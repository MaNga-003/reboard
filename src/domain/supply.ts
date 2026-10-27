// Tedarik sürekliliği göstergeleri (DATA_DICTIONARY §5): güvenilirlik (T2.1), stok, kaç günlük hammadde, projeksiyon, yoğunlaşma ve uyarılar (T2.3).
import { classOf, kgTotal, type KgTotal } from "./impact";
import { Decimal, weakestClass, type ResultClass } from "./result";

export type DeliveryState = { plannedAt: Date; deliveredAt: Date | null; status: "planned" | "delivered" | "cancelled" };

/** Zamanında sayılma payı: planlanandan en çok 1 gün sonra. */
export const ON_TIME_GRACE_MS = 86_400_000;

/**
 * Zamanında teslim oranı. Payda: vadesi gelmiş teslimler (teslim edilen, iptal edilen ya da süresi geçip gelmeyen).
 * İptal ve gecikme zamanında sayılmaz. Vadesi gelmemiş planlar hesaba girmez; hiç vade yoksa oran bilinmiyor (null).
 */
export function onTimeRate(deliveries: readonly DeliveryState[], now: Date): { rate: Decimal | null; due: number; onTime: number } {
  let due = 0;
  let onTime = 0;
  for (const d of deliveries) {
    const deadline = d.plannedAt.getTime() + ON_TIME_GRACE_MS;
    if (d.status === "planned" && deadline >= now.getTime()) continue;
    due++;
    if (d.status === "delivered" && d.deliveredAt && d.deliveredAt.getTime() <= deadline) onTime++;
  }
  return { rate: due === 0 ? null : new Decimal(onTime).div(due), due, onTime };
}

// ---- Stok ve kaç günlük hammadde (T2.3) ----

export type Level = "ok" | "warn" | "danger";

/** PRODUCT §3.3: 14 gün ve üstü yeşil, 7–14 sarı, 7'den az kırmızı. Kurum model girdisiyle değiştirebilir. */
export const COVER_DEFAULTS = { greenDays: 14, yellowDays: 7 } as const;
export const PROJECTION_DAYS = 30;
const DAY_MS = 86_400_000;

export type CoverThresholds = { greenDays: Decimal; yellowDays: Decimal; fromModel: boolean };

/** İki eşik birlikte ve tutarlı gelirse kullanılır; biri eksik ya da sarı yeşili aşıyorsa varsayılan döner. */
export function coverThresholds(green: Decimal.Value | null, yellow: Decimal.Value | null): CoverThresholds {
  if (green !== null && yellow !== null) {
    const g = new Decimal(green);
    const y = new Decimal(yellow);
    if (g.isFinite() && y.isFinite() && !y.isNeg() && y.lte(g)) return { greenDays: g, yellowDays: y, fromModel: true };
  }
  return { greenDays: new Decimal(COVER_DEFAULTS.greenDays), yellowDays: new Decimal(COVER_DEFAULTS.yellowDays), fromModel: false };
}

/** Stok ÷ planlı günlük ihtiyaç. İhtiyaç bilinmiyor ya da sıfırsa gün sayısı da bilinmiyor. */
export function daysOfCover(stockKg: Decimal | null, dailyNeedKg: Decimal | null): Decimal | null {
  if (stockKg === null || dailyNeedKg === null || !dailyNeedKg.gt(0)) return null;
  return stockKg.div(dailyNeedKg);
}

export function coverLevel(days: Decimal | null, t: CoverThresholds): Level | null {
  if (days === null) return null;
  return days.gte(t.greenDays) ? "ok" : days.gte(t.yellowDays) ? "warn" : "danger";
}

export type Arrival = { at: Date; kg: Decimal | null };
export type ProjectionPoint = {
  day: number;
  at: Date;
  stockKg: Decimal;
  days: Decimal;
  level: Level;
  /** O güne düşen planlı teslim sayısı ve bilinen kg'ı (teslim yoksa 0 ve null). */
  arrivals: number;
  arrivalKg: Decimal | null;
};
export type Projection = {
  points: ProjectionPoint[];
  /** Stokun bittiği ilk gün (1 = şu andan 24 saat sonrasına kadar); ufukta bitmiyorsa null. */
  stockoutDay: number | null;
  arrivalsKg: Decimal;
  /** Kg'ı bilinmeyen planlı teslimler projeksiyona girmez; sayısı yazılır. */
  unknownArrivals: number;
};

