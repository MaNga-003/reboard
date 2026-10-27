// İzlenebilirlik deposu (T2.2). Kurallar src/domain/traceability'de; burada kiracı görünürlüğüyle okunur ve uygulanır.
// Her yazma, olayını aynı işlemde gözetim zincirine ekler: kayıt ya zinciriyle birlikte oluşur ya hiç oluşmaz.
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { and, asc, desc, eq, inArray, like } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { istanbulDay } from "../../domain/market";
import { TARGET_THICKNESS_MM } from "../../domain/panel";
import { Decimal, type ResultClass } from "../../domain/result";
import {
  acceptedKg,
  cleanFileName,
  declaredGap,
  evidenceError,
  genealogy,
  isVerified,
  kgText,
  lotAreaM2,
  massBalance,
  nextCode,
  productionError,
  receiveError,
  remainingKg,
  sniffMime,
  touches,
  verifyChain,
  type ChainVerdict,
  type ChainedEvent,
  type CodePrefix,
  type EvidenceKind,
  type Genealogy,
  type MassBalance,
  type ProductionInput,
  type ReceiveInput,
} from "../../domain/traceability";
import type { Db } from "../client";
import { batchInputs, deals, deliveries, evidenceLinks, evidenceRegister, listings, panelLots, productionBatches, wasteBatches } from "../schema";
import { appendCustodyEvent, listCustodyEvents } from "./custody";
import { TenantAccessError, withTenant, type TenantRow } from "./tenant";

export class TraceRuleError extends Error {
  constructor(readonly code: string) {
    super(`İzlenebilirlik kuralı: ${code}`);
    this.name = "TraceRuleError";
  }
}

// Bütün hesaplar demo hesabıdır (D-010); girdikleri her kayıt sentetiktir (D-011).
const ENTRY_CLASS = "synthetic" as const;

export type Actor = { orgId: string; userId: string };
type WasteBatch = TenantRow<"wasteBatches">;
type Evidence = TenantRow<"evidenceRegister">;
type Binder = (typeof productionBatches.$inferInsert)["binder"];

const n = (v: Decimal.Value | null, dp: number) => (v === null ? null : new Decimal(v).toFixed(dp));
const year = (now: Date) => Number(istanbulDay(now).slice(0, 4));
const asDb = (tx: unknown) => tx as Db;

/** D-018: dosya içeriği bu arayüzün arkasında. MVP'de Postgres bytea; ileride S3 ya da R2 aynı imzayla gelir. */
export type EvidenceStore = {
  /** Kayda yazılacak içerik kolonu; dış depoda dosya önce yüklenir, kolon boş kalır. */
  put(bytes: Uint8Array): Promise<{ content: Uint8Array | null }>;
  read(db: Db, evidenceId: string): Promise<Uint8Array | null>;
};

export const pgEvidenceStore: EvidenceStore = {
  // node-postgres bytea için Buffer bekler; PGlite Uint8Array'i de kabul eder.
  put: async (bytes) => ({ content: Buffer.from(bytes) }),
  async read(db, evidenceId) {
    const [row] = await db.select({ content: evidenceRegister.content }).from(evidenceRegister).where(eq(evidenceRegister.id, evidenceId));
    return row?.content ?? null;
  },
};

const UNIQUE_CODES = ["waste_batches_code_unique", "production_batches_code_unique", "panel_lots_code_unique"];
const isCodeConflict = (e: unknown) => {
  const cause = (e as { cause?: unknown })?.cause ?? e;
  const msg = String((cause as { message?: string })?.message);
  return (cause as { code?: string })?.code === "23505" && UNIQUE_CODES.some((c) => msg.includes(c));
};

/** Kod yılın en büyük numarasından türetilir; aynı anda iki kayıt aynı kodu alırsa benzersizlik reddeder, işlem yeniden denenir. */
async function retryOnCode<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || !isCodeConflict(e)) throw e;
    }
  }
}

