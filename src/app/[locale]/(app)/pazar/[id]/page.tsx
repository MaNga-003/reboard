import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { ListingFacts } from "@/components/market/ListingFacts";
import { MatchSummary } from "@/components/market/MatchSummary";
import { OfferForm, type OfferDefaults } from "@/components/market/OfferForm";
import { PriceText } from "@/components/market/PriceText";
import { getDb } from "@/db/client";
import { listingDetail, type ListingDetail } from "@/db/repo/market";
import { can } from "@/domain/access";
import { istanbulDay, payerOf } from "@/domain/market";
import { Decimal } from "@/domain/result";
import { Link } from "@/i18n/navigation";
import { fmtDate, fmtNumber } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";
import { acceptOfferAction, closeListingAction, rejectOfferAction, withdrawOfferAction } from "../actions";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const button = "inline-flex min-h-11 items-center rounded border border-fg/60 px-4 font-semibold hover:bg-fg/5";

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
function RowAction({ action, locale, listingId, id, label }: { action: (fd: FormData) => Promise<void>; locale: string; listingId: string; id: string; label: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={button}>
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
    <main id="main" className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-8 px-4 py-10">
      <Link href="/pazar" className="inline-flex min-h-11 items-center justify-self-start underline underline-offset-4">
        {t("market.detail.back")}
      </Link>
      {notice && t.has(`market.notices.${notice}`) && (
        <p role="status" className="rounded border-2 border-accent px-3 py-2 font-semibold">
          {t(`market.notices.${notice}`)}
        </p>
      )}
      {error && t.has(`market.errors.${error}`) && (
        <p role="alert" className="rounded border-2 border-fg px-3 py-2">
          {t(`market.errors.${error}`)}
        </p>
      )}

      <article data-listing-id={l.id} data-status={l.status} className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{t(`market.kinds.${l.kind}`)}</span>
          <ResultClassBadge value={l.resultClass} />
          {d.own && <span className="rounded bg-fg/10 px-2 leading-6">{t("market.yours")}</span>}
        </div>
        <h1 className="font-display text-4xl">{l.title}</h1>
        <ListingFacts row={d} />
        {!d.own && <MatchSummary match={d.match} detailed />}
        {!open && <p className="font-semibold">{t("market.detail.closed")}</p>}
        {open && d.own && can(roles, "listing", "close") && (
          <div className="justify-self-start">
            <RowAction action={closeListingAction} locale={locale} listingId={l.id} id={l.id} label={t("market.detail.close")} />
          </div>
        )}
      </article>

      {open && !d.own && canOffer && (
        <section aria-labelledby="offer-title" className="grid gap-3 rounded border border-fg/30 p-4">
          <h2 id="offer-title" className="text-2xl font-semibold">
            {t("market.offerForm.title")}
          </h2>
          <OfferForm locale={locale} listingId={l.id} d={offerDefaults(l, istanbulDay(now), locale)} />
        </section>
      )}

      <section aria-labelledby="offers-title" className="grid gap-3">
        <h2 id="offers-title" className="text-2xl font-semibold">
          {t("market.detail.offers")}
        </h2>
        <p className="text-sm">{t("market.detail.offersHint")}</p>
        {d.offers.length === 0 ? (
          <p>{t("market.detail.noOffers")}</p>
        ) : (
          <ul className="grid gap-3">
            {d.offers.map((o) => (
              <li key={o.id} data-offer-id={o.id} data-status={o.status} className="grid gap-2 rounded border border-fg/30 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{o.orgName ?? t("market.hiddenOrg")}</span>
                  <span className="rounded bg-fg/10 px-2 text-sm leading-6">{t(`market.offerStatus.${o.status}`)}</span>
                  <ResultClassBadge value={o.resultClass} />
                </div>
                <p className="text-sm">
                  {fmtNumber(o.quantity, locale)} {t(`units.${o.unit}`)} · <PriceText unitPrice={o.unitPrice} currency={o.currency} taxBasis={o.taxBasis} unit={o.unit} /> ·{" "}
                  {t("market.detail.proposedDate")}: {o.proposedDate ? fmtDate(o.proposedDate, locale) : unknown}
                </p>
                {o.message && <p className="text-sm">{o.message}</p>}
                {o.status === "open" && (
                  <div className="flex flex-wrap gap-2">
                    {canRespond && (
                      <>
                        <RowAction action={acceptOfferAction} locale={locale} listingId={l.id} id={o.id} label={t("market.detail.accept")} />
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
        <h2 id="deals-title" className="text-2xl font-semibold">
          {t("market.detail.deals")}
        </h2>
        {d.deals.length === 0 ? (
          <p>{t("market.detail.noDeals")}</p>
        ) : (
          d.deals.map((deal) => (
            <div key={deal.id} data-deal-id={deal.id} className="grid gap-3 rounded border border-fg/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <ResultClassBadge value={deal.resultClass} />
              </div>
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                <dt className="font-semibold">{t("market.detail.seller")}</dt>
                <dd>{deal.sellerName ?? t("market.hiddenOrg")}</dd>
                <dt className="font-semibold">{t("market.detail.buyer")}</dt>
                <dd>{deal.buyerName ?? t("market.hiddenOrg")}</dd>
                <dt className="font-semibold">{t("market.quantity")}</dt>
                <dd>
                  {fmtNumber(deal.quantity, locale)} {t(`units.${deal.unit}`)}
                  {l.recurrence !== "once" && ` (${t("market.perDelivery")})`}
                </dd>
                <dt className="font-semibold">{t("market.price")}</dt>
                <dd>
                  <PriceText unitPrice={deal.unitPrice} currency={deal.currency} taxBasis={deal.taxBasis} unit={deal.unit} />
                </dd>
              </dl>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="text-left font-semibold">{t("market.detail.deliveries")}</caption>
                  <thead>
                    <tr className="border-b border-fg/30">
                      <th scope="col" className="py-1 pe-3">
                        {t("market.detail.plannedAt")}
                      </th>
                      <th scope="col" className="py-1 pe-3">
                        {t("market.detail.plannedKg")}
                      </th>
                      <th scope="col" className="py-1">
                        {t("market.detail.status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deal.deliveries.map((v) => (
                      <tr key={v.id} data-delivery-id={v.id} className="border-b border-fg/15">
                        <td className="py-1 pe-3">{fmtDate(v.plannedAt, locale)}</td>
                        <td className="py-1 pe-3" data-planned-kg={v.plannedKg ?? "unknown"}>
                          {v.plannedKg === null ? unknown : fmtNumber(v.plannedKg, locale)}
                        </td>
                        <td className="py-1">{t(`market.deliveryStatus.${v.status}`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
