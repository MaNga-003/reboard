// Pazar yeri deposu (T2.1). Kurallar src/domain/market.ts'te; burada kiracı görünürlüğüyle okunur ve uygulanır.
// Okuma her zaman withTenant'tan geçer. Yazma koşullu güncellemeyle yapılır: iki kişi aynı teklifi aynı anda kabul
// ederse yalnızca biri satır günceller, öteki kural hatası alır; anlaşma ve teslimler aynı işlemde oluşur.
import { and, desc, eq, inArray, or } from "drizzle-orm";
import {
  closesOnAccept,
  dealParties,
  deliveryPlan,
  isWaste,
  istanbulDay,
  listingError,
  matchScore,
  offerError,
  ownerSells,
  planStart,
  quantityKg,
  respondError,
  withdrawError,
  type ListingInput,
  type ListingKind,
  type Match,
  type MatchSide,
  type Recurrence,
} from "../../domain/market";
import { crowFliesKm, type Point } from "../../domain/geo";
import { Decimal, type Currency, type TaxBasis } from "../../domain/result";
import { onTimeRate } from "../../domain/supply";
import type { Db } from "../client";
import { deals, deliveries, listings, offers, orgProfiles } from "../schema";
import { TenantAccessError, withTenant, type TenantRow } from "./tenant";

export class MarketRuleError extends Error {
  constructor(readonly code: string) {
    super(`Pazar yeri kuralı: ${code}`);
    this.name = "MarketRuleError";
  }
}

// Kayıt kapalı; bütün hesaplar demo hesabıdır (D-010). Onların girdiği her kayıt sentetiktir (D-011).
// Gerçek hesaplar açıldığında (Faz 5) sınıf kanıt durumundan gelecek.
const ENTRY_CLASS = "synthetic" as const;

type Listing = TenantRow<"listings">;
type Offer = TenantRow<"offers">;

const pointOf = (r: { lat: number | null; lon: number | null }): Point | null => (r.lat === null || r.lon === null ? null : { lat: r.lat, lon: r.lon });

// ---- Yazma ----

export type NewListing = ListingInput & {
  title: string;
  recurrence: Recurrence;
  unitPrice: string | null;
  currency: Currency;
  taxBasis: TaxBasis;
};

/** Konum ilan formunda sorulmaz: kurumun ilçe düzeyindeki profil konumu kullanılır. */
export async function createListing(db: Db, orgId: string, input: NewListing): Promise<string> {
  const err = listingError(input);
  if (err) throw new MarketRuleError(err);
  const [profile] = await db
    .select({ district: orgProfiles.district, lat: orgProfiles.lat, lon: orgProfiles.lon })
    .from(orgProfiles)
    .where(eq(orgProfiles.orgId, orgId));
  const [row] = await db
    .insert(listings)
    .values({
      orgId,
      kind: input.kind,
      title: input.title,
      composition: input.composition,
      containsSilk: input.containsSilk,
      quantity: new Decimal(input.quantity).toFixed(3),
      unit: input.unit,
      recurrence: input.recurrence,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      unitPrice: input.unitPrice,
      priceUnit: input.unitPrice === null ? null : input.unit,
      currency: input.currency,
      taxBasis: input.taxBasis,
      district: profile?.district ?? null,
      lat: profile?.lat ?? null,
      lon: profile?.lon ?? null,
      resultClass: ENTRY_CLASS,
    })
    .returning({ id: listings.id });
  return row.id;
}

export type NewOffer = { quantity: string; unitPrice: string | null; proposedDate: string; message: string | null };

