// Senaryo hesaplayıcısının alan modeli (T2.5). Formüller maliyet raporundan (D-026): her kalem bir girdidir, gizli sabit yoktur.
// Varsayılan girdiler yalnız dayanağı olan değerlerdir (D-029); dayanağı olmayan girdi boş kalır ve "bilinmiyor" sayılır.
// Raporun sentetik örneğini üretmek için yeniden kurulan girdiler yalnız testte durur (tests/fixtures/report-scenario.ts).
import { Decimal, type MoneyLine, type QuantityLine, type Result } from "../result";
import { factoryGain, panelCustomerGain, priceCorridor, reboardOperatingResult, saasContribution } from "./formulas";
import { minus, sumMoney, type MoneyContext } from "./money";

/** null = bilinmiyor; ona dayanan sonuç da bilinmiyor olur, 0 sayılmaz. */
export type Amount = Decimal.Value | null;

export type ScenarioUnit = "t" | "m2" | "try" | "try_per_t" | "try_per_m2" | "try_per_month" | "percent";
export type ScenarioGroup = "volume" | "factory" | "customer" | "reboard" | "saas";
/** Girdinin dayanağı: ekip planı ya da değerin neden bilinmediği. Ekranda girdinin altında yazar (D-029). */
export type ScenarioBasis =
  | "teamPlan"
  | "notMeasured"
  | "notDecided"
  | "supplierData"
  | "noLocalTariff"
  | "buyerTrial"
  | "noRecipe"
  | "noPlant"
  | "saasTable";

/** Ekrandaki sıra ve gruplar. Tutarlar dönem toplamıdır; "_per_t" olanlar atık miktarıyla çarpılır. */
export const SCENARIO_FIELDS = [
  { key: "wasteT", group: "volume", unit: "t", basis: "teamPlan" },
  { key: "sellableAreaM2", group: "volume", unit: "m2", basis: "notMeasured" },
  { key: "panelPricePerM2", group: "volume", unit: "try_per_m2", basis: "notDecided" },
  { key: "acceptanceFeePerT", group: "volume", unit: "try_per_t", basis: "notDecided" },
  { key: "wastePaymentPerT", group: "volume", unit: "try_per_t", basis: "notDecided" },
  { key: "collection", group: "factory", unit: "try", basis: "supplierData" },
  { key: "transportNow", group: "factory", unit: "try", basis: "supplierData" },
  { key: "disposalPerT", group: "factory", unit: "try_per_t", basis: "noLocalTariff" },
  { key: "wasteSalePerT", group: "factory", unit: "try_per_t", basis: "supplierData" },
  { key: "handling", group: "factory", unit: "try", basis: "supplierData" },
  { key: "transportNext", group: "factory", unit: "try", basis: "supplierData" },
  { key: "equivalentProduct", group: "customer", unit: "try", basis: "buyerTrial" },
  { key: "delivery", group: "customer", unit: "try", basis: "buyerTrial" },
  { key: "cuttingCoating", group: "customer", unit: "try", basis: "buyerTrial" },
  { key: "switchingTrial", group: "customer", unit: "try", basis: "buyerTrial" },
  { key: "extraProcessing", group: "customer", unit: "try", basis: "buyerTrial" },
  { key: "customerCutYield", group: "customer", unit: "percent", basis: "buyerTrial" },
  { key: "material", group: "reboard", unit: "try", basis: "noRecipe" },
  { key: "operations", group: "reboard", unit: "try", basis: "noPlant" },
  { key: "fixed", group: "reboard", unit: "try", basis: "noPlant" },
  { key: "depreciation", group: "reboard", unit: "try", basis: "noPlant" },
  { key: "subscriptionPerMonth", group: "saas", unit: "try_per_month", basis: "notDecided" },
  { key: "customerCostPerMonth", group: "saas", unit: "try_per_month", basis: "saasTable" },
] as const satisfies readonly { key: string; group: ScenarioGroup; unit: ScenarioUnit; basis: ScenarioBasis }[];

export type ScenarioKey = (typeof SCENARIO_FIELDS)[number]["key"];
export type ScenarioParams = Record<ScenarioKey, Amount>;

