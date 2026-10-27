// Pazar yeri (T2.1): ilan → teklif → kabul → anlaşma ve teslim planı, gerçek migrasyonlar ve demo verisiyle.
// Kurallar, eşzamanlı kabul ve kiracı sınırı (teklif ve anlaşmayı yalnızca tarafları görür) burada ölçülür.
import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb } from "@/db/client";
import {
  MarketRuleError,
  acceptOffer,
  closeListing,
  createListing,
  listMarket,
  listingDetail,
  placeOffer,
  rejectOffer,
  withdrawOffer,
  type NewListing,
} from "@/db/repo/market";
import { TenantAccessError } from "@/db/repo/tenant";
import { deals, deliveries, listings, offers } from "@/db/schema";
import { seedDemo } from "@/db/seed";
import { DEMO_ORGS, demoId, orgIdOf } from "@/db/seed/demo";
import { deliveryPlan } from "@/domain/market";

const NOW = new Date("2026-10-29T15:00:00Z");
const client = new PGlite();
const db = createPgliteDb(client);
const [R, A, B, F, G] = [DEMO_ORGS.reboard, DEMO_ORGS.a, DEMO_ORGS.b, DEMO_ORGS.f, DEMO_ORGS.g].map(orgIdOf);
const ORGS = Object.values(DEMO_ORGS).map(orgIdOf);

const waste = (o: Partial<NewListing> = {}): NewListing => ({
  kind: "waste_offer",
  title: "Test kırpıntısı",
  quantity: "800",
  unit: "kg",
  composition: { cotton: 55, polyester: 45 },
  containsSilk: false,
  recurrence: "once",
  windowStart: "2026-10-29",
  windowEnd: "2026-11-30",
  unitPrice: "-400",
  currency: "TRY",
  taxBasis: "excl_vat",
  ...o,
});
const offer = (o: Partial<{ quantity: string; proposedDate: string }> = {}) => ({
  quantity: "800",
  unitPrice: "-400",
  proposedDate: "2026-11-02",
  message: null,
  ...o,
});
const rule = (code: string) => expect.objectContaining({ name: "MarketRuleError", code });

beforeAll(async () => {
  await migrate(db as never, { migrationsFolder: "./drizzle" });
  await seedDemo(db, { now: NOW, env: { DEMO_MODE: "true" } });
}, 60_000);
afterAll(() => client.close());

describe("akış: ilan, teklif, kabul", () => {
  it("sağlayıcı ilan verir, üretici teklif eder, sağlayıcı kabul eder: anlaşma ve teslim planı oluşur", async () => {
    const listingId = await createListing(db, A, waste());
    const [l] = await db.select().from(listings).where(eq(listings.id, listingId));
    // Konum kurum profilinden gelir; sınıf sentetik.
    expect(l).toMatchObject({ orgId: A, status: "open", district: DEMO_ORGS.a.district, lat: DEMO_ORGS.a.lat, resultClass: "synthetic", priceUnit: "kg" });

    const mine = await placeOffer(db, R, listingId, offer(), NOW);
    const other = await placeOffer(db, B, listingId, offer({ quantity: "300" }), NOW);
    const accepted = await acceptOffer(db, A, mine, NOW);
    expect(accepted.deliveries.map((d) => d.toISOString())).toEqual(["2026-11-02T06:00:00.000Z"]);

    const [deal] = await db.select().from(deals).where(eq(deals.id, accepted.dealId));
    expect(deal).toMatchObject({ offerId: mine, listingId, sellerOrgId: A, buyerOrgId: R, quantity: "800.000", unit: "kg", unitPrice: "-400.00" });
    const plan = await db.select().from(deliveries).where(eq(deliveries.dealId, deal.id));
    expect(plan).toEqual([expect.objectContaining({ plannedKg: "800.000", status: "planned", deliveredAt: null, resultClass: "synthetic" })]);
    // Tek seferlik ilan kapanır; bekleyen öteki teklif reddedilir.
    const [after] = await db.select({ status: listings.status }).from(listings).where(eq(listings.id, listingId));
    expect(after.status).toBe("closed");
    const statuses = Object.fromEntries((await db.select().from(offers).where(eq(offers.listingId, listingId))).map((o) => [o.id, o.status]));
    expect(statuses).toEqual({ [mine]: "accepted", [other]: "rejected" });
  });

  it("talep ilanında teklif veren satıcıdır; tekrarlı ilan açık kalır, teslimler haftalık", async () => {
    const requestId = demoId("listing:reboard-waste-request");
    const [req] = await db.select().from(listings).where(eq(listings.id, requestId));
    const offerId = await placeOffer(db, A, requestId, offer({ quantity: "2000", proposedDate: "2026-11-05" }), NOW);
    const { dealId, deliveries: plan } = await acceptOffer(db, R, offerId, NOW);
    expect(plan).toEqual(deliveryPlan("2026-11-05", "weekly", req.windowEnd));
    expect(plan.length).toBeGreaterThan(1);
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal).toMatchObject({ sellerOrgId: A, buyerOrgId: R });
    expect(await db.select().from(deliveries).where(eq(deliveries.dealId, dealId))).toHaveLength(plan.length);
    const [still] = await db.select({ status: listings.status }).from(listings).where(eq(listings.id, requestId));
    expect(still.status).toBe("open");
  });

  it("m² panel anlaşmasında teslim kütlesi bilinmiyor (null), 0 değil", async () => {
    const { dealId, deliveries: plan } = await acceptOffer(db, G, demoId("offer:reboard-to-g"), NOW);
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal).toMatchObject({ sellerOrgId: R, buyerOrgId: G, unit: "m2" });
    const rows = await db.select().from(deliveries).where(eq(deliveries.dealId, dealId));
    expect(rows).toHaveLength(plan.length);
    expect(rows.every((r) => r.plannedKg === null)).toBe(true);
  });
});

