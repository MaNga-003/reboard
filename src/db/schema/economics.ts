// Maliyet ve veri raporundaki tablolar (D-002). Para alanları para birimi ve vergi temeli taşır.
import { jsonb, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { classified, id, kg, money, moneyMeta, orgId, ts } from "./common";
import { buyerProduct, costCategory, distanceKind, transactionKind, unit } from "./enums";
import { deals } from "./market";
import { evidenceRegister, productionBatches } from "./trace";

export const supplierBaseline = pgTable("supplier_baseline", {
  id: id(),
  orgId: orgId(),
  period: text("period").notNull(),
  disposalKg: kg("disposal_kg"),
  disposalCost: money("disposal_cost"),
  transportCost: money("transport_cost"),
  gateFee: money("gate_fee"),
  ...moneyMeta(),
  source: text("source"),
  ...classified(),
});

export const transportQuotes = pgTable("transport_quotes", {
  id: id(),
  orgId: orgId(),
  carrierName: text("carrier_name").notNull(),
  originDistrict: text("origin_district"),
  destinationDistrict: text("destination_district"),
  distanceKm: numeric("distance_km", { precision: 8, scale: 1 }),
  distanceKind: distanceKind("distance_kind").notNull(),
  pricePerTrip: money("price_per_trip"),
  capacityKg: kg("capacity_kg"),
  ...moneyMeta(),
  period: text("period"),
  source: text("source"),
  ...classified(),
});

export const costLines = pgTable("cost_lines", {
  id: id(),
  orgId: orgId(),
  period: text("period").notNull(),
  category: costCategory("category").notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }),
  unit: unit("unit"),
  unitCost: money("unit_cost"),
  amount: money("amount"),
  ...moneyMeta(),
  productionBatchId: uuid("production_batch_id").references(() => productionBatches.id),
  source: text("source"),
  ...classified(),
});

export const buyerTrials = pgTable("buyer_trials", {
  id: id(),
  orgId: orgId(),
  period: text("period").notNull(),
  product: buyerProduct("product").notNull(),
  areaM2: numeric("area_m2", { precision: 12, scale: 2 }),
  totalCost: money("total_cost"),
  ...moneyMeta(),
  notes: text("notes"),
  ...classified(),
});

export const transactions = pgTable("transactions", {
  id: id(),
  orgId: orgId(),
  counterpartyOrgId: text("counterparty_org_id").references(() => organization.id),
  dealId: uuid("deal_id").references(() => deals.id),
  kind: transactionKind("kind").notNull(),
  amount: money("amount").notNull(),
  ...moneyMeta(),
  occurredAt: ts("occurred_at").notNull(),
  evidenceId: uuid("evidence_id").references(() => evidenceRegister.id),
  ...classified(),
});

// Platform giderleri: kurumdan bağımsız; fiyatlar resmî sayfadan, tarihiyle.
export const saasCosts = pgTable("saas_costs", {
  id: id(),
  item: text("item").notNull(),
  vendor: text("vendor").notNull(),
  plan: text("plan"),
  monthlyCost: money("monthly_cost"),
  perCustomerCost: money("per_customer_cost"),
  ...moneyMeta(),
  sourceUrl: text("source_url").notNull(),
  retrievedAt: ts("retrieved_at").notNull(),
  ...classified(),
});

export const modelInputs = pgTable("model_inputs", {
  id: id(),
  orgId: text("org_id").references(() => organization.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: numeric("value", { precision: 18, scale: 6 }),
  unit: unit("unit"),
  ...moneyMeta(),
  period: text("period"),
  source: text("source"),
  ...classified(),
});

export const calcRuns = pgTable("calc_runs", {
  id: id(),
  orgId: text("org_id").references(() => organization.id, { onDelete: "cascade" }),
  formula: text("formula").notNull(),
  formulaVersion: text("formula_version").notNull(),
  inputHash: text("input_hash").notNull(),
  inputs: jsonb("inputs").notNull(),
  outputs: jsonb("outputs").notNull(),
  ...classified(),
});
