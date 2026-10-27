// Kiracı katmanı (D-016): kurum verisi yalnızca buradan okunur. Her tablo için "bu kurum hangi satırları görür"
// kuralı tek yerde durur; sorgu bu kuralı her zaman ekler, çağıran onu ezemez.
import { and, eq, getTableColumns, inArray, isNull, or, sql, type InferSelectModel, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Db } from "../client";
import {
  batchInputs,
  buyerTrials,
  calcRuns,
  costLines,
  custodyEvents,
  deals,
  deliveries,
  evidenceLinks,
  evidenceRegister,
  listings,
  modelInputs,
  offers,
  organization,
  orgProfiles,
  panelLots,
  productionBatches,
  referenceValues,
  saasCosts,
  supplierBaseline,
  transactions,
  transportQuotes,
  wasteBatches,
} from "../schema";

export const TENANT_TABLES = {
  organizations: organization,
  orgProfiles,
  listings,
  offers,
  deals,
  deliveries,
  wasteBatches,
  productionBatches,
  batchInputs,
  panelLots,
  custodyEvents,
  evidenceRegister,
  evidenceLinks,
  supplierBaseline,
  transportQuotes,
  costLines,
  buyerTrials,
  transactions,
  saasCosts,
  modelInputs,
  calcRuns,
  referenceValues,
} as const;

/** Kimlik tabloları kiracı katmanından hiç okunmaz; yalnızca Better Auth ve membership deposu kullanır. */
export const AUTH_INTERNAL_TABLES = ["user", "session", "account", "verification", "member", "invitation"] as const;

export type TenantTable = keyof typeof TENANT_TABLES;

// Dosya içeriği listelerde taşınmaz; indirme ayrı ve sahiplik denetimli olacak (T2.2).
const OMIT: Partial<Record<TenantTable, readonly string[]>> = { evidenceRegister: ["content"] };

export type TenantRow<K extends TenantTable> = K extends "evidenceRegister"
  ? Omit<InferSelectModel<typeof evidenceRegister>, "content">
  : InferSelectModel<(typeof TENANT_TABLES)[K]>;

const ALL = sql`true`;

/** org kurumunun görebildiği satırlar. Paylaşılanlar dışında her şey yalnızca sahibine açıktır. */
function visibility(db: Db, org: string): Record<TenantTable, SQL> {
  const ownListings = db.select({ id: listings.id }).from(listings).where(eq(listings.orgId, org));
  const ownDeals = db
    .select({ id: deals.id })
    .from(deals)
    .where(or(eq(deals.sellerOrgId, org), eq(deals.buyerOrgId, org)));
  const dealListings = db
    .select({ id: deals.listingId })
    .from(deals)
    .where(or(eq(deals.sellerOrgId, org), eq(deals.buyerOrgId, org)));
  const ownProduction = db.select({ id: productionBatches.id }).from(productionBatches).where(eq(productionBatches.orgId, org));
  const ownEvidence = db.select({ id: evidenceRegister.id }).from(evidenceRegister).where(eq(evidenceRegister.orgId, org));
  const publicOrgs = db.select({ id: orgProfiles.orgId }).from(orgProfiles).where(eq(orgProfiles.isPublic, true));
  return {
    // Pazar yeri: herkese açık kurum profilleri ve açık ilanlar. Anlaşmanın tarafı, ilan kapansa da
    // anlaştığı ilanı görür: tek seferlik ilan kabulde kapanır, alıcı teslim alırken başlığı ve bileşimi okur.
    organizations: or(eq(organization.id, org), inArray(organization.id, publicOrgs))!,
    orgProfiles: or(eq(orgProfiles.orgId, org), eq(orgProfiles.isPublic, true))!,
    listings: or(eq(listings.orgId, org), eq(listings.status, "open"), inArray(listings.id, dealListings))!,
    // Teklifi veren ve ilan sahibi görür.
    offers: or(eq(offers.orgId, org), inArray(offers.listingId, ownListings))!,
    deals: or(eq(deals.sellerOrgId, org), eq(deals.buyerOrgId, org))!,
    deliveries: inArray(deliveries.dealId, ownDeals),
    // Sağlayıcı, teslim ettiği partinin tartım sonucunu görür: doğrulanan kg'ın iki tarafı da aynı sayıyı izler.
    wasteBatches: or(eq(wasteBatches.orgId, org), eq(wasteBatches.supplierOrgId, org))!,
    productionBatches: eq(productionBatches.orgId, org),
    batchInputs: inArray(batchInputs.productionBatchId, ownProduction),
    // Herkese açık lotlar ürün pasaportunda zaten açık (T2.4).
    panelLots: or(eq(panelLots.orgId, org), eq(panelLots.isPublic, true))!,
    custodyEvents: eq(custodyEvents.orgId, org),
    evidenceRegister: eq(evidenceRegister.orgId, org),
    evidenceLinks: inArray(evidenceLinks.evidenceId, ownEvidence),
    supplierBaseline: eq(supplierBaseline.orgId, org),
    transportQuotes: eq(transportQuotes.orgId, org),
    costLines: eq(costLines.orgId, org),
    buyerTrials: eq(buyerTrials.orgId, org),
    transactions: eq(transactions.orgId, org),
    // Kurumdan bağımsız kaynaklı değerler herkese açık.
    saasCosts: ALL,
    referenceValues: ALL,
    modelInputs: or(isNull(modelInputs.orgId), eq(modelInputs.orgId, org))!,
    calcRuns: or(isNull(calcRuns.orgId), eq(calcRuns.orgId, org))!,
  };
}

