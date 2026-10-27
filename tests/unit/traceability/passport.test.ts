// Pasaportun alan kuralları (T2.4, D-025): etiket çapası, zincir rolleri, açık olay süzgeci, lif payları.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Decimal } from "@/domain/result";
import {
  anchorStatus,
  byRole,
  chainRole,
  fibreRows,
  formatAnchor,
  isLotCode,
  kgText,
  lotAnchor,
  nextEvent,
  parseAnchor,
  passportOk,
  publicEvent,
  publicVerdict,
  splitByComposition,
  verifyChain,
  type ChainedEvent,
  type EventBody,
} from "@/domain/traceability";

const HEX = "0123456789abcdef";
const hex64 = fc.string({ unit: fc.constantFrom(...HEX), minLength: 64, maxLength: 64 });

/** Üretici zinciri: iki kabul, lotu üreten dönüşüm, sonra bir sevk. */
function chain(note = "Kantar tartımı"): ChainedEvent[] {
  const bodies: Omit<EventBody, "seq">[] = [
    { orgId: "R", type: "object", bizStep: "receiving", eventTime: "2026-10-01T08:00:00Z", payload: { inputs: [], outputs: [{ ref: "WB-2026-0001", kg: kgText(500) }], evidenceIds: ["ev-1"], note } },
    { orgId: "R", type: "object", bizStep: "receiving", eventTime: "2026-10-02T08:00:00Z", payload: { inputs: [], outputs: [{ ref: "WB-2026-0002", kg: kgText(300) }], evidenceIds: [], note } },
    {
      orgId: "R",
      type: "transformation",
      bizStep: "transforming",
      eventTime: "2026-10-05T08:00:00Z",
      payload: {
        inputs: [
          { ref: "WB-2026-0001", kg: kgText(500) },
          { ref: "WB-2026-0002", kg: kgText(300) },
        ],
        outputs: [
          { ref: "PB-2026-01", kg: kgText(700) },
          { ref: "PL-2026-001", kg: kgText(400) },
          { ref: "PL-2026-002", kg: kgText(300) },
        ],
        evidenceIds: [],
        note: "Bağlayıcı: pMDI",
      },
    },
    { orgId: "R", type: "transaction", bizStep: "shipping", eventTime: "2026-10-09T08:00:00Z", payload: { inputs: [{ ref: "PL-2026-001", kg: kgText(200) }], outputs: [], evidenceIds: ["inv-1"], note: "18 levha" } },
  ];
  const out: ChainedEvent[] = [];
  for (const b of bodies) out.push(nextEvent(out.at(-1) ?? null, b));
  return out;
}

describe("etiket çapası", () => {
  it("biçim gidiş-dönüşü: formatAnchor ∘ parseAnchor kimliktir; büyük harf küçültülür", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999_999_999 }), hex64, (count, head) => {
        const a = { count, head };
        expect(parseAnchor(formatAnchor(a))).toEqual(a);
        expect(parseAnchor(formatAnchor(a).toUpperCase())).toEqual(a);
      }),
    );
  });

  it("bozuk çapalar reddedilir", () => {
    const h = "a".repeat(64);
    for (const bad of [null, undefined, "", "1", `0-${h}`, `01-${h}`, `-1-${h}`, `1-${h.slice(1)}`, `1-${h}0`, `1-${h.slice(1)}g`, ` 1-${h}`, `1-${h} `, `1_${h}`, `1000000000-${h}`])
      expect(parseAnchor(bad), String(bad)).toBeNull();
  });

  it("lotun çapası lotu ilk çıktı olarak yazan olaydır; çapa zincirle doğrulanır", () => {
    const c = chain();
    expect(lotAnchor(c, "PL-2026-001")).toEqual({ count: 3, head: c[2].hash });
    expect(lotAnchor(c, "PL-2026-002")).toEqual({ count: 3, head: c[2].hash });
    expect(lotAnchor(c, "PL-2026-999")).toBeNull();
    expect(verifyChain(c, lotAnchor(c, "PL-2026-001")!)).toMatchObject({ ok: true, count: 4 });
  });

  it("geçmişi baştan yeniden yazan saldırgan zincirde görünmez, etiket çapasında yakalanır", () => {
    const label = lotAnchor(chain(), "PL-2026-001")!;
    // Aynı olaylar, ilk olayın notu değişmiş ve bütün hash'ler yeniden hesaplanmış: zincir kendi içinde tutarlı.
    const rewritten = chain("Kantar tartımı (düzeltildi)");
    expect(verifyChain(rewritten).ok).toBe(true);
    expect(verifyChain(rewritten, label)).toEqual({ ok: false, brokenAt: 3, reason: "anchor_mismatch" });
  });

  it("çapa durumu: yok, okunamadı, eşleşti, eşleşmedi, denetlenemedi", () => {
    const c = chain();
    const good = formatAnchor(lotAnchor(c, "PL-2026-001")!);
    expect(anchorStatus(null, verifyChain(c))).toBe("missing");
    expect(anchorStatus("zzz", verifyChain(c))).toBe("invalid");
    expect(anchorStatus(good, verifyChain(c, parseAnchor(good)!))).toBe("matched");
    const wrong = { count: 3, head: "f".repeat(64) };
    expect(anchorStatus(formatAnchor(wrong), verifyChain(c, wrong))).toBe("mismatch");
    const tampered = c.map((e, i) => (i === 0 ? { ...e, payload: { ...e.payload, note: "x" } } : e));
    expect(anchorStatus(good, verifyChain(tampered, parseAnchor(good)!))).toBe("unchecked");
  });
});

