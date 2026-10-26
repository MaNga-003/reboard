// Raporun "Sentetik model örneği": 10 t tekstil, satılabilir ve tamamı satıldığı varsayılan 1.000 m² panel,
// müşteri kesim verimi %85. Raporun girdi dosyası (scenario_inputs.json) elde olmadığından girdiler,
// raporda yayımlanan sonuçları birebir üretecek biçimde yeniden kuruldu: fabrika 10.000 TL,
// panel müşterisi 31.111 TL, ReBoard 17.500 TL, fiyat koridoru 222,50–271,11 TL/m².
// Bütün tutarlar SENTETİKTİR (D-011).
import { Decimal, type MoneyLine, type QuantityLine } from "../result";
import { factoryGain, panelCustomerGain, priceCorridor, reboardOperatingResult, saasContribution } from "./formulas";
import type { MoneyContext } from "./money";

export type ScenarioParams = {
  wasteT: number;
  sellableAreaM2: number;
  customerCutYield: number;
  panelPricePerM2: number;
  /** Fabrikanın bugün atığı satarak aldığı gelir (TL/t). Rapordaki olumsuz senaryo: 2.000. */
  currentWasteSalePerT: number;
  acceptanceFeePerT: number;
  /** ReBoard kalemleri: malzeme, operasyon, sabit gider, amortisman (TL). */
  reboardCosts: { material: number; operations: number; fixed: number; depreciation: number };
  /** Aylık abonelik ve müşteriye bağlı gider (TL). Ücret henüz belirlenmedi: null = bilinmiyor. */
  subscriptionPerMonth: number | null;
  customerAttributableCostPerMonth: number | null;
};

export const REPORT_SCENARIO: ScenarioParams = {
  wasteT: 10,
  sellableAreaM2: 1000,
  customerCutYield: 0.85,
  panelPricePerM2: 240,
  currentWasteSalePerT: 0,
  acceptanceFeePerT: 500,
  reboardCosts: { material: 120_000, operations: 62_500, fixed: 30_000, depreciation: 15_000 },
  subscriptionPerMonth: null,
  customerAttributableCostPerMonth: null,
};

/** Rapordaki olumsuz senaryo: fabrika atığı bugün 2.000 TL/t'ye satıyorsa fabrika 10.000 TL kaybeder. */
export const REPORT_NEGATIVE_SCENARIO: ScenarioParams = { ...REPORT_SCENARIO, currentWasteSalePerT: 2000 };

export const SCENARIO_CTX: MoneyContext = { currency: "TRY", taxBasis: "excl_vat", period: "sentetik-donem" };

const line = (ref: string, amount: Decimal.Value | null): MoneyLine => ({
  ref,
  amount,
  currency: SCENARIO_CTX.currency,
  taxBasis: SCENARIO_CTX.taxBasis,
  period: SCENARIO_CTX.period,
  resultClass: "synthetic",
});
const area = (ref: string, value: Decimal.Value | null): QuantityLine => ({
  ref,
  value,
  unit: "m2",
  period: SCENARIO_CTX.period,
  resultClass: "synthetic",
});

export function runScenario(p: ScenarioParams = REPORT_SCENARIO) {
  const t = new Decimal(p.wasteT);
  const acceptance = t.times(p.acceptanceFeePerT);
  const panelRevenue = new Decimal(p.panelPricePerM2).times(p.sellableAreaM2);
  // Müşteri ReBoard'un bütün satılabilir alanını alır; kullanılabilir alan = brüt × kesim verimi.
  const grossArea = new Decimal(p.sellableAreaM2);
  const customerSwitching = [line("musteri.gecis_denemesi", 4000), line("musteri.ek_isleme", 6000)];

  const factory = factoryGain(
    {
      current: {
        avoidableCosts: [line("fabrika.toplama", 6150), line("fabrika.tasima", 6000), line("fabrika.bertaraf_785TL_t", t.times(785))],
        wasteSaleRevenue: [line("fabrika.atik_satis_geliri", t.times(p.currentWasteSalePerT))],
      },
      next: {
        costs: [line("fabrika.elleçleme", 2000), line("fabrika.tasima_yeni", 3000), line("fabrika.kabul_bedeli", acceptance)],
        reboardPayment: [line("reboard.atik_bedeli", 0)],
      },
    },
    SCENARIO_CTX,
  );

  const customer = panelCustomerGain(
    {
      currentProductCosts: [line("musteri.esdeger_urun", 263_111), line("musteri.teslim", 8000), line("musteri.kesim_kaplama", 10_000)],
      reboardProductCosts: [line("musteri.reboard_panel", panelRevenue), ...customerSwitching],
      equivalenceVerified: false,
    },
    SCENARIO_CTX,
  );

  const costs = {
    material: [line("reboard.malzeme", p.reboardCosts.material)],
    operations: [line("reboard.operasyon", p.reboardCosts.operations)],
    fixed: [line("reboard.sabit", p.reboardCosts.fixed)],
    depreciation: [line("reboard.amortisman", p.reboardCosts.depreciation)],
  };
  const reboard = reboardOperatingResult(
    {
      revenues: { panel: [line("reboard.panel_geliri", panelRevenue)], acceptance: [line("reboard.kabul_geliri", acceptance)], service: [] },
      costs,
    },
    SCENARIO_CTX,
  );

  const corridor = priceCorridor(
    {
      periodTotalCosts: [...costs.material, ...costs.operations, ...costs.fixed, ...costs.depreciation],
      nonPanelRevenues: [line("reboard.kabul_geliri", acceptance)],
      sellableAreaM2: area("reboard.satilabilir_alan", p.sellableAreaM2),
      customerCurrentTotalCost: [line("musteri.esdeger_urun", 263_111), line("musteri.teslim", 8000), line("musteri.kesim_kaplama", 10_000)],
      switchingAndExtraCosts: customerSwitching,
      requiredGrossAreaM2: area("musteri.gerekli_brut_alan", grossArea),
    },
    SCENARIO_CTX,
  );

  const saas = saasContribution(
    {
      subscription: [line("saas.abonelik", p.subscriptionPerMonth)],
      customerCosts: [line("saas.musteri_gideri", p.customerAttributableCostPerMonth)],
    },
    SCENARIO_CTX,
  );

  return { factory, customer, reboard, corridor, saas, usableAreaM2: grossArea.times(p.customerCutYield) };
}
