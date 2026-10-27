// Pazar yeri kuralları (T2.1): kim satar, kim öder, ilan, teklif ve kabul koşulları, teslim planı, eşleşme skoru.
// Saf: veritabanını bilmez. Repository bu kararları uygular; arayüz yalnızca sonucu gösterir.
import { FIBRES, type Composition } from "./fibre";
import { crowFliesKm, type Point } from "./geo";
import { CalcError, Decimal } from "./result";

export const LISTING_KINDS = ["waste_offer", "waste_request", "panel_offer", "panel_request"] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];
export const RECURRENCES = ["once", "weekly", "monthly"] as const;
export type Recurrence = (typeof RECURRENCES)[number];
export const MARKET_UNITS = ["kg", "t", "m2"] as const;
export type MarketUnit = (typeof MARKET_UNITS)[number];
export type OfferStatus = "open" | "accepted" | "rejected" | "withdrawn";

export const isWaste = (kind: ListingKind) => kind.startsWith("waste_");
/** İlan sahibi teklif ilanında satıcı, talep ilanında alıcıdır. */
export const ownerSells = (kind: ListingKind) => kind.endsWith("_offer");
/** Atık kg ya da ton, panel m² ile ilan edilir. */
export const unitsFor = (kind: ListingKind): readonly MarketUnit[] => (isWaste(kind) ? ["kg", "t"] : ["m2"]);

/** Yeni ilan formunda önerilen tür: kurumun pazardaki doğal rolü. Kullanıcı değiştirebilir. */
export function defaultListingKind(orgKind: string | null): ListingKind {
  if (orgKind === "producer") return "waste_request";
  if (orgKind === "panel_buyer") return "panel_request";
  return "waste_offer";
}

export function dealParties(kind: ListingKind, listingOrgId: string, offerOrgId: string) {
  return ownerSells(kind) ? { sellerOrgId: listingOrgId, buyerOrgId: offerOrgId } : { sellerOrgId: offerOrgId, buyerOrgId: listingOrgId };
}

export type Payer = "buyer" | "seller" | "none";
/** Fiyatın işareti "kim kime öder"i söyler: pozitif → alıcı öder, negatif → sağlayıcı kabul bedeli öder. null: bilinmiyor. */
export function payerOf(unitPrice: Decimal.Value | null): Payer | null {
  if (unitPrice === null) return null;
  const p = new Decimal(unitPrice);
  if (p.isZero()) return "none";
  return p.isPositive() ? "buyer" : "seller";
}

/** Kütleye çevrilebilen birimler; m² panel için kütle bilinmiyor sayılır (yoğunluk ölçülmedi). */
export function quantityKg(quantity: Decimal.Value, unit: string): Decimal | null {
  const q = new Decimal(quantity);
  if (unit === "kg") return q;
  if (unit === "t") return q.times(1000);
  return null;
}

// ---- İlan ----

export type ListingInput = {
  kind: ListingKind;
  quantity: Decimal.Value;
  unit: MarketUnit;
  composition: Composition | null;
  containsSilk: boolean | null;
  windowStart: string | null;
  windowEnd: string | null;
};
export type ListingRuleError = "unit_mismatch" | "quantity_invalid" | "composition_invalid" | "window_invalid" | "panel_fields";

export function listingError(input: ListingInput): ListingRuleError | null {
  if (!unitsFor(input.kind).includes(input.unit)) return "unit_mismatch";
  if (!positive(input.quantity)) return "quantity_invalid";
  if (!isWaste(input.kind) && (input.composition || input.containsSilk)) return "panel_fields";
  if (input.composition && !validComposition(input.composition)) return "composition_invalid";
  if (input.windowStart && input.windowEnd && input.windowStart > input.windowEnd) return "window_invalid";
  return null;
}

function validComposition(c: Composition): boolean {
  const entries = Object.entries(c);
  if (entries.some(([f, v]) => !(FIBRES as readonly string[]).includes(f) || typeof v !== "number" || !(v >= 0 && v <= 100))) return false;
  return entries.reduce((a, [, v]) => a.plus(v!), new Decimal(0)).lte(100);
}

const positive = (v: Decimal.Value) => {
  try {
    const d = new Decimal(v);
    return d.isFinite() && d.gt(0);
  } catch {
    return false;
  }
};

// ---- Teklif ----