async function codeFor(tx: Db, prefix: CodePrefix, now: Date, col: PgColumn, table: PgTable): Promise<string> {
  const y = year(now);
  const rows = await tx
    .select({ code: col })
    .from(table)
    .where(like(col, `${prefix}-${y}-%`));
  return nextCode(
    prefix,
    y,
    rows.map((r) => String(r.code)),
  );
}

// ---- Kabul ----

export type Receivable = {
  id: string;
  dealId: string;
  plannedAt: Date;
  plannedKg: string | null;
  status: "planned" | "delivered" | "cancelled";
  sellerOrgId: string;
  sellerName: string | null;
  listingTitle: string | null;
  composition: WasteBatch["composition"];
  containsSilk: boolean | null;
  resultClass: ResultClass;
};

/** Bu kurumun alıcı olduğu atık anlaşmalarının teslimleri. m² panel teslimleri atık partisi olarak kabul edilmez. */
async function receivables(db: Db, orgId: string, where?: ReturnType<typeof eq>): Promise<Receivable[]> {
  const tenant = withTenant(db, orgId);
  const rows = await db
    .select({
      id: deliveries.id,
      dealId: deliveries.dealId,
      plannedAt: deliveries.plannedAt,
      plannedKg: deliveries.plannedKg,
      status: deliveries.status,
      resultClass: deliveries.resultClass,
      sellerOrgId: deals.sellerOrgId,
      listingId: deals.listingId,
    })
    .from(deliveries)
    .innerJoin(deals, eq(deals.id, deliveries.dealId))
    .where(and(tenant.visible("deliveries"), eq(deals.buyerOrgId, orgId), inArray(deals.unit, ["kg", "t"]), where))
    .orderBy(asc(deliveries.plannedAt));
  if (!rows.length) return [];
  const [orgs, ls] = await Promise.all([
    tenant.list("organizations"),
    tenant.list("listings", {
      where: inArray(
        listings.id,
        rows.map((r) => r.listingId),
      ),
    }),
  ]);
  const names = new Map(orgs.map((o) => [o.id, o.name]));
  const byListing = new Map(ls.map((l) => [l.id, l]));
  return rows.map(({ listingId, ...r }) => {
    const l = byListing.get(listingId);
    return {
      ...r,
      sellerName: names.get(r.sellerOrgId) ?? null,
      listingTitle: l?.title ?? null,
      composition: l?.composition ?? null,
      containsSilk: l?.containsSilk ?? null,
    };
  });
}

export const receivableDeliveries = (db: Db, orgId: string) => receivables(db, orgId, eq(deliveries.status, "planned"));

export async function receiveTarget(db: Db, orgId: string, deliveryId: string): Promise<Receivable | null> {
  if (!/^[0-9a-f-]{36}$/i.test(deliveryId)) return null;
  const [row] = await receivables(db, orgId, eq(deliveries.id, deliveryId));
  return row ?? null;
}

export type NewReceipt = ReceiveInput & { notes: string | null };

