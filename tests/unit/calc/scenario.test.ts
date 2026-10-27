// Senaryo ekranının alan kuralları (T2.5, M-28): form metni ↔ girdi, bilinmeyenin yayılması, atık bedelinin
// iki tarafa yazılması, ara toplamların sonuçla tutarlılığı ve kırmızı gösterilecek sonuçlar.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  SCENARIO_FIELDS,
  SOURCED_SCENARIO,
  formFromParams,
  isLoss,
  paramsFromForm,
  runScenario,
  scenarioAlerts,
  type ScenarioParams,
} from "@/domain/calc";
import { Decimal } from "@/domain/result";
import { REPORT_NEGATIVE_SCENARIO, REPORT_SCENARIO } from "../../fixtures/report-scenario";

const str = (d: Decimal | null) => (d === null ? null : d.toString());

describe("alan listesi", () => {
  it("her girdi bir kez listelenir ve rapor senaryosunun anahtarlarıyla aynıdır", () => {
    const keys = SCENARIO_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(Object.keys(REPORT_SCENARIO).sort());
    expect([...keys].sort()).toEqual(Object.keys(SOURCED_SCENARIO).sort());
  });
});

describe("kaynaklı varsayılanlar (D-029)", () => {
  it("yalnız ekip planına dayanan girdi değer taşır: ayda 10 t atık; öteki her girdi bilinmiyor", () => {
    for (const f of SCENARIO_FIELDS) {
      if (f.basis === "teamPlan") expect(SOURCED_SCENARIO[f.key], f.key).not.toBeNull();
      else expect(SOURCED_SCENARIO[f.key], f.key).toBeNull();
    }
    expect(SOURCED_SCENARIO.wasteT).toBe(10);
  });

  it("hesaplayıcı varsayılan olarak kaynaklı girdilerle açılır; sonuçların hiçbiri uydurulmaz, kırmızı da yoktur", () => {
    const r = runScenario();
    for (const k of ["factory", "customer", "reboard", "saas"] as const) expect(r[k].value, k).toBeNull();
    expect(r.corridor.lower.value).toBeNull();
    expect(r.corridor.upper.value).toBeNull();
    expect(scenarioAlerts(r)).toEqual({ factory: false, customer: false, reboard: false, corridor: false, saas: false });
    expect(formFromParams(SOURCED_SCENARIO).wasteT).toBe("10");
  });
});

describe("form metni ↔ girdi", () => {
  it("rapor ve olumsuz senaryo formdan geçince aynı sonuçları verir", () => {
    for (const p of [REPORT_SCENARIO, REPORT_NEGATIVE_SCENARIO]) {
      const { params, invalid } = paramsFromForm(formFromParams(p));
      expect(invalid).toEqual([]);
      const a = runScenario(p);
      const b = runScenario(params);
      for (const k of ["factory", "customer", "reboard", "saas"] as const) expect(str(b[k].value)).toBe(str(a[k].value));
      expect(str(b.corridor.lower.value)).toBe(str(a.corridor.lower.value));
      expect(str(b.usableAreaM2)).toBe("850");
    }
  });

  it("yüzde ekranda 0–100, hesapta 0–1; boş alan bilinmiyor", () => {
    const form = formFromParams(REPORT_SCENARIO);
    expect(form.customerCutYield).toBe("85");
    expect(form.subscriptionPerMonth).toBe("");
    const { params } = paramsFromForm({ ...form, customerCutYield: "100" });
    expect(params.customerCutYield).toBe("1");
    expect(params.subscriptionPerMonth).toBeNull();
  });

  it("virgül ondalık ayırıcıdır; eksi, harf, boşluklu sayı ve %100 üstü geçersizdir ve bilinmiyor sayılır", () => {
    const form = formFromParams(REPORT_SCENARIO);
    const { params, invalid } = paramsFromForm({
      ...form,
      panelPricePerM2: "222,5",
      wasteT: " 12 ",
      collection: "-1",
      delivery: "abc",
      handling: "1 000",
      customerCutYield: "100.01",
    });
    expect(params.panelPricePerM2).toBe("222.5");
    expect(params.wasteT).toBe("12");
    expect(invalid.sort()).toEqual(["collection", "customerCutYield", "delivery", "handling"]);
    for (const k of invalid) expect(params[k]).toBeNull();
  });
});

describe("bilinmeyen girdi", () => {
  it("atık miktarı bilinmiyorsa ona dayanan fabrika, ReBoard ve alt sınır bilinmiyor; müşteri ve üst sınır etkilenmez", () => {
    const r = runScenario({ ...REPORT_SCENARIO, wasteT: null });
    expect(r.factory.value).toBeNull();
    expect(r.reboard.value).toBeNull();
    expect(r.corridor.lower.value).toBeNull();
    expect(r.corridor.exists).toBeNull();
    expect(str(r.customer.value)).toBe("31111");
    expect(r.corridor.upper.value?.toFixed(2)).toBe("271.11");
  });

  it("bilinmeyen sonuç zarar sayılmaz", () => {
    const r = runScenario({ ...REPORT_NEGATIVE_SCENARIO, wasteT: null });
    expect(isLoss(r.factory)).toBe(false);
    expect(scenarioAlerts(r)).toEqual({ factory: false, customer: false, reboard: false, corridor: false, saas: false });
  });
});

