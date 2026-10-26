import { CalcError, Decimal, weakestClass, type Currency, type MoneyLine, type QuantityLine, type ResultClass, type TaxBasis } from "../result";

export type MoneyContext = { currency: Currency; taxBasis: TaxBasis; period: string };

export type Sum = { value: Decimal | null; classes: ResultClass[]; refs: string[] };

/**
 * Para kalemlerini toplar. Para birimi, vergi temeli ya da dönem bağlamla uyuşmazsa CalcError fırlatır.
 * Boş liste bilinen sıfırdır; kalemlerden biri null ise toplam bilinmiyor (null) olur.
 */
export function sumMoney(lines: readonly MoneyLine[], ctx: MoneyContext): Sum {
  let total: Decimal | null = new Decimal(0);
  for (const l of lines) {
    if (l.currency !== ctx.currency) throw new CalcError("currency_mismatch", `${l.ref}: ${l.currency} ≠ ${ctx.currency}`);
    if (l.taxBasis !== ctx.taxBasis) throw new CalcError("tax_basis_mismatch", `${l.ref}: ${l.taxBasis} ≠ ${ctx.taxBasis}`);
    if (l.period !== ctx.period) throw new CalcError("period_mismatch", `${l.ref}: ${l.period} ≠ ${ctx.period}`);
    total = l.amount === null || total === null ? null : total.plus(new Decimal(l.amount));
  }
  return { value: total, classes: lines.map((l) => l.resultClass), refs: lines.map((l) => l.ref) };
}

export function quantity(q: QuantityLine, unit: string, period: string): Sum {
  if (q.unit !== unit) throw new CalcError("unit_mismatch", `${q.ref}: ${q.unit} ≠ ${unit}`);
  if (q.period !== period) throw new CalcError("period_mismatch", `${q.ref}: ${q.period} ≠ ${period}`);
  return { value: q.value === null ? null : new Decimal(q.value), classes: [q.resultClass], refs: [q.ref] };
}

export const minus = (a: Decimal | null, b: Decimal | null) => (a === null || b === null ? null : a.minus(b));
export const plus = (a: Decimal | null, b: Decimal | null) => (a === null || b === null ? null : a.plus(b));

/** Bölen sıfır ya da negatifse sonuç tanımsızdır; bilinmiyor döner, sıfır dönmez. */
export const divide = (a: Decimal | null, b: Decimal | null) => (a === null || b === null || b.lte(0) ? null : a.div(b));

export function combine(...sums: Sum[]): { classes: ResultClass[]; refs: string[] } {
  return { classes: sums.flatMap((s) => s.classes), refs: sums.flatMap((s) => s.refs) };
}

export function classOf(sums: Sum[]): ResultClass {
  return weakestClass(combine(...sums).classes);
}
