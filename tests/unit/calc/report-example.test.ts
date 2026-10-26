// Maliyet raporundaki "Sentetik model örneği" sonuçları (M-5). Beklenen sayılar raporun metninden alınmıştır;
// girdiler yeniden kurulduğu için bu test, yeniden kurulan girdilerin raporu birebir ürettiğini kilitler.
import { describe, expect, it } from "vitest";
import { REPORT_NEGATIVE_SCENARIO, REPORT_SCENARIO, runScenario } from "@/domain/calc";
import { FORMULA_VERSION } from "@/domain/result";

describe("rapor örneği: 10 t tekstil, 1.000 m² satılabilir panel, %85 kesim verimi", () => {
  const r = runScenario(REPORT_SCENARIO);

  it("tekstil fabrikası kazancı 10.000 TL", () => {
    expect(r.factory.value?.toString()).toBe("10000");
    expect(r.factory.unit).toBe("TRY");
  });

  it("panel müşterisi kazancı 31.111 TL ve teknik eşdeğerlik doğrulanmadığı için koşullu", () => {
    expect(r.customer.value?.toString()).toBe("31111");
    expect(r.customer.conditions).toContain("equivalence_unverified");
  });

  it("ReBoard faaliyet sonucu 17.500 TL, finansman ve vergi öncesi", () => {
    expect(r.reboard.value?.toString()).toBe("17500");
    expect(r.reboard.conditions).toContain("before_financing_and_tax");
  });

  it("fiyat koridoru 222,50–271,11 TL/m² ve aralık var", () => {
    expect(r.corridor.lower.value?.toFixed(2)).toBe("222.50");
    expect(r.corridor.upper.value?.toFixed(2)).toBe("271.11");
    expect(r.corridor.lower.unit).toBe("TRY/m2");
    expect(r.corridor.exists).toBe(true);
    expect(r.corridor.lower.conditions).not.toContain("no_corridor");
  });

  it("müşterinin kullanılabilir alanı 850 m²", () => {
    expect(r.usableAreaM2.toString()).toBe("850");
  });

  it("abonelik ücreti belirlenmediği için SaaS katkısı bilinmiyor (null), sıfır değil", () => {
    expect(r.saas.value).toBeNull();
  });

  it("bütün sonuçlar Sentetik sınıfında, formül sürümü ve girdi kaynakları taşınıyor", () => {
    for (const res of [r.factory, r.customer, r.reboard, r.corridor.lower, r.corridor.upper, r.saas]) {
      expect(res.resultClass).toBe("synthetic");
      expect(res.formulaVersion).toBe(FORMULA_VERSION);
      expect(res.inputRefs.length).toBeGreaterThan(0);
      expect(res.taxBasis).toBe("excl_vat");
    }
  });
});

describe("rapordaki olumsuz senaryo: atık bugün 2.000 TL/t'ye satılıyor", () => {
  it("fabrikanın sonucu −10.000 TL olur", () => {
    expect(runScenario(REPORT_NEGATIVE_SCENARIO).factory.value?.toString()).toBe("-10000");
  });

  it("diğer tarafların sonucu değişmez", () => {
    const neg = runScenario(REPORT_NEGATIVE_SCENARIO);
    expect(neg.customer.value?.toString()).toBe("31111");
    expect(neg.reboard.value?.toString()).toBe("17500");
  });
});

describe("koridor oluşmayan senaryo", () => {
  it("giderler yükselince alt sınır üst sınırı aşar ve no_corridor koşulu eklenir", () => {
    const r = runScenario({ ...REPORT_SCENARIO, reboardCosts: { ...REPORT_SCENARIO.reboardCosts, material: 200_000 } });
    expect(r.corridor.exists).toBe(false);
    expect(r.corridor.lower.conditions).toContain("no_corridor");
    expect(r.corridor.upper.conditions).toContain("no_corridor");
  });
});
