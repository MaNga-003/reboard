// Maliyet ve veri raporundaki formüller (D-002). Tanımlar raporun "İki müşteri ve ReBoard için
// ekonomik model" ve "Abonelik hesabı" bölümlerinden alınmıştır.
import { Decimal, FORMULA_VERSION, type MoneyLine, type QuantityLine, type Result } from "../result";
import { classOf, combine, divide, minus, plus, quantity, sumMoney, type MoneyContext, type Sum } from "./money";

function moneyResult(value: Result["value"], ctx: MoneyContext, sums: Sum[], conditions: string[] = []): Result {
  return {
    value,
    unit: ctx.currency,
    period: ctx.period,
    currency: ctx.currency,
    taxBasis: ctx.taxBasis,
    resultClass: classOf(sums),
    inputRefs: combine(...sums).refs,
    formulaVersion: FORMULA_VERSION,
    conditions,
  };
}

/**
 * Tekstil fabrikası kazancı = mevcut net atık gideri − yeni net atık gideri.
 * Mevcut net gider: kaçınılabilir toplama, taşıma ve bertaraf giderleri − bugünkü atık satış geliri.
 * Yeni net gider: fabrikanın üstlendiği elleçleme, taşıma, kabul ve abonelik giderleri − ReBoard'un ödediği atık bedeli.
 */
export function factoryGain(
  input: {
    current: { avoidableCosts: MoneyLine[]; wasteSaleRevenue: MoneyLine[] };
    next: { costs: MoneyLine[]; reboardPayment: MoneyLine[] };
  },
  ctx: MoneyContext,
): Result {
  const curCost = sumMoney(input.current.avoidableCosts, ctx);
  const curRev = sumMoney(input.current.wasteSaleRevenue, ctx);
  const newCost = sumMoney(input.next.costs, ctx);
  const newPay = sumMoney(input.next.reboardPayment, ctx);
  const currentNet = minus(curCost.value, curRev.value);
  const newNet = minus(newCost.value, newPay.value);
  return moneyResult(minus(currentNet, newNet), ctx, [curCost, curRev, newCost, newPay]);
}

/**
 * Panel müşterisi kazancı = eşdeğer mevcut ürün toplam gideri − ReBoard kullanılan ürün toplam gideri.
 * Aynı kabul edilmiş ürün sayısı ya da kullanılabilir m² karşılaştırılır. Teknik eşdeğerlik doğrulanmadan sonuç koşullu kalır.
 */
export function panelCustomerGain(
  input: { currentProductCosts: MoneyLine[]; reboardProductCosts: MoneyLine[]; equivalenceVerified: boolean },
  ctx: MoneyContext,
): Result {
  const cur = sumMoney(input.currentProductCosts, ctx);
  const rb = sumMoney(input.reboardProductCosts, ctx);
  return moneyResult(minus(cur.value, rb.value), ctx, [cur, rb], input.equivalenceVerified ? [] : ["equivalence_unverified"]);
}

/**
 * ReBoard faaliyet sonucu = panel + kabul + hizmet gelirleri − malzeme − operasyon − sabit gider − amortisman.
 * Finansman ve vergi öncesidir. Fabrikanın kaçındığı bertaraf gideri ReBoard'a ödeme yapılmadıkça gelir değildir.
 */
export function reboardOperatingResult(
  input: {
    revenues: { panel: MoneyLine[]; acceptance: MoneyLine[]; service: MoneyLine[] };
    costs: { material: MoneyLine[]; operations: MoneyLine[]; fixed: MoneyLine[]; depreciation: MoneyLine[] };
  },
  ctx: MoneyContext,
): Result {
  const rev = [input.revenues.panel, input.revenues.acceptance, input.revenues.service].map((l) => sumMoney(l, ctx));
  const cost = [input.costs.material, input.costs.operations, input.costs.fixed, input.costs.depreciation].map((l) => sumMoney(l, ctx));
  const total = (sums: Sum[]) => sums.reduce<Result["value"]>((a, s) => plus(a, s.value), new Decimal(0));
  return moneyResult(minus(total(rev), total(cost)), ctx, [...rev, ...cost], ["before_financing_and_tax"]);
}

export type PriceCorridor = {
  lower: Result;
  upper: Result;
  /** Alt sınır üst sınırı aşmıyorsa true; sınırlardan biri bilinmiyorsa null. */
  exists: boolean | null;
};

/**
 * Panel fiyat koridoru (TL/m²).
 * Alt sınır = (dönem toplam giderleri − panel dışı gelirler) ÷ satılabilir ve satıldığı varsayılan panel alanı.
 * Üst sınır = (müşterinin aynı ürün için mevcut toplam gideri − geçiş ve ReBoard ile ek işleme giderleri) ÷ gerekli ReBoard brüt alanı.
 * Aralık yoksa ürün, gider ya da iş modeli yeniden ele alınır.
 */
export function priceCorridor(
  input: {
    periodTotalCosts: MoneyLine[];
    nonPanelRevenues: MoneyLine[];
    sellableAreaM2: QuantityLine;
    customerCurrentTotalCost: MoneyLine[];
    switchingAndExtraCosts: MoneyLine[];
    requiredGrossAreaM2: QuantityLine;
  },
  ctx: MoneyContext,
): PriceCorridor {
  const costs = sumMoney(input.periodTotalCosts, ctx);
  const nonPanel = sumMoney(input.nonPanelRevenues, ctx);
  const sellable = quantity(input.sellableAreaM2, "m2", ctx.period);
  const custCur = sumMoney(input.customerCurrentTotalCost, ctx);
  const switching = sumMoney(input.switchingAndExtraCosts, ctx);
  const gross = quantity(input.requiredGrossAreaM2, "m2", ctx.period);

  const perM2 = (value: Result["value"], sums: Sum[]): Result => ({
    ...moneyResult(value, ctx, sums),
    unit: `${ctx.currency}/m2`,
  });
  const lower = perM2(divide(minus(costs.value, nonPanel.value), sellable.value), [costs, nonPanel, sellable]);
  const upper = perM2(divide(minus(custCur.value, switching.value), gross.value), [custCur, switching, gross]);
  const exists = lower.value === null || upper.value === null ? null : lower.value.lte(upper.value);
  if (exists === false) {
    lower.conditions.push("no_corridor");
    upper.conditions.push("no_corridor");
  }
  return { lower, upper, exists };
}

/** SaaS müşteri katkısı = abonelik faturası − müşteriye bağlı bulut, harita, iletişim ve destek gideri. */
export function saasContribution(input: { subscription: MoneyLine[]; customerCosts: MoneyLine[] }, ctx: MoneyContext): Result {
  const sub = sumMoney(input.subscription, ctx);
  const cost = sumMoney(input.customerCosts, ctx);
  return moneyResult(minus(sub.value, cost.value), ctx, [sub, cost]);
}
