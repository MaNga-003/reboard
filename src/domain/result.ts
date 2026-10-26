// Hesap sonuçlarının ortak tipi (D-011). null = bilinmiyor; asla 0'a çevrilmez.
import Decimal from "decimal.js";

export { Decimal };

export const RESULT_CLASSES = ["synthetic", "sourced_estimate", "pilot_projection", "realized"] as const;
export type ResultClass = (typeof RESULT_CLASSES)[number];

export type Currency = "TRY" | "EUR" | "USD";
export type TaxBasis = "incl_vat" | "excl_vat";

/** Bir hesabın sınıfı, girdilerinin en zayıf sınıfıdır (synthetic en zayıf). */
export function weakestClass(classes: readonly ResultClass[]): ResultClass {
  if (classes.length === 0) throw new CalcError("no_inputs", "Sonuç sınıfı için en az bir girdi gerekir");
  return classes.reduce((a, b) => (RESULT_CLASSES.indexOf(a) <= RESULT_CLASSES.indexOf(b) ? a : b));
}

export type CalcErrorCode = "currency_mismatch" | "tax_basis_mismatch" | "period_mismatch" | "unit_mismatch" | "no_inputs" | "invalid_input";

export class CalcError extends Error {
  constructor(
    readonly code: CalcErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CalcError";
  }
}

export type Result = {
  value: Decimal | null;
  unit: string;
  period: string;
  currency?: Currency;
  taxBasis?: TaxBasis;
  resultClass: ResultClass;
  inputRefs: string[];
  formulaVersion: string;
  /** Sonucu koşullu kılan durumlar; ör. teknik eşdeğerlik doğrulanmadı. */
  conditions: string[];
};

/** Para kalemi: tutar, para birimi, vergi temeli, dönem ve sınıf birlikte taşınır. */
export type MoneyLine = {
  ref: string;
  amount: Decimal.Value | null;
  currency: Currency;
  taxBasis: TaxBasis;
  period: string;
  resultClass: ResultClass;
};

/** Miktar kalemi: ör. satılabilir panel alanı (m²). */
export type QuantityLine = {
  ref: string;
  value: Decimal.Value | null;
  unit: string;
  period: string;
  resultClass: ResultClass;
};

export const FORMULA_VERSION = "maliyet-raporu-2026-10/v1";
