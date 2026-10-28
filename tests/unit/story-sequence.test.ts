import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  LruCache,
  coverRect,
  decodeWindow,
  frameAt,
  loadOrder,
  nearestLoaded,
  pickAspect,
  textOpacity,
  type ManifestFrame,
} from "@/components/story/sequence";

const frames = (n: number, step = 1): ManifestFrame[] =>
  Array.from({ length: n }, (_, i) => ({ index: i * step, avif: "", webp: null, quality: 50, ssim: 0.97, bytes: { avif: 1, webp: null } }));

describe("pickAspect", () => {
  it("dikey ekranda 9:16, yatayda 16:9; istenen yoksa eldeki", () => {
    expect(pickAspect(390, 844, ["d", "m"])).toBe("m");
    expect(pickAspect(1440, 900, ["d", "m"])).toBe("d");
    expect(pickAspect(390, 844, ["d"])).toBe("d");
    expect(pickAspect(390, 844, [])).toBeNull();
  });
});

describe("frameAt", () => {
  it("uçlar kenetlenir; NaN ilk kare; dizi boşsa -1", () => {
    expect(frameAt(0, 240)).toBe(0);
    expect(frameAt(1, 240)).toBe(239);
    expect(frameAt(1.4, 240)).toBe(239);
    expect(frameAt(-0.2, 240)).toBe(0);
    expect(frameAt(Number.NaN, 240)).toBe(0);
    expect(frameAt(0.5, 0)).toBe(-1);
  });

  it("özellik: artan ilerleme azalmayan kare verir ve dizinin içinde kalır", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), fc.integer({ min: 1, max: 500 }), (a, b, n) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(frameAt(lo, n)).toBeLessThanOrEqual(frameAt(hi, n));
        expect(frameAt(hi, n)).toBeLessThan(n);
      }),
    );
  });
});

describe("loadOrder", () => {
  it("ilk bölüm önce; mobil dizide bölüm sınırı kare numarasından okunur", () => {
    const m = frames(120, 2);
    const order = loadOrder(m, 30, false);
    expect(order.slice(0, 15)).toEqual(Array.from({ length: 15 }, (_, i) => i));
    expect(new Set(order).size).toBe(120);
  });

  it("kare atlamada ilk bölüm tam, kalanın yarısı yüklenir", () => {
    const order = loadOrder(frames(240), 30, true);
    expect(order.filter((i) => i < 30)).toHaveLength(30);
    expect(order.filter((i) => i >= 30)).toHaveLength(105);
  });
});

describe("nearestLoaded", () => {
  it("yüklü kare yoksa en yakını; eşitlikte geride kalan; hiç yoksa -1", () => {
    const loaded = new Set([10, 14]);
    expect(nearestLoaded(14, loaded, 240)).toBe(14);
    expect(nearestLoaded(12, loaded, 240)).toBe(10);
    expect(nearestLoaded(13, loaded, 240)).toBe(14);
    expect(nearestLoaded(5, new Set(), 240)).toBe(-1);
  });
});

describe("LruCache", () => {
  it("kapasiteyi aşan en eski kare kapatılır; okunan kare tazelenir", () => {
    const closed: number[] = [];
    const item = (k: number) => ({ close: () => closed.push(k) });
    const c = new LruCache<ReturnType<typeof item>>(2);
    c.set(1, item(1));
    c.set(2, item(2));
    c.get(1);
    c.set(3, item(3));
    expect(closed).toEqual([2]);
    expect(c.has(1) && c.has(3)).toBe(true);
    c.set(3, item(30));
    expect(closed).toEqual([2, 3]);
    c.clear();
    expect(c.size).toBe(0);
    expect(closed).toEqual([2, 3, 1, 30]);
  });
});

describe("decodeWindow", () => {
  it("önce şu anki kare, sonra scroll yönü; dizinin dışına taşmaz", () => {
    expect(decodeWindow(5, 240, 3, 1, 1)).toEqual([5, 6, 4, 7, 8]);
    expect(decodeWindow(5, 240, 3, 1, -1)).toEqual([5, 6, 4, 3, 2]);
    expect(decodeWindow(0, 3, 4, 2, 1)).toEqual([0, 1, 2]);
  });
});

describe("textOpacity", () => {
  it("ilk bölümün metni açılışta görünür; son bölümün metni sonda kalır; bölüm dışında 0", () => {
    expect(textOpacity(0, 0, 8)).toBe(1);
    expect(textOpacity(1, 7, 8)).toBe(1);
    expect(textOpacity(0.5, 0, 8)).toBe(0);
    expect(textOpacity((2 + 0.5) / 8, 2, 8)).toBe(1);
    expect(textOpacity(2 / 8, 2, 8)).toBe(0);
  });

  it("özellik: aynı anda en fazla bir bölümün metni tam görünür", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (p) => {
        const full = Array.from({ length: 8 }, (_, s) => textOpacity(p, s, 8)).filter((o) => o > 0.999);
        expect(full.length).toBeLessThanOrEqual(1);
      }),
    );
  });
});

describe("coverRect", () => {
  it("kaynak oranı korunur ve hedefi kaplar", () => {
    const r = coverRect(1920, 1080, 390, 844);
    expect(r.h).toBeCloseTo(844);
    expect(r.w / r.h).toBeCloseTo(1920 / 1080);
    expect(r.x).toBeLessThan(0);
  });
});