const amount = fc.integer({ min: 0, max: 5_000_000 }).map(String);
const maybe = fc.option(amount, { nil: null, freq: 6 });
const params: fc.Arbitrary<ScenarioParams> = fc.record(
  Object.fromEntries(SCENARIO_FIELDS.map((f) => [f.key, f.unit === "percent" ? fc.option(fc.integer({ min: 0, max: 100 }).map((n) => String(n / 100)), { nil: null }) : maybe])) as Record<keyof ScenarioParams, fc.Arbitrary<string | null>>,
);

describe("atık bedeli", () => {
  it("ReBoard'un ödediği her lira fabrikaya kazanç, ReBoard'a gider olarak yazılır: iki sonucun toplamı değişmez", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), fc.integer({ min: 0, max: 10_000 }), (t, pay) => {
        const base = runScenario({ ...REPORT_SCENARIO, wasteT: t, wastePaymentPerT: 0 });
        const paid = runScenario({ ...REPORT_SCENARIO, wasteT: t, wastePaymentPerT: pay });
        const moved = new Decimal(t).times(pay);
        expect(str(paid.factory.value!.minus(base.factory.value!))).toBe(moved.toString());
        expect(str(base.reboard.value!.minus(paid.reboard.value!))).toBe(moved.toString());
        // Alt sınır ödemeyi alana böler: ödeme ReBoard'un panel fiyatına biner.
        expect(paid.corridor.lower.value!.minus(base.corridor.lower.value!).times(1000).toFixed(6)).toBe(moved.toFixed(6));
      }),
    );
  });
});

describe("ara toplamlar", () => {
  it("her sonuç ekranda yazılan ara toplamlardan çıkar; ara toplamlardan biri bilinmiyorsa sonuç da bilinmiyor", () => {
    const diff = (a: Decimal | null, b: Decimal | null) => (a === null || b === null ? null : a.minus(b).toString());
    const ratio = (a: Decimal | null, b: Decimal | null) => (a === null || b === null || b.lte(0) ? null : a.div(b).toString());
    fc.assert(
      fc.property(params, (p) => {
        const r = runScenario(p);
        expect(str(r.factory.value)).toBe(diff(r.parts.factory.currentNet, r.parts.factory.newNet));
        expect(str(r.customer.value)).toBe(diff(r.parts.customer.current, r.parts.customer.reboard));
        expect(str(r.reboard.value)).toBe(diff(r.parts.reboard.revenue, r.parts.reboard.cost));
        expect(str(r.corridor.lower.value)).toBe(ratio(r.parts.corridor.lowerNumerator, r.parts.corridor.areaM2));
        expect(str(r.corridor.upper.value)).toBe(ratio(r.parts.corridor.upperNumerator, r.parts.corridor.areaM2));
        expect(str(r.saas.value)).toBe(diff(r.parts.saas.subscription, r.parts.saas.customerCost));
      }),
      { numRuns: 300 },
    );
  });
});

describe("kırmızı gösterilen sonuçlar", () => {
  it("rapor örneğinde hiçbiri; olumsuz senaryoda yalnızca fabrika", () => {
    expect(scenarioAlerts(runScenario(REPORT_SCENARIO))).toEqual({ factory: false, customer: false, reboard: false, corridor: false, saas: false });
    expect(scenarioAlerts(runScenario(REPORT_NEGATIVE_SCENARIO))).toEqual({ factory: true, customer: false, reboard: false, corridor: false, saas: false });
  });

  it("malzeme gideri 200.000 TL olunca ReBoard zarar eder ve fiyat koridoru oluşmaz", () => {
    const alerts = scenarioAlerts(runScenario({ ...REPORT_SCENARIO, material: 200_000 }));
    expect(alerts).toMatchObject({ reboard: true, corridor: true, factory: false });
  });

  it("sıfır zarar değildir; −0,01 zarardır", () => {
    const at = (sale: string) => runScenario({ ...REPORT_SCENARIO, wasteT: 1, collection: 0, transportNow: 0, disposalPerT: 0, handling: 0, transportNext: 0, acceptanceFeePerT: 0, wasteSalePerT: sale }).factory;
    expect(isLoss(at("0"))).toBe(false);
    expect(isLoss(at("0.01"))).toBe(true);
  });

  it("SaaS katkısı abonelik müşteri giderinin altına düşünce kırmızıdır", () => {
    expect(scenarioAlerts(runScenario({ ...REPORT_SCENARIO, subscriptionPerMonth: 100, customerCostPerMonth: 150 })).saas).toBe(true);
    expect(scenarioAlerts(runScenario({ ...REPORT_SCENARIO, subscriptionPerMonth: 150, customerCostPerMonth: 100 })).saas).toBe(false);
  });
});
