import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChainList, PassportTimeline } from "@/components/passport/PassportParts";
import { QrCode } from "@/components/passport/QrCode";
import { VerifyButton } from "@/components/passport/VerifyButton";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { BalanceText, Qty } from "@/components/trace/Qty";
import { BrandMark, Wordmark } from "@/components/ui/Brand";
import { PageBanner } from "@/components/ui/PageHeader";
import { alertBox, cardPad, h2, link, note } from "@/components/ui/classes";
import { getDb } from "@/db/client";
import { publicPassport } from "@/db/repo/passport";
import { anchorStatus, formatAnchor, parseAnchor } from "@/domain/traceability";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { fmtDate, fmtNumber, fmtPercent } from "@/lib/format";

const tap = "inline-flex min-h-11 items-center rounded-lg px-3";
const DL = "grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[max-content_1fr] [&_dd]:text-ink";
const DL_TWO = "grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 text-sm [&_dd]:text-ink";
/** Lif bileşimi çubuğunun dilimleri: yalnızca süs; her lifin payı yazıyla da verilir. */
const SEGMENT = ["bg-ink", "bg-brand", "bg-glow", "bg-sky", "bg-subtle"] as const;

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
  const VerdictIcon = v.ok ? ShieldCheck : ShieldAlert;

  return (
    <div className="rb-app flex min-h-screen flex-1 flex-col bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 px-4 py-2 sm:px-6">
          <Link href="/" className={`${tap} gap-2`}>
            <BrandMark className="size-8" />
            <Wordmark>{t("nav.brand")}</Wordmark>
          </Link>
          <Link
            href={{ pathname: `/pasaport/${v.lot.code}`, query: given ? { a: given } : {} }}
            locale={other}
            lang={other}
            className={`${tap} ms-auto text-sm font-semibold text-muted hover:text-ink`}
          >
            {t("passport.otherLocale")}
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <article data-lot-code={v.lot.code} data-passport={v.ok ? "ok" : "broken"} className="grid gap-6">
          <PageBanner
            still="room"
            eyebrow={t("passport.kicker")}
            title={t("trace.lot.title", { code: v.lot.code })}
            lead={t("passport.lead")}
            actions={
              <>
                <span data-test-status={v.lot.testStatus} className="rounded-full bg-surface px-3 text-sm font-semibold leading-8 text-ink">
                  {t(`trace.testStatus.${v.lot.testStatus}`)}
                </span>
                <ResultClassBadge value={v.resultClass} />
              </>
            }
          >
            <p role="note" className="relative border-t border-side-line px-6 py-4 text-sm text-side-muted sm:px-10">
              {t("trace.lot.testNote")}
            </p>
          </PageBanner>
          <dl className={`${cardPad} ${DL}`}>
            <dt className="font-medium text-muted">{t("passport.producer")}</dt>
            <dd>{v.producerName ?? t("passport.hiddenName")}</dd>
            <dt className="font-medium text-muted">{t("trace.lot.production")}</dt>
            <dd>
              {v.production.code} · {fmtDate(v.production.startedAt, locale)}
            </dd>
            <dt className="font-medium text-muted">{t("trace.lot.sheets")}</dt>
            <dd>{v.lot.sheetCount ?? unknown}</dd>
            <dt className="font-medium text-muted">{t("trace.lot.area")}</dt>
            <dd>
              <Qty value={v.lot.areaM2} locale={locale} unit="m²" />
            </dd>
            <dt className="font-medium text-muted">{t("trace.lot.thickness")}</dt>
            <dd>
              <Qty value={v.lot.thicknessMm} locale={locale} unit="mm" />
            </dd>
            <dt className="font-medium text-muted">{t("trace.lot.density")}</dt>
            <dd>
              <Qty value={v.lot.densityKgM3} locale={locale} unit="kg/m³" />
            </dd>
            <dt className="font-medium text-muted">{t("trace.lot.textileKg")}</dt>
            <dd data-testid="textile-kg">
              <Qty value={v.textileKg} locale={locale} />
            </dd>
            <dt className="font-medium text-muted">{t("trace.lot.verifiedTextileKg")}</dt>
            <dd data-testid="verified-kg">
              <Qty value={v.verifiedTextileKg} locale={locale} />
            </dd>
          </dl>
        </article>

        <section aria-labelledby="verify-title" className={`${cardPad} grid gap-4`}>
          <h2 id="verify-title" className={h2}>
            {t("passport.verify.title")}
          </h2>
          <p
            role={v.ok ? undefined : "alert"}
            data-verdict={v.ok ? "ok" : "broken"}
            className={`flex items-start gap-3 rounded-xl px-4 py-3 font-semibold ${v.ok ? "bg-ok text-on-ok" : alertBox}`}
          >
            <VerdictIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            {v.ok ? t("passport.verify.ok", { count: v.chains.length }) : t("passport.verify.broken")}
          </p>
          <ChainList chains={v.chains} />
          <p data-anchor={anchorNote} className="max-w-prose text-sm text-muted">
            {t(`passport.anchor.${anchorNote}`)}
          </p>
          <p className="max-w-prose text-sm text-muted">{t("passport.verify.how")}</p>
          <VerifyButton code={v.lot.code} anchor={label && formatAnchor(label)} locale={locale} />
          <a
            href={`/api/verify/${v.lot.code}${label ? `?a=${formatAnchor(label)}` : ""}`}
            className={`inline-flex min-h-11 items-center justify-self-start ${link}`}
          >
            {t("passport.verify.json")}
          </a>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <section aria-labelledby="fibre-title" className={`${cardPad} grid content-start gap-4`}>
            <h2 id="fibre-title" className={h2}>
              {t("passport.composition")}
            </h2>
            {v.fibres === null ? (
              <p className={note}>{unknown}</p>
            ) : (
              <>
                <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-full bg-line">
                  {v.fibres
                    .filter((f) => f.share !== null)
                    .map((f, i) => (
                      <span key={f.fibre} className={SEGMENT[i % SEGMENT.length]} style={{ width: `${f.share!.times(100).toNumber()}%` }} />
                    ))}
                </div>
                <dl className={DL_TWO}>
                  {v.fibres.map((f) => (
                    <div key={f.fibre} data-fibre={f.fibre} className="contents">
                      <dt className="font-medium text-muted">{t(`fibres.${f.fibre}`)}</dt>
                      <dd>
                        {f.share === null ? unknown : fmtPercent(f.share.times(100).toNumber(), locale, 1)} · <Qty value={f.kg} locale={locale} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </section>
          <section aria-labelledby="supplier-title" className={`${cardPad} grid content-start gap-4`}>
            <h2 id="supplier-title" className={h2}>
              {t("trace.lot.bySupplier")}
            </h2>
            {v.suppliers === null ? (
              <p className={note}>{unknown}</p>
            ) : (
              <dl className={DL_TWO}>
                {v.suppliers.map((s, i) => (
                  <div key={i} data-supplier={s.name ?? ""} className="contents">
                    <dt className="font-medium text-muted">{s.name ?? t("passport.hiddenName")}</dt>
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
          <h2 id="sources-title" className={h2}>
            {t("passport.sources")}
          </h2>
          <p className="text-sm text-muted">{t("passport.sourcesHint")}</p>
          <ul data-testid="sources" className="grid gap-2 text-sm">
            {v.sources.map((s) => (
              <li
                key={s.code}
                data-batch-code={s.code}
                data-verified={s.verified}
                className="flex flex-wrap gap-x-2 rounded-xl border border-line bg-surface px-4 py-3 text-ink shadow-card"
              >
                <span className="font-semibold">{s.code}</span>
                <span>{s.supplierName ?? t("passport.hiddenName")}</span>
                <span className="text-muted">· {s.lotKg === null ? unknown : t("trace.lot.inLot", { kg: fmtNumber(s.lotKg, locale) })}</span>
                <span className="text-muted">· {t(s.verified ? "trace.verified" : "trace.unverified")}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="balance-title" className={`${cardPad} grid gap-4`}>
          <h2 id="balance-title" className={h2}>
            {t("trace.lot.massBalance")}
          </h2>
          <dl className={DL}>
            <dt className="font-medium text-muted">{t("trace.lot.input")}</dt>
            <dd>
              <Qty value={v.massBalance.inputKg} locale={locale} />
            </dd>
            <dt className="font-medium text-muted">{t("trace.lot.accounted")}</dt>
            <dd>
              <Qty value={v.massBalance.accountedKg} locale={locale} />
            </dd>
          </dl>
          <p className="text-sm text-ink">
            <BalanceText mb={v.massBalance} locale={locale} />
          </p>
        </section>

        <section aria-labelledby="qr-title" className={`${cardPad} grid content-start justify-items-start gap-3`}>
          <h2 id="qr-title" className={h2}>
            {t("passport.qr.title")}
          </h2>
          <p className="max-w-prose text-sm text-muted">{t("passport.qr.hint")}</p>
          <QrCode text={url} label={t("passport.qr.label", { code: v.lot.code })} />
          <p className="max-w-full font-mono text-xs break-all text-subtle">{url}</p>
        </section>

        <section aria-labelledby="timeline-title" className="grid gap-3">
          <h2 id="timeline-title" className={h2}>
            {t("trace.lot.timeline")}
          </h2>
          <p className="text-sm text-muted">{t("passport.timelineHint")}</p>
          <PassportTimeline events={v.timeline} locale={locale} />
        </section>
      </main>
    </div>
  );
}
