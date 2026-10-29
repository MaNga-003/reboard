import fc from "fast-check";
import gsap from "gsap";
import { describe, expect, it } from "vitest";
import {
  LruCache,
  coverRect,
  decodeWindow,
  expoOut,
  frameAt,
  loadOrder,
  nearestLoaded,
  pickAspect,
  retarget,
  scrollProgress,
  scrubAt,
  textOpacity,
  type ManifestFrame,
  type Scrub,
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

describe("scrollProgress", () => {
  it("üst kenar ekran üstündeyken 0, alt kenar yapışkan kabın altındayken 1; dışı kenetlenir", () => {
    // 8 bölüm × 120svh, ekran 900 px: kaydırılabilir boy 8640 − 900.
    expect(scrollProgress(0, 8640, 900)).toBe(0);
    expect(scrollProgress(300, 8640, 900)).toBe(0);
    expect(scrollProgress(-7740, 8640, 900)).toBe(1);
    expect(scrollProgress(-9000, 8640, 900)).toBe(1);
    expect(scrollProgress(-3870, 8640, 900)).toBeCloseTo(0.5, 12);
    expect(scrollProgress(-10, 900, 900)).toBe(0);
  });
});

// Oynatıcının hissi gsap ScrollTrigger'ın `scrub: 0.35`'iyle kuruldu; yerel yumuşatma onu birebir kopyalar (R-7).
// gsap burada yalnızca kâhin olarak durur (devDependencies), pakete girmez.
describe("yumuşatma: gsap ScrollTrigger scrub'ı ile aynı", () => {
  const D = 350;

  it("expoOut, gsap'in 'expo' eğrisi", () => {
    const ease = gsap.parseEase("expo");
    for (let i = -10; i <= 1010; i++) expect(expoOut(i / 1000)).toBeCloseTo(ease(Math.min(1, Math.max(0, i / 1000))), 12);
  });

  // ScrollTrigger her ilerleme değişiminde yumuşatma tween'ini o anki zamanda çizer, sonra
  // resetTo("totalProgress", hedef, o anki değer) çağırır (gsap 3.15, ScrollTrigger.js 2316–2320). Aynısı burada
  // duraklatılmış bir zaman çizelgesinde elle sürülür; her adımda iki uygulamanın değeri karşılaştırılır.
  // Tolerans: gsap her çizimde değeri 6 basamağa yuvarlar (_renderPlain) ve yuvarlanmış değerden yeniden başlar. 40 bin
  // rastgele dizide (254 bin örnek) en büyük fark 1,4e-6 ölçüldü; ders kitabı expo'su (1 − 2^(−10k)) 7,8e-3 sapardı.
  // Eşik ikisinin arasında: yuvarlamaya 7 kat pay, yanlış eğriye 800 kat uzak.
  it("özellik: rastgele scroll dizilerinde gsap resetTo ile aynı değer", () => {
    const step = fc.record({ dt: fc.integer({ min: 1, max: 600 }), to: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }) });
    fc.assert(
      fc.property(fc.array(step, { minLength: 1, maxLength: 40 }), (steps) => {
        // ScrollTrigger'ın tween'i gsap'in kök çizelgesinde yaşar; resetTo başlangıcı yalnızca smoothChildTiming açıkken
        // o ana hizalar (gsap.js _alignPlayhead), kökte açıktır.
        const tl = gsap.timeline({ paused: true, smoothChildTiming: true });
        tl.set({}, {}, 3600); // çizelge zamanı kenetlenmesin
        const state = { p: 0 };
        const tw = gsap.to(state, { p: 0, ease: "expo", duration: D / 1000, paused: true });
        tl.add(tw, 0);
        let s: Scrub = { from: 0, to: 0, at: -Infinity };
        let now = 0;
        for (const { dt, to } of steps) {
          now += dt;
          tl.time(now / 1000);
          if (to !== undefined && to !== s.to) {
            tw.resetTo("p", to, state.p);
            s = retarget(s, to, now, D);
          }
          expect(Math.abs(scrubAt(s, now, D) - state.p)).toBeLessThanOrEqual(1e-5);
        }
        tl.kill();
      }),
    );
  });

  it("hedef değişince eğri o anki değerden başlar ve süre sonunda hedefe varır", () => {
    let s: Scrub = { from: 0, to: 0, at: -Infinity };
    s = retarget(s, 1, 0, D);
    const mid = scrubAt(s, 100, D);
    expect(mid).toBe(expoOut(100 / D));
    s = retarget(s, 0.2, 100, D);
    expect(scrubAt(s, 100, D)).toBe(mid);
    expect(scrubAt(s, 100 + D, D)).toBe(0.2);
    expect(retarget(s, 0.2, 200, D)).toBe(s);
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
