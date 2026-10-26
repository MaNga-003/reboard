// M-6: değiştirilen, silinen, eklenen ya da yer değiştiren her olay verifyChain'de yakalanır (0 kaçak).
import { createHash } from "node:crypto";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BIZ_STEPS,
  canonicalJson,
  EVENT_TYPES,
  GENESIS_HASH,
  hashEvent,
  kgText,
  nextEvent,
  verifyChain,
  type ChainedEvent,
  type EventBody,
} from "@/domain/traceability";

const ORG = "org-a";
const draft = fc.record({
  orgId: fc.constant(ORG),
  type: fc.constantFrom(...EVENT_TYPES),
  bizStep: fc.constantFrom(...BIZ_STEPS),
  eventTime: fc.date({ min: new Date("2026-01-01"), max: new Date("2027-01-01"), noInvalidDate: true }),
  payload: fc.record({
    inputs: fc.array(fc.record({ ref: fc.string({ minLength: 1, maxLength: 6 }), kg: fc.integer({ min: 0, max: 10_000_000 }).map((g) => kgText(g / 1000)) }), {
      maxLength: 3,
    }),
    outputs: fc.array(fc.record({ ref: fc.string({ minLength: 1, maxLength: 6 }), kg: fc.integer({ min: 0, max: 10_000_000 }).map((g) => kgText(g / 1000)) }), {
      maxLength: 3,
    }),
    evidenceIds: fc.array(fc.uuid(), { maxLength: 2 }),
  }),
}) satisfies fc.Arbitrary<Omit<EventBody, "seq">>;

const build = (drafts: Omit<EventBody, "seq">[]) =>
  drafts.reduce<ChainedEvent[]>((chain, d) => [...chain, nextEvent(chain.at(-1) ?? null, d)], []);
const chain = fc.array(draft, { minLength: 1, maxLength: 12 }).map(build);

// Saldırganın tek bir olayda yapabileceği değişiklikler. Her biri k. olayda brokenAt = k vermeli.
const TAMPERS: Record<string, (e: ChainedEvent) => ChainedEvent> = {
  kg: (e) => ({ ...e, payload: { ...e.payload, outputs: [...e.payload.outputs, { ref: "x", kg: "1.000" }] } }),
  girdi: (e) => ({ ...e, payload: { ...e.payload, inputs: [{ ref: "sahte", kg: "999.000" }] } }),
  kanit: (e) => ({ ...e, payload: { ...e.payload, evidenceIds: [...e.payload.evidenceIds, "00000000-0000-4000-8000-000000000000"] } }),
  zaman: (e) => ({ ...e, eventTime: new Date(new Date(e.eventTime).getTime() + 1) }),
  tur: (e) => ({ ...e, type: e.type === "object" ? "transaction" : "object" }),
  adim: (e) => ({ ...e, bizStep: e.bizStep === "receiving" ? "shipping" : "receiving" }),
  sira: (e) => ({ ...e, seq: e.seq + 100 }),
  onceki: (e) => ({ ...e, prevHash: "f".repeat(64) }),
  hash: (e) => ({ ...e, hash: "e".repeat(64) }),
  org: (e) => ({ ...e, orgId: "org-b" }),
};
// İlk olayın organizasyonu zincirin organizasyonu sayılır; orada org değişikliğini hash yakalar.
const reasonOf = (kind: string, k: number) =>
  ({ sira: "seq_gap", onceki: "prev_hash_mismatch", org: k === 0 ? "hash_mismatch" : "org_mismatch" })[kind] ?? "hash_mismatch";

/** Sıra numarasına dokunmadan zinciri `prev`'den itibaren yeniden bağlar (tetikleyiciyi atlayan saldırgan). */
const rechain = (events: ChainedEvent[], prev: string) =>
  events.map((e) => {
    const linked = { ...e, prevHash: prev, hash: hashEvent(e, prev) };
    prev = linked.hash;
    return linked;
  });

describe("hashEvent", () => {
  it("bağımsız uygulamayla (node:crypto) aynı sonucu verir", () => {
    fc.assert(
      fc.property(chain, (c) => {
        for (const e of c) {
          const { orgId, seq, type, bizStep, eventTime, payload } = e;
          const text = canonicalJson({ orgId, seq, type, bizStep, eventTime: new Date(eventTime).toISOString(), payload }) + e.prevHash;
          expect(e.hash).toBe(createHash("sha256").update(text, "utf8").digest("hex"));
        }
      }),
    );
  });

  it("ilk olay GENESIS_HASH'e bağlanır, sıra 1'den başlar", () => {
    fc.assert(
      fc.property(chain, (c) => {
        expect(c[0].seq).toBe(1);
        expect(c[0].prevHash).toBe(GENESIS_HASH);
      }),
    );
  });

  it("Date ya da ISO metni aynı hash'i verir; geçersiz zaman hata verir", () => {
    const body: EventBody = { orgId: ORG, seq: 1, type: "object", bizStep: "receiving", eventTime: new Date("2026-10-27T10:00:00.123Z"), payload: { inputs: [], outputs: [], evidenceIds: [] } };
    expect(hashEvent(body, GENESIS_HASH)).toBe(hashEvent({ ...body, eventTime: "2026-10-27T13:00:00.123+03:00" }, GENESIS_HASH));
    expect(() => hashEvent({ ...body, eventTime: "dün" }, GENESIS_HASH)).toThrow(RangeError);
  });

  it("başka organizasyonun ucuna olay eklenemez", () => {
    const [first] = build([{ orgId: ORG, type: "object", bizStep: "receiving", eventTime: new Date(0), payload: { inputs: [], outputs: [], evidenceIds: [] } }]);
    expect(() => nextEvent(first, { ...first, orgId: "org-b" })).toThrow(/organizasyonu farklı/);
  });
});

