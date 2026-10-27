import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { Notice } from "@/components/trace/Notice";
import { BalanceText, Qty } from "@/components/trace/Qty";
import { TableWrap, rowLink, td, th } from "@/components/trace/Table";
import { ChainStatus } from "@/components/trace/Timeline";
import { getDb } from "@/db/client";
import { traceOverview, type BatchRow } from "@/db/repo/trace";
import { can } from "@/domain/access";
import { Link } from "@/i18n/navigation";
import { fmtDate, fmtNumber } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";

// Kurumun izlenebilirlik özeti: teslim alınacaklar, partiler, üretim ve zincir hükmü. Hesap depoda ve alanda yapılır.
export default async function TracePage({ params, searchParams }: PageProps<"/[locale]/izlenebilirlik">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const o = await traceOverview(getDb(), viewer.orgId);
  const roles = viewer.roles.join(",");
  const canReceive = can(roles, "wasteBatch", "receive");
  const canProduce = can(roles, "production", "create");
  const unknown = t("common.unknown");

  const batchTable = (rows: BatchRow[], who: "seller" | "buyer", id: string, caption: string) => (
    <TableWrap label={caption}>
      <table className="w-full text-left text-sm">
        <caption id={id} className="sr-only">
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-fg/30">
            <th scope="col" className={th}>{t("trace.cols.code")}</th>
            <th scope="col" className={th}>{t("trace.cols.receivedAt")}</th>
            <th scope="col" className={th}>{t(`trace.cols.${who}`)}</th>
            <th scope="col" className={th}>{t("trace.cols.weighedKg")}</th>
            <th scope="col" className={th}>{t("trace.cols.acceptedKg")}</th>
            {who === "seller" && <th scope="col" className={th}>{t("trace.cols.remainingKg")}</th>}
            <th scope="col" className={th}>{t("trace.cols.status")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.batch.id} data-batch-code={r.batch.code} data-verified={r.batch.verified} className="border-b border-fg/15">
              <td className={td}>
                <Link href={`/izlenebilirlik/parti/${r.batch.id}`} className={rowLink}>
                  {r.batch.code}
                </Link>
              </td>
              <td className={td}>{fmtDate(r.batch.receivedAt, locale)}</td>
              <td className={td}>{r.counterpartyName ?? t("market.hiddenOrg")}</td>
              <td className={td}>
                <Qty value={r.batch.weighedKg} locale={locale} />
              </td>
              <td className={td}>
                <Qty value={r.accepted} locale={locale} />
              </td>
              {who === "seller" && (
                <td className={td}>
                  <Qty value={r.remaining} locale={locale} />
                </td>
              )}
              <td className={td}>
                <span className="flex flex-wrap items-center gap-1">
                  {t(r.batch.verified ? "trace.verified" : "trace.unverified")}
                  <ResultClassBadge value={r.batch.resultClass} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );

  return (
    <main id="main" className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-8 px-4 py-10">
      <div className="grid gap-2">
        <h1 className="font-display text-4xl">{t("trace.title")}</h1>
        <p className="max-w-prose">{t("trace.lead")}</p>
      </div>
      <Notice query={await searchParams} />
      <ChainStatus verdict={o.chain} />
      {!canReceive && !canProduce && (
        <p role="note" className="rounded border border-fg/30 px-3 py-2">
          {t("trace.readOnly")}
        </p>
      )}

      <section aria-labelledby="receivable-title" className="grid gap-3">
        <h2 id="receivable-title" className="text-2xl font-semibold">
          {t("trace.overview.receivable")}
        </h2>
        <p className="text-sm">{t("trace.overview.receivableHint")}</p>
        {o.receivable.length === 0 ? (
          <p>{t("trace.overview.noReceivable")}</p>
        ) : (
          <TableWrap label={t("trace.overview.receivable")}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-fg/30">
                  <th scope="col" className={th}>{t("trace.cols.plannedAt")}</th>
                  <th scope="col" className={th}>{t("trace.cols.seller")}</th>
                  <th scope="col" className={th}>{t("trace.cols.listing")}</th>
                  <th scope="col" className={th}>{t("trace.cols.plannedKg")}</th>
                  {canReceive && (
                    <th scope="col" className={th}>
                      <span className="sr-only">{t("trace.overview.receive")}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {o.receivable.map((r) => (
                  <tr key={r.id} data-delivery-id={r.id} className="border-b border-fg/15">
                    <td className={td}>{fmtDate(r.plannedAt, locale)}</td>
                    <td className={td}>{r.sellerName ?? t("market.hiddenOrg")}</td>
                    <td className={td}>{r.listingTitle ?? unknown}</td>
                    <td className={td}>{r.plannedKg === null ? unknown : fmtNumber(r.plannedKg, locale)}</td>
                    {canReceive && (
                      <td className={td}>
                        <Link href={`/izlenebilirlik/kabul/${r.id}`} className={rowLink}>
                          {t("trace.overview.receive")}
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>

      <section aria-labelledby="received-title" className="grid gap-3">
        <h2 id="received-title" className="text-2xl font-semibold">
          {t("trace.overview.received")}
        </h2>
        <p className="text-sm">{t("trace.verifiedHint")}</p>
        {o.received.length === 0 ? <p>{t("trace.overview.noReceived")}</p> : batchTable(o.received, "seller", "received-caption", t("trace.overview.received"))}
      </section>

      {o.supplied.length > 0 && (
        <section aria-labelledby="supplied-title" className="grid gap-3">
          <h2 id="supplied-title" className="text-2xl font-semibold">
            {t("trace.overview.supplied")}
          </h2>
          <p className="text-sm">{t("trace.overview.suppliedHint")}</p>
          {batchTable(o.supplied, "buyer", "supplied-caption", t("trace.overview.supplied"))}
        </section>
      )}

      <section aria-labelledby="productions-title" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="productions-title" className="text-2xl font-semibold">
            {t("trace.overview.productions")}
          </h2>
          {canProduce && (
            <Link href="/izlenebilirlik/uretim/yeni" className="inline-flex min-h-11 items-center rounded bg-accent px-4 font-semibold text-on-accent">
              {t("trace.overview.newProduction")}
            </Link>
          )}
        </div>
        {o.productions.length === 0 ? (
          <p>{t("trace.overview.noProductions")}</p>
        ) : (
          <TableWrap label={t("trace.overview.productions")}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-fg/30">
                  <th scope="col" className={th}>{t("trace.cols.code")}</th>
                  <th scope="col" className={th}>{t("trace.cols.startedAt")}</th>
                  <th scope="col" className={th}>{t("trace.cols.inputKg")}</th>
                  <th scope="col" className={th}>{t("trace.cols.outputKg")}</th>
                  <th scope="col" className={th}>{t("trace.cols.balance")}</th>
                  <th scope="col" className={th}>{t("trace.cols.lots")}</th>
                </tr>
              </thead>
              <tbody>
                {o.productions.map((p) => (
                  <tr key={p.production.id} data-production-code={p.production.code} className="border-b border-fg/15">
                    <td className={`${td} font-semibold`}>{p.production.code}</td>
                    <td className={td}>{fmtDate(p.production.startedAt, locale)}</td>
                    <td className={td}>
                      <Qty value={p.inputKg} locale={locale} />
                    </td>
                    <td className={td}>
                      <Qty value={p.production.outputKg} locale={locale} />
                    </td>
                    <td className={td}>
                      <BalanceText mb={p.massBalance} locale={locale} />
                    </td>
                    <td className={td}>
                      {p.lots.length === 0
                        ? "—"
                        : p.lots.map((l) => (
                            <Link key={l.id} href={`/izlenebilirlik/lot/${l.id}`} className={`${rowLink} me-2`}>
                              {l.code}
                            </Link>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>
    </main>
  );
}
