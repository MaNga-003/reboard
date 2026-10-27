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
    <main id="main" className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-8 px-4 py-10">
      <Link href="/izlenebilirlik" className="inline-flex min-h-11 items-center justify-self-start underline underline-offset-4">
        {t("trace.back")}
      </Link>
      <Notice query={await searchParams} />

      <article data-lot-code={lot.code} className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span data-test-status={lot.testStatus} className="font-semibold">
            {t(`trace.testStatus.${lot.testStatus}`)}
          </span>
          <ResultClassBadge value={g.resultClass} />
        </div>
        <h1 className="font-display text-4xl break-words">{t("trace.lot.title", { code: lot.code })}</h1>
        <p role="note" className="max-w-prose rounded border border-fg/30 px-3 py-2 text-sm">
          {t("trace.lot.testNote")}
        </p>
        {lot.isPublic && (
          <Link href={`/pasaport/${lot.code}`} data-passport-link className="inline-flex min-h-11 items-center justify-self-start underline underline-offset-4">
            {t("trace.lot.passport")}
          </Link>
        )}
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="font-semibold">{t("trace.lot.production")}</dt>
          <dd>{production.code}</dd>
          <dt className="font-semibold">{t("trace.lot.binder")}</dt>
          <dd>{t(`trace.binders.${production.binder}`)}</dd>
          <dt className="font-semibold">{t("trace.lot.sheets")}</dt>
          <dd>{lot.sheetCount ?? unknown}</dd>
          <dt className="font-semibold">{t("trace.lot.area")}</dt>
          <dd>
            <Qty value={lot.areaM2} locale={locale} unit="m²" />
          </dd>
          <dt className="font-semibold">{t("trace.lot.thickness")}</dt>
          <dd>
            <Qty value={lot.thicknessMm} locale={locale} unit="mm" />
          </dd>
          <dt className="font-semibold">{t("trace.lot.density")}</dt>
          <dd>
            <Qty value={lot.densityKgM3} locale={locale} unit="kg/m³" />
          </dd>
          <dt className="font-semibold">{t("trace.lot.textileKg")}</dt>
          <dd data-testid="textile-kg">
            <Qty value={g.textileKg} locale={locale} />
          </dd>
          <dt className="font-semibold">{t("trace.lot.verifiedTextileKg")}</dt>
          <dd data-testid="verified-kg">
            <Qty value={g.verifiedTextileKg} locale={locale} />
          </dd>
          <dt className="font-semibold">{t("trace.lot.share")}</dt>
          <dd>{g.lotShare === null ? unknown : fmtPercent(g.lotShare.times(100).toNumber(), locale, 1)}</dd>
        </dl>
      </article>

      <section aria-labelledby="tree-title" className="grid gap-3">
        <h2 id="tree-title" className="text-2xl font-semibold">
          {t("trace.lot.tree")}
        </h2>
        <p className="text-sm">{t("trace.lot.treeHint")}</p>
        <ul data-testid="genealogy" className="grid gap-2 text-sm">
          <li className="grid gap-2">
            <span className="font-semibold">{lot.code}</span>
            <ul className="grid gap-2 border-s-2 border-fg/30 ps-4">
              <li className="grid gap-2">
                <span>
                  <span className="font-semibold">{production.code}</span> · {t("trace.cols.outputKg")}: <Qty value={production.outputKg} locale={locale} />
                </span>
                <ul className="grid gap-2 border-s-2 border-fg/30 ps-4">
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
          <h2 id="fibre-title" className="text-2xl font-semibold">
            {t("trace.lot.fibreKg")}
          </h2>
          {g.fibreKg === null ? (
            <p>{unknown}</p>
          ) : (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              {fibres.map((f) => (
                <div key={f} data-fibre={f} className="contents">
                  <dt className="font-semibold">{t(`fibres.${f}`)}</dt>
                  <dd>
                    <Qty value={g.fibreKg![f]} locale={locale} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
        <section aria-labelledby="supplier-title" className="grid content-start gap-3">
          <h2 id="supplier-title" className="text-2xl font-semibold">
            {t("trace.lot.bySupplier")}
          </h2>
          {g.bySupplierKg === null ? (
            <p>{unknown}</p>
          ) : (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              {[...g.bySupplierKg].map(([org, kg]) => (
                <div key={org} data-supplier={v.supplierNames.get(org) ?? ""} className="contents">
                  <dt className="font-semibold">{v.supplierNames.get(org) ?? t("market.hiddenOrg")}</dt>
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
        <h2 id="balance-title" className="text-2xl font-semibold">
          {t("trace.lot.massBalance")}
        </h2>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="font-semibold">{t("trace.lot.input")}</dt>
          <dd>
            <Qty value={g.massBalance.inputKg} locale={locale} />
          </dd>
          <dt className="font-semibold">{t("trace.lot.accounted")}</dt>
          <dd>
            <Qty value={g.massBalance.accountedKg} locale={locale} />
          </dd>
        </dl>
        <p className="text-sm">
          <BalanceText mb={g.massBalance} locale={locale} />
        </p>
      </section>

      <section aria-labelledby="timeline-title" className="grid gap-3">
        <h2 id="timeline-title" className="text-2xl font-semibold">
          {t("trace.lot.timeline")}
        </h2>
        <ChainStatus verdict={v.chain} />
        <Timeline events={v.timeline} locale={locale} />
      </section>
    </main>
  );
}
