// Kütle dengesi (M-7): Σ girdi = çıktı + fire + nem kaybı. Fark girdinin %2'sini aşarsa açıklama zorunlu.
import { CalcError, Decimal } from "../result";

export const DEFAULT_TOLERANCE = new Decimal("0.02");

export type MassBalanceInput = {
  inputsKg: readonly (Decimal.Value | null)[];
  outputKg: Decimal.Value | null;
  scrapKg: Decimal.Value | null;
  moistureLossKg: Decimal.Value | null;
};

export type MassBalance = {
  inputKg: Decimal | null;
  accountedKg: Decimal | null;
  /** girdi − (çıktı + fire + nem kaybı); pozitifse kayıp açıklanmamış, negatifse girdiden fazla çıktı var. */
  diffKg: Decimal | null;
  /** |fark| ÷ girdi. */
  diffRatio: Decimal | null;
  /** Bir değer bilinmiyorsa ya da girdi yoksa null: denge iddia edilemez. */
  withinTolerance: boolean | null;
  noteRequired: boolean;
};

const dec = (v: Decimal.Value | null, what: string) => {
  if (v === null) return null;
  const d = new Decimal(v);
  if (d.isNeg() || !d.isFinite()) throw new CalcError("invalid_input", `${what} negatif ya da sonsuz olamaz: ${d}`);
  return d;
};

export function massBalance(i: MassBalanceInput, tolerance: Decimal.Value = DEFAULT_TOLERANCE): MassBalance {
  const ins = i.inputsKg.map((v, k) => dec(v, `girdi[${k}]`));
  const parts = [dec(i.outputKg, "çıktı"), dec(i.scrapKg, "fire"), dec(i.moistureLossKg, "nem kaybı")];
  const inputKg = ins.some((v) => v === null) ? null : ins.reduce<Decimal>((a, v) => a.plus(v!), new Decimal(0));
  const accountedKg = parts.some((v) => v === null) ? null : parts.reduce<Decimal>((a, v) => a.plus(v!), new Decimal(0));
  const diffKg = inputKg === null || accountedKg === null ? null : inputKg.minus(accountedKg);
  const diffRatio = diffKg === null || inputKg === null || inputKg.isZero() ? null : diffKg.abs().div(inputKg);
  const withinTolerance = diffRatio === null ? null : diffRatio.lte(tolerance);
  return { inputKg, accountedKg, diffKg, diffRatio, withinTolerance, noteRequired: withinTolerance === false };
}

/** Tolerans aşıldıysa ve açıklama boşsa true: kayıt reddedilir. */
export const balanceNoteMissing = (mb: MassBalance, note: string | null | undefined) => mb.noteRequired && !note?.trim();
