import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  LISTING_KINDS,
  MATCH_WEIGHTS,
  PLAN_HORIZON_DAYS,
  addDays,
  closesOnAccept,
  compositionFit,
  dealParties,
  defaultListingKind,
  deliveryPlan,
  istanbulDay,
  listingError,
  matchScore,
  offerError,
  payerOf,
  planStart,
  quantityKg,
  respondError,
  withdrawError,
  type ListingState,
  type MatchSide,
} from "@/domain/market";
import { CalcError, Decimal } from "@/domain/result";

const DAY = 86_400_000;
const listing = (o: Partial<ListingState> = {}): ListingState => ({
  orgId: "A",
  kind: "waste_offer",
  status: "open",
  quantity: "500",
  unit: "kg",
  recurrence: "weekly",
  windowStart: "2026-10-01",
  windowEnd: "2026-12-31",
  ...o,
});

describe("taraflar ve ödeme yönü", () => {
  it("teklif ilanında sahip satar, talep ilanında alır", () => {
    expect(dealParties("waste_offer", "A", "B")).toEqual({ sellerOrgId: "A", buyerOrgId: "B" });
    expect(dealParties("panel_offer", "A", "B")).toEqual({ sellerOrgId: "A", buyerOrgId: "B" });
    expect(dealParties("waste_request", "A", "B")).toEqual({ sellerOrgId: "B", buyerOrgId: "A" });
    expect(dealParties("panel_request", "A", "B")).toEqual({ sellerOrgId: "B", buyerOrgId: "A" });
  });

  it("yeni ilanda önerilen tür kurumun rolünden gelir", () => {
    expect(defaultListingKind("producer")).toBe("waste_request");
    expect(defaultListingKind("panel_buyer")).toBe("panel_request");
    expect(defaultListingKind("textile_factory")).toBe("waste_offer");
    expect(defaultListingKind(null)).toBe("waste_offer");
  });

  it("fiyatın işareti kimin ödediğini söyler; bilinmeyen fiyat null kalır", () => {
    expect(payerOf("250")).toBe("buyer");
    expect(payerOf("-500")).toBe("seller");
    expect(payerOf("0")).toBe("none");
    expect(payerOf("-0")).toBe("none");
    expect(payerOf(null)).toBeNull();
  });

  it("kütle yalnızca kg ve tondan çıkar; m² bilinmiyor", () => {
    expect(quantityKg("1.5", "t")!.toString()).toBe("1500");
    expect(quantityKg("700", "kg")!.toString()).toBe("700");
    expect(quantityKg("40", "m2")).toBeNull();
  });
});

describe("ilan kuralları", () => {
  const ok = { kind: "waste_offer" as const, quantity: "500", unit: "kg" as const, composition: { cotton: 60, polyester: 40 }, containsSilk: false, windowStart: "2026-10-01", windowEnd: "2026-10-31" };

  it("geçerli ilan hata vermez", () => {
    expect(listingError(ok)).toBeNull();
    expect(listingError({ ...ok, kind: "panel_offer", unit: "m2", composition: null, containsSilk: null })).toBeNull();
  });

  it("birim, miktar, bileşim, pencere ve panel alanlarını denetler", () => {
    expect(listingError({ ...ok, unit: "m2" })).toBe("unit_mismatch");
    expect(listingError({ ...ok, kind: "panel_request", unit: "kg", composition: null, containsSilk: null })).toBe("unit_mismatch");
    expect(listingError({ ...ok, quantity: "0" })).toBe("quantity_invalid");
    expect(listingError({ ...ok, quantity: "abc" })).toBe("quantity_invalid");
    expect(listingError({ ...ok, composition: { cotton: 70, polyester: 40 } })).toBe("composition_invalid");
    expect(listingError({ ...ok, composition: { silk: 10 } as never })).toBe("composition_invalid");
    expect(listingError({ ...ok, composition: { cotton: -1 } })).toBe("composition_invalid");
    expect(listingError({ ...ok, windowStart: "2026-11-01" })).toBe("window_invalid");
    expect(listingError({ ...ok, kind: "panel_offer", unit: "m2", containsSilk: null })).toBe("panel_fields");
  });
});