/**
 * Günlük adımlı stok projeksiyonu: o güne düşen planlı teslimler eklenir, günlük ihtiyaç düşülür, stok 0'ın altına inmez.
 * Planlı kg ayıklamadan önceki kg'dır; projeksiyon bu yüzden iyimserdir ve sınıfı en çok "pilot projeksiyon" olur.
 */
export function projectStock(
  stockKg: Decimal,
  dailyNeedKg: Decimal,
  arrivals: readonly Arrival[],
  now: Date,
  t: CoverThresholds,
  horizon = PROJECTION_DAYS,
): Projection | null {
  if (!dailyNeedKg.gt(0)) return null;
  const byDay = new Map<number, Decimal>();
  const countByDay = new Map<number, number>();
  let arrivalsKg = new Decimal(0);
  let unknownArrivals = 0;
  for (const a of arrivals) {
    // Vadesi bugün dolmuş ama pay süresi bitmemiş teslim ilk güne düşer.
    const day = Math.max(1, Math.ceil((a.at.getTime() - now.getTime()) / DAY_MS));
    if (day > horizon) continue;
    countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
    if (a.kg === null) {
      unknownArrivals++;
      continue;
    }
    byDay.set(day, (byDay.get(day) ?? new Decimal(0)).plus(a.kg));
    arrivalsKg = arrivalsKg.plus(a.kg);
  }
  let stock = stockKg;
  let stockoutDay: number | null = null;
  const points: ProjectionPoint[] = [];
  for (let day = 1; day <= horizon; day++) {
    stock = stock.plus(byDay.get(day) ?? 0).minus(dailyNeedKg);
    if (stock.lte(0)) {
      stock = new Decimal(0);
      stockoutDay ??= day;
    }
    const days = stock.div(dailyNeedKg);
    const arrivals = countByDay.get(day) ?? 0;
    points.push({ day, at: new Date(now.getTime() + day * DAY_MS), stockKg: stock, days, level: coverLevel(days, t)!, arrivals, arrivalKg: byDay.get(day) ?? null });
  }
  return { points, stockoutDay, arrivalsKg, unknownArrivals };
}

// ---- Tedarikçi yoğunlaşması ----

/** ABD DOJ/FTC 2023 birleşme rehberi §2.1: HHI 1.800'ü aşan piyasa "yüksek yoğunlaşmış" sayılır (docs/RESEARCH.md §1). */
export const HHI_HIGH = 1800;
/** Yoğunlaşma güncel tedarik yapısını anlatsın diye son 90 günün kabul edilen kg'ı. */
export const HHI_WINDOW_DAYS = 90;

/** Payların (yüzde) karelerinin toplamı, 0–10.000. Toplam sıfırsa ya da kalem yoksa bilinmiyor. */
export function hhi(amounts: readonly Decimal.Value[]): Decimal | null {
  const total = amounts.reduce<Decimal>((a, v) => a.plus(v), new Decimal(0));
  if (!total.gt(0)) return null;
  return amounts.reduce<Decimal>((a, v) => a.plus(new Decimal(v).div(total).times(100).pow(2)), new Decimal(0));
}

// ---- Panel görünümü ----

export type StockBatchIn = {
  id: string;
  supplierOrgId: string;
  receivedAt: Date;
  verified: boolean;
  declaredKg: Decimal.Value | null;
  weighedKg: Decimal.Value | null;
  accepted: Decimal | null;
  remaining: Decimal | null;
  resultClass: ResultClass;
};
export type IncomingDelivery = DeliveryState & { id: string; supplierOrgId: string; plannedKg: Decimal | null; resultClass: ResultClass };

