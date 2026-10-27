// SaaS gider tablosu (T2.6, M-29): kurulum başına aylık sabit ve müşteri başı gider, TL çevirisi, bilinmeyenin yayılması,
// alt sınır, sınıf ve satırların çeviri anahtarları. Beklenen sayılar fiyat sayfalarından (20 USD, 49,5523 TL/USD), işlevden değil.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildDemo } from "@/db/seed";
import { SAAS_ITEMS, saasStageSummary, type SaasCostLine, type UsdTry } from "@/domain/calc";
import { CalcError, Decimal, RESULT_CLASSES, weakestClass, type ResultClass } from "@/domain/result";
import en from "../../../messages/en.json";
import tr from "../../../messages/tr.json";

const seedRows = buildDemo(new Date("2026-10-29T15:00:00Z")).saasCosts;
const seedLines: SaasCostLine[] = seedRows.map((r) => ({
  key: r.key,
  stage: r.stage,
  item: r.item as SaasCostLine["item"],
  monthly: r.monthlyCost ?? null,
  perCustomer: r.perCustomerCost ?? null,
  unitPrice: r.unitPrice ?? null,
  currency: r.currency ?? "TRY",
  taxBasis: r.taxBasis ?? "excl_vat",
  resultClass: r.resultClass,
}));
const TCMB: UsdTry = { rate: "49.5523", resultClass: "sourced_estimate" };
const str = (d: Decimal | null) => (d === null ? null : d.toString());

describe("seed'deki fiyatlarla", () => {
  it("bugünkü demo kurulumu: aylık sabit 0 TL, müşteri başı 0 TL; ikisi de kaynaklı tahmin", () => {
    const s = saasStageSummary(seedLines, "demo", TCMB);
    expect(s.lines.map((l) => l.key)).toEqual(["vercel_hobby", "neon_free", "openfreemap", "github_actions"]);
    for (const total of [s.monthly, s.perCustomer]) {
      expect(str(total.value)).toBe("0");
      expect(total).toMatchObject({ atLeast: null, unknown: [], fxUnknown: false, resultClass: "sourced_estimate" });
    }
  });

  it("ticari kurulum: aylık sabit en az 20 USD × 49,5523 = 991,046 TL, alan adı bilinmiyor; müşteri başı bilinmiyor", () => {
    const s = saasStageSummary(seedLines, "commercial", TCMB);
    expect(s.lines.map((l) => l.key)).toEqual(["vercel_pro", "neon_launch_compute", "neon_launch_storage", "openfreemap", "github_actions", "domain"]);
    expect(s.monthly.value).toBeNull();
    expect(str(s.monthly.atLeast)).toBe("991.046");
    expect(s.monthly.unknown).toEqual(["domain"]);
    // Bilinen kısım 0: alt sınır bilgi taşımaz, yazılmaz.
    expect(s.perCustomer).toMatchObject({ value: null, atLeast: null, unknown: ["vercel_pro", "neon_launch_compute", "neon_launch_storage"] });
    expect(s.monthly.resultClass).toBe("sourced_estimate");
  });

  it("her satırın çeviri anahtarı iki dilde var; anahtarlar tekil; her fiyat https kaynaklı ve tarihli", () => {
    const keys = seedRows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const m of [tr, en]) {
      for (const r of seedRows) {
        expect(m.saasCosts.notes, r.key).toHaveProperty(r.key);
        expect(m.saasCosts.items, r.item).toHaveProperty(r.item);
        if (r.usageUnit) expect(m.saasCosts.units, r.usageUnit).toHaveProperty(r.usageUnit);
        expect(r.sourceUrl).toMatch(/^https:\/\//);
        expect(r.retrievedAt).toBeInstanceOf(Date);
      }
      for (const i of SAAS_ITEMS) expect(m.saasCosts.items).toHaveProperty(i);
    }
    // Kullanıma bağlı satırın birim fiyatı ve birimi birlikte gelir.
    for (const r of seedRows) expect(r.unitPrice == null, r.key).toBe(r.usageUnit == null);
  });
});

const amount = fc.option(fc.integer({ min: 0, max: 1_000_000 }).map((c) => new Decimal(c).div(100).toString()), { nil: null, freq: 4 });
const lineArb = fc.record({
  stage: fc.constantFrom("demo", "commercial", "both") as fc.Arbitrary<SaasCostLine["stage"]>,
  item: fc.constantFrom(...SAAS_ITEMS),
  monthly: amount,
  perCustomer: amount,
  unitPrice: amount,
  currency: fc.constantFrom("USD", "TRY") as fc.Arbitrary<SaasCostLine["currency"]>,
  resultClass: fc.constantFrom(...RESULT_CLASSES),
});
const linesArb = fc.array(lineArb, { minLength: 1, maxLength: 12 }).map((ls) => ls.map((l, i) => ({ ...l, key: `k${i}`, taxBasis: "excl_vat" as const })));
const fxArb = fc.record({
  rate: fc.option(fc.integer({ min: 1, max: 1_000_000 }).map((c) => new Decimal(c).div(10_000).toString()), { nil: null, freq: 5 }),
  resultClass: fc.constantFrom(...RESULT_CLASSES),
});

