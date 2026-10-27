import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Decimal } from "@/domain/result";
import {
  COVER_DEFAULTS,
  HHI_HIGH,
  ON_TIME_GRACE_MS,
  coverLevel,
  coverThresholds,
  daysOfCover,
  hhi,
  onTimeRate,
  projectStock,
  supplyView,
  type IncomingDelivery,
  type StockBatchIn,
  type SupplyInput,
} from "@/domain/supply";

const now = new Date("2026-10-27T12:00:00Z");
const at = (h: number) => new Date(now.getTime() + h * 3600_000);
const day = (d: number) => at(d * 24);
const D = (v: Decimal.Value) => new Decimal(v);
const defaults = coverThresholds(null, null);

describe("zamanında teslim oranı", () => {
  it("1 gün pay içinde gelen zamanında; geç gelen, iptal ve süresi geçen gelmeyen zamanında değil", () => {
    const r = onTimeRate(
      [
        { plannedAt: at(-100), deliveredAt: at(-100 + 24), status: "delivered" }, // tam sınırda: zamanında
        { plannedAt: at(-100), deliveredAt: at(-100 + 25), status: "delivered" }, // geç
        { plannedAt: at(-60), deliveredAt: null, status: "cancelled" },
        { plannedAt: at(-30), deliveredAt: null, status: "planned" }, // vadesi geçti, gelmedi
        { plannedAt: at(-10), deliveredAt: null, status: "planned" }, // pay süresi bitmedi: hesaba girmez
        { plannedAt: at(48), deliveredAt: at(-1), status: "delivered" }, // erken teslim: zamanında
      ],
      now,
    );
    expect(r).toMatchObject({ due: 5, onTime: 2 });
    expect(r.rate!.toString()).toBe("0.4");
    expect(ON_TIME_GRACE_MS).toBe(86_400_000);
  });

  it("vadesi gelmiş teslim yoksa oran bilinmiyor", () => {
    expect(onTimeRate([], now).rate).toBeNull();
    expect(onTimeRate([{ plannedAt: at(5), deliveredAt: null, status: "planned" }], now).rate).toBeNull();
  });
});

describe("eşikler", () => {
  it("ikisi de gelip tutarlıysa modelden; eksik ya da sarı > yeşil ise varsayılan 14 ve 7", () => {
    const m = coverThresholds(21, 10);
    expect(m.fromModel).toBe(true);
    expect([m.greenDays.toNumber(), m.yellowDays.toNumber()]).toEqual([21, 10]);
    for (const [g, y] of [
      [null, 7],
      [14, null],
      [5, 10],
      [14, -1],
    ] as const) {
      const t = coverThresholds(g, y);
      expect(t.fromModel).toBe(false);
      expect([t.greenDays.toNumber(), t.yellowDays.toNumber()]).toEqual([COVER_DEFAULTS.greenDays, COVER_DEFAULTS.yellowDays]);
    }
  });

  it("sınırlar: 14 yeşil, 13,999 sarı, 7 sarı, 6,999 kırmızı; gün bilinmiyorsa düzey de yok", () => {
    expect(coverLevel(D(14), defaults)).toBe("ok");
    expect(coverLevel(D("13.999"), defaults)).toBe("warn");
    expect(coverLevel(D(7), defaults)).toBe("warn");
    expect(coverLevel(D("6.999"), defaults)).toBe("danger");
    expect(coverLevel(D(0), defaults)).toBe("danger");
    expect(coverLevel(null, defaults)).toBeNull();
  });

  it("özellik: düzey gün sayısıyla tekdüze (daha çok gün daha kötü düzey vermez)", () => {
    const rank = { danger: 0, warn: 1, ok: 2 } as const;
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40_000 }), fc.integer({ min: 0, max: 40_000 }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(rank[coverLevel(D(lo).div(1000), defaults)!]).toBeLessThanOrEqual(rank[coverLevel(D(hi).div(1000), defaults)!]);
      }),
    );
  });
});

describe("kaç günlük hammadde", () => {
  it("stok ÷ günlük ihtiyaç; stok ya da ihtiyaç bilinmiyorsa, ihtiyaç 0 ise bilinmiyor", () => {
    expect(daysOfCover(D(3000), D(400))!.toString()).toBe("7.5");
    expect(daysOfCover(D(0), D(400))!.toString()).toBe("0");
    expect(daysOfCover(null, D(400))).toBeNull();
    expect(daysOfCover(D(3000), null)).toBeNull();
    expect(daysOfCover(D(3000), D(0))).toBeNull();
  });
});

