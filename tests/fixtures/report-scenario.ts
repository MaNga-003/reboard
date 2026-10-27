// Maliyet raporunun "Sentetik model örneği" (DATA_DICTIONARY §6). Rapor yalnız 10 t, 1.000 m² ve %85 kesim verimini
// ve sonuçları yayımladı: fabrika 10.000 TL, panel müşterisi 31.111 TL, ReBoard 17.500 TL, koridor 222,50–271,11 TL/m²,
// olumsuz senaryoda fabrika −10.000 TL. Öteki girdiler bu sonuçları üretecek biçimde yeniden kuruldu; kaynakları yok.
// Bu yüzden ekranda gösterilmez (D-029), yalnız formüllerin raporun sonuçlarını ürettiğini denetler.
import type { ScenarioParams } from "../../src/domain/calc";

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
  subscriptionPerMonth: null,
  customerCostPerMonth: null,
};

/** Rapordaki olumsuz senaryo: fabrika atığı bugün 2.000 TL/t'ye satıyorsa fabrika 10.000 TL kaybeder. */
export const REPORT_NEGATIVE_SCENARIO: ScenarioParams = { ...REPORT_SCENARIO, wasteSalePerT: 2000 };