/** Teklif ilanın biriminde ve para biriminde verilir; iki taraf aynı şeyi karşılaştırsın. */
export async function placeOffer(db: Db, orgId: string, listingId: string, input: NewOffer, now = new Date()): Promise<string> {
  const listing = await withTenant(db, orgId).get("listings", listingId);
  if (!listing) throw new TenantAccessError("listings", listingId);
  const err = offerError(listing, orgId, { quantity: input.quantity, unit: listing.unit, proposedDate: input.proposedDate }, istanbulDay(now));
  if (err) throw new MarketRuleError(err);
  const [row] = await db
    .insert(offers)
    .values({
      listingId,
      orgId,
      quantity: new Decimal(input.quantity).toFixed(3),
      unit: listing.unit,
      unitPrice: input.unitPrice,
      currency: listing.currency,
      taxBasis: listing.taxBasis,
      proposedDate: input.proposedDate,
      message: input.message,
      resultClass: ENTRY_CLASS,
    })
    .returning({ id: offers.id });
  return row.id;
}

async function offerWithListing(db: Db, orgId: string, offerId: string) {
  const tenant = withTenant(db, orgId);
  const offer = await tenant.get("offers", offerId);
  const listing = offer && (await tenant.get("listings", offer.listingId));
  if (!offer || !listing) throw new TenantAccessError("offers", offerId);
  return { offer, listing };
}

export async function rejectOffer(db: Db, orgId: string, offerId: string): Promise<void> {
  const { offer, listing } = await offerWithListing(db, orgId, offerId);
  const err = respondError(listing, offer, orgId, "reject");
  if (err) throw new MarketRuleError(err);
  const done = await db
    .update(offers)
    .set({ status: "rejected" })
    .where(and(eq(offers.id, offerId), eq(offers.status, "open")))
    .returning({ id: offers.id });
  if (!done.length) throw new MarketRuleError("offer_not_open");
}

export async function withdrawOffer(db: Db, orgId: string, offerId: string): Promise<void> {
  const offer = await withTenant(db, orgId).get("offers", offerId);
  if (!offer) throw new TenantAccessError("offers", offerId);
  const err = withdrawError(offer, orgId);
  if (err) throw new MarketRuleError(err);
  const done = await db
    .update(offers)
    .set({ status: "withdrawn" })
    .where(and(eq(offers.id, offerId), eq(offers.orgId, orgId), eq(offers.status, "open")))
    .returning({ id: offers.id });
  if (!done.length) throw new MarketRuleError("offer_not_open");
}

/** Kapanan ilandaki açık teklifler reddedilir; teklif verenler beklemede kalmasın. */
export async function closeListing(db: Db, orgId: string, listingId: string): Promise<void> {
  await withTenant(db, orgId).assertOwns("listings", listingId);
  await db.transaction(async (tx) => {
    await tx
      .update(listings)
      .set({ status: "closed" })
      .where(and(eq(listings.id, listingId), eq(listings.orgId, orgId)));
    await tx
      .update(offers)
      .set({ status: "rejected" })
      .where(and(eq(offers.listingId, listingId), eq(offers.status, "open")));
  });
}

export type Accepted = { dealId: string; deliveries: Date[] };

