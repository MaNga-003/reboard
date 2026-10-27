import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChainList, PassportTimeline } from "@/components/passport/PassportParts";
import { QrCode } from "@/components/passport/QrCode";
import { VerifyButton } from "@/components/passport/VerifyButton";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { BalanceText, Qty } from "@/components/trace/Qty";
import { getDb } from "@/db/client";
import { publicPassport } from "@/db/repo/passport";
import { anchorStatus, formatAnchor, parseAnchor } from "@/domain/traceability";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { fmtDate, fmtNumber, fmtPercent } from "@/lib/format";

const tap = "inline-flex min-h-11 items-center rounded px-3";

export async function generateMetadata({ params }: PageProps<"/[locale]/pasaport/[lot]">): Promise<Metadata> {
  const { locale, lot } = await params;
  const t = await getTranslations({ locale });
  return { title: t("passport.metaTitle", { code: lot }), description: t("passport.lead") };
}

/** Kullanıcının açtığı adres; QR aynı sunucuyu göstersin diye istekten okunur. Yanlış Host yalnızca isteyenin kendi yanıtını etkiler. */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Dijital ürün pasaportu (T2.4, D-025): girişsiz açılır. Soy ağacı, lif bileşimi, kütle dengesi, test durumu ve zincir doğrulaması.
export default async function PassportPage({ params, searchParams }: PageProps<"/[locale]/pasaport/[lot]">) {
  const { locale, lot: code } = await params;
  setRequestLocale(locale);
  const raw = (await searchParams).a;
  const given = typeof raw === "string" ? raw : null;
  const label = parseAnchor(given);
  const v = await publicPassport(getDb(), code, label);
  if (!v) notFound();
  const t = await getTranslations();
  const unknown = t("common.unknown");
  const anchor = v.anchor && formatAnchor(v.anchor);
  const url = `${await origin()}/${locale}/pasaport/${v.lot.code}${anchor ? `?a=${anchor}` : ""}`;
  const other = routing.locales.find((l) => l !== locale)!;
  const anchorNote = anchorStatus(given, v.chains.find((c) => c.role === "producer")!.verdict);

  return (
    <>
      <header className="border-b border-fg/30">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 px-4 py-2">
          <Link href="/" className={`${tap} font-display text-xl`}>
            {t("nav.brand")}
          </Link>
          <Link
            href={{ pathname: `/pasaport/${v.lot.code}`, query: given ? { a: given } : {} }}
            locale={other}
            lang={other}
            className={`${tap} ms-auto underline underline-offset-4`}
          >
            {t("passport.otherLocale")}
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-8 px-4 py-10">
        <article data-lot-code={v.lot.code} data-passport={v.ok ? "ok" : "broken"} className="grid gap-4">
          <p className="text-sm font-semibold">{t("passport.kicker")}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span data-test-status={v.lot.testStatus} className="font-semibold">
              {t(`trace.testStatus.${v.lot.testStatus}`)}
            </span>
            <ResultClassBadge value={v.resultClass} />
          </div>
          <h1 className="font-display text-4xl break-words">{t("trace.lot.title", { code: v.lot.code })}</h1>
          <p className="max-w-prose">{t("passport.lead")}</p>
          <p role="note" className="max-w-prose rounded border border-fg/30 px-3 py-2 text-sm">
            {t("trace.lot.testNote")}
          </p>
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="font-semibold">{t("passport.producer")}</dt>
            <dd>{v.producerName ?? t("passport.hiddenName")}</dd>
            <dt className="font-semibold">{t("trace.lot.production")}</dt>
            <dd>
              {v.production.code} · {fmtDate(v.production.startedAt, locale)}
            </dd>
            <dt className="font-semibold">{t("trace.lot.sheets")}</dt>
            <dd>{v.lot.sheetCount ?? unknown}</dd>
            <dt className="font-semibold">{t("trace.lot.area")}</dt>
            <dd>
              <Qty value={v.lot.areaM2} locale={locale} unit="m²" />
            </dd>
            <dt className="font-semibold">{t("trace.lot.thickness")}</dt>
            <dd>
              <Qty value={v.lot.thicknessMm} locale={locale} unit="mm" />
            </dd>
            <dt className="font-semibold">{t("trace.lot.density")}</dt>
            <dd>
              <Qty value={v.lot.densityKgM3} locale={locale} unit="kg/m³" />
            </dd>
            <dt className="font-semibold">{t("trace.lot.textileKg")}</dt>
            <dd data-testid="textile-kg">
              <Qty value={v.textileKg} locale={locale} />
            </dd>
            <dt className="font-semibold">{t("trace.lot.verifiedTextileKg")}</dt>
            <dd data-testid="verified-kg">
              <Qty value={v.verifiedTextileKg} locale={locale} />
            </dd>
          </dl>
        </article>

        <section aria-labelledby="verify-title" className="grid gap-3">
          <h2 id="verify-title" className="text-2xl font-semibold">
            {t("passport.verify.title")}
          </h2>
          <p
            role={v.ok ? undefined : "alert"}
            data-verdict={v.ok ? "ok" : "broken"}
            className={`max-w-prose rounded px-3 py-2 font-semibold ${v.ok ? "border border-fg/30" : "border-2 border-fg"}`}
          >
            {v.ok ? t("passport.verify.ok", { count: v.chains.length }) : t("passport.verify.broken")}
          </p>
          <ChainList chains={v.chains} />
          <p data-anchor={anchorNote} className="max-w-prose text-sm">
            {t(`passport.anchor.${anchorNote}`)}
          </p>
          <p className="max-w-prose text-sm">{t("passport.verify.how")}</p>
          <VerifyButton code={v.lot.code} anchor={label && formatAnchor(label)} locale={locale} />
          <a
            href={`/api/verify/${v.lot.code}${label ? `?a=${formatAnchor(label)}` : ""}`}
            className="inline-flex min-h-11 items-center justify-self-start underline underline-offset-4"
          >
            {t("passport.verify.json")}
          </a>
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          <section aria-labelledby="fibre-title" className="grid content-start gap-3">
            <h2 id="fibre-title" className="text-2xl font-semibold">
              {t("passport.composition")}
            </h2>
            {v.fibres === null ? (
              <p>{unknown}</p>
            ) : (
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                {v.fibres.map((f) => (
                  <div key={f.fibre} data-fibre={f.fibre} className="contents">
                    <dt className="font-semibold">{t(`fibres.${f.fibre}`)}</dt>
                    <dd>
                      {f.share === null ? unknown : fmtPercent(f.share.times(100).toNumber(), locale, 1)} · <Qty value={f.kg} locale={locale} />
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
            {v.suppliers === null ? (
              <p>{unknown}</p>
            ) : (
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                {v.suppliers.map((s, i) => (
                  <div key={i} data-supplier={s.name ?? ""} className="contents">
                    <dt className="font-semibold">{s.name ?? t("passport.hiddenName")}</dt>
                    <dd>
                      <Qty value={s.kg} locale={locale} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>

        <section aria-labelledby="sources-title" className="grid gap-3">
          <h2 id="sources-title" className="text-2xl font-semibold">
            {t("passport.sources")}
          </h2>
          <p className="text-sm">{t("passport.sourcesHint")}</p>
          <ul data-testid="sources" className="grid gap-2 text-sm">
            {v.sources.map((s) => (
              <li key={s.code} data-batch-code={s.code} data-verified={s.verified} className="flex flex-wrap gap-x-2">
                <span className="font-semibold">{s.code}</span>
                <span>{s.supplierName ?? t("passport.hiddenName")}</span>
                <span>· {s.lotKg === null ? unknown : t("trace.lot.inLot", { kg: fmtNumber(s.lotKg, locale) })}</span>
                <span>· {t(s.verified ? "trace.verified" : "trace.unverified")}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="balance-title" className="grid gap-3">
          <h2 id="balance-title" className="text-2xl font-semibold">
            {t("trace.lot.massBalance")}
          </h2>
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="font-semibold">{t("trace.lot.input")}</dt>
            <dd>
              <Qty value={v.massBalance.inputKg} locale={locale} />
            </dd>
            <dt className="font-semibold">{t("trace.lot.accounted")}</dt>
            <dd>
              <Qty value={v.massBalance.accountedKg} locale={locale} />
            </dd>
          </dl>
          <p className="text-sm">
            <BalanceText mb={v.massBalance} locale={locale} />
          </p>
        </section>

        <section aria-labelledby="qr-title" className="grid content-start justify-items-start gap-3">
          <h2 id="qr-title" className="text-2xl font-semibold">
            {t("passport.qr.title")}
          </h2>
          <p className="max-w-prose text-sm">{t("passport.qr.hint")}</p>
          <QrCode text={url} label={t("passport.qr.label", { code: v.lot.code })} />
          <p className="max-w-full font-mono text-xs break-all">{url}</p>
        </section>

        <section aria-labelledby="timeline-title" className="grid gap-3">
          <h2 id="timeline-title" className="text-2xl font-semibold">
            {t("trace.lot.timeline")}
          </h2>
          <p className="text-sm">{t("passport.timelineHint")}</p>
          <PassportTimeline events={v.timeline} locale={locale} />
        </section>
      </main>
    </>
  );
}
