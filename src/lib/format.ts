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
export const fmtPercent = (share: number, locale: string, maxFraction = 0) =>
  new Intl.NumberFormat(tag(locale), { style: "percent", maximumFractionDigits: maxFraction }).format(share / 100);

/** Olay zamanı: gün ve saat, İstanbul saatiyle. */
export const fmtDateTime = (v: Date | string, locale: string) =>
  new Intl.DateTimeFormat(tag(locale), { dateStyle: "medium", timeStyle: "short", timeZone: ZONE }).format(new Date(v));

/** "2026-10" → "Eki 26" / "Oct 26": grafik ekseni için kısa ay. */
export const fmtMonth = (month: string, locale: string) =>
  new Intl.DateTimeFormat(tag(locale), { month: "short", year: "2-digit", timeZone: ZONE }).format(new Date(`${month}-15T12:00:00Z`));

/** Grafik ekseni için kısa gün: "3 Kas" / "3 Nov". */
export const fmtShortDate = (v: Date, locale: string) => new Intl.DateTimeFormat(tag(locale), { day: "numeric", month: "short", timeZone: ZONE }).format(v);

/** İşaretli pay (oran × 100): "+%2,5", "−%1"; sıfır işaretsiz. */
export const fmtSignedPercent = (share: number, locale: string, maxFraction = 1) =>
  new Intl.NumberFormat(tag(locale), { style: "percent", maximumFractionDigits: maxFraction, signDisplay: "exceptZero" }).format(share / 100);

/** Saat, saniyesiyle: art arda iki doğrulamanın zamanı ayırt edilsin. */
export const fmtTime = (v: Date | string, locale: string) =>
  new Intl.DateTimeFormat(tag(locale), { timeStyle: "medium", timeZone: ZONE }).format(new Date(v));

/** Para tutarı: tam sayıysa kuruşsuz, değilse iki haneyle ("222,50"); karışık hane sayısı sütunu bulandırır. */
export function fmtMoney(v: Decimal, locale: string) {
  const digits = v.isInteger() ? 0 : 2;
  return new Intl.NumberFormat(tag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(v.toString()));
}

/** Sayılan öğeler: "a, b ve c" / "a, b and c". */
export const fmtList = (items: readonly string[], locale: string) => new Intl.ListFormat(tag(locale), { type: "conjunction" }).format(items);