/** Bağımsız hesap: kalemleri tek tek TL'ye çevirip toplar. */
function expected(lines: SaasCostLine[], pick: "monthly" | "perCustomer", fx: UsdTry) {
  let known = new Decimal(0);
  let fxUnknown = false;
  const classes: ResultClass[] = [];
  const unknown: string[] = [];
  for (const l of lines) {
    classes.push(l.resultClass);
    const v = l[pick];
    if (v === null) {
      unknown.push(l.key);
      continue;
    }
    if (l.currency === "USD") {
      classes.push(fx.resultClass);
      if (fx.rate === null) fxUnknown = true;
      else known = known.plus(new Decimal(v).mul(fx.rate));
    } else known = known.plus(v);
  }
  return { known, unknown, fxUnknown, resultClass: weakestClass(classes) };
}

describe("rastgele kalemlerle", () => {
  it("kurulum kendi kalemlerini ve ortak kalemleri alır; öbür kurulumunkini almaz; sıra kalem sırasıdır", () => {
    fc.assert(
      fc.property(linesArb, (lines) => {
        for (const stage of ["demo", "commercial"] as const) {
          const own = lines.filter((l) => l.stage === stage || l.stage === "both");
          if (own.length === 0) {
            expect(() => saasStageSummary(lines, stage, TCMB)).toThrow(CalcError);
            continue;
          }
          const s = saasStageSummary(lines, stage, TCMB);
          expect(new Set(s.lines.map((l) => l.key))).toEqual(new Set(own.map((l) => l.key)));
          const order = s.lines.map((l) => SAAS_ITEMS.indexOf(l.item));
          expect(order).toEqual([...order].sort((a, b) => a - b));
        }
      }),
      { numRuns: 300 },
    );
  });

  it("toplam: hepsi biliniyorsa tam toplam; biri bilinmiyorsa null, bilinen kısım > 0 ise alt sınır; kur yoksa dolar tutarı TL'de bilinmiyor", () => {
    fc.assert(
      fc.property(linesArb, fxArb, (lines, fx) => {
        for (const stage of ["demo", "commercial"] as const) {
          const own = lines.filter((l) => l.stage === stage || l.stage === "both");
          if (own.length === 0) continue;
          const s = saasStageSummary(lines, stage, fx);
          for (const pick of ["monthly", "perCustomer"] as const) {
            const e = expected(s.lines, pick, fx);
            const got = s[pick];
            expect(got.unknown).toEqual(e.unknown);
            expect(got.fxUnknown).toBe(e.fxUnknown);
            expect(got.resultClass).toBe(e.resultClass);
            if (e.unknown.length === 0 && !e.fxUnknown) {
              expect(str(got.value)).toBe(e.known.toString());
              expect(got.atLeast).toBeNull();
            } else {
              // Bilinmeyen asla 0 olmaz.
              expect(got.value).toBeNull();
              expect(str(got.atLeast)).toBe(e.unknown.length > 0 && !e.fxUnknown && e.known.gt(0) ? e.known.toString() : null);
            }
          }
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe("geçersiz girdi", () => {
  const base: SaasCostLine = { key: "a", stage: "both", item: "hosting", monthly: "1", perCustomer: "0", unitPrice: null, currency: "USD", taxBasis: "excl_vat", resultClass: "sourced_estimate" };
  const code = (lines: SaasCostLine[]) => {
    try {
      saasStageSummary(lines, "demo", TCMB);
      return null;
    } catch (e) {
      return (e as CalcError).code;
    }
  };
  it("kuru tutulmayan para birimi, karışık vergi temeli, eksi tutar ya da birim fiyat, bilinmeyen kalem ve boş kurulum hata verir", () => {
    expect(code([base])).toBeNull();
    expect(code([{ ...base, currency: "EUR" }])).toBe("currency_mismatch");
    expect(code([base, { ...base, key: "b", taxBasis: "incl_vat" }])).toBe("tax_basis_mismatch");
    expect(code([{ ...base, monthly: "-0.01" }])).toBe("invalid_input");
    expect(code([{ ...base, perCustomer: "-5" }])).toBe("invalid_input");
    expect(code([{ ...base, unitPrice: "-0.1" }])).toBe("invalid_input");
    expect(code([{ ...base, item: "email" as SaasCostLine["item"] }])).toBe("invalid_input");
    expect(code([{ ...base, stage: "commercial" }])).toBe("no_inputs");
  });

  it("tutarı bilinmeyen kalemin para birimi çevrilmez; yalnızca adı listelenir", () => {
    const s = saasStageSummary([{ ...base, monthly: null, perCustomer: null, currency: "EUR" }], "demo", TCMB);
    for (const total of [s.monthly, s.perCustomer]) expect(total).toMatchObject({ value: null, atLeast: null, unknown: ["a"] });
  });
});
