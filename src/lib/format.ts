// Sayı ve tarih gösterimi. Yalnızca biçimler; hesap yapmaz (hesap src/domain'de, Decimal ile).
import type { Decimal } from "@/domain/result";

const tag = (locale: string) => (locale === "tr" ? "tr-TR" : "en-GB");
const ZONE = "Europe/Istanbul";

export const fmtNumber = (v: Decimal.Value, locale: string, maxFraction = 3) =>
  new Intl.NumberFormat(tag(locale), { maximumFractionDigits: maxFraction }).format(Number(v.toString()));

/** YYYY-MM-DD takvim günü ya da zaman damgası; gün kaymasın diye takvim günü öğlen UTC'ye konur. */
export function fmtDate(v: Date | string, locale: string) {
  const d = typeof v === "string" ? new Date(`${v}T12:00:00Z`) : v;
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: "medium", timeZone: ZONE }).format(d);
}

/** 0–100 arası pay; Türkçede "%50", İngilizcede "50%". */
export const fmtPercent = (share: number, locale: string) => new Intl.NumberFormat(tag(locale), { style: "percent", maximumFractionDigits: 0 }).format(share / 100);