describe("30 günlük projeksiyon", () => {
  it("teslimsiz: stok her gün ihtiyaç kadar azalır, 0'ın altına inmez, bittiği gün yazılır", () => {
    const p = projectStock(D(1000), D(400), [], now, defaults)!;
    expect(p.points.slice(0, 4).map((x) => x.stockKg.toString())).toEqual(["600", "200", "0", "0"]);
    expect(p.stockoutDay).toBe(3);
    expect(p.points).toHaveLength(30);
  });

  it("teslim kendi gününe düşer; pay süresindeki geçmiş teslim ilk güne; ufuk dışı ve kg'ı bilinmeyen girmez", () => {
    const p = projectStock(
      D(1000),
      D(400),
      [
        { at: at(30), kg: D(500) }, // 2. gün
        { at: at(-5), kg: D(100) }, // 1. gün
        { at: day(31), kg: D(9999) }, // ufuk dışı
        { at: at(50), kg: null },
      ],
      now,
      defaults,
    )!;
    expect(p.points.slice(0, 3).map((x) => x.stockKg.toString())).toEqual(["700", "800", "400"]);
    expect(p.arrivalsKg.toString()).toBe("600");
    expect(p.unknownArrivals).toBe(1);
    // Ekrandaki teslim işaretleri: gün başına sayı ve bilinen kg; kg'ı bilinmeyen teslim sayılır ama kg'a girmez.
    expect(p.points.slice(0, 4).map((x) => [x.arrivals, x.arrivalKg?.toString() ?? null])).toEqual([
      [1, "100"],
      [1, "500"],
      [1, null],
      [0, null],
    ]);
  });

  it("ihtiyaç 0 ise projeksiyon yok", () => expect(projectStock(D(1000), D(0), [], now, defaults)).toBeNull());

  it("özellik: teslimsiz projeksiyonda bitiş günü ⌈stok ÷ ihtiyaç⌉ (en az 1); stok hiç negatif değil", () => {
    fc.assert(
      fc.property(fc.oneof(fc.constantFrom(0, 400, 12_000), fc.integer({ min: 0, max: 20_000 })), fc.integer({ min: 1, max: 2_000 }), (stock, need) => {
        const p = projectStock(D(stock), D(need), [], now, defaults)!;
        const expected = Math.max(1, Math.ceil(stock / need));
        expect(p.stockoutDay).toBe(expected <= 30 ? expected : null);
        expect(p.points.every((x) => !x.stockKg.isNeg())).toBe(true);
      }),
    );
  });
});

describe("HHI", () => {
  it("tek tedarikçi 10.000, iki eşit 5.000; kalem yoksa ya da toplam 0 ise bilinmiyor", () => {
    expect(hhi([500])!.toString()).toBe("10000");
    expect(hhi([300, 300])!.toString()).toBe("5000");
    expect(hhi([])).toBeNull();
    expect(hhi([0, 0])).toBeNull();
    expect(HHI_HIGH).toBe(1800);
  });

  it("özellik: n tedarikçide 10.000 ÷ n ile 10.000 arasında", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 100_000 }), { minLength: 1, maxLength: 12 }), (xs) => {
        const v = hhi(xs)!.toNumber();
        expect(v).toBeGreaterThanOrEqual(10_000 / xs.length - 1e-6);
        expect(v).toBeLessThanOrEqual(10_000 + 1e-6);
      }),
    );
  });
});