describe("teklif kuralları", () => {
  const input = { quantity: "400", unit: "kg", proposedDate: "2026-10-30" };
  const today = "2026-10-27";

  it("açık ilana başka kurumdan pencere içinde teklif geçer", () => {
    expect(offerError(listing(), "B", input, today)).toBeNull();
  });

  it("her ihlal kendi koduyla reddedilir", () => {
    expect(offerError(listing({ status: "closed" }), "B", input, today)).toBe("listing_closed");
    expect(offerError(listing(), "A", input, today)).toBe("own_listing");
    expect(offerError(listing(), "B", { ...input, unit: "t" }, today)).toBe("unit_mismatch");
    expect(offerError(listing(), "B", { ...input, quantity: "0" }, today)).toBe("quantity_invalid");
    expect(offerError(listing(), "B", { ...input, quantity: "500.001" }, today)).toBe("quantity_exceeds");
    expect(offerError(listing(), "B", { ...input, proposedDate: "2026-10-26" }, today)).toBe("date_past");
    expect(offerError(listing({ windowStart: "2026-11-01" }), "B", input, today)).toBe("date_outside_window");
    expect(offerError(listing({ windowEnd: "2026-10-29" }), "B", input, today)).toBe("date_outside_window");
    expect(offerError(listing({ windowStart: null, windowEnd: null }), "B", input, today)).toBeNull();
  });

  it("kabul ve ret yalnızca ilan sahibinden, açık teklif ve açık ilanda", () => {
    const offer = { orgId: "B", status: "open" as const, quantity: "400" };
    expect(respondError(listing(), offer, "A", "accept")).toBeNull();
    expect(respondError(listing(), offer, "B", "accept")).toBe("not_owner");
    expect(respondError(listing(), { ...offer, status: "accepted" }, "A", "accept")).toBe("offer_not_open");
    expect(respondError(listing({ status: "closed" }), offer, "A", "accept")).toBe("listing_closed");
    expect(respondError(listing({ quantity: "300" }), offer, "A", "accept")).toBe("quantity_exceeds");
    // Kapalı ilandaki açık teklif yine de reddedilebilir.
    expect(respondError(listing({ status: "closed" }), offer, "A", "reject")).toBeNull();
    expect(respondError(listing(), { ...offer, status: "rejected" }, "A", "reject")).toBe("offer_not_open");
  });

  it("teklifi yalnızca veren geri çeker", () => {
    expect(withdrawError({ orgId: "B", status: "open", quantity: "1" }, "B")).toBeNull();
    expect(withdrawError({ orgId: "B", status: "open", quantity: "1" }, "A")).toBe("not_owner");
    expect(withdrawError({ orgId: "B", status: "withdrawn", quantity: "1" }, "B")).toBe("offer_not_open");
  });

  it("gün TSİ'ye göre; plan geçmişten başlamaz", () => {
    expect(istanbulDay(new Date("2026-10-27T20:59:59Z"))).toBe("2026-10-27");
    expect(istanbulDay(new Date("2026-10-27T21:00:00Z"))).toBe("2026-10-28");
    expect(planStart("2026-10-30", "2026-10-27")).toBe("2026-10-30");
    expect(planStart("2026-10-20", "2026-10-27")).toBe("2026-10-27");
    expect(planStart(null, "2026-10-27")).toBe("2026-10-27");
  });

  it("tek seferlik ilan kabulle kapanır, tekrarlı ilan açık kalır", () => {
    expect(closesOnAccept("once")).toBe(true);
    expect(closesOnAccept("weekly")).toBe(false);
    expect(closesOnAccept("monthly")).toBe(false);
  });
});