/** Kabul: teklif kabul edilir, anlaşma ve teslim planı oluşur; tek seferlik ilan kapanır. Hepsi ya olur ya hiçbiri. */
export async function acceptOffer(db: Db, orgId: string, offerId: string, now = new Date()): Promise<Accepted> {
  const { offer, listing } = await offerWithListing(db, orgId, offerId);
  const err = respondError(listing, offer, orgId, "accept");
  if (err) throw new MarketRuleError(err);
  const plan = deliveryPlan(planStart(offer.proposedDate, istanbulDay(now)), listing.recurrence, listing.windowEnd);
  const plannedKg = quantityKg(offer.quantity, offer.unit)?.toFixed(3) ?? null;

  return db.transaction(async (tx) => {
    const won = await tx
      .update(offers)
      .set({ status: "accepted" })
      .where(and(eq(offers.id, offerId), eq(offers.status, "open")))
      .returning({ id: offers.id });
    if (!won.length) throw new MarketRuleError("offer_not_open");
    const stillOpen = closesOnAccept(listing.recurrence)
      ? await tx
          .update(listings)
          .set({ status: "closed" })
          .where(and(eq(listings.id, listing.id), eq(listings.orgId, orgId), eq(listings.status, "open")))
          .returning({ id: listings.id })
      : await tx
          .select({ id: listings.id })
          .from(listings)
          .where(and(eq(listings.id, listing.id), eq(listings.status, "open")));
    if (!stillOpen.length) throw new MarketRuleError("listing_closed");
    if (closesOnAccept(listing.recurrence)) {
      await tx
        .update(offers)
        .set({ status: "rejected" })
        .where(and(eq(offers.listingId, listing.id), eq(offers.status, "open")));
    }
    const [deal] = await tx
      .insert(deals)
      .values({
        offerId,
        listingId: listing.id,
        ...dealParties(listing.kind, listing.orgId, offer.orgId),
        quantity: offer.quantity,
        unit: offer.unit,
        unitPrice: offer.unitPrice ?? listing.unitPrice,
        currency: offer.currency,
        taxBasis: offer.taxBasis,
        resultClass: ENTRY_CLASS,
      })
      .returning({ id: deals.id });
    await tx.insert(deliveries).values(plan.map((plannedAt) => ({ dealId: deal.id, plannedAt, plannedKg, status: "planned" as const, resultClass: ENTRY_CLASS })));
    return { dealId: deal.id, deliveries: plan };
  });
}

// ---- Okuma ----

export type ListingMatch = Match & { against: { id: string; title: string } };
export type MarketRow = {
  listing: Listing;
  orgName: string | null;
  own: boolean;
  /** Kurumunuzun konumundan kuş uçuşu; konumlardan biri bilinmiyorsa null. */
  distanceKm: Decimal | null;
  match: ListingMatch | null;
  openOffers: number;
};

type Context = {
  orgNames: Map<string, string>;
  home: Point | null;
  ownOpen: Listing[];
  reliability: (sellerOrgId: string) => Decimal | null;
};

/**
 * Güvenilirlik yalnızca bu kurumun görebildiği teslimlerden hesaplanır (taraf olduğu anlaşmalar).
 * Böylece bir sağlayıcının başka alıcılarla geçmişi sızmaz; skor "sizinle olan geçmiş"tir.
 */
async function context(db: Db, orgId: string, now: Date): Promise<Context> {
  const tenant = withTenant(db, orgId);
  const [orgs, profiles, ownOpen, visibleDeals, visibleDeliveries] = await Promise.all([
    tenant.list("organizations"),
    tenant.list("orgProfiles"),
    tenant.list("listings", { where: and(eq(listings.orgId, orgId), eq(listings.status, "open")) }),
    tenant.list("deals"),
    tenant.list("deliveries"),
  ]);
  const sellerOf = new Map(visibleDeals.map((d) => [d.id, d.sellerOrgId]));
  const bySeller = new Map<string, typeof visibleDeliveries>();
  for (const d of visibleDeliveries) {
    const s = sellerOf.get(d.dealId);
    if (s) bySeller.set(s, [...(bySeller.get(s) ?? []), d]);
  }
  const home = profiles.find((p) => p.orgId === orgId);
  return {
    orgNames: new Map(orgs.map((o) => [o.id, o.name])),
    home: home ? pointOf(home) : null,
    ownOpen,
    reliability: (seller) => onTimeRate(bySeller.get(seller) ?? [], now).rate,
  };
}

const sideOf = (l: Listing): MatchSide => ({
  kind: l.kind,
  composition: l.composition ?? null,
  containsSilk: l.containsSilk,
  quantity: l.quantity,
  unit: l.unit,
  point: pointOf(l),
});

