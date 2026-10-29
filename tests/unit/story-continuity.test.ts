// Kare dizisinin sürekliliği (M-10). Ölçü scripts/story-continuity.mjs'te; burada önce ölçünün kendisi sentetik
// örneklerle sınanır, sonra kodlanmış dizi (public/story; yerelde STORY_DIR=story/out ile ham PNG'ler) dolaşılır.
// Gerçek dizide bilerek bozma da yapılır: dikişte parlatılmış kare, mobil dikişte ışık sıçraması, bölüm ortasında
// sıra dışı kare. Kaçırılan oranlar VERIFICATION.md M-10'da.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Aspect } from "@/components/story/sequence";
import { readRgb } from "../../scripts/image-metrics.mjs";
import {
  boundaryPairs,
  CUT,
  CUT_WIDTH,
  cutMetrics,
  findJumps,
  JUMP,
  listFrames,
  measure,
  pairSeries,
  SEAM,
  seamRatio,
} from "../../scripts/story-continuity.mjs";
import { FRAMES_PER_SECTION } from "../../scripts/story-encode.mjs";

type Img = { data: Buffer; width: number; height: number };

const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const enc = (l: number) => Math.round(255 * Math.min(1, l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055));
/** Doğrusal ışıkta kazanç: pozlama ya da ışık gücü değişimi. */
const gain = (img: Img, g: number): Img => ({ ...img, data: Buffer.from(img.data.map((c) => enc(lin(c) * g))) });

/** Sentetik kare: yumuşak eğim üstünde ince desen (doku), x yönünde kaydırılabilir; isteğe bağlı dikey ışık eğimi. */
function synthetic(shift = 0, tilt = 0, w = 160, h = 90): Img {
  const data = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = x + shift;
      const base = 90 + 60 * Math.sin(u / 23) * Math.cos(y / 17) + 25 * Math.sin((u * 7) / 5 + y / 3);
      const light = 1 + tilt * (y / h - 0.5);
      const i = 3 * (y * w + x);
      data[i] = Math.max(0, Math.min(255, Math.round(base * light + 30)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(base * light)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(base * light * 0.7)));
    }
  return { data, width: w, height: h };
}

describe("ölçünün kendisi", () => {
  // Düzgün hızlanıp yavaşlayan hareket, sınırda bir karelik duraklama (fark ≈ 0).
  const speeds = Array.from({ length: 29 }, (_, k) => 0.012 + 0.06 * Math.sin((Math.PI * (k + 0.5)) / 29));
  const smooth = [...speeds, 0.0002, ...speeds];
  // Düzgün harekette iki adımın farkı tek adımınkinden büyük (ölçülen dizilerde oran ≥ 0,82).
  const skipOf = (d: number[]) => d.slice(1).map((v, k) => Math.max(v, d[k]) * 1.1);

  it.each(["d", "m"] as Aspect[])("%s: düzgün hareket ve duraklama sıçrama değil", (aspect) => {
    expect(findJumps(smooth, skipOf(smooth), JUMP[aspect])).toEqual([]);
  });

  it.each(["d", "m"] as Aspect[])("%s: kare düşmesi (yavaş bölümde çift hız) basamak olarak yakalanır", (aspect) => {
    const d = [...smooth];
    d[5] *= 2;
    expect(findJumps(d, skipOf(d), JUMP[aspect])).toContainEqual(expect.objectContaining({ kind: "step", at: 5 }));
  });

  it.each(["d", "m"] as Aspect[])("%s: dizinin dışında kalan tek kare yakalanır: k ile k+2 birbirine k+1'den çok daha yakın", (aspect) => {
    const d = [...smooth];
    d[10] = d[11] = 0.2;
    const skip = skipOf(d);
    skip[10] = smooth[10];
    expect(findJumps(d, skip, JUMP[aspect])).toContainEqual(expect.objectContaining({ kind: "frame", at: 11 }));
  });

  it.each(["d", "m"] as Aspect[])("%s: fark doyunca da (k–k+2 kör) sıra dışı kare tümsekten yakalanır", (aspect) => {
    const d = [...smooth];
    d[10] = d[11] = 0.2;
    const skip = skipOf(d);
    skip[10] = 0.2;
    const jumps = findJumps(d, skip, JUMP[aspect]);
    expect(jumps.filter((j) => j.kind !== "bump")).toEqual([]);
    expect(jumps).toContainEqual(expect.objectContaining({ kind: "bump", at: 11 }));
  });

  it("mobil adımda (2) bölüm sınırı kare numarasından bulunur", () => {
    expect(boundaryPairs([24, 26, 28, 30, 32, 58, 60], FRAMES_PER_SECTION)).toEqual([
      [2, 3],
      [5, 6],
    ]);
  });

  it("mobil dikiş oranı: yarım adım geçer, tam adım düşer", () => {
    expect(seamRatio([0.06, 0.03, 0.06], 1)).toBeLessThanOrEqual(SEAM);
    expect(seamRatio([0.06, 0.06, 0.06], 1)).toBeGreaterThan(SEAM);
  });

  it("kesme ölçüleri: aynı kare geçer; parlak, kaymış ve eğimli kare düşer", () => {
    const a = synthetic();
    const same = cutMetrics(a, synthetic());
    expect(same.ssimRaw).toBeCloseTo(1, 6);
    expect(same.ssimStructure).toBeCloseTo(1, 6);
    expect(same.dE).toBe(0);
    expect(same.slope).toBe(0);
    expect(cutMetrics(a, gain(a, 1.05)).dE).toBeGreaterThan(CUT.dE);
    const moved = cutMetrics(a, synthetic(3));
    expect(moved.ssimStructure).toBeLessThan(CUT.ssimStructure);
    expect(moved.ssimRaw).toBeLessThan(CUT.ssimRaw);
    expect(cutMetrics(a, synthetic(0, 0.1)).slope).toBeGreaterThan(CUT.slope);
  });
});

