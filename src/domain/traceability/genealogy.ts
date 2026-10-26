// Soy ağacı: panel lotundan üretim partisine, oradan atık partilerine ve sağlayıcılara.
// Pasaporttaki "tekstil kg'ı" ve "lif bileşimi" buradan gelir. Bilinmeyen pay "unknown" lifine yazılır.
import { FIBRES, type Composition, type Fibre } from "../fibre";
import { CalcError, Decimal, weakestClass, type ResultClass } from "../result";
import { massBalance, type MassBalance } from "./mass-balance";

export type LotNode = { id: string; code: string; productionBatchId: string; areaM2: Decimal.Value | null; resultClass: ResultClass };
export type ProductionNode = {
  id: string;
  code: string;
  outputKg: Decimal.Value | null;
  scrapKg: Decimal.Value | null;
  moistureLossKg: Decimal.Value | null;
  resultClass: ResultClass;
};
export type AllocationEdge = { productionBatchId: string; wasteBatchId: string; allocatedKg: Decimal.Value };
export type WasteNode = {
  id: string;
  code: string;
  supplierOrgId: string;
  composition: Composition | null;
  /** D-013: tartım ve kanıt varsa doğrulanmış. */
  verified: boolean;
  resultClass: ResultClass;
};
export type TraceGraph = { lots: LotNode[]; productions: ProductionNode[]; allocations: AllocationEdge[]; wastes: WasteNode[] };

export type LotSource = { waste: WasteNode; allocatedKg: Decimal; lotKg: Decimal | null };

export type Genealogy = {
  lot: LotNode;
  production: ProductionNode;
  /** Üretim partisinden bu lota düşen pay: tek lotsa 1, değilse alan oranı; alanlar bilinmiyorsa null. */
  lotShare: Decimal | null;
  sources: LotSource[];
  textileKg: Decimal | null;
  /** Doğrulanmış (tartımlı ve kanıtlı) atık partilerinden gelen kg. */
  verifiedTextileKg: Decimal | null;
  fibreKg: Record<Fibre, Decimal> | null;
  bySupplierKg: Map<string, Decimal> | null;
  massBalance: MassBalance;
  resultClass: ResultClass;
};

function byId<T extends { id: string }>(xs: readonly T[], id: string, what: string): T {
  const x = xs.find((n) => n.id === id);
  if (!x) throw new CalcError("invalid_input", `${what} bulunamadı: ${id}`);
  return x;
}

/** Bileşimi kg'a dağıtır. Yüzdeler toplamı 100'ü aşamaz; eksik kalan pay "unknown"dur. */
export function splitByComposition(kg: Decimal, composition: Composition | null): Record<Fibre, Decimal> {
  const out = Object.fromEntries(FIBRES.map((f) => [f, new Decimal(0)])) as Record<Fibre, Decimal>;
  let pct = new Decimal(0);
  for (const f of FIBRES) {
    const p = composition?.[f];
    if (p === undefined) continue;
    if (p < 0) throw new CalcError("invalid_input", `Negatif lif payı: ${f}`);
    pct = pct.plus(p);
    out[f] = out[f].plus(kg.times(p).div(100));
  }
  if (pct.gt(100)) throw new CalcError("invalid_input", `Bileşim toplamı %100'ü aşıyor: ${pct}`);
  out.unknown = out.unknown.plus(kg.times(new Decimal(100).minus(pct)).div(100));
  return out;
}

export function genealogy(lotId: string, g: TraceGraph): Genealogy {
  const lot = byId(g.lots, lotId, "Lot");
  const production = byId(g.productions, lot.productionBatchId, "Üretim partisi");
  const siblings = g.lots.filter((l) => l.productionBatchId === production.id);

  let lotShare: Decimal | null = null;
  if (siblings.length === 1) lotShare = new Decimal(1);
  else if (siblings.every((s) => s.areaM2 !== null)) {
    const total = siblings.reduce((a, s) => a.plus(s.areaM2!), new Decimal(0));
    lotShare = total.isZero() ? null : new Decimal(lot.areaM2!).div(total);
  }

  const edges = g.allocations.filter((a) => a.productionBatchId === production.id);
  const sources: LotSource[] = edges.map((e) => {
    const allocatedKg = new Decimal(e.allocatedKg);
    return { waste: byId(g.wastes, e.wasteBatchId, "Atık partisi"), allocatedKg, lotKg: lotShare === null ? null : allocatedKg.times(lotShare) };
  });

  const known = lotShare !== null;
  const sum = (xs: LotSource[]) => xs.reduce((a, s) => a.plus(s.lotKg!), new Decimal(0));
  const fibreKg = known
    ? sources.reduce(
        (acc, s) => {
          const part = splitByComposition(s.lotKg!, s.waste.composition);
          for (const f of FIBRES) acc[f] = acc[f].plus(part[f]);
          return acc;
        },
        splitByComposition(new Decimal(0), null),
      )
    : null;
  const bySupplierKg = known
    ? sources.reduce((m, s) => m.set(s.waste.supplierOrgId, (m.get(s.waste.supplierOrgId) ?? new Decimal(0)).plus(s.lotKg!)), new Map<string, Decimal>())
    : null;

  return {
    lot,
    production,
    lotShare,
    sources,
    textileKg: known ? sum(sources) : null,
    verifiedTextileKg: known ? sum(sources.filter((s) => s.waste.verified)) : null,
    fibreKg,
    bySupplierKg,
    massBalance: massBalance({
      inputsKg: sources.map((s) => s.allocatedKg),
      outputKg: production.outputKg,
      scrapKg: production.scrapKg,
      moistureLossKg: production.moistureLossKg,
    }),
    resultClass: weakestClass([lot.resultClass, production.resultClass, ...sources.map((s) => s.waste.resultClass)]),
  };
}
