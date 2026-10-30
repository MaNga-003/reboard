import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { KIND_STILL } from "@/components/market/ListingCard";
import { ListingFacts } from "@/components/market/ListingFacts";
import { MatchSummary } from "@/components/market/MatchSummary";
import { OfferForm, type OfferDefaults } from "@/components/market/OfferForm";
import { PriceText } from "@/components/market/PriceText";
import { TableWrap, td, th, tr } from "@/components/trace/Table";
import { BackLink } from "@/components/ui/BackLink";
import { PageBanner } from "@/components/ui/PageHeader";
import { alertBox, btnPrimary, btnSecondary, card, cardPad, h2, note } from "@/components/ui/classes";
import { getDb } from "@/db/client";
import { listingDetail, type ListingDetail } from "@/db/repo/market";
import { can } from "@/domain/access";
import { istanbulDay, payerOf } from "@/domain/market";
import { Decimal } from "@/domain/result";
import { fmtDate, fmtNumber } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";
import { acceptOfferAction, closeListingAction, rejectOfferAction, withdrawOfferAction } from "../actions";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const chip = "rounded-full border border-line-strong bg-canvas px-2.5 text-xs font-semibold leading-6 text-muted";

/** Teklif formunun varsayılanları ilandan: aynı miktar, aynı fiyat yönü, pencere içindeki ilk uygun gün. */
function offerDefaults(l: ListingDetail["listing"], today: string, locale: string): OfferDefaults {
  const first = l.windowStart && l.windowStart > today ? l.windowStart : today;
  return {
    quantity: new Decimal(l.quantity).toString(),
    maxQuantity: fmtNumber(l.quantity, locale),
    unit: l.unit,
    payer: payerOf(l.unitPrice) ?? "unknown",
    amount: l.unitPrice === null ? "" : new Decimal(l.unitPrice).abs().toString(),
    date: first,
    minDate: first,
    maxDate: l.windowEnd,
  };
}

/** Tek düğmeli eylem formu; kimlik ve dönüş yolu gizli alanlarda. */
function RowAction({
  action,
  locale,
  listingId,
  id,
  label,
  primary = false,
}: {
  action: (fd: FormData) => Promise<void>;
  locale: string;
  listingId: string;
  id: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={primary ? btnPrimary : btnSecondary}>
        {label}
      </button>
    </form>
  );
}

