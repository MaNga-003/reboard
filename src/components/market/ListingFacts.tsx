import { useLocale, useTranslations } from "next-intl";
import type { MarketRow } from "@/db/repo/market";
import { compositionShares } from "@/domain/fibre";
import { isWaste } from "@/domain/market";
import { fmtDate, fmtNumber, fmtPercent } from "@/lib/format";
import { PriceText } from "./PriceText";

/** İlanın künyesi; kart ve ayrıntı sayfası aynı alanları aynı sırada gösterir. Bilinmeyen alan "bilinmiyor" yazar. */
export function ListingFacts({ row }: { row: Pick<MarketRow, "listing" | "orgName" | "distanceKm"> }) {
  const t = useTranslations();
  const locale = useLocale();
  const l = row.listing;
  const silk = l.containsSilk === null ? "unknown" : l.containsSilk ? "yes" : "no";
  const unknown = t("common.unknown");

  return (
    <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
      <dt className="font-semibold">{t("market.detail.owner")}</dt>
      <dd>{row.orgName ?? t("market.hiddenOrg")}</dd>
      <dt className="font-semibold">{t("market.quantity")}</dt>
      <dd data-testid="quantity">
        {fmtNumber(l.quantity, locale)} {t(`units.${l.unit}`)} · {t(`market.recurrence.${l.recurrence}`)}
        {l.recurrence !== "once" && ` (${t("market.perDelivery")})`}
      </dd>
      <dt className="font-semibold">{t("market.price")}</dt>
      <dd>
        <PriceText unitPrice={l.unitPrice} currency={l.currency} taxBasis={l.taxBasis} unit={l.priceUnit ?? l.unit} />
      </dd>
      <dt className="font-semibold">{t("market.location")}</dt>
      <dd>
        {l.district ?? unknown}
        {row.distanceKm && ` · ${t("market.distance", { km: fmtNumber(row.distanceKm, locale, 1) })} ${t("common.asTheCrowFlies")}`}
      </dd>
      {isWaste(l.kind) && (
        <>
          <dt className="font-semibold">{t("market.composition")}</dt>
          <dd>
            {l.composition
              ? compositionShares(l.composition)
                  .map(([f, v]) => `${t(`fibres.${f}`)} ${fmtPercent(v, locale)}`)
                  .join(" · ")
              : unknown}
            {" · "}
            <span data-silk={silk} className={silk === "no" ? undefined : "font-semibold"}>
              {t(`market.silk.${silk}`)}
            </span>
          </dd>
        </>
      )}
      <dt className="font-semibold">{t("market.window")}</dt>
      <dd>
        {t("market.windowValue", {
          start: l.windowStart ? fmtDate(l.windowStart, locale) : unknown,
          end: l.windowEnd ? fmtDate(l.windowEnd, locale) : unknown,
        })}
      </dd>
    </dl>
  );
}
