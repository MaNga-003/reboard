import { boolean, customType, integer, jsonb, numeric, pgTable, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { classified, id, kg, orgId, ts } from "./common";
import { binder, bizStep, eventType, evidenceKind, evidenceStatus, testStatus } from "./enums";
import { deliveries, type Composition } from "./market";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => "bytea" });

// Teslim alınan atık partisi. org_id teslim alan (üretici), supplier_org_id sağlayıcıdır.
export const wasteBatches = pgTable("waste_batches", {
  id: id(),
  code: text("code").notNull().unique(),
  orgId: orgId(),
  supplierOrgId: text("supplier_org_id")
    .notNull()
    .references(() => organization.id),
  deliveryId: uuid("delivery_id").references(() => deliveries.id),
  receivedAt: ts("received_at").notNull(),
  declaredKg: kg("declared_kg"),
  weighedKg: kg("weighed_kg"),
  moisturePct: numeric("moisture_pct", { precision: 5, scale: 2 }),
  rejectedKg: kg("rejected_kg"),
  composition: jsonb("composition").$type<Composition>(),
  containsSilk: boolean("contains_silk"),
  // D-013: tartım ve kanıt varsa doğrulanmış sayılır.
  verified: boolean("verified").notNull().default(false),
  notes: text("notes"),
  ...classified(),
});

export const productionBatches = pgTable("production_batches", {
  id: id(),
  code: text("code").notNull().unique(),
  orgId: orgId(),
  startedAt: ts("started_at").notNull(),
  binder: binder("binder").notNull().default("unknown"),
  outputKg: kg("output_kg"),
  scrapKg: kg("scrap_kg"),
  moistureLossKg: kg("moisture_loss_kg"),
  // Kütle dengesi toleransı aşılırsa zorunlu açıklama.
  balanceNote: text("balance_note"),
  ...classified(),
});

export const batchInputs = pgTable(
  "batch_inputs",
  {
    productionBatchId: uuid("production_batch_id")
      .notNull()
      .references(() => productionBatches.id, { onDelete: "cascade" }),
    wasteBatchId: uuid("waste_batch_id")
      .notNull()
      .references(() => wasteBatches.id),
    allocatedKg: kg("allocated_kg").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productionBatchId, t.wasteBatchId] })],
);

export const panelLots = pgTable("panel_lots", {
  id: id(),
  code: text("code").notNull().unique(),
  orgId: orgId(),
  productionBatchId: uuid("production_batch_id")
    .notNull()
    .references(() => productionBatches.id),
  areaM2: numeric("area_m2", { precision: 12, scale: 2 }),
  sheetCount: integer("sheet_count"),
  thicknessMm: numeric("thickness_mm", { precision: 5, scale: 1 }),
  densityKgM3: numeric("density_kg_m3", { precision: 7, scale: 1 }),
  testStatus: testStatus("test_status").notNull().default("not_tested"),
  isPublic: boolean("is_public").notNull().default(true),
  ...classified(),
});

/**
 * Gözetim zinciri (D-012). Yalnızca eklenir: UPDATE ve DELETE bir tetikleyiciyle reddedilir
 * (drizzle/0002_append_only.sql). hash = sha256(canonicalJson(payload) + prev_hash), zincir org başına.
 */
export const custodyEvents = pgTable(
  "custody_events",
  {
    id: id(),
    orgId: orgId(),
    seq: integer("seq").notNull(),
    type: eventType("type").notNull(),
    bizStep: bizStep("biz_step").notNull(),
    eventTime: ts("event_time").notNull(),
    payload: jsonb("payload").notNull(),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [unique("custody_events_org_seq").on(t.orgId, t.seq)],
);

export const evidenceRegister = pgTable("evidence_register", {
  id: id(),
  orgId: orgId(),
  kind: evidenceKind("kind").notNull(),
  fileName: text("file_name").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  // D-018: MVP'de en fazla 5 MB, EvidenceStore arayüzünün arkasında.
  content: bytea("content"),
  period: text("period"),
  status: evidenceStatus("status").notNull().default("declared"),
  uploadedBy: text("uploaded_by").references(() => user.id),
  checkedBy: text("checked_by").references(() => user.id),
  ...classified(),
});

export const evidenceLinks = pgTable(
  "evidence_links",
  {
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidenceRegister.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.evidenceId, t.entityType, t.entityId] })],
);