/** Teslim alınır: teslim "teslim edildi" olur, atık partisi açılır, kabul ve ayıklama olayları zincire eklenir. */
export async function receiveDelivery(db: Db, actor: Actor, deliveryId: string, input: NewReceipt, now = new Date()): Promise<{ id: string; code: string }> {
  const err = receiveError(input);
  if (err) throw new TraceRuleError(err);
  const target = await receiveTarget(db, actor.orgId, deliveryId);
  if (!target) throw new TenantAccessError("deliveries", deliveryId);
  if (target.status !== "planned") throw new TraceRuleError("delivery_not_open");
  const { declaredKg, weighedKg, rejectedKg } = input;

  return retryOnCode(() =>
    db.transaction(async (tx) => {
      const done = await tx
        .update(deliveries)
        .set({ status: "delivered", deliveredAt: now })
        .where(and(eq(deliveries.id, deliveryId), eq(deliveries.status, "planned")))
        .returning({ id: deliveries.id });
      if (!done.length) throw new TraceRuleError("delivery_not_open");
      const code = await codeFor(asDb(tx), "WB", now, wasteBatches.code, wasteBatches);
      const [row] = await tx
        .insert(wasteBatches)
        .values({
          code,
          orgId: actor.orgId,
          supplierOrgId: target.sellerOrgId,
          deliveryId,
          receivedAt: now,
          declaredKg: n(declaredKg, 3),
          weighedKg: n(weighedKg, 3),
          moisturePct: n(input.moisturePct, 2),
          rejectedKg: n(rejectedKg, 3),
          composition: input.composition,
          containsSilk: input.containsSilk,
          // Kanıt henüz kontrol edilmedi: doğrulama kanıt kontrolünde açılır (D-013).
          verified: false,
          notes: input.notes,
          resultClass: ENTRY_CLASS,
        })
        .returning({ id: wasteBatches.id });
      await appendCustodyEvent(asDb(tx), {
        orgId: actor.orgId,
        type: "object",
        bizStep: "receiving",
        eventTime: now,
        payload: {
          inputs: [],
          outputs: [{ ref: code, kg: kgText((weighedKg ?? declaredKg)!) }],
          evidenceIds: [],
          note: weighedKg === null ? "Tartım bekleniyor; beyan edilen kg" : "Kantar tartımı",
        },
      });
      const accepted = acceptedKg(weighedKg, rejectedKg);
      if (accepted !== null) {
        await appendCustodyEvent(asDb(tx), {
          orgId: actor.orgId,
          type: "object",
          bizStep: "inspecting",
          eventTime: now,
          payload: {
            inputs: [{ ref: code, kg: kgText(weighedKg!) }],
            outputs: [{ ref: code, kg: kgText(accepted) }],
            evidenceIds: [],
            note: `Ayıklanan ${kgText(rejectedKg!)} kg${input.containsSilk ? " (ipek dahil)" : ""}`,
          },
        });
      }
      return { id: row.id, code };
    }),
  );
}

// ---- Kanıt ----

export type NewEvidence = { wasteBatchId: string; kind: EvidenceKind; fileName: string; bytes: Uint8Array };

/** Kanıt "beyan" durumunda kaydedilir; SHA-256 özeti zincire yazılır, sonradan dosya değiştirilirse özet tutmaz. */
export async function uploadEvidence(db: Db, actor: Actor, input: NewEvidence, now = new Date(), store = pgEvidenceStore): Promise<string> {
  const tenant = withTenant(db, actor.orgId);
  await tenant.assertOwns("wasteBatches", input.wasteBatchId);
  const err = evidenceError(input.bytes);
  if (err) throw new TraceRuleError(err);
  const batch = (await tenant.get("wasteBatches", input.wasteBatchId))!;
  const hash = bytesToHex(sha256(input.bytes));
  const stored = await store.put(input.bytes);

  return db.transaction(async (tx) => {
    const [ev] = await tx
      .insert(evidenceRegister)
      .values({
        orgId: actor.orgId,
        kind: input.kind,
        fileName: cleanFileName(input.fileName),
        mime: sniffMime(input.bytes)!,
        sizeBytes: input.bytes.length,
        sha256: hash,
        ...stored,
        period: istanbulDay(now).slice(0, 7),
        status: "declared",
        uploadedBy: actor.userId,
        resultClass: ENTRY_CLASS,
      })
      .returning({ id: evidenceRegister.id });
    await tx.insert(evidenceLinks).values({ evidenceId: ev.id, entityType: "waste_batch", entityId: batch.id });
    await appendCustodyEvent(asDb(tx), {
      orgId: actor.orgId,
      type: "object",
      bizStep: "inspecting",
      eventTime: now,
      payload: { inputs: [], outputs: [], evidenceIds: [ev.id], note: `Kanıt yüklendi: ${input.kind}, ${batch.code}, sha256 ${hash}` },
    });
    return ev.id;
  });
}

