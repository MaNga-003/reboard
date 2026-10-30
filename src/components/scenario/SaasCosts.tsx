import { useLocale, useTranslations } from "next-intl";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { TableWrap, rowLink, td, th } from "@/components/trace/Table";
import type { SaasCostData } from "@/db/repo/saas";
import type { CostTotal, SaasCostLine, SaasStageSummary } from "@/domain/calc";
import { Decimal, weakestClass, type Currency } from "@/domain/result";
import { fmtDate, fmtList, fmtMoney, fmtNumber } from "@/lib/format";

const currencyText = (c: Currency) => (c === "TRY" ? "TL" : c);

/** Toplam kutusu. Sınıf rozeti zorunlu (D-011); bilinmeyen kalem varsa toplam yazılmaz, adı yazılır. */
function Total({ id, label, total, lines }: { id: string; label: string; total: CostTotal; lines: SaasCostLine[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const items = total.unknown.map((k) => t(`saasCosts.items.${lines.find((l) => l.key === k)!.item}`));
  const value =
    total.value !== null
      ? t("saasCosts.tryMonth", { amount: fmtMoney(total.value, locale) })
      : total.atLeast !== null
        ? t("saasCosts.atLeast", { amount: fmtMoney(total.atLeast, locale) })
        : t("common.unknown");
  return (
    <div data-kpi={id} className="grid min-w-0 content-start gap-1.5 rounded-2xl border border-t-4 border-line border-t-brand bg-surface p-5 shadow-card">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd data-value className="text-3xl font-semibold tracking-tight text-ink break-words [font-variant-numeric:normal]">
        {value}
      </dd>
      <dd className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <ResultClassBadge value={total.resultClass} />
      </dd>
      {items.length > 0 && (
        <dd data-unknown className="text-sm text-muted">
          {t("saasCosts.unknownItems", { items: fmtList(items, locale) })}
        </dd>
      )}
      {total.fxUnknown && <dd className="text-sm text-muted">{t("saasCosts.fxMissing")}</dd>}
    </div>
  );
}

function Stage({ summary, data }: { summary: SaasStageSummary; data: SaasCostData }) {
  const t = useTranslations();
  const locale = useLocale();
  const s = summary.stage;
  const amount = (v: Decimal.Value | null, c: Currency) =>
    v === null ? t("common.unknown") : t("saasCosts.amount", { amount: fmtMoney(new Decimal(v), locale), currency: currencyText(c) });
  return (
    <div data-stage={s} className="grid gap-4">
      <div className="grid gap-1">
        <h3 id={`saas-${s}`} className="text-lg font-semibold tracking-tight text-ink">
          {t(`saasCosts.stages.${s}.title`)}
        </h3>
        <p className="max-w-prose text-sm text-muted">{t(`saasCosts.stages.${s}.intro`)}</p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Total id={`saas-${s}-monthly`} label={t("saasCosts.monthly")} total={summary.monthly} lines={summary.lines} />
        <Total id={`saas-${s}-per-customer`} label={t("saasCosts.perCustomer")} total={summary.perCustomer} lines={summary.lines} />
      </dl>
      <TableWrap label={t(`saasCosts.stages.${s}.title`)}>
        <table className="w-full">
          <thead>
            <tr>
              {(["item", "monthly", "perCustomer"] as const).map((c) => (
                <th key={c} scope="col" className={`${th} text-start`}>
                  {t(`saasCosts.columns.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.lines.map((l) => {
              const row = data.rows.get(l.key)!;
              const url = new URL(row.sourceUrl);
              return (
                <tr key={l.key} data-line={l.key} className="border-t border-line">
                  {/* Kaynak ve tarih kalem hücresinde: dar ekranda ayrı sütun kaydırma alanının dışında kalıyordu (390 px, 27 Ekim). */}
                  <th scope="row" className={`${td} text-start font-normal`}>
                    <span className="block font-semibold text-ink">{t(`saasCosts.items.${l.item}`)}</span>
                    <span className="block">{row.vendor ? [row.vendor, row.plan].filter(Boolean).join(" ") : t("saasCosts.noVendor")}</span>
                    <span className="block text-sm text-muted">{t(`saasCosts.notes.${l.key}`)}</span>
                    <span data-source className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span>{t("saasCosts.columns.source")}:</span>
                      <a href={row.sourceUrl} rel="noreferrer" className={rowLink}>
                        {url.host}
                      </a>
                      <span>{t("saasCosts.retrieved", { date: fmtDate(row.retrievedAt, locale) })}</span>
                    </span>
                  </th>
                  <td data-monthly className={`${td} whitespace-nowrap`}>
                    {amount(l.monthly, l.currency)}
                  </td>
                  <td data-per-customer className={td}>
                    <span className="block whitespace-nowrap">{amount(l.perCustomer, l.currency)}</span>
                    {l.unitPrice !== null && row.usageUnit && (
                      <span data-unit-price className="block text-sm">
                        {t("saasCosts.unitPrice", {
                          amount: fmtNumber(l.unitPrice, locale, 6),
                          currency: currencyText(l.currency),
                          unit: t(`saasCosts.units.${row.usageUnit}`),
                        })}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}

/** SaaS gider tablosu (T2.6, D-027): iki kurulum, her satırda kaynak ve okunma tarihi; hesap src/domain/calc'ta. */
export function SaasCosts({ data }: { data: SaasCostData }) {
  const t = useTranslations();
  const locale = useLocale();
  const fx = data.usdTry;
  const classes = data.stages.flatMap((s) => [s.monthly.resultClass, s.perCustomer.resultClass]);
  return (
    <section aria-labelledby="sc-saas" className="grid gap-8">
      <div className="grid gap-2">
        <h2 id="sc-saas" className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-ink">
          {t("saasCosts.title")}
          {classes.length > 0 && <ResultClassBadge value={weakestClass(classes)} />}
        </h2>
        <p className="max-w-prose text-base leading-relaxed text-muted">{t("saasCosts.intro")}</p>
        {fx ? (
          <p data-fx className="flex flex-wrap items-center gap-x-2 text-sm">
            <span>{t("saasCosts.fx", { rate: fmtNumber(fx.value, locale, 4), date: fmtDate(fx.period ?? fx.retrievedAt, locale) })}</span>
            <a href={fx.sourceUrl} rel="noreferrer" className={rowLink}>
              {t("saasCosts.fxSource")}
            </a>
            <ResultClassBadge value={fx.resultClass} />
          </p>
        ) : (
          <p className="text-sm text-muted">{t("saasCosts.fxMissing")}</p>
        )}
      </div>
      {data.stages.length === 0 ? (
        <p data-empty>{t("saasCosts.empty")}</p>
      ) : (
        data.stages.map((s) => <Stage key={s.stage} summary={s} data={data} />)
      )}
    </section>
  );
}
