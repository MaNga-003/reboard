import { useLocale, useTranslations } from "next-intl";
import { payerOf } from "@/domain/market";
import { Decimal } from "@/domain/result";
import { fmtNumber } from "@/lib/format";

/** Birim fiyat her zaman para birimi, vergi temeli ve "kim öder" ile yazılır; bilinmeyen fiyat 0 gösterilmez. */
export function PriceText({ unitPrice, currency, taxBasis, unit }: { unitPrice: string | null; currency: string; taxBasis: string; unit: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const payer = payerOf(unitPrice);
  if (payer === null) return <>{t("market.payer.unknown")}</>;
  if (payer === "none") return <>{t("market.payer.none")}</>;
  const amount = t("market.priceValue", {
    amount: fmtNumber(new Decimal(unitPrice!).abs(), locale, 2),
    currency: t(`currency.${currency}`),
    unit: t(`units.${unit}`),
    tax: t(`taxBasis.${taxBasis}`),
  });
  return (
    <>
      {amount} · <span data-payer={payer}>{t(`market.payer.${payer}`)}</span>
    </>
  );
}
