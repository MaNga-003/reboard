import { boolean, date, doublePrecision, jsonb, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { classified, id, kg, money, moneyMeta, orgId, ts } from "./common";
import type { Composition } from "../../domain/fibre";
import { deliveryStatus, listingKind, listingStatus, offerStatus, recurrence, unit } from "./enums";

export type { Composition };

export const listings = pgTable("listings", {
  id: id(),
  orgId: orgId(),
  kind: listingKind("kind").notNull(),
  status: listingStatus("status").notNull().default("open"),
  title: text("title").notNull(),
  composition: jsonb("composition").$type<Composition>(),
  containsSilk: boolean("contains_silk"),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unit: unit("unit").notNull(),
  recurrence: recurrence("recurrence").notNull().default("once"),
  windowStart: date("window_start"),
  windowEnd: date("window_end"),
  // İşaret "kim kime öder"i söyler: pozitif → alıcı öder; negatif → sağlayıcı kabul bedeli öder.
  unitPrice: money("unit_price"),
  priceUnit: unit("price_unit"),
  ...moneyMeta(),
  district: text("district"),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  ...classified(),
});

export const offers = pgTable("offers", {
  id: id(),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  orgId: orgId(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unit: unit("unit").notNull(),
  unitPrice: money("unit_price"),
  ...moneyMeta(),
  proposedDate: date("proposed_date"),
  status: offerStatus("status").notNull().default("open"),
  message: text("message"),
  ...classified(),
});

export const deals = pgTable("deals", {
  id: id(),
  offerId: uuid("offer_id")
    .notNull()
    .unique()
    .references(() => offers.id),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listings.id),
  sellerOrgId: text("seller_org_id")
    .notNull()
    .references(() => organization.id),
  buyerOrgId: text("buyer_org_id")
    .notNull()
    .references(() => organization.id),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unit: unit("unit").notNull(),
  unitPrice: money("unit_price"),
  ...moneyMeta(),
  ...classified(),
});

export const deliveries = pgTable("deliveries", {
  id: id(),
  dealId: uuid("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  plannedAt: ts("planned_at").notNull(),
  deliveredAt: ts("delivered_at"),
  plannedKg: kg("planned_kg").notNull(),
  carrierName: text("carrier_name"),
  status: deliveryStatus("status").notNull().default("planned"),
  ...classified(),
});
