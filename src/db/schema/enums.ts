// Ortak enum'lar; anlamları docs/DATA_DICTIONARY.md içinde.
import { pgEnum } from "drizzle-orm/pg-core";

export const resultClass = pgEnum("result_class", ["synthetic", "sourced_estimate", "pilot_projection", "realized"]);
export const unit = pgEnum("unit", ["kg", "t", "m2", "m3", "kwh", "h", "km", "pcs", "trip", "month"]);
export const currency = pgEnum("currency", ["TRY", "EUR", "USD"]);
export const taxBasis = pgEnum("tax_basis", ["incl_vat", "excl_vat"]);
export const orgKind = pgEnum("org_kind", ["textile_factory", "municipality", "recycler", "producer", "panel_buyer", "carrier"]);
export const listingKind = pgEnum("listing_kind", ["waste_offer", "waste_request", "panel_offer", "panel_request"]);
export const listingStatus = pgEnum("listing_status", ["open", "closed"]);
export const recurrence = pgEnum("recurrence", ["once", "weekly", "monthly"]);
export const offerStatus = pgEnum("offer_status", ["open", "accepted", "rejected", "withdrawn"]);
export const deliveryStatus = pgEnum("delivery_status", ["planned", "delivered", "cancelled"]);
export const binder = pgEnum("binder", ["pet_copet", "pmdi", "none", "unknown"]);
export const testStatus = pgEnum("test_status", ["not_tested", "in_progress", "passed", "failed"]);
export const eventType = pgEnum("event_type", ["object", "transformation", "transaction"]);
export const bizStep = pgEnum("biz_step", ["receiving", "inspecting", "commissioning", "shipping", "transforming", "accepting"]);
export const evidenceKind = pgEnum("evidence_kind", ["weighbridge_ticket", "waybill", "invoice", "test_report", "photo", "other"]);
export const evidenceStatus = pgEnum("evidence_status", ["declared", "documented", "reconciled"]);
export const distanceKind = pgEnum("distance_kind", ["crow_flies", "road"]);
export const costCategory = pgEnum("cost_category", ["material", "binder", "energy", "labor", "operations", "fixed", "depreciation", "transport", "other"]);
export const transactionKind = pgEnum("transaction_kind", ["panel_sale", "gate_fee", "service", "waste_purchase", "subscription"]);
export const buyerProduct = pgEnum("buyer_product", ["particleboard", "mdf", "reboard"]);
// SaaS gider kalemi hangi kurulumda geçerli: bugünkü demo, ilk ücretli müşteriyle ticari ya da ikisi (D-027).
export const saasStage = pgEnum("saas_stage", ["demo", "commercial", "both"]);
