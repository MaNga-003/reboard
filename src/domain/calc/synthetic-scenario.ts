// Raporun "Sentetik model örneği": 10 t tekstil, satılabilir ve tamamı satıldığı varsayılan 1.000 m² panel,
// müşteri kesim verimi %85. Raporun girdi dosyası (scenario_inputs.json) elde olmadığından girdiler,
// raporda yayımlanan sonuçları birebir üretecek biçimde yeniden kuruldu: fabrika 10.000 TL,
// panel müşterisi 31.111 TL, ReBoard 17.500 TL, fiyat koridoru 222,50–271,11 TL/m².
// Bütün tutarlar SENTETİKTİR (D-011). Hesapta gizli sabit yoktur: her kalem bir girdidir (D-026).
import { Decimal, type MoneyLine, type QuantityLine, type Result } from "../result";
import { factoryGain, panelCustomerGain, priceCorridor, reboardOperatingResult, saasContribution } from "./formulas";
import { minus, sumMoney, type MoneyContext } from "./money";

/** null = bilinmiyor; ona dayanan sonuç da bilinmiyor olur, 0 sayılmaz. */
export type Amount = Decimal.Value | null;

export type ScenarioUnit = "t" | "m2" | "try" | "try_per_t" | "try_per_m2" | "try_per_month" | "percent";
export type ScenarioGroup = "volume" | "factory" | "customer" | "reboard" | "saas";

/** Ekrandaki sıra ve gruplar. Tutarlar dönem toplamıdır; "_per_t" olanlar atık miktarıyla çarpılır. */
export const SCENARIO_FIELDS = [
  { key: "wasteT", group: "volume", unit: "t" },
  { key: "sellableAreaM2", group: "volume", unit: "m2" },
  { key: "panelPricePerM2", group: "volume", unit: "try_per_m2" },
  { key: "acceptanceFeePerT", group: "volume", unit: "try_per_t" },
  { key: "wastePaymentPerT", group: "volume", unit: "try_per_t" },
  { key: "collection", group: "factory", unit: "try" },
  { key: "transportNow", group: "factory", unit: "try" },
  { key: "disposalPerT", group: "factory", unit: "try_per_t" },
  { key: "wasteSalePerT", group: "factory", unit: "try_per_t" },
  { key: "handling", group: "factory", unit: "try" },
  { key: "transportNext", group: "factory", unit: "try" },
  { key: "equivalentProduct", group: "customer", unit: "try" },
  { key: "delivery", group: "customer", unit: "try" },
  { key: "cuttingCoating", group: "customer", unit: "try" },
  { key: "switchingTrial", group: "customer", unit: "try" },
  { key: "extraProcessing", group: "customer", unit: "try" },
  { key: "customerCutYield", group: "customer", unit: "percent" },
  { key: "material", group: "reboard", unit: "try" },
  { key: "operations", group: "reboard", unit: "try" },
  { key: "fixed", group: "reboard", unit: "try" },
  { key: "depreciation", group: "reboard", unit: "try" },
  { key: "subscriptionPerMonth", group: "saas", unit: "try_per_month" },
  { key: "customerCostPerMonth", group: "saas", unit: "try_per_month" },
] as const satisfies readonly { key: string; group: ScenarioGroup; unit: ScenarioUnit }[];

export type ScenarioKey = (typeof SCENARIO_FIELDS)[number]["key"];
export type ScenarioParams = Record<ScenarioKey, Amount>;

export const REPORT_SCENARIO: ScenarioParams = {
  wasteT: 10,
  sellableAreaM2: 1000,
  panelPricePerM2: 240,
  acceptanceFeePerT: 500,
  wastePaymentPerT: 0,
  collection: 6150,
  transportNow: 6000,
  disposalPerT: 785,
  wasteSalePerT: 0,
  handling: 2000,
  transportNext: 3000,
  equivalentProduct: 263_111,
  delivery: 8000,
  cuttingCoating: 10_000,
  switchingTrial: 4000,
  extraProcessing: 6000,
  customerCutYield: 0.85,
  material: 120_000,
  operations: 62_500,
  fixed: 30_000,
  depreciation: 15_000,
  // Abonelik ücreti henüz belirlenmedi.
  subscriptionPerMonth: null,
  customerCostPerMonth: null,
};

/** Rapordaki olumsuz senaryo: fabrika atığı bugün 2.000 TL/t'ye satıyorsa fabrika 10.000 TL kaybeder. */
export const REPORT_NEGATIVE_SCENARIO: ScenarioParams = { ...REPORT_SCENARIO, wasteSalePerT: 2000 };

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

export function runScenario(p: ScenarioParams = REPORT_SCENARIO) {
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