/**
 * Varsayılan girdiler (D-029). Tek değer ekip planından: Ocak 2027'de ayda 10 t atık işleyen pilot tesis (sunum, 7. slayt).
 * Öteki girdilerin kamuya açık bir kaynağı yok: fabrikaya, alıcıya ya da henüz seçilmemiş reçete ve tesise özgüler.
 */
export const SOURCED_SCENARIO: ScenarioParams = {
  ...(Object.fromEntries(SCENARIO_FIELDS.map((f) => [f.key, null])) as ScenarioParams),
  wasteT: 10,
};

export const SCENARIO_CTX: MoneyContext = { currency: "TRY", taxBasis: "excl_vat", period: "sentetik-donem" };

const line = (ref: string, amount: Amount): MoneyLine => ({
  ref,
  amount,
  currency: SCENARIO_CTX.currency,
  taxBasis: SCENARIO_CTX.taxBasis,
  period: SCENARIO_CTX.period,
  resultClass: "synthetic",
});
const area = (ref: string, value: Amount): QuantityLine => ({ ref, value, unit: "m2", period: SCENARIO_CTX.period, resultClass: "synthetic" });
const dec = (v: Amount) => (v === null ? null : new Decimal(v));
const times = (a: Amount, b: Amount) => (a === null || b === null ? null : new Decimal(a).times(b));
const total = (lines: MoneyLine[]) => sumMoney(lines, SCENARIO_CTX).value;

export function runScenario(p: ScenarioParams = SOURCED_SCENARIO) {
  const acceptance = times(p.wasteT, p.acceptanceFeePerT);
  const wastePayment = times(p.wasteT, p.wastePaymentPerT);
  const panelRevenue = times(p.panelPricePerM2, p.sellableAreaM2);

  const factoryNow = {
    avoidableCosts: [line("fabrika.toplama", p.collection), line("fabrika.tasima", p.transportNow), line("fabrika.bertaraf", times(p.wasteT, p.disposalPerT))],
    wasteSaleRevenue: [line("fabrika.atik_satis_geliri", times(p.wasteT, p.wasteSalePerT))],
  };
  const factoryNext = {
    costs: [line("fabrika.elleçleme", p.handling), line("fabrika.tasima_yeni", p.transportNext), line("fabrika.kabul_bedeli", acceptance)],
    reboardPayment: [line("reboard.atik_bedeli", wastePayment)],
  };
  const factory = factoryGain({ current: factoryNow, next: factoryNext }, SCENARIO_CTX);

  const customerNow = [line("musteri.esdeger_urun", p.equivalentProduct), line("musteri.teslim", p.delivery), line("musteri.kesim_kaplama", p.cuttingCoating)];
  const switching = [line("musteri.gecis_denemesi", p.switchingTrial), line("musteri.ek_isleme", p.extraProcessing)];
  const customerReboard = [line("musteri.reboard_panel", panelRevenue), ...switching];
  const customer = panelCustomerGain({ currentProductCosts: customerNow, reboardProductCosts: customerReboard, equivalenceVerified: false }, SCENARIO_CTX);

  // Atık bedeli fabrikanın geliri olduğu kadar ReBoard'un gideridir; yalnız bir tarafa yazılırsa para yoktan var olur.
  const costs = {
    material: [line("reboard.malzeme", p.material), line("reboard.atik_bedeli", wastePayment)],
    operations: [line("reboard.operasyon", p.operations)],
    fixed: [line("reboard.sabit", p.fixed)],
    depreciation: [line("reboard.amortisman", p.depreciation)],
  };
  const allCosts = [...costs.material, ...costs.operations, ...costs.fixed, ...costs.depreciation];
  const revenues = { panel: [line("reboard.panel_geliri", panelRevenue)], acceptance: [line("reboard.kabul_geliri", acceptance)], service: [] };
  const reboard = reboardOperatingResult({ revenues, costs }, SCENARIO_CTX);

  // Müşteri ReBoard'un bütün satılabilir alanını alır; kullanılabilir alan = brüt × kesim verimi.
  const corridor = priceCorridor(
    {
      periodTotalCosts: allCosts,
      nonPanelRevenues: revenues.acceptance,
      sellableAreaM2: area("reboard.satilabilir_alan", p.sellableAreaM2),
      customerCurrentTotalCost: customerNow,
      switchingAndExtraCosts: switching,
      requiredGrossAreaM2: area("musteri.gerekli_brut_alan", p.sellableAreaM2),
    },
    SCENARIO_CTX,
  );

  const subscription = [line("saas.abonelik", p.subscriptionPerMonth)];
  const saasCosts = [line("saas.musteri_gideri", p.customerCostPerMonth)];
  const saas = saasContribution({ subscription, customerCosts: saasCosts }, SCENARIO_CTX);

  /** Formülün ara toplamları: ekran formülü sayılarıyla yazar. */
  const parts = {
    factory: {
      currentNet: minus(total(factoryNow.avoidableCosts), total(factoryNow.wasteSaleRevenue)),
      newNet: minus(total(factoryNext.costs), total(factoryNext.reboardPayment)),
    },
    customer: { current: total(customerNow), reboard: total(customerReboard) },
    reboard: { revenue: total([...revenues.panel, ...revenues.acceptance]), cost: total(allCosts) },
    corridor: {
      lowerNumerator: minus(total(allCosts), total(revenues.acceptance)),
      upperNumerator: minus(total(customerNow), total(switching)),
      areaM2: dec(p.sellableAreaM2),
    },
    saas: { subscription: total(subscription), customerCost: total(saasCosts) },
  };

  return { factory, customer, reboard, corridor, saas, parts, usableAreaM2: times(p.sellableAreaM2, p.customerCutYield) };
}