describe("teslim planı", () => {
  it("gün ekleme takvim gününde çalışır: ay ve yıl geçişi, eksi gün", () => {
    expect(addDays("2026-10-27", 30)).toBe("2026-11-26");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(() => addDays("27.10.2026", 1)).toThrow(CalcError);
  });

  it("tek seferlik: önerilen gün 09:00 TSİ", () => {
    expect(deliveryPlan("2026-10-30", "once", null).map((d) => d.toISOString())).toEqual(["2026-10-30T06:00:00.000Z"]);
  });

  it("haftalık: pencere sonunda durur", () => {
    expect(deliveryPlan("2026-10-30", "weekly", "2026-11-20").map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-10-30",
      "2026-11-06",
      "2026-11-13",
      "2026-11-20",
    ]);
  });

  it("aylık: ay sonu kırpılır", () => {
    expect(deliveryPlan("2026-01-31", "monthly", null).map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("geçersiz tarih reddedilir", () => {
    expect(() => deliveryPlan("2026-02-30", "once", null)).toThrow(CalcError);
    expect(() => deliveryPlan("30.10.2026", "once", null)).toThrow(CalcError);
  });

  it("her plan: ilk teslim başlangıçta, sıralı, ufuk ve pencere içinde, aralık sabit", () => {
    const day = fc.date({ min: new Date("2026-01-01"), max: new Date("2028-12-31"), noInvalidDate: true }).map((d) => d.toISOString().slice(0, 10));
    fc.assert(
      fc.property(day, fc.constantFrom("once", "weekly", "monthly" as const), fc.option(fc.integer({ min: 0, max: 120 })), (start, rec, endAfter) => {
        const s = new Date(`${start}T06:00:00Z`).getTime();
        const windowEnd = endAfter === null ? null : new Date(s + endAfter * DAY).toISOString().slice(0, 10);
        const plan = deliveryPlan(start, rec, windowEnd);
        expect(plan[0].getTime()).toBe(s);
        const limit = Math.min(s + PLAN_HORIZON_DAYS * DAY, windowEnd ? s + endAfter! * DAY : Infinity);
        for (const [i, d] of plan.entries()) {
          if (i > 0) expect(d.getTime()).toBeGreaterThan(plan[i - 1].getTime());
          if (rec !== "once") expect(d.getTime()).toBeLessThanOrEqual(limit);
          if (rec === "weekly" && i > 0) expect(d.getTime() - plan[i - 1].getTime()).toBe(7 * DAY);
        }
        if (rec === "once") expect(plan).toHaveLength(1);
        if (rec === "weekly") expect(plan.length).toBe(Math.floor((limit - s) / (7 * DAY)) + 1);
      }),
    );
  });
});

describe("eşleşme skoru", () => {
  const demand: MatchSide = { kind: "waste_request", composition: { cotton: 50, polyester: 40 }, containsSilk: false, quantity: "3000", unit: "kg", point: { lat: 37.02, lon: 30.6 } };
  const supply: MatchSide = { kind: "waste_offer", composition: { cotton: 60, polyester: 30, elastane: 10 }, containsSilk: false, quantity: "1.5", unit: "t", point: { lat: 36.99, lon: 30.63 } };

  it("bileşim uyumu: talebin belirttiği liflerin karşılanan payı", () => {
    expect(compositionFit({ cotton: 50, polyester: 40 }, { cotton: 50, polyester: 40 })!.toNumber()).toBe(1);
    expect(compositionFit({ cotton: 60, polyester: 30 }, { cotton: 50, polyester: 40 })!.toFixed(4)).toBe(new Decimal(80).div(90).toFixed(4));
    expect(compositionFit({ unknown: 100 }, { cotton: 50, unknown: 50 })!.toNumber()).toBe(0);
    expect(compositionFit({ cotton: 100 }, { unknown: 100 })).toBeNull();
  });

  it("bilinen örnek: her bileşen elle hesaplanan değerde", () => {
    const m = matchScore(supply, demand, new Decimal("0.75"));
    // bileşim 80/90; miktar 1500/3000 = 0,5; mesafe ≈4,3 km → 1 − 4,3/100; güvenilirlik 0,75.
    expect(m.parts).toEqual({ composition: 0.89, quantity: 0.5, distance: 0.96, reliability: 0.75 });
    const expected = new Decimal(80).div(90).times(40).plus(10).plus(new Decimal(1).minus(m.distanceKm!.div(100)).times(20)).plus(15);
    expect(m.score).toBe(expected.round().toNumber());
    expect(m.knownWeight).toBe(100);
  });

  it("ipek içeren arz dışlanır", () => {
    const m = matchScore({ ...supply, containsSilk: true }, demand, null);
    expect(m).toMatchObject({ score: 0, excluded: "silk" });
  });

  it("bilinmeyen bileşen 0 sayılmaz, ağırlığı düşülür", () => {
    const m = matchScore({ ...supply, composition: null, point: null }, demand, null);
    expect(m.parts).toEqual({ composition: null, quantity: 0.5, distance: null, reliability: null });
    expect(m.knownWeight).toBe(MATCH_WEIGHTS.quantity);
    expect(m.score).toBe(50);
    const none = matchScore({ ...supply, composition: null, point: null, unit: "m2" }, demand, null);
    expect(none.score).toBeNull();
  });

  it("skor her zaman 0–100 tam sayı; bileşen artınca skor düşmez", () => {
    const comp = fc.dictionary(fc.constantFrom("cotton", "polyester", "viscose", "wool"), fc.integer({ min: 0, max: 25 }));
    const part = fc.option(fc.double({ min: 0, max: 1, noNaN: true }));
    fc.assert(
      fc.property(comp, comp, fc.integer({ min: 1, max: 10_000 }), fc.integer({ min: 1, max: 10_000 }), part, (sc, dc, sq, dq, rel) => {
        const s = { ...supply, composition: sc, quantity: String(sq), unit: "kg" };
        const d = { ...demand, composition: dc, quantity: String(dq) };
        const r = rel === null ? null : new Decimal(rel);
        const m = matchScore(s, d, r);
        if (m.score !== null) {
          expect(Number.isInteger(m.score)).toBe(true);
          expect(m.score).toBeGreaterThanOrEqual(0);
          expect(m.score).toBeLessThanOrEqual(100);
        }
        if (r) expect(matchScore(s, d, Decimal.min(1, r.plus(0.1))).score!).toBeGreaterThanOrEqual(m.score!);
      }),
    );
  });

  it("yanlış yönlü ya da farklı malzemeli çift hata verir", () => {
    expect(() => matchScore(demand, supply, null)).toThrow(CalcError);
    expect(() => matchScore({ ...supply, kind: "panel_offer" }, demand, null)).toThrow(CalcError);
    expect(LISTING_KINDS).toHaveLength(4);
  });
});