export type SupplierRow = {
  orgId: string;
  onTime: ReturnType<typeof onTimeRate>;
  /** (Σ tartım − Σ beyan) ÷ Σ beyan; yalnızca ikisi de bilinen partilerden. */
  gap: Decimal | null;
  windowKg: KgTotal;
  share: Decimal | null;
  batches: number;
};

export type SupplyAlert =
  | { kind: "cover"; level: Level; days: Decimal; threshold: Decimal; lowerBound: boolean }
  | { kind: "need_missing"; level: "warn" }
  | { kind: "projected_danger"; level: "warn"; day: number; at: Date }
  | { kind: "stockout"; level: Level; day: number; at: Date }
  | { kind: "overdue"; level: "warn"; deliveryId: string; supplierOrgId: string; plannedAt: Date; kg: Decimal | null }
  | { kind: "pending"; level: "warn"; batches: number; kg: KgTotal }
  | { kind: "stock_unknown"; level: "warn"; batches: number }
  | { kind: "concentration"; level: "warn"; hhi: Decimal; topOrgId: string; topShare: Decimal };

export type Supply = {
  /** Üretime girebilir stok: doğrulanmış partilerin kalanı (D-013). Bilinmeyen kalan varsa alt sınır. */
  usable: KgTotal;
  /** Doğrulama bekleyen partilerin kabul edilen kg'ı; üretime giremez. */
  pending: KgTotal & { batches: number };
  dailyNeedKg: Decimal | null;
  thresholds: CoverThresholds;
  days: Decimal | null;
  level: Level | null;
  projection: Projection | null;
  upcoming: IncomingDelivery[];
  suppliers: SupplierRow[];
  hhi: Decimal | null;
  alerts: SupplyAlert[];
  resultClass: ResultClass;
  projectionClass: ResultClass;
};

export type SupplyInput = {
  now: Date;
  stock: readonly StockBatchIn[];
  deliveries: readonly IncomingDelivery[];
  dailyNeed: { kg: Decimal.Value | null; resultClass: ResultClass } | null;
  thresholds: { green: Decimal.Value | null; yellow: Decimal.Value | null };
};

const LEVEL_ORDER: Record<Level, number> = { danger: 0, warn: 1, ok: 2 };