describe("verifyChain", () => {
  it("dokunulmamış zincir doğrulanır", () => {
    fc.assert(
      fc.property(chain, (c) => {
        expect(verifyChain(c)).toEqual({ ok: true, count: c.length, head: c.at(-1)!.hash });
        expect(verifyChain(c, { count: c.length, head: c.at(-1)!.hash }).ok).toBe(true);
      }),
    );
  });

  it("boş zincir geçerlidir, ucu GENESIS_HASH'tir", () => {
    expect(verifyChain([])).toEqual({ ok: true, count: 0, head: GENESIS_HASH });
    expect(verifyChain([], { count: 0, head: GENESIS_HASH }).ok).toBe(true);
  });

  it("tek bir olayda yapılan her değişiklik tam o olayda yakalanır (0 kaçak)", () => {
    let trials = 0;
    fc.assert(
      fc.property(chain, fc.nat(), fc.constantFrom(...Object.keys(TAMPERS)), (c, i, kind) => {
        const k = i % c.length;
        const tampered = c.map((e, j) => (j === k ? TAMPERS[kind](e) : e));
        const v = verifyChain(tampered);
        trials++;
        expect(v.ok, `${kind} @${k + 1} kaçtı`).toBe(false);
        expect(v).toMatchObject({ brokenAt: k + 1, reason: reasonOf(kind, k) });
      }),
      { numRuns: 500 },
    );
    expect(trials).toBe(500);
  });

  it("aradan olay silinmesi, yer değiştirme ve araya sahte olay eklenmesi yakalanır", () => {
    fc.assert(
      fc.property(fc.array(draft, { minLength: 3, maxLength: 12 }).map(build), fc.nat(), draft, (c, i, extra) => {
        const k = i % (c.length - 1); // son olay değil
        const deleted = c.filter((_, j) => j !== k);
        expect(verifyChain(deleted)).toMatchObject({ ok: false, brokenAt: k + 1 });

        const swapped = [...c];
        [swapped[k], swapped[k + 1]] = [swapped[k + 1], swapped[k]];
        expect(verifyChain(swapped)).toMatchObject({ ok: false, brokenAt: k + 1 });

        // Saldırgan k. olaydan sonra doğru hash'li bir olay ekler; sonraki asıl olay artık uymaz.
        const forged = nextEvent(c[k], extra);
        const inserted = [...c.slice(0, k + 1), forged, ...c.slice(k + 1)];
        expect(verifyChain(inserted)).toMatchObject({ ok: false, brokenAt: k + 3 });
      }),
    );
  });

  it("aradan silip sonrakileri sıra numarasına dokunmadan yeniden zincirleyen saldırıyı sıra denetimi yakalar", () => {
    fc.assert(
      fc.property(fc.array(draft, { minLength: 3, maxLength: 12 }).map(build), fc.nat(), (c, i) => {
        const k = i % (c.length - 1);
        const forged = [...c.slice(0, k), ...rechain(c.slice(k + 1), k === 0 ? GENESIS_HASH : c[k - 1].hash)];
        expect(verifyChain(forged)).toEqual({ ok: false, brokenAt: k + 1, reason: "seq_gap" });
      }),
    );
  });

  it("başka organizasyonun olaylarıyla yeniden zincirlenen kuyruğu organizasyon denetimi yakalar", () => {
    fc.assert(
      fc.property(fc.array(draft, { minLength: 2, maxLength: 12 }).map(build), fc.nat(), (c, i) => {
        const k = (i % (c.length - 1)) + 1;
        const tail = c.slice(k).map((e) => ({ ...e, orgId: "org-b" }));
        expect(verifyChain([...c.slice(0, k), ...rechain(tail, c[k - 1].hash)])).toEqual({ ok: false, brokenAt: k + 1, reason: "org_mismatch" });
      }),
    );
  });

  it("sonraki bütün hash'leri yeniden hesaplayan saldırıyı ve sondan silmeyi yalnızca çapa yakalar", () => {
    fc.assert(
      fc.property(fc.array(draft, { minLength: 2, maxLength: 12 }).map(build), fc.nat(), (c, i) => {
        const anchor = { count: c.length, head: c.at(-1)!.hash };
        const k = i % c.length;
        // k. olayın kg'ı değiştirilir ve zincir oradan sonra baştan hesaplanır.
        const drafts = c.map((e, j) => (j === k ? TAMPERS.kg(e) : e));
        const rewritten = build(drafts.map(({ orgId, type, bizStep, eventTime, payload }) => ({ orgId, type, bizStep, eventTime, payload })));
        expect(verifyChain(rewritten).ok).toBe(true); // zincir tek başına yakalayamaz (bilinen sınır)
        expect(verifyChain(rewritten, anchor)).toMatchObject({ ok: false, reason: "anchor_mismatch", brokenAt: c.length });

        const truncated = c.slice(0, -1);
        expect(verifyChain(truncated).ok).toBe(true);
        expect(verifyChain(truncated, anchor)).toMatchObject({ ok: false, reason: "anchor_mismatch", brokenAt: c.length });
      }),
    );
  });

  it("zincir çapadan sonra büyüyebilir", () => {
    fc.assert(
      fc.property(fc.array(draft, { minLength: 2, maxLength: 12 }).map(build), fc.nat(), (c, i) => {
        const n = (i % (c.length - 1)) + 1;
        expect(verifyChain(c, { count: n, head: c[n - 1].hash }).ok).toBe(true);
      }),
    );
  });
});
