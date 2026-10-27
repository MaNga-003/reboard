// Etki ve tedarik paneli deposu (T2.3). Yalnızca okur: kurumun gördüğü kayıtları toplar, hesabı src/domain yapar.
import { eq, inArray } from "drizzle-orm";
import { impactSummary, type Impact } from "../../domain/impact";
import { Decimal } from "../../domain/result";
import { supplyView, type IncomingDelivery, type Supply } from "../../domain/supply";
import type { Db } from "../client";
import { deals, listings, modelInputs, panelLots } from "../schema";
import { withTenant, type TenantRow } from "./tenant";
import { stock } from "./trace";

/** Hammadde ihtiyacı ve eşikler kurumun model girdilerinden gelir (DATA_DICTIONARY §5). */
export const SUPPLY_INPUT_KEYS = { need: "planned_daily_need_kg", green: "days_of_cover_green_min", yellow: "days_of_cover_yellow_min" } as const;
// Hammadde akışı yalnızca atık ilanlarından doğan anlaşmalardır; panel teslimi stoğa girmez.
const WASTE_KINDS: ReadonlySet<string> = new Set(["waste_offer", "waste_request"]);

export type PanelData = {
  impact: Impact | null;
  supply: Supply | null;
  /** Karşı tarafların adı; herkese açık profili olmayan kurum listede yoktur ve ekranda gizli yazar. */
  names: Map<string, string>;
};

/** Kurumun kendi girdisi genel girdinin önüne geçer; aynı düzeyde en yeni dönem kullanılır. */
function latestInput(rows: readonly TenantRow<"modelInputs">[], key: string) {
  return (
    rows
      .filter((r) => r.key === key)
      .sort((a, b) => Number(b.orgId !== null) - Number(a.orgId !== null) || (b.period ?? "").localeCompare(a.period ?? ""))[0] ?? null
  );
}

export async function panelData(db: Db, orgId: string, now = new Date()): Promise<PanelData> {
  const tenant = withTenant(db, orgId);
  const [batches, own, productions, lots, inputs, buying, deliveries, model, orgs] = await Promise.all([
    tenant.list("wasteBatches"),
    stock(db, orgId),
    tenant.list("productionBatches"),
    tenant.list("panelLots", { where: eq(panelLots.orgId, orgId) }),
    tenant.list("batchInputs"),
    tenant.list("deals", { where: eq(deals.buyerOrgId, orgId) }),
    tenant.list("deliveries"),
    tenant.list("modelInputs", { where: inArray(modelInputs.key, Object.values(SUPPLY_INPUT_KEYS)) }),
    tenant.list("organizations"),
  ]);
  const listingIds = [...new Set(buying.map((d) => d.listingId))];
  const wasteListings = listingIds.length
    ? new Set((await tenant.list("listings", { where: inArray(listings.id, listingIds) })).filter((l) => WASTE_KINDS.has(l.kind)).map((l) => l.id))
    : new Set<string>();
  const seller = new Map(buying.filter((d) => wasteListings.has(d.listingId)).map((d) => [d.id, d.sellerOrgId]));

  const withLot = new Set(lots.map((l) => l.productionBatchId));
  const impact = impactSummary(
    batches,
    productions.map((p) => ({ id: p.id, hasLot: withLot.has(p.id), inputs: inputs.filter((i) => i.productionBatchId === p.id), resultClass: p.resultClass })),
    (b) => (b.orgId === orgId ? b.supplierOrgId : b.orgId),
    now,
  );

  const incoming: IncomingDelivery[] = deliveries
    .filter((d) => seller.has(d.dealId))
    .map((d) => ({ ...d, supplierOrgId: seller.get(d.dealId)!, plannedKg: d.plannedKg === null ? null : new Decimal(d.plannedKg) }));
  const need = latestInput(model, SUPPLY_INPUT_KEYS.need);
  const supply = supplyView({
    now,
    stock: own.map((r) => ({ ...r.batch, accepted: r.accepted, remaining: r.remaining })),
    deliveries: incoming,
    dailyNeed: need && { kg: need.value, resultClass: need.resultClass },
    thresholds: { green: latestInput(model, SUPPLY_INPUT_KEYS.green)?.value ?? null, yellow: latestInput(model, SUPPLY_INPUT_KEYS.yellow)?.value ?? null },
  });

  return { impact, supply, names: new Map(orgs.map((o) => [o.id, o.name])) };
}