/** Kurumun açık ilanları arasından tamamlayıcı olanlarla en iyi eşleşme; eşleşecek ilan yoksa null. */
function bestMatch(l: Listing, ctx: Context, orgId: string): ListingMatch | null {
  if (l.orgId === orgId) return null;
  const complement = ctx.ownOpen.filter((o) => isWaste(o.kind) === isWaste(l.kind) && ownerSells(o.kind) !== ownerSells(l.kind));
  let best: ListingMatch | null = null;
  for (const o of complement) {
    const [supply, demand] = ownerSells(l.kind) ? [l, o] : [o, l];
    const m = matchScore(sideOf(supply), sideOf(demand), ctx.reliability(supply.orgId));
    if (!best || (m.score ?? -1) > (best.score ?? -1)) best = { ...m, against: { id: o.id, title: o.title } };
  }
  return best;
}

function rowOf(l: Listing, ctx: Context, orgId: string, openOffers: number): MarketRow {
  const at = pointOf(l);
  return {
    listing: l,
    orgName: ctx.orgNames.get(l.orgId) ?? null,
    own: l.orgId === orgId,
    distanceKm: at && ctx.home ? crowFliesKm(ctx.home, at) : null,
    match: bestMatch(l, ctx, orgId),
    openOffers,
  };
}

export type MarketFilter = { kind?: ListingKind; silkFree?: boolean; sort?: "score" | "new" };

export async function listMarket(db: Db, orgId: string, filter: MarketFilter = {}, now = new Date()): Promise<MarketRow[]> {
  const tenant = withTenant(db, orgId);
  const ctx = await context(db, orgId, now);
  const rows = await tenant.list("listings", {
    where: and(
      eq(listings.status, "open"),
      filter.kind ? eq(listings.kind, filter.kind) : undefined,
      // İpeksiz süzgeci atık ilanları içindir; panel ilanında ipek alanı yoktur.
      filter.silkFree ? or(eq(listings.containsSilk, false), inArray(listings.kind, ["panel_offer", "panel_request"])) : undefined,
    ),
    orderBy: [desc(listings.createdAt), desc(listings.id)],
  });
  const ownIds = rows.filter((r) => r.orgId === orgId).map((r) => r.id);
  const pending = ownIds.length ? await tenant.list("offers", { where: and(inArray(offers.listingId, ownIds), eq(offers.status, "open")) }) : [];
  const out = rows.map((l) => rowOf(l, ctx, orgId, pending.filter((o) => o.listingId === l.id).length));
  if (filter.sort !== "new") out.sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1));
  return out;
}

export type DealView = TenantRow<"deals"> & { sellerName: string | null; buyerName: string | null; deliveries: TenantRow<"deliveries">[] };
export type ListingDetail = MarketRow & { offers: (Offer & { orgName: string | null })[]; deals: DealView[] };

/** Görünmeyen ilan için null: yok ile yetkisiz ayırt edilmez. */
export async function listingDetail(db: Db, orgId: string, listingId: string, now = new Date()): Promise<ListingDetail | null> {
  const tenant = withTenant(db, orgId);
  const listing = await tenant.get("listings", listingId);
  if (!listing) return null;
  const ctx = await context(db, orgId, now);
  const [visibleOffers, visibleDeals] = await Promise.all([
    tenant.list("offers", { where: eq(offers.listingId, listingId), orderBy: [desc(offers.createdAt), desc(offers.id)] }),
    tenant.list("deals", { where: eq(deals.listingId, listingId), orderBy: [desc(deals.createdAt)] }),
  ]);
  const dealDeliveries = visibleDeals.length
    ? await tenant.list("deliveries", { where: inArray(deliveries.dealId, visibleDeals.map((d) => d.id)), orderBy: [deliveries.plannedAt] })
    : [];
  const name = (id: string) => ctx.orgNames.get(id) ?? null;
  return {
    ...rowOf(listing, ctx, orgId, visibleOffers.filter((o) => o.status === "open").length),
    offers: visibleOffers.map((o) => ({ ...o, orgName: name(o.orgId) })),
    deals: visibleDeals.map((d) => ({
      ...d,
      sellerName: name(d.sellerOrgId),
      buyerName: name(d.buyerOrgId),
      deliveries: dealDeliveries.filter((x) => x.dealId === d.id),
    })),
  };
}
