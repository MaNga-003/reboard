// SaaS gider tablosu (T2.6, D-027): kurulum başına aylık sabit gider ve müşteri başı aylık gider, TL'ye çevrilmiş.
// Bir kalem bilinmiyorsa toplam da bilinmiyor; bilinen kalemlerin toplamı yalnızca alt sınır olarak verilir.
import { CalcError, Decimal, weakestClass, type Currency, type ResultClass, type TaxBasis } from "../result";

export const SAAS_STAGES = ["demo", "commercial"] as const;
export type SaasStage = (typeof SAAS_STAGES)[number];
/** "both": iki kurulumda da aynı olan kalem (ör. harita altlığı). */
export type SaasLineStage = SaasStage | "both";
/** Tablodaki sıra: önce barındırma ve veritabanı, en sonda henüz seçilmemiş kalemler. */
export const SAAS_ITEMS = ["hosting", "database", "database_compute", "database_storage", "map_tiles", "ci", "domain"] as const;
export type SaasItem = (typeof SAAS_ITEMS)[number];

export type SaasCostLine = {
  key: string;
  stage: SaasLineStage;
  item: SaasItem;
  /** Aylık sabit tutar; null = bilinmiyor. */
  monthly: Decimal.Value | null;
  /** Müşteri başına aylık tutar; null = kullanıma bağlı ya da bilinmiyor. */
  perCustomer: Decimal.Value | null;
  /** Kullanıma bağlı kalemin birim fiyatı (ör. USD/CU-saat); toplama girmez, tabloda gösterilir. */
  unitPrice: Decimal.Value | null;
  currency: Currency;
  taxBasis: TaxBasis;
  resultClass: ResultClass;
};

/** TL/USD kuru; kaynaklı referans değerden gelir. */
export type UsdTry = { rate: Decimal.Value | null; resultClass: ResultClass };

export type CostTotal = {
  /** Bütün kalemler biliniyorsa TL toplamı; biri bilinmiyorsa null. */
  value: Decimal | null;
  /** Toplam bilinmiyorken bilinen kalemlerin TL toplamı. Gider eksi olamayacağı için alt sınırdır; sıfırsa bilgi taşımaz ve null döner. */
  atLeast: Decimal | null;
  /** Değeri bilinmeyen kalemlerin anahtarları. */
  unknown: string[];
  /** Dolar tutarı var ama kur bilinmiyor: TL toplamı bu yüzden bilinmiyor. */
  fxUnknown: boolean;
  resultClass: ResultClass;
};

export type SaasStageSummary = {
  stage: SaasStage;
  lines: SaasCostLine[];
  monthly: CostTotal;
  perCustomer: CostTotal;
};

/** Tutarı TL'ye çevirir. Kur bilinmiyorsa dolar tutarı da TL'de bilinmiyor olur; EUR kuru tutulmadığı için hata verir. */
function toTry(amount: Decimal, currency: Currency, usdTry: UsdTry, key: string): Decimal | null {
  if (currency === "TRY") return amount;
  if (currency === "USD") return usdTry.rate === null ? null : amount.mul(usdTry.rate);
  throw new CalcError("currency_mismatch", `${key}: ${currency} için kur yok`);
}

function total(lines: readonly SaasCostLine[], pick: (l: SaasCostLine) => Decimal.Value | null, usdTry: UsdTry): CostTotal {
  let known = new Decimal(0);
  let fxUnknown = false;
  const unknown: string[] = [];
  const classes: ResultClass[] = [];
  for (const l of lines) {
    const raw = pick(l);
    classes.push(l.resultClass);
    if (raw === null) {
      unknown.push(l.key);
      continue;
    }
    if (l.currency !== "TRY") classes.push(usdTry.resultClass);
    const v = toTry(new Decimal(raw), l.currency, usdTry, l.key);
    if (v === null) fxUnknown = true;
    else known = known.plus(v);
  }
  // Kur bilinmiyorsa bilinen kısım da TL'de bilinmiyor: alt sınır verilmez.
  const value = unknown.length === 0 && !fxUnknown ? known : null;
  const atLeast = unknown.length > 0 && !fxUnknown && known.gt(0) ? known : null;
  return { value, atLeast, unknown, fxUnknown, resultClass: weakestClass(classes) };
}

/**
 * Bir kurulumun gider özeti. "both" kalemleri iki kuruluma da girer.
 * Vergi temeli karışamaz; eksi tutar ve eksi birim fiyat geçersizdir.
 */
export function saasStageSummary(lines: readonly SaasCostLine[], stage: SaasStage, usdTry: UsdTry): SaasStageSummary {
  const own = lines
    .filter((l) => l.stage === stage || l.stage === "both")
    .sort((a, b) => SAAS_ITEMS.indexOf(a.item) - SAAS_ITEMS.indexOf(b.item) || a.key.localeCompare(b.key));
  if (own.length === 0) throw new CalcError("no_inputs", `${stage}: kalem yok`);
  for (const l of own) {
    if (!SAAS_ITEMS.includes(l.item)) throw new CalcError("invalid_input", `${l.key}: bilinmeyen kalem ${l.item}`);
    if (l.taxBasis !== own[0].taxBasis) throw new CalcError("tax_basis_mismatch", `${l.key}: ${l.taxBasis} ≠ ${own[0].taxBasis}`);
    for (const v of [l.monthly, l.perCustomer, l.unitPrice])
      if (v !== null && new Decimal(v).isNegative()) throw new CalcError("invalid_input", `${l.key}: eksi tutar`);
  }
  return {
    stage,
    lines: own,
    monthly: total(own, (l) => l.monthly, usdTry),
    perCustomer: total(own, (l) => l.perCustomer, usdTry),
  };
}
