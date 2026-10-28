#!/usr/bin/env node
// story/out/{d,m}/f_*.png → public/story/{d,m}/f_*.avif (+ .webp yedeği) ve public/story/manifest.json.
// AVIF kalitesi bütçeye göre seçilir: örnek kareler üzerinde ikili arama, sonra bütün dizi ölçülür.
// Kullanım: node scripts/story-encode.mjs [--in story/out] [--out public/story] [--aspect d,m]
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";

const ROOT = resolve(import.meta.dirname, "..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const IN = resolve(ROOT, args.in ?? "story/out");
const OUT = resolve(ROOT, args.out ?? "public/story");
const ASPECTS = (args.aspect ?? "d,m").split(",");

export const FRAMES_PER_SECTION = 30;
export const SECTIONS = 8;
// Bütçe (bayt): STORY.md §5. AVIF dizisi için; WebP yalnız AVIF desteklemeyen tarayıcıya gider.
export const BUDGET = { d: 14e6, m: 6e6, firstSection: 1.5e6 };
const SIZE = { d: [1920, 1080], m: [1080, 1920] };
const STEP = { d: 1, m: 2 };

async function frames(aspect) {
  const dir = join(IN, aspect);
  const names = (await readdir(dir).catch(() => [])).filter((n) => /^f_\d{4}\.png$/.test(n)).sort();
  return names.map((n) => ({ index: Number(n.slice(2, 6)), src: join(dir, n) }));
}

const avif = (src, quality) =>
  sharp(src).avif({ quality, effort: 6, chromaSubsampling: "4:2:0" }).toBuffer();
const webp = (src, quality) => sharp(src).webp({ quality, effort: 5, smartSubsample: true }).toBuffer();

// Bütün dizinin kare başına hedef boyutu: toplam bütçe ve ilk bölüm bütçesinden sıkı olanı, %5 pay.
function perFrameTarget(aspect) {
  const total = (SECTIONS * FRAMES_PER_SECTION) / STEP[aspect];
  const first = FRAMES_PER_SECTION / STEP[aspect];
  return Math.min(BUDGET[aspect] / total, BUDGET.firstSection / first) * 0.95;
}

async function pickQuality(list, aspect, target) {
  const sample = list.filter((_, i) => i % Math.max(1, Math.floor(list.length / 12)) === 0);
  let lo = 20;
  let hi = 70;
  let best = lo;
  while (lo <= hi) {
    const q = Math.floor((lo + hi) / 2);
    const sizes = await Promise.all(sample.map((f) => avif(f.src, q).then((b) => b.length)));
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    if (mean <= target) {
      best = q;
      lo = q + 1;
    } else {
      hi = q - 1;
    }
  }
  return best;
}

async function encodeAspect(aspect) {
  const list = await frames(aspect);
  if (!list.length) return null;
  const target = perFrameTarget(aspect);
  let q = await pickQuality(list, aspect, target);
  const outDir = join(OUT, aspect);
  for (;;) {
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    const out = [];
    for (const f of list) {
      const name = `f_${String(f.index).padStart(4, "0")}`;
      const [a, w] = await Promise.all([avif(f.src, q), webp(f.src, Math.min(90, q + 20))]);
      await writeFile(join(outDir, `${name}.avif`), a);
      await writeFile(join(outDir, `${name}.webp`), w);
      out.push({ index: f.index, avif: `${aspect}/${name}.avif`, webp: `${aspect}/${name}.webp`, bytes: { avif: a.length, webp: w.length } });
    }
    const total = out.reduce((s, f) => s + f.bytes.avif, 0);
    const first = out.filter((f) => f.index < FRAMES_PER_SECTION).reduce((s, f) => s + f.bytes.avif, 0);
    const full = (SECTIONS * FRAMES_PER_SECTION) / STEP[aspect];
    // Henüz render edilmemiş bölümler varken toplam, tam diziye oranlanarak denetlenir.
    const projected = (total / out.length) * full;
    if ((projected <= BUDGET[aspect] && first <= BUDGET.firstSection) || q <= 20) {
      const [width, height] = SIZE[aspect];
      return {
        width,
        height,
        step: STEP[aspect],
        quality: { avif: q, webp: Math.min(90, q + 20) },
        bytes: { avif: total, webp: out.reduce((s, f) => s + f.bytes.webp, 0), firstSectionAvif: first, projectedAvif: Math.round(projected) },
        frames: out,
      };
    }
    q -= 2;
  }
}

async function main() {
  const variants = {};
  for (const aspect of ASPECTS) {
    const v = await encodeAspect(aspect);
    if (v) {
      variants[aspect] = v;
      console.log(
        `${aspect}: ${v.frames.length} kare, AVIF q${v.quality.avif}, ${(v.bytes.avif / 1e6).toFixed(2)} MB` +
          ` (tam dizi tahmini ${(v.bytes.projectedAvif / 1e6).toFixed(2)} MB), ilk bölüm ${(v.bytes.firstSectionAvif / 1e6).toFixed(2)} MB`,
      );
    }
  }
  if (!Object.keys(variants).length) throw new Error(`Kare yok: ${IN}`);
  const manifest = { framesPerSection: FRAMES_PER_SECTION, sections: SECTIONS, budget: BUDGET, variants };
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const s = await stat(join(OUT, "manifest.json"));
  console.log(`manifest.json ${s.size} B`);
}

// Testler bütçe sabitlerini içe aktarır; kodlama yalnızca komut satırından çalışır.
if (import.meta.main) await main();