/** Bir insan kanıtı kontrol eder: beyan → belgeli. Bağlı partiler D-013'e göre yeniden değerlendirilir. */
export async function checkEvidence(db: Db, actor: Actor, evidenceId: string, now = new Date()): Promise<{ verified: string[] }> {
  await withTenant(db, actor.orgId).assertOwns("evidenceRegister", evidenceId);
  return db.transaction(async (tx) => {
    const done = await tx
      .update(evidenceRegister)
      .set({ status: "documented", checkedBy: actor.userId })
      .where(and(eq(evidenceRegister.id, evidenceId), eq(evidenceRegister.orgId, actor.orgId), eq(evidenceRegister.status, "declared")))
      .returning({ id: evidenceRegister.id });
    if (!done.length) throw new TraceRuleError("evidence_not_declared");
    const linked = await tx
      .select({ id: wasteBatches.id, code: wasteBatches.code, weighedKg: wasteBatches.weighedKg, verified: wasteBatches.verified })
      .from(evidenceLinks)
      .innerJoin(wasteBatches, eq(wasteBatches.id, evidenceLinks.entityId))
      .where(and(eq(evidenceLinks.evidenceId, evidenceId), eq(evidenceLinks.entityType, "waste_batch"), eq(wasteBatches.orgId, actor.orgId)));
    const verified: string[] = [];
    for (const b of linked) {
      const evidence = await tx
        .select({ kind: evidenceRegister.kind, status: evidenceRegister.status })
        .from(evidenceLinks)
        .innerJoin(evidenceRegister, eq(evidenceRegister.id, evidenceLinks.evidenceId))
        .where(and(eq(evidenceLinks.entityType, "waste_batch"), eq(evidenceLinks.entityId, b.id), eq(evidenceRegister.orgId, actor.orgId)));
      if (!b.verified && isVerified(b.weighedKg, evidence)) {
        await tx.update(wasteBatches).set({ verified: true }).where(eq(wasteBatches.id, b.id));
        verified.push(b.code);
      }
    }
    await appendCustodyEvent(asDb(tx), {
      orgId: actor.orgId,
      type: "object",
      bizStep: "inspecting",
      eventTime: now,
      payload: {
        inputs: [],
        outputs: [],
        evidenceIds: [evidenceId],
        note: `Kanıt kontrol edildi${verified.length ? `; doğrulanan parti: ${verified.join(", ")}` : ""}`,
      },
    });
    return { verified };
  });
}

export async function evidenceFile(db: Db, orgId: string, evidenceId: string, store = pgEvidenceStore): Promise<{ meta: Evidence; bytes: Uint8Array } | null> {
  const meta = await withTenant(db, orgId).get("evidenceRegister", evidenceId);
  if (!meta) return null;
  const bytes = await store.read(db, evidenceId);
  return bytes && { meta, bytes };
}

// ---- Stok ve üretim ----

export type StockRow = { batch: WasteBatch; accepted: Decimal | null; remaining: Decimal | null };

/** Kurumun teslim aldığı partiler; kalan = kabul edilen − kendi üretimlerine tahsis edilen. */
export async function stock(db: Db, orgId: string): Promise<StockRow[]> {
  const tenant = withTenant(db, orgId);
  const [batches, inputs] = await Promise.all([
    tenant.list("wasteBatches", { where: eq(wasteBatches.orgId, orgId), orderBy: [asc(wasteBatches.receivedAt)] }),
    tenant.list("batchInputs"),
  ]);
  return batches.map((batch) => {
    const accepted = acceptedKg(batch.weighedKg, batch.rejectedKg);
    const allocated = inputs.filter((i) => i.wasteBatchId === batch.id).map((i) => i.allocatedKg);
    return { batch, accepted, remaining: remainingKg(accepted, allocated) };
  });
}

