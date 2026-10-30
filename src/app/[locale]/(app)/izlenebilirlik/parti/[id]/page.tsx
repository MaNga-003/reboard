import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { EvidenceForm } from "@/components/trace/EvidenceForm";
import { Notice } from "@/components/trace/Notice";
import { Qty } from "@/components/trace/Qty";
import { Timeline } from "@/components/trace/Timeline";
import { getDb } from "@/db/client";
import { wasteBatchDetail } from "@/db/repo/trace";
import { can } from "@/domain/access";
import { compositionShares } from "@/domain/fibre";
import { BackLink } from "@/components/ui/BackLink";
import { PageBanner } from "@/components/ui/PageHeader";
import { btnSecondary, card, cardPad, h2, note, page } from "@/components/ui/classes";
import { fmtDateTime, fmtNumber, fmtPercent } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";
import { checkEvidenceAction } from "../../actions";

const button = btnSecondary;
const chip = "rounded-full border border-line-strong bg-canvas px-2.5 text-xs font-semibold leading-6 text-muted";

// Atık partisi: alıcı tartımı, kanıtları ve tahsisleri görür; sağlayıcı yalnızca tartımı ve doğrulama sonucunu görür (D-013).
export default async function BatchPage({ params, searchParams }: PageProps<"/[locale]/izlenebilirlik/parti/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const d = await wasteBatchDetail(getDb(), viewer.orgId, id);
  if (!d) notFound();
  const b = d.batch;
  const roles = viewer.roles.join(",");
  const canUpload = d.own && can(roles, "evidence", "upload");
  const canCheck = d.own && can(roles, "evidence", "check");
  const unknown = t("common.unknown");
  const silk = b.containsSilk === null ? "unknown" : b.containsSilk ? "yes" : "no";
  const hasTicket = d.evidence.some((e) => e.kind === "weighbridge_ticket");

  return (
    <main id="main" className={`${page} gap-8`}>
      <BackLink href="/izlenebilirlik">{t("trace.back")}</BackLink>
      <Notice query={await searchParams} />

      <article data-batch-code={b.code} data-verified={b.verified} className="grid gap-6">
        <PageBanner
          still="weighing"
          title={t("trace.batch.title", { code: b.code })}
          lead={!b.verified ? t("trace.verifiedHint") : undefined}
          actions={
            <>
              <span className="rounded-full bg-surface px-3 text-sm font-semibold leading-8 text-ink">{t(b.verified ? "trace.verified" : "trace.unverified")}</span>
              <ResultClassBadge value={b.resultClass} />
            </>
          }
        />
        <dl className="grid gap-x-6 gap-y-2.5 rounded-2xl border border-line bg-surface p-5 text-sm shadow-card sm:grid-cols-[max-content_1fr] [&_dd]:text-ink">
          <dt className="font-medium text-muted">{t("trace.batch.supplier")}</dt>
          <dd>{d.supplierName ?? t("market.hiddenOrg")}</dd>
          <dt className="font-medium text-muted">{t("trace.batch.receiver")}</dt>
          <dd>{d.receiverName ?? t("market.hiddenOrg")}</dd>
          <dt className="font-medium text-muted">{t("trace.batch.receivedAt")}</dt>
          <dd>{fmtDateTime(b.receivedAt, locale)}</dd>
          <dt className="font-medium text-muted">{t("trace.batch.declared")}</dt>
          <dd data-testid="declared">
            <Qty value={b.declaredKg} locale={locale} />
          </dd>
          <dt className="font-medium text-muted">{t("trace.batch.weighed")}</dt>
          <dd data-testid="weighed">
            <Qty value={b.weighedKg} locale={locale} />
          </dd>
          <dt className="font-medium text-muted">{t("trace.batch.gap")}</dt>
          <dd data-gap={d.gap?.toString() ?? "unknown"}>{d.gap === null ? unknown : fmtPercent(d.gap.times(100).toNumber(), locale, 1)}</dd>
          <dt className="font-medium text-muted">{t("trace.batch.moisture")}</dt>
          <dd>{b.moisturePct === null ? unknown : fmtPercent(Number(b.moisturePct), locale, 2)}</dd>
          <dt className="font-medium text-muted">{t("trace.batch.rejected")}</dt>
          <dd>
            <Qty value={b.rejectedKg} locale={locale} />
          </dd>
          <dt className="font-medium text-muted">{t("trace.batch.accepted")}</dt>
          <dd data-testid="accepted">
            <Qty value={d.accepted} locale={locale} />
          </dd>
          {d.own && (
            <>
              <dt className="font-medium text-muted">{t("trace.batch.remaining")}</dt>
              <dd data-testid="remaining">
                <Qty value={d.remaining} locale={locale} />
              </dd>
            </>
          )}
          <dt className="font-medium text-muted">{t("trace.batch.composition")}</dt>
          <dd>
            {b.composition
              ? compositionShares(b.composition)
                  .map(([f, v]) => `${t(`fibres.${f}`)} ${fmtPercent(v, locale)}`)
                  .join(" · ")
              : unknown}
          </dd>
          <dt className="font-medium text-muted">{t("trace.batch.silk")}</dt>
          <dd data-silk={silk}>{t(`market.silk.${silk}`)}</dd>
          {b.notes && (
            <>
              <dt className="font-medium text-muted">{t("trace.batch.notes")}</dt>
              <dd className="wrap-anywhere">{b.notes}</dd>
            </>
          )}
        </dl>
      </article>

      {d.own && (
        <section aria-labelledby="evidence-title" className="grid gap-3">
          <h2 id="evidence-title" className={h2}>
            {t("trace.batch.evidence")}
          </h2>
          {d.evidence.length === 0 ? (
            <p className={note}>{t("trace.batch.noEvidence")}</p>
          ) : (
            <ul className="grid gap-3">
              {d.evidence.map((e) => (
                <li key={e.id} data-evidence-id={e.id} data-status={e.status} className={`${card} grid gap-2 p-4`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{t(`trace.evidenceKinds.${e.kind}`)}</span>
                    <span className={chip}>{t(`trace.evidenceStatus.${e.status}`)}</span>
                    <ResultClassBadge value={e.resultClass} />
                  </div>
                  <p className="text-sm break-all text-muted">
                    {e.fileName} · {t("trace.batch.size", { kb: fmtNumber(e.sizeBytes / 1024, locale, 1) })} · {fmtDateTime(e.createdAt, locale)}
                  </p>
                  <p className="font-mono text-xs break-all text-subtle">SHA-256 {e.sha256}</p>
                  <div className="flex flex-wrap gap-2">
                    {/* API yolu dil önekli değil; next-intl Link'i yerine düz bağlantı. */}
                    <a href={`/api/evidence/${e.id}`} className={button} download>
                      {t("trace.batch.download")}
                    </a>
                    {canCheck && e.status === "declared" && (
                      <form action={checkEvidenceAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="batchId" value={b.id} />
                        <input type="hidden" name="id" value={e.id} />
                        <button type="submit" className={button}>
                          {t("trace.batch.check")}
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canUpload && (
            <div className={`${cardPad} grid gap-4`}>
              <h3 className={h2}>{t("trace.batch.uploadTitle")}</h3>
              <EvidenceForm locale={locale} wasteBatchId={b.id} defaultKind={hasTicket ? "photo" : "weighbridge_ticket"} />
            </div>
          )}
        </section>
      )}

      {d.own && (
        <section aria-labelledby="alloc-title" className="grid gap-3">
          <h2 id="alloc-title" className={h2}>
            {t("trace.batch.allocations")}
          </h2>
          {d.allocations.length === 0 ? (
            <p className={note}>{t("trace.batch.noAllocations")}</p>
          ) : (
            <ul className="grid gap-2 text-sm text-ink">
              {d.allocations.map((a) => (
                <li key={a.productionId} data-production-code={a.code}>
                  <span className="font-semibold">{a.code}</span> · <Qty value={a.kg} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Olaylar alıcının zincirinde durur; sağlayıcının kendi zincirinde bu partiye dokunan olay yoktur. */}
      {d.own && (
        <section aria-labelledby="timeline-title" className="grid gap-3">
          <h2 id="timeline-title" className={h2}>
            {t("trace.batch.timeline")}
          </h2>
          <Timeline events={d.timeline} locale={locale} />
        </section>
      )}
    </main>
  );
}
