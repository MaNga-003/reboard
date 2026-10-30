import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { Notice } from "@/components/trace/Notice";
import { BalanceText, Qty } from "@/components/trace/Qty";
import { ChainStatus, Timeline } from "@/components/trace/Timeline";
import { getDb } from "@/db/client";
import { lotGenealogy } from "@/db/repo/trace";
import { FIBRES } from "@/domain/fibre";
import { Link } from "@/i18n/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { PageBanner } from "@/components/ui/PageHeader";
import { btnPrimary, h2, note, page } from "@/components/ui/classes";
import { fmtNumber, fmtPercent } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";

// Panel lotunun soy ağacı: lottan üretim partisine, oradan atık partilerine ve sağlayıcılara (iç içe liste, D-023).
export default async function LotPage({ params, searchParams }: PageProps<"/[locale]/izlenebilirlik/lot/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const v = await lotGenealogy(getDb(), viewer.orgId, id);
  if (!v) notFound();
  const g = v.genealogy;
  const { lot, production } = v;
  const unknown = t("common.unknown");
  const supplierOf = new Map(v.wastes.map((w) => [w.id, w.supplierName]));
  const fibres = g.fibreKg ? FIBRES.filter((f) => g.fibreKg![f].gt(0)) : [];

  return (
    <main id="main" className={`${page} gap-8`}>
      <BackLink href="/izlenebilirlik">{t("trace.back")}</BackLink>
      <Notice query={await searchParams} />

      <article data-lot-code={lot.code} className="grid gap-6">
        <PageBanner
          still="press"
          title={t("trace.lot.title", { code: lot.code })}
          lead={
            <p role="note" className="max-w-prose">
              {t("trace.lot.testNote")}
            </p>
          }
          actions={
            <>
              <span data-test-status={lot.testStatus} className="rounded-full bg-surface px-3 text-sm font-semibold leading-8 text-ink">
                {t(`trace.testStatus.${lot.testStatus}`)}
              </span>
              <ResultClassBadge value={g.resultClass} />
              {lot.isPublic && (
                <Link href={`/pasaport/${lot.code}`} data-passport-link className={btnPrimary}>
                  {t("trace.lot.passport")}
                </Link>
              )}
            </>
          }
        />
        <dl className="grid gap-x-6 gap-y-2.5 rounded-2xl border border-line bg-surface p-5 text-sm shadow-card sm:grid-cols-[max-content_1fr] [&_dd]:text-ink">
          <dt className="font-medium text-muted">{t("trace.lot.production")}</dt>
          <dd>{production.code}</dd>
          <dt className="font-medium text-muted">{t("trace.lot.binder")}</dt>
          <dd>{t(`trace.binders.${production.binder}`)}</dd>
          <dt className="font-medium text-muted">{t("trace.lot.sheets")}</dt>
          <dd>{lot.sheetCount ?? unknown}</dd>
          <dt className="font-medium text-muted">{t("trace.lot.area")}</dt>
          <dd>
            <Qty value={lot.areaM2} locale={locale} unit="m²" />
          </dd>
          <dt className="font-medium text-muted">{t("trace.lot.thickness")}</dt>
          <dd>
            <Qty value={lot.thicknessMm} locale={locale} unit="mm" />
          </dd>
          <dt className="font-medium text-muted">{t("trace.lot.density")}</dt>
          <dd>
            <Qty value={lot.densityKgM3} locale={locale} unit="kg/m³" />
          </dd>
          <dt className="font-medium text-muted">{t("trace.lot.textileKg")}</dt>
          <dd data-testid="textile-kg">
            <Qty value={g.textileKg} locale={locale} />
          </dd>
          <dt className="font-medium text-muted">{t("trace.lot.verifiedTextileKg")}</dt>
          <dd data-testid="verified-kg">
            <Qty value={g.verifiedTextileKg} locale={locale} />
          </dd>
          <dt className="font-medium text-muted">{t("trace.lot.share")}</dt>
          <dd>{g.lotShare === null ? unknown : fmtPercent(g.lotShare.times(100).toNumber(), locale, 1)}</dd>
        </dl>
      </article>

      <section aria-labelledby="tree-title" className="grid gap-3">
        <h2 id="tree-title" className={h2}>
          {t("trace.lot.tree")}
        </h2>
        <p className="text-sm text-muted">{t("trace.lot.treeHint")}</p>
        <ul data-testid="genealogy" className="grid gap-2 rounded-2xl border border-line bg-surface p-5 text-sm text-ink shadow-card">
          <li className="grid gap-2">
            <span className="font-semibold">{lot.code}</span>
            <ul className="grid gap-2 border-s-2 border-line-strong ps-4">
              <li className="grid gap-2">
                <span>
                  <span className="font-semibold">{production.code}</span> · {t("trace.cols.outputKg")}: <Qty value={production.outputKg} locale={locale} />
                </span>
                <ul className="grid gap-2 border-s-2 border-line-strong ps-4">
                  {g.sources.map((s) => (
                    <li key={s.waste.id} data-batch-code={s.waste.code} data-verified={s.waste.verified} className="flex flex-wrap items-center gap-x-2">
                      <Link href={`/izlenebilirlik/parti/${s.waste.id}`} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                        {s.waste.code}
                      </Link>
                      <span>{supplierOf.get(s.waste.id) ?? t("market.hiddenOrg")}</span>
                      <span>· {t("trace.lot.allocated", { kg: fmtNumber(s.allocatedKg, locale) })}</span>
                      <span>· {s.lotKg === null ? unknown : t("trace.lot.inLot", { kg: fmtNumber(s.lotKg, locale) })}</span>
                      <span>· {t(s.waste.verified ? "trace.verified" : "trace.unverified")}</span>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="fibre-title" className="grid content-start gap-3">
          <h2 id="fibre-title" className={h2}>
            {t("trace.lot.fibreKg")}
          </h2>
          {g.fibreKg === null ? (
            <p className={note}>{unknown}</p>
          ) : (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 rounded-2xl border border-line bg-surface p-5 text-sm shadow-card [&_dd]:text-ink">
              {fibres.map((f) => (
                <div key={f} data-fibre={f} className="contents">
                  <dt className="font-medium text-muted">{t(`fibres.${f}`)}</dt>
                  <dd>
                    <Qty value={g.fibreKg![f]} locale={locale} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
        <section aria-labelledby="supplier-title" className="grid content-start gap-3">
          <h2 id="supplier-title" className={h2}>
            {t("trace.lot.bySupplier")}
          </h2>
          {g.bySupplierKg === null ? (
            <p className={note}>{unknown}</p>
          ) : (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 rounded-2xl border border-line bg-surface p-5 text-sm shadow-card [&_dd]:text-ink">
              {[...g.bySupplierKg].map(([org, kg]) => (
                <div key={org} data-supplier={v.supplierNames.get(org) ?? ""} className="contents">
                  <dt className="font-medium text-muted">{v.supplierNames.get(org) ?? t("market.hiddenOrg")}</dt>
                  <dd>
                    <Qty value={kg} locale={locale} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      <section aria-labelledby="balance-title" className="grid gap-3">
        <h2 id="balance-title" className={h2}>
          {t("trace.lot.massBalance")}
        </h2>
        <dl className="grid gap-x-6 gap-y-2.5 rounded-2xl border border-line bg-surface p-5 text-sm shadow-card sm:grid-cols-[max-content_1fr] [&_dd]:text-ink">
          <dt className="font-medium text-muted">{t("trace.lot.input")}</dt>
          <dd>
            <Qty value={g.massBalance.inputKg} locale={locale} />
          </dd>
          <dt className="font-medium text-muted">{t("trace.lot.accounted")}</dt>
          <dd>
            <Qty value={g.massBalance.accountedKg} locale={locale} />
          </dd>
        </dl>
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink shadow-card">
          <BalanceText mb={g.massBalance} locale={locale} />
        </p>
      </section>

      <section aria-labelledby="timeline-title" className="grid gap-3">
        <h2 id="timeline-title" className={h2}>
          {t("trace.lot.timeline")}
        </h2>
        <ChainStatus verdict={v.chain} />
        <Timeline events={v.timeline} locale={locale} />
      </section>
    </main>
  );
}
