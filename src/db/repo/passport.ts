// Ürün pasaportu deposu (T2.4, D-025). Pasaport girişsiz açılır: herkese açık lot, sahibinin gözüyle okunur ve
// yalnızca alan katmanının seçtiği alanlar dışarı çıkar. Not, kanıt, fiyat, alıcının adı ve gizli profilli kurumun adı çıkmaz.
import { and, eq, or, sql } from "drizzle-orm";
import type { Decimal, ResultClass } from "../../domain/result";
import {
  byRole,
  chainRole,
  fibreRows,
  isLotCode,
  lotAnchor,
  passportOk,
  publicEvent,
  publicVerdict,
  touches,
  verifyChain,
  type ChainAnchor,
  type ChainRole,
  type FibreRow,
  type MassBalance,
  type PublicEvent,
  type PublicVerdict,
} from "../../domain/traceability";
import type { Db } from "../client";
import { custodyEvents, orgProfiles, panelLots } from "../schema";
import { listCustodyEvents } from "./custody";
import { withTenant, type TenantRow } from "./tenant";
import { lotGraph } from "./trace";

export type PassportChain = { role: ChainRole; name: string | null; verdict: PublicVerdict };
export type PassportEvent = PublicEvent & { role: ChainRole; name: string | null };

export type PassportView = {
  lot: Pick<TenantRow<"panelLots">, "code" | "areaM2" | "sheetCount" | "thicknessMm" | "densityKgM3" | "testStatus" | "resultClass">;
  production: { code: string; startedAt: Date };
  producerName: string | null;
  textileKg: Decimal | null;
  verifiedTextileKg: Decimal | null;
  fibres: FibreRow[] | null;
  suppliers: { name: string | null; kg: Decimal }[] | null;
  sources: { code: string; supplierName: string | null; lotKg: Decimal | null; verified: boolean }[];
  massBalance: MassBalance;
  resultClass: ResultClass;
  timeline: PassportEvent[];
  /** Üretici önce, sonra sağlayıcılar, sonra alıcılar. */
  chains: PassportChain[];
  ok: boolean;
  /** Lotun etiket çapası, bugünkü zincirden; QR adresine yazılır. */
  anchor: ChainAnchor | null;
  /** İstekle gelen etiket çapası üretici zincirinde denetlendi mi; sonucu üretici zincirinin hükmündedir. */
  anchorChecked: boolean;
};

/** Olay girdisinde ya da çıktısında bu kodlardan biri geçen zincirler. jsonb içerme sorgusu; yalnızca kurum kimliği okunur. */
async function chainsTouching(db: Db, refs: Iterable<string>): Promise<string[]> {
  const conds = [...refs].flatMap((ref) => {
    const q = JSON.stringify([{ ref }]);
    return [sql`${custodyEvents.payload}->'inputs' @> ${q}::jsonb`, sql`${custodyEvents.payload}->'outputs' @> ${q}::jsonb`];
  });
  if (!conds.length) return [];
  const rows = await db.selectDistinct({ orgId: custodyEvents.orgId }).from(custodyEvents).where(or(...conds));
  return rows.map((r) => r.orgId);
}

/**
 * Herkese açık lotun pasaportu; lot yoksa ya da açık değilse null. Soy ağacına dokunan her zincir baştan doğrulanır
 * (verifyChain); etiket çapası verildiyse üretici zinciri ona göre de denetlenir.
 */
export async function publicPassport(db: Db, code: string, label: ChainAnchor | null = null): Promise<PassportView | null> {
  if (!isLotCode(code)) return null;
  // Açık lot herkesin görünürlüğündedir (tenant.ts panelLots kuralı); sahibini bulmak için kimlik gerekmez.
  const [lot] = await db
    .select()
    .from(panelLots)
    .where(and(eq(panelLots.code, code), eq(panelLots.isPublic, true)))
    .limit(1);
  if (!lot) return null;
  const graph = await lotGraph(db, lot);
  if (!graph) return null;
  const { genealogy: g, production, wastes, refs } = graph;

  const publicOrgs = new Set(
    (await withTenant(db, lot.orgId).list("orgProfiles", { where: eq(orgProfiles.isPublic, true) })).map((p) => p.orgId),
  );
  const names = new Map(graph.orgs.filter((o) => publicOrgs.has(o.id)).map((o) => [o.id, o.name]));
  const suppliers = new Set(wastes.map((w) => w.supplierOrgId));
  // Alıcının adı yazılmaz: kimin aldığı ticari bilgidir; pasaport kökeni anlatır.
  const nameOf = (orgId: string, role: ChainRole) => (role === "buyer" ? null : (names.get(orgId) ?? null));

  const orgIds = [...new Set([lot.orgId, ...(await chainsTouching(db, refs))])];
  const chains = await Promise.all(
    orgIds.map(async (orgId) => {
      const role = chainRole(orgId, lot.orgId, suppliers);
      const events = await listCustodyEvents(db, orgId);
      const verdict = verifyChain(events, role === "producer" ? (label ?? undefined) : undefined);
      return { orgId, role, name: nameOf(orgId, role), events, verdict };
    }),
  );
  chains.sort(byRole);
  const producer = chains[0];

  const timeline = chains
    .flatMap((c) => c.events.filter((e) => touches(e, refs)).map((e) => ({ ...publicEvent(e, refs, c.name !== null), role: c.role, name: c.name })))
    .sort((a, b) => a.eventTime.localeCompare(b.eventTime) || byRole(a, b) || (a.seq ?? 0) - (b.seq ?? 0));

  return {
    lot: {
      code: lot.code,
      areaM2: lot.areaM2,
      sheetCount: lot.sheetCount,
      thicknessMm: lot.thicknessMm,
      densityKgM3: lot.densityKgM3,
      testStatus: lot.testStatus,
      resultClass: lot.resultClass,
    },
    production: { code: production.code, startedAt: production.startedAt },
    producerName: producer.name,
    textileKg: g.textileKg,
    verifiedTextileKg: g.verifiedTextileKg,
    fibres: fibreRows(g.fibreKg),
    suppliers: g.bySupplierKg && [...g.bySupplierKg].map(([orgId, kg]) => ({ name: names.get(orgId) ?? null, kg })),
    sources: g.sources.map((s) => ({ code: s.waste.code, supplierName: names.get(s.waste.supplierOrgId) ?? null, lotKg: s.lotKg, verified: s.waste.verified })),
    massBalance: g.massBalance,
    resultClass: g.resultClass,
    timeline,
    chains: chains.map(({ role, name, verdict }) => ({ role, name, verdict: publicVerdict(verdict, name !== null) })),
    ok: passportOk(chains),
    anchor: lotAnchor(producer.events, lot.code),
    anchorChecked: label !== null,
  };
}
