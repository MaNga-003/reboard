import { useTranslations } from "next-intl";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import type { MarketRow } from "@/db/repo/market";
import { Link } from "@/i18n/navigation";
import { ListingFacts } from "./ListingFacts";
import { MatchSummary } from "./MatchSummary";

export function ListingCard({ row }: { row: MarketRow }) {
  const t = useTranslations("market");
  const l = row.listing;
  return (
    <article data-listing-id={l.id} data-kind={l.kind} className="grid gap-3 rounded border border-fg/30 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{t(`kinds.${l.kind}`)}</span>
        <ResultClassBadge value={l.resultClass} />
        {row.own && <span className="rounded bg-fg/10 px-2 leading-6">{t("yours")}</span>}
      </div>
      <h2 className="text-xl font-semibold">
        <Link href={`/pazar/${l.id}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
          {l.title}
        </Link>
      </h2>
      <ListingFacts row={row} />
      {row.own ? <p className="text-sm">{t("openOffers", { count: row.openOffers })}</p> : <MatchSummary match={row.match} />}
    </article>
  );
}
