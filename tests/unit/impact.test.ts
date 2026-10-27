import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { classOf, impactSummary, kgTotal, monthsBack, type ImpactBatch, type ImpactProduction } from "@/domain/impact";
import { Decimal } from "@/domain/result";

const now = new Date("2026-10-27T12:00:00Z");
const batch = (o: Partial<ImpactBatch> & Pick<ImpactBatch, "id">): ImpactBatch => ({
  orgId: "R",
  supplierOrgId: "A",
  receivedAt: new Date("2026-10-10T09:00:00Z"),
  declaredKg: "1000",
  weighedKg: "980",
  rejectedKg: "30",
  verified: true,
  resultClass: "synthetic",
  ...o,
});

describe("kgTotal: bilinmeyen 0 sayılmaz", () => {
  it("kalem yoksa bilinen sıfır; hepsi bilinmiyorsa null; karışıksa alt sınır ve bilinmeyen sayısı", () => {
    expect(kgTotal([])).toEqual({ kg: new Decimal(0), unknown: 0, count: 0 });
    expect(kgTotal([null, null])).toEqual({ kg: null, unknown: 2, count: 2 });
    const t = kgTotal(["1.5", null, "2"]);
    expect(t.kg!.toString()).toBe("3.5");
    expect(t).toMatchObject({ unknown: 1, count: 3 });
  });

  it("özellik: kg yalnızca bilinenlerin toplamı; null yalnızca hepsi bilinmiyorken", () => {
    fc.assert(
      fc.property(fc.array(fc.option(fc.integer({ min: 0, max: 1_000_000 }), { nil: null })), (xs) => {
        const t = kgTotal(xs);
        const known = xs.filter((x): x is number => x !== null);
        expect(t.unknown).toBe(xs.length - known.length);
        if (xs.length > 0 && known.length === 0) expect(t.kg).toBeNull();
        else expect(t.kg!.toNumber()).toBe(known.reduce((a, b) => a + b, 0));
      }),
    );
  });
});

describe("classOf", () => {
  it("kayıt yoksa sınıf da yok; varsa en zayıfı", () => {
    expect(classOf([])).toBeNull();
    expect(classOf([{ resultClass: "realized" }, { resultClass: "sourced_estimate" }])).toBe("sourced_estimate");
    expect(classOf([{ resultClass: "realized" }], "pilot_projection")).toBe("pilot_projection");
  });
});

describe("monthsBack: Türkiye takvimine göre aylar", () => {
  it("yıl sınırını geçer", () => expect(monthsBack(new Date("2026-01-15T12:00:00Z"), 3)).toEqual(["2025-11", "2025-12", "2026-01"]));
  it("UTC 31 Ekim 22:00 İstanbul'da 1 Kasım'dır", () => expect(monthsBack(new Date("2026-10-31T22:00:00Z"), 1)).toEqual(["2026-11"]));
});

describe("impactSummary", () => {
  const supplier = (b: ImpactBatch) => b.supplierOrgId;

  it("parti yoksa özet yok: 0 kg yazmak kurumun bu akışta kaydı olmadığını gizler", () => {
    expect(impactSummary([], null, supplier, now)).toBeNull();
  });

  it("doğrulanmış ve beyan edilen ayrı; doğrulanmamış parti doğrulanmış toplama girmez", () => {
    const s = impactSummary(
      [
        batch({ id: "1" }), // kabul 950
        batch({ id: "2", supplierOrgId: "B", verified: false, declaredKg: "500", weighedKg: "490", rejectedKg: "0" }),
        batch({ id: "3", supplierOrgId: "C", declaredKg: null }), // beyan yok: beyan toplamında bilinmiyor
      ],
      null,
      supplier,
      now,
    )!;
    expect(s.verified.kg!.toString()).toBe("1900");
    expect(s.declared.kg!.toString()).toBe("1500");
    expect(s.declared.unknown).toBe(1);
    expect(s).toMatchObject({ batches: 3, verifiedBatches: 2 });
    expect(s.inPanel).toBeUndefined();
  });

  it("ayıklanan bilinmiyorsa kabul edilen de bilinmiyor: toplam alt sınır olur", () => {
    const s = impactSummary([batch({ id: "1" }), batch({ id: "2", rejectedKg: null })], null, supplier, now)!;
    expect(s.verified.kg!.toString()).toBe("950");
    expect(s.verified.unknown).toBe(1);
  });

  it("kaynak dağılımı büyükten küçüğe, paylar toplamı 1", () => {
    const s = impactSummary(
      [batch({ id: "1" }), batch({ id: "2", supplierOrgId: "B", weighedKg: "2000", rejectedKg: "0" }), batch({ id: "3" })],
      null,
      supplier,
      now,
    )!;
    expect(s.byCounterparty.map((r) => r.orgId)).toEqual(["B", "A"]);
    expect(s.byCounterparty.reduce((a, r) => a.plus(r.share!), new Decimal(0)).toString()).toBe("1");
  });

  it("aylık trend en çok 6 ay, Türkiye ayına göre; boş ay bilinen sıfır", () => {
    const s = impactSummary(
      [
        batch({ id: "1", receivedAt: new Date("2026-09-30T22:30:00Z") }), // İstanbul'da 1 Ekim
        batch({ id: "2", receivedAt: new Date("2026-09-15T09:00:00Z") }),
        batch({ id: "3", receivedAt: new Date("2026-01-15T09:00:00Z") }), // pencere dışında
      ],
      null,
      supplier,
      now,
    )!;
    expect(s.monthly.map((m) => m.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(s.monthly.map((m) => m.verified.kg!.toString())).toEqual(["0", "0", "0", "0", "950", "950"]);
  });

  it("trend ilk kaydın ayından başlar; doğrulanmamış ilk parti de başlangıçtır", () => {
    const s = impactSummary(
      [batch({ id: "1", receivedAt: new Date("2026-08-31T21:30:00Z"), verified: false }), batch({ id: "2", receivedAt: new Date("2026-10-02T09:00:00Z") })],
      null,
      supplier,
      now,
    )!;
    // UTC 31 Ağustos 21:30 İstanbul'da 1 Eylül'dür.
    expect(s.monthly.map((m) => m.month)).toEqual(["2026-09", "2026-10"]);
    expect(s.monthly.map((m) => m.verified.kg!.toString())).toEqual(["0", "950"]);
  });

  it("panele giren: yalnızca lotu olan üretimlerin tahsisi; üretimi olmayan kurumda alan yok", () => {
    const productions: ImpactProduction[] = [
      { id: "p1", hasLot: true, inputs: [{ allocatedKg: "600", resultClass: "synthetic" }, { allocatedKg: "400", resultClass: "synthetic" }], resultClass: "synthetic" },
      { id: "p2", hasLot: false, inputs: [{ allocatedKg: "700", resultClass: "synthetic" }], resultClass: "synthetic" },
    ];
    const s = impactSummary([batch({ id: "1" })], productions, supplier, now)!;
    expect(s.inPanel!.kg!.toString()).toBe("1000");
    expect(s.inPanel!.resultClass).toBe("synthetic");
    expect(impactSummary([batch({ id: "1" })], [], supplier, now)!.inPanel).toBeUndefined();
  });

  it("sınıf partilerin en zayıfı", () => {
    const s = impactSummary([batch({ id: "1", resultClass: "realized" }), batch({ id: "2", resultClass: "synthetic" })], null, supplier, now)!;
    expect(s.resultClass).toBe("synthetic");
  });
});
