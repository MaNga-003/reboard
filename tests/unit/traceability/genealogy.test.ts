import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FIBRES } from "@/domain/fibre";
import { CalcError, Decimal } from "@/domain/result";
import { genealogy, splitByComposition, type TraceGraph } from "@/domain/traceability";

// Üç sağlayıcı, bir üretim partisi (1.000 kg girdi), iki lot (40 ve 60 m²).
const graph = (): TraceGraph => ({
  wastes: [
    { id: "w1", code: "WB-1", supplierOrgId: "ege", composition: { cotton: 100 }, verified: true, resultClass: "synthetic" },
    { id: "w2", code: "WB-2", supplierOrgId: "akdeniz", composition: { polyester: 60, cotton: 30 }, verified: true, resultClass: "synthetic" },
    { id: "w3", code: "WB-3", supplierOrgId: "belediye", composition: null, verified: false, resultClass: "synthetic" },
  ],
  productions: [{ id: "p1", code: "PB-1", outputKg: 900, scrapKg: 70, moistureLossKg: 20, resultClass: "synthetic" }],
  allocations: [
    { productionBatchId: "p1", wasteBatchId: "w1", allocatedKg: 400 },
    { productionBatchId: "p1", wasteBatchId: "w2", allocatedKg: 350 },
    { productionBatchId: "p1", wasteBatchId: "w3", allocatedKg: 250 },
  ],
  lots: [
    { id: "l1", code: "PL-1", productionBatchId: "p1", areaM2: 40, resultClass: "synthetic" },
    { id: "l2", code: "PL-2", productionBatchId: "p1", areaM2: 60, resultClass: "synthetic" },
  ],
});

const s = (d: Decimal | null | undefined) => d?.toString();

describe("genealogy", () => {
  it("lotun payı alan oranıdır; tekstil kg'ı, sağlayıcı ve lif dağılımı buna göre", () => {
    const r = genealogy("l1", graph());
    expect(s(r.lotShare)).toBe("0.4");
    expect(s(r.textileKg)).toBe("400");
    expect(s(r.verifiedTextileKg)).toBe("300"); // w3 doğrulanmamış
    expect(Object.fromEntries([...r.bySupplierKg!].map(([k, v]) => [k, v.toString()]))).toEqual({ ege: "160", akdeniz: "140", belediye: "100" });
    // w1 160 pamuk; w2 140 → 84 polyester, 42 pamuk, 14 bilinmiyor; w3 100 bilinmiyor.
    expect(s(r.fibreKg!.cotton)).toBe("202");
    expect(s(r.fibreKg!.polyester)).toBe("84");
    expect(s(r.fibreKg!.unknown)).toBe("114");
    expect(r.massBalance.withinTolerance).toBe(true);
    expect(r.sources.map((x) => x.waste.code)).toEqual(["WB-1", "WB-2", "WB-3"]);
  });

  it("kardeş lotun alanı bilinmiyorsa pay ve kg bilinmiyor (sıfır değil)", () => {
    const g = graph();
    g.lots[1].areaM2 = null;
    const r = genealogy("l1", g);
    expect(r.lotShare).toBeNull();
    expect(r.textileKg).toBeNull();
    expect(r.verifiedTextileKg).toBeNull();
    expect(r.fibreKg).toBeNull();
    expect(r.bySupplierKg).toBeNull();
    expect(r.sources.every((x) => x.lotKg === null)).toBe(true);
  });

  it("tek lot varsa alanı bilinmese de payı 1'dir", () => {
    const g = graph();
    g.lots = [{ ...g.lots[0], areaM2: null }];
    expect(s(genealogy("l1", g).textileKg)).toBe("1000");
  });

  it("toplam alan sıfırsa pay bilinmiyor", () => {
    const g = graph();
    g.lots.forEach((l) => (l.areaM2 = 0));
    expect(genealogy("l1", g).lotShare).toBeNull();
  });

  it("sonuç sınıfı en zayıf düğümün sınıfıdır", () => {
    const g = graph();
    g.lots[0].resultClass = "realized";
    g.productions[0].resultClass = "realized";
    g.wastes.forEach((w) => (w.resultClass = "realized"));
    expect(genealogy("l1", g).resultClass).toBe("realized");
    g.wastes[2].resultClass = "pilot_projection";
    expect(genealogy("l1", g).resultClass).toBe("pilot_projection");
  });

  it("olmayan lot, parti ya da atık partisi hata verir", () => {
    expect(() => genealogy("yok", graph())).toThrow(CalcError);
    const g = graph();
    g.allocations.push({ productionBatchId: "p1", wasteBatchId: "w9", allocatedKg: 1 });
    expect(() => genealogy("l1", g)).toThrow(/Atık partisi bulunamadı/);
  });

  it("korunum: kardeş lotların tekstil kg'ı toplamı tahsis edilen kg'a, lif kg'ları toplamı lotun kg'ına eşittir", () => {
    const pct = fc.integer({ min: 0, max: 100 });
    fc.assert(
      fc.property(
        fc.array(fc.record({ kg: fc.integer({ min: 1, max: 100_000 }), a: pct, b: pct }), { minLength: 1, maxLength: 5 }),
        fc.array(fc.integer({ min: 1, max: 500 }), { minLength: 1, maxLength: 4 }),
        (wastes, areas) => {
          const g: TraceGraph = {
            wastes: wastes.map((w, i) => ({
              id: `w${i}`,
              code: `W${i}`,
              supplierOrgId: `s${i % 2}`,
              composition: { cotton: Math.min(w.a, 100), polyester: Math.min(w.b, 100 - Math.min(w.a, 100)) },
              verified: i % 2 === 0,
              resultClass: "synthetic",
            })),
            productions: [{ id: "p", code: "P", outputKg: null, scrapKg: null, moistureLossKg: null, resultClass: "synthetic" }],
            allocations: wastes.map((w, i) => ({ productionBatchId: "p", wasteBatchId: `w${i}`, allocatedKg: w.kg })),
            lots: areas.map((a, i) => ({ id: `l${i}`, code: `L${i}`, productionBatchId: "p", areaM2: a, resultClass: "synthetic" })),
          };
          const allocated = wastes.reduce((a, w) => a + w.kg, 0);
          let total = new Decimal(0);
          for (const l of g.lots) {
            const r = genealogy(l.id, g);
            total = total.plus(r.textileKg!);
            const fibres = FIBRES.reduce((a, f) => a.plus(r.fibreKg![f]), new Decimal(0));
            expect(fibres.minus(r.textileKg!).abs().lt("1e-9")).toBe(true);
            expect(r.massBalance.withinTolerance).toBeNull(); // çıktı bilinmiyor
          }
          expect(total.minus(allocated).abs().lt("1e-9")).toBe(true);
        },
      ),
    );
  });
});

describe("splitByComposition", () => {
  it("yüzdeler toplamı 100'ü aşarsa ya da negatifse hata verir", () => {
    expect(() => splitByComposition(new Decimal(10), { cotton: 70, polyester: 40 })).toThrow(/aşıyor/);
    expect(() => splitByComposition(new Decimal(10), { cotton: -1 })).toThrow(/Negatif/);
  });

  it("bileşim yoksa hepsi bilinmiyor lifine yazılır", () => {
    expect(splitByComposition(new Decimal(10), null).unknown.toString()).toBe("10");
  });
});