export default async function ListingPage({ params, searchParams }: PageProps<"/[locale]/pazar/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const now = new Date();
  const d = await listingDetail(getDb(), viewer.orgId, id, now);
  if (!d) notFound();
  const sp = await searchParams;
  const notice = one(sp.durum);
  const error = one(sp.hata);
  const l = d.listing;
  const open = l.status === "open";
  const roles = viewer.roles.join(",");
  const canRespond = d.own && can(roles, "offer", "respond");
  const canOffer = can(roles, "offer", "create");
  const unknown = t("common.unknown");

  return (
    <main id="main" className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-8 px-4 py-8 sm:px-6 lg:py-10">
      <BackLink href="/pazar">{t("market.detail.back")}</BackLink>
      {notice && t.has(`market.notices.${notice}`) && (
        <p role="status" className="rounded-xl border-2 border-brand bg-brand-soft px-4 py-3 font-semibold text-ink">
          {t(`market.notices.${notice}`)}
        </p>
      )}
      {error && t.has(`market.errors.${error}`) && (
        <p role="alert" className={alertBox}>
          {t(`market.errors.${error}`)}
        </p>
      )}

      <article data-listing-id={l.id} data-status={l.status} className="grid gap-6">
        <PageBanner
          still={KIND_STILL[l.kind]}
          title={l.title}
          eyebrow={t(`market.kinds.${l.kind}`)}
          actions={
            <>
              <ResultClassBadge value={l.resultClass} />
              {d.own && <span className="rounded-full bg-brand px-2.5 text-xs font-semibold leading-6 text-on-brand">{t("market.yours")}</span>}
            </>
          }
        />
        <div className={`${cardPad} grid gap-5`}>
          <ListingFacts row={d} />
          {!d.own && <MatchSummary match={d.match} detailed />}
          {!open && <p className={note}>{t("market.detail.closed")}</p>}
          {open && d.own && can(roles, "listing", "close") && (
            <div className="justify-self-start">
              <RowAction action={closeListingAction} locale={locale} listingId={l.id} id={l.id} label={t("market.detail.close")} />
            </div>
          )}
        </div>
      </article>

      {open && !d.own && canOffer && (
        <section aria-labelledby="offer-title" className={`${cardPad} grid gap-4`}>
          <h2 id="offer-title" className={h2}>
            {t("market.offerForm.title")}
          </h2>
          <OfferForm locale={locale} listingId={l.id} d={offerDefaults(l, istanbulDay(now), locale)} />
        </section>
      )}

      <section aria-labelledby="offers-title" className="grid gap-3">
        <h2 id="offers-title" className={h2}>
          {t("market.detail.offers")}
        </h2>
        <p className="text-sm text-muted">{t("market.detail.offersHint")}</p>
        {d.offers.length === 0 ? (
          <p className={note}>{t("market.detail.noOffers")}</p>
        ) : (
          <ul className="grid gap-3">
            {d.offers.map((o) => (
              <li key={o.id} data-offer-id={o.id} data-status={o.status} className={`${card} grid gap-2 p-4`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{o.orgName ?? t("market.hiddenOrg")}</span>
                  <span className={chip}>{t(`market.offerStatus.${o.status}`)}</span>
                  <ResultClassBadge value={o.resultClass} />
                </div>
                <p className="text-sm text-muted">
                  {fmtNumber(o.quantity, locale)} {t(`units.${o.unit}`)} · <PriceText unitPrice={o.unitPrice} currency={o.currency} taxBasis={o.taxBasis} unit={o.unit} /> ·{" "}
                  {t("market.detail.proposedDate")}: {o.proposedDate ? fmtDate(o.proposedDate, locale) : unknown}
                </p>
                {o.message && <p className="text-sm text-ink">{o.message}</p>}
                {o.status === "open" && (
                  <div className="flex flex-wrap gap-2">
                    {canRespond && (
                      <>
                        <RowAction action={acceptOfferAction} locale={locale} listingId={l.id} id={o.id} label={t("market.detail.accept")} primary />
                        <RowAction action={rejectOfferAction} locale={locale} listingId={l.id} id={o.id} label={t("market.detail.reject")} />
                      </>
                    )}
                    {o.orgId === viewer.orgId && canOffer && (
                      <RowAction action={withdrawOfferAction} locale={locale} listingId={l.id} id={o.id} label={t("market.detail.withdraw")} />
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="deals-title" className="grid gap-3">
        <h2 id="deals-title" className={h2}>
          {t("market.detail.deals")}
        </h2>
        {d.deals.length === 0 ? (
          <p className={note}>{t("market.detail.noDeals")}</p>
        ) : (
          d.deals.map((deal) => (
            <div key={deal.id} data-deal-id={deal.id} className={`${cardPad} grid gap-4`}>
              <div className="flex flex-wrap items-center gap-2">
                <ResultClassBadge value={deal.resultClass} />
              </div>
              <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[max-content_1fr]">
                <dt className="font-medium text-muted">{t("market.detail.seller")}</dt>
                <dd className="text-ink">{deal.sellerName ?? t("market.hiddenOrg")}</dd>
                <dt className="font-medium text-muted">{t("market.detail.buyer")}</dt>
                <dd className="text-ink">{deal.buyerName ?? t("market.hiddenOrg")}</dd>
                <dt className="font-medium text-muted">{t("market.quantity")}</dt>
                <dd className="text-ink">
                  {fmtNumber(deal.quantity, locale)} {t(`units.${deal.unit}`)}
                  {l.recurrence !== "once" && ` (${t("market.perDelivery")})`}
                </dd>
                <dt className="font-medium text-muted">{t("market.price")}</dt>
                <dd className="text-ink">
                  <PriceText unitPrice={deal.unitPrice} currency={deal.currency} taxBasis={deal.taxBasis} unit={deal.unit} />
                </dd>
              </dl>
              <TableWrap label={t("market.detail.deliveries")}>
                <table className="w-full text-left text-sm">
                  <caption className="px-4 py-3 text-left font-semibold text-ink">{t("market.detail.deliveries")}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={th}>
                        {t("market.detail.plannedAt")}
                      </th>
                      <th scope="col" className={th}>
                        {t("market.detail.plannedKg")}
                      </th>
                      <th scope="col" className={th}>
                        {t("market.detail.status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deal.deliveries.map((v) => (
                      <tr key={v.id} data-delivery-id={v.id} className={tr}>
                        <td className={td}>{fmtDate(v.plannedAt, locale)}</td>
                        <td className={td} data-planned-kg={v.plannedKg ?? "unknown"}>
                          {v.plannedKg === null ? unknown : fmtNumber(v.plannedKg, locale)}
                        </td>
                        <td className={td}>{t(`market.deliveryStatus.${v.status}`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