export type NewProduction = ProductionInput & { binder: NonNullable<Binder> };

/** Üretim partisi, tahsisler, isteğe bağlı lot ve dönüşüm olayı tek işlemde. */
export async function createProduction(db: Db, actor: Actor, input: NewProduction, now = new Date()): Promise<{ id: string; code: string; lotId: string | null }> {
  const ids = input.inputs.map((i) => i.wasteBatchId).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  return retryOnCode(() =>
    db.transaction(async (tx) => {
      // Eşzamanlı iki üretim aynı kalanı tahsis etmesin: girdi partileri kilitlenir, kalan kilit altında hesaplanır.
      const locked = ids.length
        ? await tx
            .select({ id: wasteBatches.id, code: wasteBatches.code, weighedKg: wasteBatches.weighedKg, rejectedKg: wasteBatches.rejectedKg, verified: wasteBatches.verified })
            .from(wasteBatches)
            .where(and(inArray(wasteBatches.id, ids), eq(wasteBatches.orgId, actor.orgId)))
            .for("update")
        : [];
      const allocs = locked.length
        ? await tx
            .select({ wasteBatchId: batchInputs.wasteBatchId, allocatedKg: batchInputs.allocatedKg })
            .from(batchInputs)
            .where(
              inArray(
                batchInputs.wasteBatchId,
                locked.map((b) => b.id),
              ),
            )
        : [];
      const stockNow = locked.map((b) => ({
        id: b.id,
        verified: b.verified,
        remainingKg: remainingKg(
          acceptedKg(b.weighedKg, b.rejectedKg),
          allocs.filter((a) => a.wasteBatchId === b.id).map((a) => a.allocatedKg),
        ),
      }));
      const err = productionError(input, stockNow);
      if (err) throw new TraceRuleError(err);

      const code = await codeFor(asDb(tx), "PB", now, productionBatches.code, productionBatches);
      const [prod] = await tx
        .insert(productionBatches)
        .values({
          code,
          orgId: actor.orgId,
          startedAt: now,
          binder: input.binder,
          outputKg: n(input.outputKg, 3),
          scrapKg: n(input.scrapKg, 3),
          moistureLossKg: n(input.moistureLossKg, 3),
          balanceNote: input.balanceNote?.trim() || null,
          resultClass: ENTRY_CLASS,
        })
        .returning({ id: productionBatches.id });
      await tx
        .insert(batchInputs)
        .values(input.inputs.map((i) => ({ productionBatchId: prod.id, wasteBatchId: i.wasteBatchId, allocatedKg: kgText(i.kg), resultClass: ENTRY_CLASS })));

      let lot: { id: string; code: string } | null = null;
      if (input.sheetCount !== null) {
        const lotCode = await codeFor(asDb(tx), "PL", now, panelLots.code, panelLots);
        const [row] = await tx
          .insert(panelLots)
          .values({
            code: lotCode,
            orgId: actor.orgId,
            productionBatchId: prod.id,
            areaM2: lotAreaM2(input.sheetCount).toFixed(2),
            sheetCount: input.sheetCount,
            thicknessMm: TARGET_THICKNESS_MM.toFixed(1),
            densityKgM3: n(input.densityKgM3, 1),
            // Reçete test edilmedi: test durumu ancak test raporu kanıtıyla değişir.
            testStatus: "not_tested",
            isPublic: true,
            resultClass: ENTRY_CLASS,
          })
          .returning({ id: panelLots.id });
        lot = { id: row.id, code: lotCode };
      }

      const codeOf = new Map(locked.map((b) => [b.id, b.code]));
      await appendCustodyEvent(asDb(tx), {
        orgId: actor.orgId,
        type: "transformation",
        bizStep: "transforming",
        eventTime: now,
        payload: {
          inputs: input.inputs.map((i) => ({ ref: codeOf.get(i.wasteBatchId)!, kg: kgText(i.kg) })),
          outputs: [{ ref: code, kg: kgText(input.outputKg!) }, ...(lot ? [{ ref: lot.code, kg: kgText(input.outputKg!) }] : [])],
          evidenceIds: [],
          note: [`Bağlayıcı: ${input.binder} (reçete seçilmedi)`, input.balanceNote?.trim()].filter(Boolean).join("; "),
        },
      });
      return { id: prod.id, code, lotId: lot?.id ?? null };
    }),
  );
}

