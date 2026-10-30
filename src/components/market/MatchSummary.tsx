import { useLocale, useTranslations } from "next-intl";
import type { ListingMatch } from "@/db/repo/market";
import { MATCH_WEIGHTS, type MatchPart } from "@/domain/market";
import { fmtPercent } from "@/lib/format";

/** Eşleşme skoru ve gerekçesi. Bilinmeyen bileşen gizlenmez: skorun hangi ağırlıktan hesaplandığı yazılır. */
export function MatchSummary({ match, detailed = false }: { match: ListingMatch | null; detailed?: boolean }) {
  const t = useTranslations("market.match");
  const tc = useTranslations("common");
  const locale = useLocale();
  if (!match) return <p className="text-sm text-muted">{t("none")}</p>;
  if (match.excluded === "silk") {
    return (
      <p data-match-score="excluded" className="rounded-xl bg-canvas p-3 text-sm font-semibold text-ink">
        {t("excludedSilk")}
      </p>
    );
  }
  if (match.score === null) return <p className="text-sm text-muted">{t("unknown")}</p>;
  const parts = Object.keys(MATCH_WEIGHTS) as MatchPart[];
  return (
    <div className="grid gap-2 rounded-xl bg-canvas p-3 text-sm text-ink">
      <p>
        <span className="font-semibold">{t("title")}: </span>
        <span data-match-score={match.score} className="font-semibold">
          {t("score", { score: match.score })}
        </span>{" "}
        {t("against", { title: match.against.title })}
      </p>
      <div aria-hidden="true" className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-line">
        <div className="h-2 rounded-full bg-brand" style={{ width: `${match.score}%` }} />
      </div>
      {match.knownWeight < 100 && <p>{t("known", { weight: match.knownWeight })}</p>}
      {detailed && (
        <ul className="grid gap-x-4 sm:grid-cols-2">
          {parts.map((p) => (
            <li key={p} data-part={p} className="flex justify-between gap-4 border-b border-line py-1">
              <span>{t(`parts.${p}`)}</span>
              <span>{match.parts[p] === null ? tc("unknown") : fmtPercent(match.parts[p]! * 100, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
