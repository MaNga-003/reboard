import { useTranslations } from "next-intl";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { card, type StillName } from "@/components/ui/classes";
import { Still } from "@/components/ui/Still";
import type { MarketRow } from "@/db/repo/market";
import type { ListingKind } from "@/domain/market";
import { Link } from "@/i18n/navigation";
import { ListingFacts } from "./ListingFacts";
import { MatchSummary } from "./MatchSummary";

/** İlan türüne göre hikâyenin render karesi: atık ilanları kumaş ve kırpıntı, panel ilanları pres ve oda. */
export const KIND_STILL: Record<ListingKind, StillName> = {
  waste_offer: "fabric",
  waste_request: "scraps",
  panel_offer: "press",
  panel_request: "room",
};

export function ListingCard({ row }: { row: MarketRow }) {
  const t = useTranslations("market");
  const l = row.listing;
  return (
    <article data-listing-id={l.id} data-kind={l.kind} className={`${card} group grid content-start overflow-hidden`}>
      <div className="relative isolate h-32 overflow-hidden bg-side">
        <Still name={KIND_STILL[l.kind]} className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-side/80 to-transparent" />
        <div className="absolute inset-x-4 bottom-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-surface px-2.5 font-semibold leading-6 text-ink">{t(`kinds.${l.kind}`)}</span>
          <ResultClassBadge value={l.resultClass} />
          {row.own && <span className="rounded-full bg-brand px-2.5 font-semibold leading-6 text-on-brand">{t("yours")}</span>}
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:p-5">
        <h2 className="text-lg font-semibold leading-snug tracking-tight text-ink">
          <Link href={`/pazar/${l.id}`} className="inline-flex min-h-11 items-center hover:text-brand">
            {l.title}
          </Link>
        </h2>
        <ListingFacts row={row} />
        {row.own ? <p className="text-sm text-muted">{t("openOffers", { count: row.openOffers })}</p> : <MatchSummary match={row.match} />}
      </div>
    </article>
  );
}