describe("kurallar", () => {
  it("kendi ilanına teklif, aşan miktar, geçmiş tarih ve pencere dışı reddedilir", async () => {
    const id = await createListing(db, A, waste());
    await expect(placeOffer(db, A, id, offer(), NOW)).rejects.toEqual(rule("own_listing"));
    await expect(placeOffer(db, R, id, offer({ quantity: "800.5" }), NOW)).rejects.toEqual(rule("quantity_exceeds"));
    await expect(placeOffer(db, R, id, offer({ proposedDate: "2026-10-28" }), NOW)).rejects.toEqual(rule("date_past"));
    await expect(placeOffer(db, R, id, offer({ proposedDate: "2026-12-01" }), NOW)).rejects.toEqual(rule("date_outside_window"));
    await expect(createListing(db, A, waste({ unit: "m2" }))).rejects.toEqual(rule("unit_mismatch"));
  });

  it("kapalı ilan başkasına görünmez: teklif 'yok' hatası alır", async () => {
    const id = await createListing(db, A, waste());
    await closeListing(db, A, id);
    await expect(placeOffer(db, R, id, offer(), NOW)).rejects.toBeInstanceOf(TenantAccessError);
  });

  it("kabul ve reddi yalnızca ilan sahibi, geri çekmeyi yalnızca teklif veren yapar", async () => {
    const id = await createListing(db, A, waste());
    const o = await placeOffer(db, R, id, offer(), NOW);
    // Teklif veren ilanı ve teklifini görür ama kabul edemez.
    await expect(acceptOffer(db, R, o, NOW)).rejects.toEqual(rule("not_owner"));
    await expect(rejectOffer(db, R, o)).rejects.toEqual(rule("not_owner"));
    // Üçüncü kurum teklifi hiç görmez.
    for (const x of [B, F, G]) {
      await expect(acceptOffer(db, x, o, NOW)).rejects.toBeInstanceOf(TenantAccessError);
      await expect(withdrawOffer(db, x, o)).rejects.toBeInstanceOf(TenantAccessError);
      await expect(closeListing(db, x, id)).rejects.toBeInstanceOf(TenantAccessError);
    }
    await expect(withdrawOffer(db, A, o)).rejects.toEqual(rule("not_owner"));
    await withdrawOffer(db, R, o);
    await expect(acceptOffer(db, A, o, NOW)).rejects.toEqual(rule("offer_not_open"));
    await expect(rejectOffer(db, A, o)).rejects.toEqual(rule("offer_not_open"));
  });

  it("aynı teklif aynı anda iki kez kabul edilirse yalnızca biri geçer", async () => {
    const id = await createListing(db, A, waste({ recurrence: "weekly" }));
    const o = await placeOffer(db, R, id, offer(), NOW);
    const results = await Promise.allSettled([acceptOffer(db, A, o, NOW), acceptOffer(db, A, o, NOW), acceptOffer(db, A, o, NOW)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((r) => r.status === "rejected")) expect((r as PromiseRejectedResult).reason).toBeInstanceOf(MarketRuleError);
    expect(await db.select().from(deals).where(eq(deals.offerId, o))).toHaveLength(1);
  });

  it("kabul yarıda kalırsa hiçbir şey yazılmaz", async () => {
    const id = await createListing(db, A, waste());
    const o = await placeOffer(db, R, id, offer(), NOW);
    // Kabul ile ilan kapanması arasında ilan başka yoldan kapanmış gibi: işlem geri alınmalı.
    await db.update(listings).set({ status: "closed" }).where(eq(listings.id, id));
    await expect(acceptOffer(db, A, o, NOW)).rejects.toEqual(rule("listing_closed"));
    const [row] = await db.select({ status: offers.status }).from(offers).where(eq(offers.id, o));
    expect(row.status).toBe("open");
    expect(await db.select().from(deals).where(eq(deals.offerId, o))).toHaveLength(0);
  });
});

describe("okuma: liste, eşleşme ve kiracı sınırı", () => {
  it("üretici, sağlayıcı ilanlarını eşleşme skoruyla görür; ipekli ilan dışlanır, süzgeç onu gizler", async () => {
    const rows = await listMarket(db, R, { kind: "waste_offer" }, NOW);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.listing.kind === "waste_offer" && r.listing.status === "open")).toBe(true);
    const silk = rows.find((r) => r.listing.id === demoId("listing:kaynak-a-silk"))!;
    expect(silk.match).toMatchObject({ score: 0, excluded: "silk" });
    const scored = rows.filter((r) => r.match?.score != null && !r.match.excluded);
    expect(scored.length).toBeGreaterThan(0);
    // Sağlayıcıyla geçmişi olan üretici için güvenilirlik bilinir; skor sıralıdır.
    expect(scored.some((r) => r.match!.parts.reliability !== null)).toBe(true);
    const scores = rows.map((r) => r.match?.score ?? -1);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(rows.every((r) => r.distanceKm !== null)).toBe(true);

    const silkFree = await listMarket(db, R, { kind: "waste_offer", silkFree: true }, NOW);
    expect(silkFree.some((r) => r.listing.containsSilk === true)).toBe(false);
    expect(silkFree.length).toBe(rows.filter((r) => r.listing.containsSilk === false).length);
  });

  it("güvenilirlik yalnızca görülebilen teslimlerden: geçmişi olmayan kurum için bilinmiyor", async () => {
    // B'nin A ile anlaşması yok; A'nın başka alıcılarla geçmişi B'ye sızmamalı.
    const bRequest = await createListing(db, B, waste({ kind: "waste_request", title: "B talebi", recurrence: "weekly" }));
    const rows = await listMarket(db, B, { kind: "waste_offer" }, NOW);
    const fromA = rows.filter((r) => r.listing.orgId === A && !r.match?.excluded);
    expect(fromA.length).toBeGreaterThan(0);
    for (const r of fromA) {
      expect(r.match!.against.id).toBe(bRequest);
      expect(r.match!.parts.reliability).toBeNull();
      expect(r.match!.knownWeight).toBe(80);
    }
  });

  it("her kurum ilan ayrıntısında yalnızca taraf olduğu teklif ve anlaşmaları görür", async () => {
    const all = await db.select().from(listings);
    const allOffers = await db.select().from(offers);
    let checked = 0;
    for (const x of ORGS) {
      for (const l of all) {
        const d = await listingDetail(db, x, l.id, NOW);
        if (l.orgId !== x && l.status !== "open") {
          expect(d, `${x} kapalı ilanı görmemeli: ${l.id}`).toBeNull();
          continue;
        }
        expect(d).not.toBeNull();
        for (const o of d!.offers) expect(o.orgId === x || l.orgId === x, `${x} teklif ${o.id}`).toBe(true);
        for (const deal of d!.deals) expect(deal.sellerOrgId === x || deal.buyerOrgId === x, `${x} anlaşma ${deal.id}`).toBe(true);
        // Görmesi gereken her teklif de görünür (eksik satır yok).
        const expected = allOffers.filter((o) => o.listingId === l.id && (o.orgId === x || l.orgId === x)).length;
        expect(d!.offers).toHaveLength(expected);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(ORGS.length * 5);
  });

  it("geçersiz ya da görünmeyen kimlik null ve 'yok' hatası verir", async () => {
    expect(await listingDetail(db, R, "olmayan", NOW)).toBeNull();
    await expect(acceptOffer(db, R, "olmayan", NOW)).rejects.toBeInstanceOf(TenantAccessError);
    const [closed] = await db.select().from(listings).where(and(eq(listings.orgId, F), eq(listings.status, "closed")));
    expect(await listingDetail(db, R, closed.id, NOW)).toBeNull();
  });
});