describe("tedarik görünümü", () => {
  const stock = (o: Partial<StockBatchIn> & Pick<StockBatchIn, "id">): StockBatchIn => ({
    supplierOrgId: "A",
    receivedAt: day(-10),
    verified: true,
    declaredKg: "1000",
    weighedKg: "950",
    accepted: D(900),
    remaining: D(900),
    resultClass: "synthetic",
    ...o,
  });
  const delivery = (o: Partial<IncomingDelivery> & Pick<IncomingDelivery, "id">): IncomingDelivery => ({
    supplierOrgId: "A",
    plannedAt: day(3),
    deliveredAt: null,
    status: "planned",
    plannedKg: D(1000),
    resultClass: "synthetic",
    ...o,
  });
  const input = (o: Partial<SupplyInput>): SupplyInput => ({
    now,
    stock: [],
    deliveries: [],
    dailyNeed: { kg: 400, resultClass: "synthetic" },
    thresholds: { green: 14, yellow: 7 },
    ...o,
  });

  it("stoku, gelen teslimi ve ihtiyacı olmayan kurumda görünüm yok", () => {
    expect(supplyView(input({ dailyNeed: null }))).toBeNull();
  });

  it("üretime hazır stok yalnızca doğrulanmış kalan; doğrulama bekleyen ayrı durur ve uyarı verir; kritik uyarılar önce", () => {
    const v = supplyView(
      input({
        stock: [stock({ id: "1" }), stock({ id: "2", remaining: D(0) }), stock({ id: "3", verified: false, accepted: D(700), remaining: D(700) })],
      }),
    )!;
    expect(v.usable.kg!.toString()).toBe("900");
    expect(v.pending.kg!.toString()).toBe("700");
    expect(v.days!.toString()).toBe("2.25");
    expect(v.level).toBe("danger");
    expect(v.alerts.map((a) => a.kind)).toEqual(["cover", "stockout", "pending", "concentration"]);
    expect(v.alerts[0]).toMatchObject({ level: "danger", lowerBound: false });
    expect(v.alerts[0].kind === "cover" && v.alerts[0].threshold.toString()).toBe("7");
  });

  it("bugün sarıyken projeksiyonun kırmızıya indiği ilk gün uyarıdır; bugün kırmızıysa bu uyarı yok", () => {
    // 4000 kg ÷ 400 = 10 gün (sarı). 4. gün sonunda 2400 kg = 6 gün (kırmızı); 10. gün stok biter.
    const v = supplyView(input({ stock: [stock({ id: "1", accepted: D(4000), remaining: D(4000) })] }))!;
    expect(v.level).toBe("warn");
    expect(v.alerts.map((a) => a.kind)).toEqual(["cover", "projected_danger", "stockout", "concentration"]); // tek tedarikçi: HHI 10.000
    expect(v.alerts[1]).toMatchObject({ day: 4, level: "warn" });
    expect(v.alerts[2]).toMatchObject({ day: 10, level: "warn" });
    const red = supplyView(input({ stock: [stock({ id: "1", accepted: D(2000), remaining: D(2000) })] }))!;
    expect(red.alerts.map((a) => a.kind)).not.toContain("projected_danger");
  });

  it("ihtiyaç bilinmiyorsa gün sayısı, düzey ve projeksiyon yok ve uyarı verir", () => {
    const v = supplyView(input({ stock: [stock({ id: "1" })], dailyNeed: { kg: null, resultClass: "synthetic" } }))!;
    expect(v.days).toBeNull();
    expect(v.level).toBeNull();
    expect(v.projection).toBeNull();
    expect(v.alerts.map((a) => a.kind)).toContain("need_missing");
  });

  it("vadesi geçmiş teslim uyarıdır ve projeksiyona girmez; yaklaşan teslimler tarihe göre, 30 gün içinde", () => {
    const v = supplyView(
      input({
        stock: [stock({ id: "1", remaining: D(8000), accepted: D(8000) })],
        deliveries: [
          delivery({ id: "late", plannedAt: day(-2) }),
          delivery({ id: "b", plannedAt: day(9) }),
          delivery({ id: "a", plannedAt: day(2) }),
          delivery({ id: "far", plannedAt: day(40) }),
        ],
      }),
    )!;
    expect(v.upcoming.map((d) => d.id)).toEqual(["a", "b"]);
    expect(v.alerts.find((a) => a.kind === "overdue")).toMatchObject({ deliveryId: "late" });
    expect(v.projection!.arrivalsKg.toString()).toBe("2000");
    expect(v.level).toBe("ok");
  });

  it("tedarikçi satırı: beyan ile tartım farkı, 90 günlük pay, zamanında teslim; HHI eşik üstünde uyarı", () => {
    const v = supplyView(
      input({
        stock: [
          stock({ id: "1", supplierOrgId: "A", accepted: D(3000), remaining: D(0) }),
          stock({ id: "2", supplierOrgId: "B", declaredKg: "1000", weighedKg: "1100", accepted: D(1000), remaining: D(1000) }),
          stock({ id: "3", supplierOrgId: "B", receivedAt: day(-100), accepted: D(5000), remaining: D(0) }), // pencere dışı
          stock({ id: "4", supplierOrgId: "C", weighedKg: null, declaredKg: "800", accepted: null, remaining: null, verified: false }),
        ],
        deliveries: [delivery({ id: "d", supplierOrgId: "A", plannedAt: day(-5), deliveredAt: day(-5), status: "delivered" })],
      }),
    )!;
    const byId = Object.fromEntries(v.suppliers.map((s) => [s.orgId, s]));
    expect(v.suppliers.map((s) => s.orgId)).toEqual(["A", "B", "C"]);
    expect(byId.A.share!.toString()).toBe("0.75");
    expect(byId.B.gap!.toString()).toBe("0.025"); // (950 + 1100 − 2000) ÷ 2000
    expect(byId.C.gap).toBeNull();
    expect(byId.C.windowKg.kg).toBeNull();
    expect(byId.C.share).toBeNull();
    expect(byId.A.onTime.rate!.toString()).toBe("1");
    expect(v.hhi!.toString()).toBe("6250");
    expect(v.alerts.find((a) => a.kind === "concentration")).toMatchObject({ topOrgId: "A" });
    expect(v.pending).toMatchObject({ batches: 1, kg: null });
  });

  it("projeksiyon hiçbir zaman gerçekleşen sınıfında değil", () => {
    const v = supplyView(input({ stock: [stock({ id: "1", resultClass: "realized" })], dailyNeed: { kg: 400, resultClass: "realized" } }))!;
    expect(v.resultClass).toBe("realized");
    expect(v.projectionClass).toBe("pilot_projection");
  });

  it("bilinmeyen kalan stoku alt sınır yapar ve uyarı verir", () => {
    const v = supplyView(input({ stock: [stock({ id: "1" }), stock({ id: "2", accepted: null, remaining: null })] }))!;
    expect(v.usable.unknown).toBe(1);
    expect(v.alerts.find((a) => a.kind === "cover")).toMatchObject({ lowerBound: true });
    expect(v.alerts.map((a) => a.kind)).toContain("stock_unknown");
  });
});