// ---- Okuma ----

export type BatchRow = StockRow & { counterpartyName: string | null };
export type ProductionRow = {
  production: TenantRow<"productionBatches">;
  inputKg: Decimal;
  massBalance: MassBalance;
  lots: TenantRow<"panelLots">[];
};
export type TraceOverview = {
  receivable: Receivable[];
  received: BatchRow[];
  /** Sağlayıcı olarak teslim ettiği partiler: alıcının tartımını ve doğrulamasını görür (D-013). */
  supplied: BatchRow[];
  productions: ProductionRow[];
  chain: ChainVerdict;
};

export async function traceOverview(db: Db, orgId: string): Promise<TraceOverview> {
  const tenant = withTenant(db, orgId);
  const [receivable, own, supplied, productions, lots, inputs, orgs, events] = await Promise.all([
    receivableDeliveries(db, orgId),
    stock(db, orgId),
    tenant.list("wasteBatches", { where: eq(wasteBatches.supplierOrgId, orgId), orderBy: [desc(wasteBatches.receivedAt)] }),
    tenant.list("productionBatches", { orderBy: [desc(productionBatches.startedAt)] }),
    tenant.list("panelLots", { where: eq(panelLots.orgId, orgId), orderBy: [asc(panelLots.code)] }),
    tenant.list("batchInputs"),
    tenant.list("organizations"),
    listCustodyEvents(db, orgId),
  ]);
  const names = new Map(orgs.map((o) => [o.id, o.name]));
  return {
    receivable,
    received: own.reverse().map((r) => ({ ...r, counterpartyName: names.get(r.batch.supplierOrgId) ?? null })),
    supplied: supplied
      .filter((b) => b.orgId !== orgId)
      .map((batch) => ({ batch, accepted: acceptedKg(batch.weighedKg, batch.rejectedKg), remaining: null, counterpartyName: names.get(batch.orgId) ?? null })),
    productions: productions.map((production) => {
      const ins = inputs.filter((i) => i.productionBatchId === production.id).map((i) => i.allocatedKg);
      return {
        production,
        inputKg: ins.reduce<Decimal>((a, v) => a.plus(v), new Decimal(0)),
        massBalance: massBalance({ inputsKg: ins, outputKg: production.outputKg, scrapKg: production.scrapKg, moistureLossKg: production.moistureLossKg }),
        lots: lots.filter((l) => l.productionBatchId === production.id),
      };
    }),
    chain: verifyChain(events),
  };
}

export type WasteBatchDetail = BatchRow & {
  own: boolean;
  supplierName: string | null;
  receiverName: string | null;
  gap: Decimal | null;
  evidence: Evidence[];
  allocations: { productionId: string; code: string; kg: string }[];
  timeline: ChainedEvent[];
};

