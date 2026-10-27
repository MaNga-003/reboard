import { useTranslations } from "next-intl";
import { Decimal } from "@/domain/result";
import type { MassBalance } from "@/domain/traceability";
import { fmtNumber, fmtPercent } from "@/lib/format";

/**
 * Miktar ya da "bilinmiyor": null asla 0 gösterilmez (D-011). data-kg testlerin ekrandaki değeri okumasına yarar;
 * veritabanından gelen "492.000" ile hesaplanan "492" aynı biçime insin diye Decimal'den geçer.
 */
export function Qty({ value, locale, unit = "kg" }: { value: Decimal.Value | null; locale: string; unit?: string }) {
  const t = useTranslations();
  if (value === null) return <span data-kg="unknown">{t("common.unknown")}</span>;
  return (
    <span data-kg={new Decimal(value).toString()}>
      {fmtNumber(value, locale)} {unit}
    </span>
  );
}

/** Kütle dengesi özeti: tolerans içinde mi, fark kaç kg ve girdinin yüzde kaçı. */
export function BalanceText({ mb, locale }: { mb: MassBalance; locale: string }) {
  const t = useTranslations("trace.balance");
  if (mb.withinTolerance === null) return <span data-balance="unknown">{t("unknown")}</span>;
  // Bir ondalık: %1,6 ile %2,4 tolerans sınırının iki yanında; yuvarlanınca ikisi de "%2" olurdu.
  const ratio = fmtPercent(mb.diffRatio!.times(100).toNumber(), locale, 1);
  return (
    <span data-balance={mb.withinTolerance ? "within" : "outside"}>
      {t(mb.withinTolerance ? "within" : "outside")} · {t("diff", { kg: fmtNumber(mb.diffKg!, locale), ratio })}
    </span>
  );
}