const DIR = join(process.cwd(), process.env.STORY_DIR ?? join("public", "story"));
const manifestFile = join(DIR, "manifest.json");
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : null;
const aspects = (["d", "m"] as Aspect[]).filter((a) => listFrames(DIR, a).length >= 3);
// Sıra dışı kare bozmasında yakalanma oranının tabanı (kalibrasyon M-10).
const CATCH: Record<Aspect, number> = { d: 0.95, m: 0.85 };

describe.skipIf(!aspects.length)("kare dizisi", () => {
  for (const aspect of aspects) {
    const frames = listFrames(DIR, aspect);
    let m: Awaited<ReturnType<typeof measure>>;
    beforeAll(async () => {
      m = await measure(frames, aspect, FRAMES_PER_SECTION);
    }, 180_000);

    it(`${aspect}: ardışık sınır kareleri aynı görüntü (ham SSIM ≥ ${CUT.ssimRaw}, yapı ≥ ${CUT.ssimStructure}, ΔE ≤ ${CUT.dE}, eğim ≤ ${CUT.slope})`, () => {
      const bad = m.cuts
        .filter((c) => c.ssimRaw < CUT.ssimRaw || c.ssimStructure < CUT.ssimStructure || c.dE > CUT.dE || c.slope > CUT.slope)
        .map((c) => `${c.from}→${c.to}: ham ${c.ssimRaw.toFixed(4)}, yapı ${c.ssimStructure.toFixed(4)}, ΔE ${c.dE.toFixed(4)}, eğim ${c.slope.toFixed(4)}`);
      expect(bad).toEqual([]);
    });

    it(`${aspect}: atlamalı dikişin farkı komşu adımın ≤ ${SEAM} katı`, () => {
      expect(m.seams.filter((s) => s.ratio > SEAM).map((s) => `${s.from}→${s.to}: ×${s.ratio.toFixed(2)}`)).toEqual([]);
    });

    const jump = JUMP[aspect];
    it(`${aspect}: bölüm içinde sıçrama yok (taban ${jump.floor}, basamak ×${jump.step}, dışarıda kalan kare ×${jump.frame}, tümsek ×${jump.bump})`, () => {
      const jumps = findJumps(m.d, m.skip, jump).map((j) => `${j.kind} ${m.indices[j.at]} ×${j.ratio.toFixed(2)}`);
      expect(jumps).toEqual([]);
    });

    if (!manifest || manifest.variants[aspect]?.frames.length === (FRAMES_PER_SECTION * manifest.sections) / manifest.variants[aspect].step)
      it(`${aspect}: her bölüm sınırı ölçüldü`, () => {
        const sections = new Set(frames.map((f) => Math.floor(f.index / FRAMES_PER_SECTION))).size;
        expect(m.cuts.length + m.seams.length).toBe(sections - 1);
      });

    // Bilerek bozma, gerçek karelerle: ölçü bu dizide kör değil. Sıra dışı kare her bölümün 8., 15. ve 24. karesine
    // 3 ve 6 adım ileriden ya da geriden konur; hızlı bölümde kaçan olabilir, yakalanma oranının tabanı denetlenir.
    it(`${aspect}: dikişte %8 parlak kare ve sıra dışı kare yakalanır (en az %${CATCH[aspect] * 100})`, async () => {
      for (const c of m.cuts) {
        const [a, b] = await Promise.all([readRgb(frames[c.at].path, CUT_WIDTH), readRgb(frames[c.at + 1].path, CUT_WIDTH)]);
        expect(cutMetrics(a, gain(b, 1.08)).dE, `${c.from}→${c.to} parlatıldı`).toBeGreaterThan(CUT.dE);
      }
      const missed: string[] = [];
      let tried = 0;
      for (const off of [6, 3, -6, -3])
        for (let s = 0; s * FRAMES_PER_SECTION <= m.indices.at(-1)!; s++)
          for (const o of [8, 15, 24]) {
            const j = m.indices.findIndex((i) => i >= s * FRAMES_PER_SECTION + o);
            if (j < 8 || j + 8 >= m.thumbs.length) continue;
            const { d, skip } = pairSeries(m.thumbs.map((x, k) => (k === j ? m.thumbs[j + off] : x)));
            tried++;
            if (!findJumps(d, skip, jump).length) missed.push(`${m.indices[j]}${off > 0 ? "+" : ""}${off}`);
          }
      expect(tried).toBeGreaterThan(0);
      expect((tried - missed.length) / tried, `kaçan ${missed.length}/${tried}: ${missed.join(", ")}`).toBeGreaterThanOrEqual(CATCH[aspect]);
    }, 60_000);
  }
});