export type ListingState = {
  orgId: string;
  kind: ListingKind;
  status: "open" | "closed";
  quantity: Decimal.Value;
  unit: string;
  recurrence: Recurrence;
  windowStart: string | null;
  windowEnd: string | null;
};
export type OfferInput = { quantity: Decimal.Value; unit: string; proposedDate: string };
export type OfferRuleError = "listing_closed" | "own_listing" | "unit_mismatch" | "quantity_invalid" | "quantity_exceeds" | "date_past" | "date_outside_window";

/** today: YYYY-MM-DD (TSİ). Tekrarlı ilanda miktar her teslim içindir; teklif onu aşamaz. */
export function offerError(listing: ListingState, offererOrgId: string, input: OfferInput, today: string): OfferRuleError | null {
  if (listing.status !== "open") return "listing_closed";
  if (listing.orgId === offererOrgId) return "own_listing";
  if (input.unit !== listing.unit) return "unit_mismatch";
  if (!positive(input.quantity)) return "quantity_invalid";
  if (new Decimal(input.quantity).gt(listing.quantity)) return "quantity_exceeds";
  if (input.proposedDate < today) return "date_past";
  if ((listing.windowStart && input.proposedDate < listing.windowStart) || (listing.windowEnd && input.proposedDate > listing.windowEnd)) {
    return "date_outside_window";
  }
  return null;
}

export type OfferState = { orgId: string; status: OfferStatus; quantity: Decimal.Value };
export type RespondRuleError = "not_owner" | "offer_not_open" | "listing_closed" | "quantity_exceeds";

/** Kabul ve reddi yalnızca ilan sahibi yapar; teklif açık, ilan açık olmalı. */
export function respondError(listing: ListingState, offer: OfferState, actorOrgId: string, decision: "accept" | "reject"): RespondRuleError | null {
  if (listing.orgId !== actorOrgId) return "not_owner";
  if (offer.status !== "open") return "offer_not_open";
  if (decision === "reject") return null;
  if (listing.status !== "open") return "listing_closed";
  if (new Decimal(offer.quantity).gt(listing.quantity)) return "quantity_exceeds";
  return null;
}

export function withdrawError(offer: OfferState, actorOrgId: string): "not_owner" | "offer_not_open" | null {
  if (offer.orgId !== actorOrgId) return "not_owner";
  return offer.status === "open" ? null : "offer_not_open";
}

/** Türkiye takvim günü (UTC+3, yaz saati yok): teklif tarihi bu güne göre geçmiş sayılır. */
export const istanbulDay = (now: Date) => new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10);

export const addDays = (day: string, n: number) => new Date(parseDay(day).getTime() + n * DAY_MS).toISOString().slice(0, 10);

/** Önerilen gün kabulden önce geçtiyse plan bugünden başlar; geçmişe teslim planlanmaz. */
export const planStart = (proposed: string | null, today: string) => (proposed && proposed > today ? proposed : today);

/** Tek seferlik ilan kabulle kapanır; tekrarlı ilan başka sağlayıcılara açık kalır. */
export const closesOnAccept = (recurrence: Recurrence) => recurrence === "once";

// ---- Teslim planı ----

export const PLAN_HORIZON_DAYS = 60;
// Planlı teslim saati: 09:00 TSİ (UTC+3, yaz saati yok).
const DELIVERY_HOUR_UTC = 6;
const DAY_MS = 86_400_000;

function parseDay(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new CalcError("invalid_input", `Geçersiz tarih: ${day}`);
  const [y, m, d] = day.split("-").map(Number);
  const out = new Date(Date.UTC(y, m - 1, d, DELIVERY_HOUR_UTC));
  if (out.getUTCMonth() !== m - 1 || out.getUTCDate() !== d) throw new CalcError("invalid_input", `Geçersiz tarih: ${day}`);
  return out;
}

/** Ay ekler; ayın son günü taşarsa o ayın son gününe kırpılır (31 Ocak → 28 Şubat). */
function addMonths(base: Date, n: number): Date {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(base.getUTCDate(), last), DELIVERY_HOUR_UTC));
}

/**
 * Kabulde oluşan teslim takvimi: ilk teslim önerilen tarihte, sonra tekrar sıklığıyla.
 * Bitiş: uygunluk penceresinin sonu ya da 60 günlük planlama ufku, hangisi önce gelirse.
 */
