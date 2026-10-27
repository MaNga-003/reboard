// SaaS gider tablosu deposu (T2.6). Kaynaklı fiyat satırlarını ve TL/USD kurunu okur; hesap src/domain/calc'ta.
import { SAAS_STAGES, saasStageSummary, type SaasCostLine, type SaasItem, type SaasStageSummary } from "../../domain/calc";
import type { Tenant, TenantRow } from "./tenant";

/** Dolar fiyatlarını TL'ye çeviren referans değer (DATA_DICTIONARY §7). */
export const USD_TRY_KEY = "usd_try";

export type SaasCostData = {
  /** Satırın kaynağı, tarihi, sağlayıcısı ve planı; anahtarla bulunur. */
  rows: Map<string, TenantRow<"saasCosts">>;
  /** Kalemi olmayan kurulum listede yoktur; tablo boşsa liste de boştur. */
  stages: SaasStageSummary[];
  usdTry: TenantRow<"referenceValues"> | null;
};

export async function saasCostData(tenant: Tenant): Promise<SaasCostData> {
  const [rows, usdTry] = await Promise.all([tenant.list("saasCosts"), tenant.get("referenceValues", USD_TRY_KEY)]);
  // Kalem adı alan katmanında denetlenir; bilinmeyen ad hesapta hata verir.
  const lines: SaasCostLine[] = rows.map((r) => ({
    key: r.key,
    stage: r.stage,
    item: r.item as SaasItem,
    monthly: r.monthlyCost,
    perCustomer: r.perCustomerCost,
    unitPrice: r.unitPrice,
    currency: r.currency,
    taxBasis: r.taxBasis,
    resultClass: r.resultClass,
  }));
  // Kur yoksa dolar tutarları TL'de bilinmiyor olur ve sınıf en zayıfa iner.
  const fx = { rate: usdTry?.value ?? null, resultClass: usdTry?.resultClass ?? "synthetic" } as const;
  const stages = SAAS_STAGES.filter((s) => lines.some((l) => l.stage === s || l.stage === "both")).map((s) => saasStageSummary(lines, s, fx));
  return { rows: new Map(rows.map((r) => [r.key, r])), stages, usdTry };
}