export async function wasteBatchDetail(db: Db, orgId: string, id: string): Promise<WasteBatchDetail | null> {
  const tenant = withTenant(db, orgId);
  const batch = await tenant.get("wasteBatches", id);
  if (!batch) return null;
  const own = batch.orgId === orgId;
  const [orgs, links, events, rows] = await Promise.all([
    tenant.list("organizations"),
    tenant.list("evidenceLinks", { where: and(eq(evidenceLinks.entityType, "waste_batch"), eq(evidenceLinks.entityId, id)) }),
    listCustodyEvents(db, orgId),
    own ? stock(db, orgId) : Promise.resolve([]),
  ]);
  const evidence = links.length
    ? await tenant.list("evidenceRegister", {
        where: inArray(
          evidenceRegister.id,
          links.map((l) => l.evidenceId),
        ),
        orderBy: [asc(evidenceRegister.createdAt)],
      })
    : [];
  const allocations = own
    ? await db
        .select({ productionId: productionBatches.id, code: productionBatches.code, kg: batchInputs.allocatedKg })
        .from(batchInputs)
        .innerJoin(productionBatches, eq(productionBatches.id, batchInputs.productionBatchId))
        .where(and(eq(batchInputs.wasteBatchId, id), eq(productionBatches.orgId, orgId)))
        .orderBy(asc(productionBatches.startedAt))
    : [];
  const names = new Map(orgs.map((o) => [o.id, o.name]));
  const accepted = acceptedKg(batch.weighedKg, batch.rejectedKg);
  return {
    batch,
    own,
    accepted,
    remaining: own ? (rows.find((r) => r.batch.id === id)?.remaining ?? null) : null,
    counterpartyName: names.get(own ? batch.supplierOrgId : batch.orgId) ?? null,
    supplierName: names.get(batch.supplierOrgId) ?? null,
    receiverName: names.get(batch.orgId) ?? null,
    gap: declaredGap(batch.declaredKg, batch.weighedKg),
    evidence,
    allocations,
    timeline: events.filter((e) =>
      touches(
        e,
        new Set([batch.code]),
        new Set(evidence.map((x) => x.id)),
      ),
    ),
  };
}

export type LotView = {
  genealogy: Genealogy;
  lot: TenantRow<"panelLots">;
  production: TenantRow<"productionBatches">;
  wastes: (WasteBatch & { supplierName: string | null })[];
  supplierNames: Map<string, string | null>;
  timeline: ChainedEvent[];
  chain: ChainVerdict;
};

/** Lottan geriye: üretim partisi, tahsis edilen atık partileri ve sağlayıcılar. Yalnızca lotun sahibi için. */
export async function lotGenealogy(db: Db, orgId: string, lotId: string): Promise<LotView | null> {
  const tenant = withTenant(db, orgId);
  const lot = await tenant.get("panelLots", lotId);
  if (!lot || lot.orgId !== orgId) return null;
  const production = await tenant.get("productionBatches", lot.productionBatchId);
  if (!production) return null;
  const [siblings, allocations, orgs, events] = await Promise.all([
    tenant.list("panelLots", { where: eq(panelLots.productionBatchId, production.id) }),
    tenant.list("batchInputs", { where: eq(batchInputs.productionBatchId, production.id) }),
    tenant.list("organizations"),
    listCustodyEvents(db, orgId),
  ]);
  const wastes = allocations.length
    ? await tenant.list("wasteBatches", {
        where: inArray(
          wasteBatches.id,
          allocations.map((a) => a.wasteBatchId),
        ),
        orderBy: [asc(wasteBatches.receivedAt)],
      })
    : [];
  const names = new Map(orgs.map((o) => [o.id, o.name]));
  const g = genealogy(lot.id, {
    lots: siblings.map((l) => ({ id: l.id, code: l.code, productionBatchId: l.productionBatchId, areaM2: l.areaM2, resultClass: l.resultClass })),
    productions: [production],
    allocations,
    wastes: wastes.map((w) => ({ id: w.id, code: w.code, supplierOrgId: w.supplierOrgId, composition: w.composition, verified: w.verified, resultClass: w.resultClass })),
  });
  const refs = new Set([lot.code, production.code, ...wastes.map((w) => w.code)]);
  return {
    genealogy: g,
    lot,
    production,
    wastes: wastes.map((w) => ({ ...w, supplierName: names.get(w.supplierOrgId) ?? null })),
    supplierNames: new Map([...(g.bySupplierKg?.keys() ?? [])].map((id) => [id, names.get(id) ?? null])),
    timeline: events.filter((e) => touches(e, refs)),
    chain: verifyChain(events),
  };
}