export type ScenarioRun = ReturnType<typeof runScenario>;

/** Zarar: bilinen ve sıfırdan küçük sonuç. Bilinmeyen sonuç zarar da kâr da değildir. */
export const isLoss = (r: Result) => r.value !== null && r.value.lt(0);

/** Ekranda kırmızı gösterilen sonuçlar: zarar eden taraflar ve oluşmayan fiyat koridoru. */
export function scenarioAlerts(run: ScenarioRun) {
  return {
    factory: isLoss(run.factory),
    customer: isLoss(run.customer),
    reboard: isLoss(run.reboard),
    corridor: run.corridor.exists === false,
    saas: isLoss(run.saas),
  };
}

export type ScenarioForm = Record<ScenarioKey, string>;

const unitOf = (key: ScenarioKey) => SCENARIO_FIELDS.find((f) => f.key === key)!.unit;
const NUMBER = /^\d{1,12}(\.\d{1,4})?$/;

/** Formdaki metin. Yüzde girdisi ekranda 0–100, hesapta 0–1'dir. */
export function formFromParams(p: ScenarioParams): ScenarioForm {
  const out = {} as ScenarioForm;
  for (const { key, unit } of SCENARIO_FIELDS) {
    const v = p[key];
    out[key] = v === null ? "" : unit === "percent" ? new Decimal(v).times(100).toString() : new Decimal(v).toString();
  }
  return out;
}

/**
 * Form metninden girdiler. Boş alan bilinmiyor (null) olur. Eksi, harf ya da yüzde 100'ü aşan değer geçersizdir:
 * geçersiz alan da bilinmiyor sayılır ve adı `invalid` listesinde döner. Ondalık ayırıcı nokta ya da virgül olabilir.
 */
export function paramsFromForm(form: ScenarioForm): { params: ScenarioParams; invalid: ScenarioKey[] } {
  const params = {} as ScenarioParams;
  const invalid: ScenarioKey[] = [];
  for (const { key } of SCENARIO_FIELDS) {
    const raw = (form[key] ?? "").trim().replace(",", ".");
    params[key] = null;
    if (raw === "") continue;
    const percent = unitOf(key) === "percent";
    if (!NUMBER.test(raw) || (percent && new Decimal(raw).gt(100))) {
      invalid.push(key);
      continue;
    }
    params[key] = percent ? new Decimal(raw).div(100).toString() : raw;
  }
  return { params, invalid };
}