describe("zincirler", () => {
  it("rol: lot sahibi üretici, parti sağlayıcısı sağlayıcı, diğerleri alıcı; sıra üretici → sağlayıcı → alıcı", () => {
    const s = new Set(["A", "B"]);
    expect(chainRole("R", "R", s)).toBe("producer");
    expect(chainRole("A", "R", s)).toBe("supplier");
    expect(chainRole("F", "R", s)).toBe("buyer");
    // Üretici kendi partisinin sağlayıcısı da olsa üreticidir.
    expect(chainRole("R", "R", new Set(["R"]))).toBe("producer");
    const xs = [{ role: "buyer" as const }, { role: "supplier" as const }, { role: "producer" as const }];
    expect(xs.sort(byRole).map((x) => x.role)).toEqual(["producer", "supplier", "buyer"]);
  });

  it("adı paylaşılmayan zincirin sağlam hükmü sayı ve uç taşımaz; kırılma her zaman yerini söyler", () => {
    const ok = verifyChain(chain());
    expect(publicVerdict(ok, true)).toEqual(ok);
    expect(publicVerdict(ok, false)).toEqual({ ok: true });
    const bad = { ok: false as const, brokenAt: 2, reason: "hash_mismatch" as const };
    expect(publicVerdict(bad, false)).toEqual(bad);
    expect(anchorStatus("1-" + "a".repeat(64), { ok: true })).toBe("matched");
  });

  it("pasaport ancak zincir varsa ve hepsi sağlamsa doğrulanmış sayılır", () => {
    const ok = { verdict: verifyChain(chain()) };
    const bad = { verdict: { ok: false as const, brokenAt: 2, reason: "hash_mismatch" as const } };
    expect(passportOk([])).toBe(false);
    expect(passportOk([ok])).toBe(true);
    expect(passportOk([ok, bad])).toBe(false);
  });
});

describe("açık olay", () => {
  const refs = new Set(["PL-2026-001", "PB-2026-01", "WB-2026-0001", "WB-2026-0002"]);

  it("not ve kanıt kimliği çıkar; soy ağacı dışındaki nesne (kardeş lot) süzülür; zaman ISO", () => {
    const e = publicEvent(chain()[2], refs);
    expect(e).toEqual({
      seq: 3,
      type: "transformation",
      bizStep: "transforming",
      eventTime: "2026-10-05T08:00:00.000Z",
      inputs: [
        { ref: "WB-2026-0001", kg: "500.000" },
        { ref: "WB-2026-0002", kg: "300.000" },
      ],
      outputs: [
        { ref: "PB-2026-01", kg: "700.000" },
        { ref: "PL-2026-001", kg: "400.000" },
      ],
      hash: chain()[2].hash,
    });
  });

  it("adı paylaşılmayan zincirin olayı sıra numarası ve hash taşımaz", () => {
    const e = publicEvent(chain()[3], refs, false);
    expect(e).toMatchObject({ seq: null, hash: null, bizStep: "shipping", inputs: [{ ref: "PL-2026-001", kg: "200.000" }] });
  });

  it("hiçbir not ya da kanıt kimliği açık olayın JSON'una sızmaz", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 8 }), fc.uuid(), (note, ev) => {
        const c = chain(note).map((e) => ({ ...e, payload: { ...e.payload, evidenceIds: [ev] } }));
        const out = JSON.stringify(c.map((e) => publicEvent(e, refs)));
        expect(out.includes(ev)).toBe(false);
        expect(out.includes(JSON.stringify(note).slice(1, -1))).toBe(false);
      }),
      { numRuns: 200 },
    );
  });
});

describe("lif bileşimi satırları", () => {
  it("büyükten küçüğe, bilinmeyen en sonda, paylar toplamı 1; sıfır lif yazılmaz", () => {
    const kg = splitByComposition(new Decimal(1000), { cotton: 30, polyester: 60 });
    const rows = fibreRows(kg)!;
    expect(rows.map((r) => r.fibre)).toEqual(["polyester", "cotton", "unknown"]);
    expect(rows.map((r) => r.share!.toString())).toEqual(["0.6", "0.3", "0.1"]);
  });

  it("rastgele bileşimlerde paylar toplamı tam 1, kg toplamı korunur", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), fc.array(fc.integer({ min: 0, max: 33 }), { minLength: 3, maxLength: 3 }), (total, [c, p, v]) => {
        const kg = splitByComposition(new Decimal(total), { cotton: c, polyester: p, viscose: v });
        const rows = fibreRows(kg)!;
        const sumKg = rows.reduce((a, r) => a.plus(r.kg), new Decimal(0));
        const sumShare = rows.reduce((a, r) => a.plus(r.share!), new Decimal(0));
        expect(sumKg.eq(total)).toBe(true);
        expect(sumShare.minus(1).abs().lt("1e-20")).toBe(true);
        // Toplam en çok %99: bilinmeyen pay her zaman var ve en sonda.
        expect(rows.at(-1)!.fibre).toBe("unknown");
      }),
    );
  });

  it("bilinmeyen dağılım null kalır; boş dağılım satır vermez", () => {
    expect(fibreRows(null)).toBeNull();
    expect(fibreRows(splitByComposition(new Decimal(0), null))).toEqual([]);
  });
});

it("lot kodu biçimi", () => {
  for (const ok of ["PL-2026-001", "PL-2026-1234"]) expect(isLotCode(ok)).toBe(true);
  for (const bad of ["", "PL-2026-01", "pl-2026-001", "PL-26-001", "WB-2026-0001", "PL-2026-001 ", "PL-2026-001/x", "../PL-2026-001"]) expect(isLotCode(bad)).toBe(false);
});