// Tek satır anahtarı. Bileşik anahtarlı tablolar (batchInputs, evidenceLinks) yalnızca list ile okunur.
const KEY = {
  organizations: organization.id,
  orgProfiles: orgProfiles.orgId,
  listings: listings.id,
  offers: offers.id,
  deals: deals.id,
  deliveries: deliveries.id,
  wasteBatches: wasteBatches.id,
  productionBatches: productionBatches.id,
  panelLots: panelLots.id,
  custodyEvents: custodyEvents.id,
  evidenceRegister: evidenceRegister.id,
  supplierBaseline: supplierBaseline.id,
  transportQuotes: transportQuotes.id,
  costLines: costLines.id,
  buyerTrials: buyerTrials.id,
  transactions: transactions.id,
  saasCosts: saasCosts.id,
  modelInputs: modelInputs.id,
  calcRuns: calcRuns.id,
  referenceValues: referenceValues.key,
} as const satisfies Partial<Record<TenantTable, PgColumn>>;
export type KeyedTable = keyof typeof KEY;

// Yazma hakkı görmekten dardır: açık bir ilanı herkes görür, yalnızca sahibi değiştirir.
// Anlaşma ve teslimin iki tarafı var; onların yazma kuralı pazar yeriyle birlikte gelir (T2.1).
const OWNER = {
  organizations: organization.id,
  orgProfiles: orgProfiles.orgId,
  listings: listings.orgId,
  offers: offers.orgId,
  wasteBatches: wasteBatches.orgId,
  productionBatches: productionBatches.orgId,
  panelLots: panelLots.orgId,
  custodyEvents: custodyEvents.orgId,
  evidenceRegister: evidenceRegister.orgId,
  supplierBaseline: supplierBaseline.orgId,
  transportQuotes: transportQuotes.orgId,
  costLines: costLines.orgId,
  buyerTrials: buyerTrials.orgId,
  transactions: transactions.orgId,
  modelInputs: modelInputs.orgId,
  calcRuns: calcRuns.orgId,
} as const satisfies Partial<Record<KeyedTable, PgColumn>>;
export type OwnedTable = keyof typeof OWNER;

export class TenantAccessError extends Error {
  constructor(readonly table: string, readonly id: string) {
    super(`Erişim yok: ${table}/${id}`);
    this.name = "TenantAccessError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Geçersiz biçimli kimlik veritabanı hatası yerine "yok" sayılır.
const validKey = (col: PgColumn, id: string) => col.columnType !== "PgUUID" || UUID.test(id);

function columnsOf(name: TenantTable): Record<string, PgColumn> {
  const omit = OMIT[name] ?? [];
  const cols = getTableColumns(TENANT_TABLES[name] as PgTable) as Record<string, PgColumn>;
  return Object.fromEntries(Object.entries(cols).filter(([k]) => !omit.includes(k)));
}

export type ListOptions = { where?: SQL; orderBy?: (PgColumn | SQL)[]; limit?: number };

export function withTenant(db: Db, orgId: string) {
  if (!orgId) throw new Error("withTenant: orgId boş");
  const vis = visibility(db, orgId);

  async function list<K extends TenantTable>(name: K, opts: ListOptions = {}): Promise<TenantRow<K>[]> {
    let q = db
      .select(columnsOf(name))
      .from(TENANT_TABLES[name] as PgTable)
      .where(and(vis[name], opts.where))
      .$dynamic();
    if (opts.orderBy?.length) q = q.orderBy(...opts.orderBy);
    if (opts.limit) q = q.limit(opts.limit);
    return (await q) as TenantRow<K>[];
  }

  async function get<K extends KeyedTable>(name: K, id: string): Promise<TenantRow<K> | null> {
    if (!validKey(KEY[name], id)) return null;
    const [row] = await list(name, { where: eq(KEY[name], id), limit: 1 });
    return row ?? null;
  }

  async function owns(name: OwnedTable, id: string): Promise<boolean> {
    if (!validKey(KEY[name], id)) return false;
    const [row] = await db
      .select({ k: KEY[name] })
      .from(TENANT_TABLES[name] as PgTable)
      .where(and(eq(KEY[name], id), eq(OWNER[name], orgId)))
      .limit(1);
    return !!row;
  }

  return {
    orgId,
    list,
    get,
    owns,
    /** Yazmadan önce: satır bu kurumun değilse (ya da yoksa) aynı hatayı verir; varlığı sızdırılmaz. */
    async assertOwns(name: OwnedTable, id: string): Promise<void> {
      if (!(await owns(name, id))) throw new TenantAccessError(name, id);
    },
    /** Özel sorgularda (birleştirme, toplama) aynı görünürlük kuralını kullanmak için. */
    visible: (name: TenantTable): SQL => vis[name],
  };
}

export type Tenant = ReturnType<typeof withTenant>;
