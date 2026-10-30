import { useLocale, useTranslations } from "next-intl";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { TableWrap, rowLink, td, th } from "@/components/trace/Table";
import type { ScenarioReference } from "@/db/repo/scenario";
import { weakestClass } from "@/domain/result";
import { fmtDate, fmtNumber } from "@/lib/format";

/**
 * Karşılaştırma için kaynaklı değerler (D-029). Senaryo girdisi değildir, hesaba girmez.
 * Her satırda kaynak bağlantısı, okunma tarihi ve sınıf rozeti; KDV durumu kaynağın yazdığı gibi.
 */
export function ScenarioReferences({ items }: { items: ScenarioReference[] }) {
  const t = useTranslations();
  const locale = useLocale();
  if (items.length === 0) return null;
  const num = (v: string) => fmtNumber(v, locale, 3);
  return (
    <section aria-labelledby="sc-references" className="grid gap-3">
      <h2 id="sc-references" className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-ink">
        {t("scenario.references.title")}
        <ResultClassBadge value={weakestClass(items.flatMap((i) => i.rows.map((r) => r.resultClass)))} />
      </h2>
      <p className="max-w-prose text-base leading-relaxed text-muted">{t("scenario.references.intro")}</p>
      <TableWrap label={t("scenario.references.title")}>
        <table className="w-full">
          <thead>
            <tr>
              {/* th, tablonun "start" hizasını miras almaz (tarayıcı ortalar); hiza hücreye yazılır. */}
              <th scope="col" className={`${th} text-start`}>
                {t("scenario.references.columns.item")}
              </th>
              <th scope="col" className={`${th} text-start`}>
                {t("scenario.references.columns.value")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ id, input, rows }) => {
              const [low, high] = rows;
              const src = rows[0];
              const amount = high ? t("scenario.references.range", { low: num(low.value), high: num(high.value) }) : num(low.value);
              return (
                <tr key={id} data-reference={id} className="border-t border-line">
                  <th scope="row" className={`${td} text-start font-normal`}>
                    <span className="block font-semibold text-ink">{t(`scenario.references.items.${id}.label`)}</span>
                    <span className="block text-sm text-muted">{t(`scenario.references.items.${id}.note`)}</span>
                    <span data-input={input} className="block text-sm">
                      {t("scenario.references.input", { field: t(`scenario.fields.${input}`) })}
                    </span>
                    <span data-source className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span>{t("saasCosts.columns.source")}:</span>
                      <a href={src.sourceUrl} rel="noreferrer" className={rowLink}>
                        {new URL(src.sourceUrl).host}
                      </a>
                      <span>{t("saasCosts.retrieved", { date: fmtDate(src.retrievedAt, locale) })}</span>
                    </span>
                  </th>
                  <td data-value className={td}>
                    {/* Dar ekranda aralık iki satıra bölünür; tek satır 360 px'te tabloyu 25 px kaydırıyordu (28 Ekim). */}
                    <span className="block">
                      {t(`scenario.references.items.${id}.value`, { amount })}
                    </span>
                    <span className="mt-1 flex">
                      <ResultClassBadge value={weakestClass(rows.map((r) => r.resultClass))} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </section>
  );
}