export function deliveryPlan(start: string, recurrence: Recurrence, windowEnd: string | null): Date[] {
  const first = parseDay(start);
  if (recurrence === "once") return [first];
  const horizon = first.getTime() + PLAN_HORIZON_DAYS * DAY_MS;
  const end = windowEnd ? Math.min(parseDay(windowEnd).getTime(), horizon) : horizon;
  const out: Date[] = [];
  for (let k = 0; ; k++) {
    const at = recurrence === "weekly" ? new Date(first.getTime() + 7 * k * DAY_MS) : addMonths(first, k);
    if (at.getTime() > end) break;
    out.push(at);
  }
  return out;
}

// ---- Eşleşme skoru ----

// DATA_DICTIONARY §5: 0–100; bileşim, miktar, kuş uçuşu mesafe ve güvenilirlik ağırlıklı toplamı. İpek dışlar.
export const MATCH_WEIGHTS = { composition: 40, quantity: 20, distance: 20, reliability: 20 } as const;
export type MatchPart = keyof typeof MATCH_WEIGHTS;
/** Bu mesafede ve ötesinde mesafe puanı 0 (Antalya OSB çevresi için seçildi; kalibre edilmedi). */
export const MATCH_MAX_KM = 100;

export type MatchSide = {
  kind: ListingKind;
  composition: Composition | null;
  containsSilk: boolean | null;
  quantity: Decimal.Value;
  unit: string;
  point: Point | null;
};
export type Match = {
  /** null: hiçbir bileşen bilinmiyor. Bilinmeyen bileşen 0 sayılmaz; ağırlığı skordan düşülür. */
  score: number | null;
  excluded: "silk" | null;
  parts: Record<MatchPart, number | null>;
  /** Skora giren bileşenlerin toplam ağırlığı (0–100). */
  knownWeight: number;
  distanceKm: Decimal | null;
};

/** Talebin belirttiği liflerin ne kadarının arzda bulunduğu; "unknown" pay eşleşme sayılmaz. */
export function compositionFit(supply: Composition, demand: Composition): Decimal | null {
  const known = FIBRES.filter((f) => f !== "unknown");
  const wanted = known.reduce((a, f) => a.plus(demand[f] ?? 0), new Decimal(0));
  if (wanted.isZero()) return null;
  const covered = known.reduce((a, f) => a.plus(Decimal.min(supply[f] ?? 0, demand[f] ?? 0)), new Decimal(0));
  return covered.div(wanted);
}

export function matchScore(supply: MatchSide, demand: MatchSide, reliability: Decimal | null): Match {
  if (!ownerSells(supply.kind) || ownerSells(demand.kind) || isWaste(supply.kind) !== isWaste(demand.kind)) {
    throw new CalcError("invalid_input", `Eşleşme yalnızca teklif ile aynı malzemenin talebi arasında: ${supply.kind} ~ ${demand.kind}`);
  }
  const distanceKm = supply.point && demand.point ? crowFliesKm(supply.point, demand.point) : null;
  const empty = { composition: null, quantity: null, distance: null, reliability: null };
  if (isWaste(supply.kind) && supply.containsSilk === true) return { score: 0, excluded: "silk", parts: empty, knownWeight: 0, distanceKm };

  const sKg = quantityKg(supply.quantity, supply.unit);
  const dKg = quantityKg(demand.quantity, demand.unit);
  const [sq, dq] = sKg && dKg ? [sKg, dKg] : supply.unit === demand.unit ? [new Decimal(supply.quantity), new Decimal(demand.quantity)] : [null, null];

  const parts: Record<MatchPart, Decimal | null> = {
    composition: supply.composition && demand.composition ? compositionFit(supply.composition, demand.composition) : null,
    quantity: sq && dq && dq.gt(0) ? Decimal.min(1, sq.div(dq)) : null,
    distance: distanceKm ? Decimal.max(0, new Decimal(1).minus(distanceKm.div(MATCH_MAX_KM))) : null,
    reliability: reliability,
  };
  const keys = Object.keys(MATCH_WEIGHTS) as MatchPart[];
  const known = keys.filter((k) => parts[k] !== null);
  const knownWeight = known.reduce((a, k) => a + MATCH_WEIGHTS[k], 0);
  const sum = known.reduce((a, k) => a.plus(parts[k]!.times(MATCH_WEIGHTS[k])), new Decimal(0));
  return {
    score: knownWeight === 0 ? null : sum.div(knownWeight).times(100).round().toNumber(),
    excluded: null,
    parts: Object.fromEntries(keys.map((k) => [k, parts[k]?.toDecimalPlaces(2).toNumber() ?? null])) as Record<MatchPart, number | null>,
    knownWeight,
    distanceKm,
  };
}