/** Hammadde teslim alan kurumun tedarik görünümü. Stoku, gelen teslimi ve ihtiyaç girdisi olmayan kurum için null. */
export function supplyView(i: SupplyInput): Supply | null {
  if (i.stock.length === 0 && i.deliveries.length === 0 && i.dailyNeed === null) return null;
  const { now } = i;
  const verified = i.stock.filter((b) => b.verified);
  const unverified = i.stock.filter((b) => !b.verified);
  const usable = kgTotal(verified.map((b) => b.remaining));
  const pending = { ...kgTotal(unverified.map((b) => b.accepted)), batches: unverified.length };
  const need = i.dailyNeed === null || i.dailyNeed.kg === null ? null : new Decimal(i.dailyNeed.kg);
  const thresholds = coverThresholds(i.thresholds.green, i.thresholds.yellow);
  const days = daysOfCover(usable.kg, need);
  const level = coverLevel(days, thresholds);

  const overdue = (d: IncomingDelivery) => d.status === "planned" && d.plannedAt.getTime() + ON_TIME_GRACE_MS < now.getTime();
  const horizonEnd = now.getTime() + PROJECTION_DAYS * DAY_MS;
  const upcoming = i.deliveries
    .filter((d) => d.status === "planned" && !overdue(d) && d.plannedAt.getTime() <= horizonEnd)
    .sort((a, b) => a.plannedAt.getTime() - b.plannedAt.getTime());
  const projection =
    usable.kg === null || need === null
      ? null
      : projectStock(
          usable.kg,
          need,
          upcoming.map((d) => ({ at: d.plannedAt, kg: d.plannedKg })),
          now,
          thresholds,
        );

  const windowStart = now.getTime() - HHI_WINDOW_DAYS * DAY_MS;
  const supplierIds = [...new Set([...i.stock.map((b) => b.supplierOrgId), ...i.deliveries.map((d) => d.supplierOrgId)])];
  const windowTotals = new Map(
    supplierIds.map((id) => [id, kgTotal(i.stock.filter((b) => b.supplierOrgId === id && b.receivedAt.getTime() >= windowStart).map((b) => b.accepted))]),
  );
  const windowKnown = [...windowTotals.values()].map((t) => t.kg ?? new Decimal(0));
  const windowSum = windowKnown.reduce<Decimal>((a, v) => a.plus(v), new Decimal(0));
  const suppliers = supplierIds.map((orgId): SupplierRow => {
    const batches = i.stock.filter((b) => b.supplierOrgId === orgId);
    const both = batches.filter((b) => b.declaredKg !== null && b.weighedKg !== null);
    const declared = both.reduce<Decimal>((a, b) => a.plus(b.declaredKg!), new Decimal(0));
    const weighed = both.reduce<Decimal>((a, b) => a.plus(b.weighedKg!), new Decimal(0));
    const windowKg = windowTotals.get(orgId)!;
    return {
      orgId,
      onTime: onTimeRate(
        i.deliveries.filter((d) => d.supplierOrgId === orgId),
        now,
      ),
      gap: declared.isZero() ? null : weighed.minus(declared).div(declared),
      windowKg,
      share: windowSum.gt(0) && windowKg.kg !== null ? windowKg.kg.div(windowSum) : null,
      batches: batches.length,
    };
  });
  suppliers.sort((a, b) => (b.share ?? new Decimal(-1)).cmp(a.share ?? new Decimal(-1)) || a.orgId.localeCompare(b.orgId));
  const concentration = hhi(windowKnown);

  const alerts: SupplyAlert[] = [];
  if (need === null) alerts.push({ kind: "need_missing", level: "warn" });
  if (days !== null && level !== null && level !== "ok")
    alerts.push({ kind: "cover", level, days, threshold: level === "danger" ? thresholds.yellowDays : thresholds.greenDays, lowerBound: usable.unknown > 0 });
  // Bugün kırmızı değilken projeksiyon kırmızıya iniyorsa sipariş için kalan süre görünsün.
  const firstDanger = level !== "danger" ? projection?.points.find((p) => p.level === "danger") : undefined;
  if (firstDanger) alerts.push({ kind: "projected_danger", level: "warn", day: firstDanger.day, at: firstDanger.at });
  if (projection && projection.stockoutDay !== null) {
    const p = projection.points[projection.stockoutDay - 1];
    alerts.push({ kind: "stockout", level: thresholds.yellowDays.gt(projection.stockoutDay) ? "danger" : "warn", day: projection.stockoutDay, at: p.at });
  }
  for (const d of i.deliveries.filter(overdue).sort((a, b) => a.plannedAt.getTime() - b.plannedAt.getTime()))
    alerts.push({ kind: "overdue", level: "warn", deliveryId: d.id, supplierOrgId: d.supplierOrgId, plannedAt: d.plannedAt, kg: d.plannedKg });
  if (pending.batches > 0) alerts.push({ kind: "pending", level: "warn", batches: pending.batches, kg: pending });
  if (usable.unknown > 0) alerts.push({ kind: "stock_unknown", level: "warn", batches: usable.unknown });
  const top = suppliers[0];
  if (concentration !== null && concentration.gt(HHI_HIGH) && top?.share)
    alerts.push({ kind: "concentration", level: "warn", hhi: concentration, topOrgId: top.orgId, topShare: top.share });
  // Kararlı sıralama: önce düzey, sonra eklenme sırası.
  alerts.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);

  const resultClass = classOf([...i.stock, ...i.deliveries, ...(i.dailyNeed ? [i.dailyNeed] : [])])!;
  return {
    usable,
    pending,
    dailyNeedKg: need,
    thresholds,
    days,
    level,
    projection,
    upcoming,
    suppliers,
    hhi: concentration,
    alerts,
    resultClass,
    // Projeksiyon ne kadar sağlam veriden gelirse gelsin gerçekleşmiş sayılmaz.
    projectionClass: weakestClass([resultClass, "pilot_projection"]),
  };
}
