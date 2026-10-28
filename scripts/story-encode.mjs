#!/usr/bin/env node
// story/out/{d,m}/f_*.png → public/story/{d,m}/f_*.avif ve public/story/manifest.json (D-004, STORY.md §5).
// Her kare, kendi PNG'sine karşı SSIM hedefine ulaşan en düşük AVIF kalitesiyle kodlanır: sade kare küçük kalır,
// lif dolu kare inceliğini korur. Tavan aşılırsa hedef bütün kareler için birlikte düşürülür, tabanın altına inilmez.
// WebP yalnızca posterde ve bölüm başına bir durağan karede: AVIF çözemeyen tarayıcı statik hikâyeyi görür.
// Kullanım: node scripts/story-encode.mjs [--in story/out] [--out public/story] [--aspect d,m]
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { readRgb, ssim } from "./image-metrics.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const IN = resolve(ROOT, args.in ?? "story/out");
const OUT = resolve(ROOT, args.out ?? "public/story");
const ASPECTS = (args.aspect ?? "d,m").split(",");

export const FRAMES_PER_SECTION = 30;
export const SECTIONS = 8;
// Tavan (bayt): STORY.md §5. Yalnızca AVIF dizisi; WebP durağan kareleri yayın boyutu testinde sayılır (M-18).
export const BUDGET = { d: 25e6, m: 12e6, firstSection: 3e6 };
// Kare başına SSIM (parlaklık, kendi PNG'sine karşı). 0,97: lif dolu karede ince lifler seçiliyor; 0,87'de siliniyordu
// (ölçüm state.json T3.5). Taban 0,95: tavan için hedef bundan aşağı inmez.
export const SSIM_TARGET = 0.97;
export const SSIM_FLOOR = 0.95;
const SSIM_STEP = 0.005;
const SIZE = { d: [1920, 1080], m: [1080, 1920] };
const STEP = { d: 1, m: 2 };
const AVIF_Q = [20, 90];
const WEBP_Q = [40, 95];
// sharp her kodlamada kendi iş parçacıklarını kullanır; SSIM ana iş parçacığında. 4 kare, makineyi doyurmaya yeter.
const WORKERS = 4;

async function frames(aspect) {
  const dir = join(IN, aspect);
  const names = (await readdir(dir).catch(() => [])).filter((n) => /^f_\d{4}\.png$/.test(n)).sort();
  return names.map((n) => ({ index: Number(n.slice(2, 6)), src: join(dir, n) }));
}

const encoders = {
  avif: (src, quality) => sharp(src).avif({ quality, effort: 6, chromaSubsampling: "4:2:0" }).toBuffer(),
  webp: (src, quality) => sharp(src).webp({ quality, effort: 5, smartSubsample: true }).toBuffer(),
};

/** Posterin ve her bölümün durağan karesi: bölümdeki karelerin ortancası (StaticStory bunları gösterir). */
export function stills(indices, perSection = FRAMES_PER_SECTION) {
  const bySection = new Map();
  for (const i of indices) {
    const s = Math.floor(i / perSection);
    bySection.set(s, [...(bySection.get(s) ?? []), i]);
  }
  return [...bySection.keys()].sort((a, b) => a - b).map((s) => {
    const list = bySection.get(s).sort((a, b) => a - b);
    return list[Math.floor(list.length / 2)];
  });
}

/** Bir karenin kodlayıcı belleği: denenen her kalitenin bayt ve SSIM'i. Hedef düşünce yeniden kodlamaya gerek kalmaz. */
function frameProbe(src, kind) {
  const memo = new Map();
  let ref = null;
  const probe = async (q) => {
    if (!memo.has(q)) {
      ref ??= await readRgb(src);
      const buf = await encoders[kind](src, q);
      memo.set(q, { q, bytes: buf.length, ssim: ssim(ref, await readRgb(buf)) });
    }
    return memo.get(q);
  };
  // Çözülmüş PNG ~6 MB; 240 karede bellekte tutulmaz, arama bitince bırakılır.
  probe.release = () => {
    ref = null;
  };
  return probe;
}

async function search(probe, range, target) {
  try {
    return await lowestPassing(probe, range, target);
  } finally {
    probe.release();
  }
}

/** Hedefe ulaşan en düşük kalite (ikili arama; SSIM kaliteyle artar). Hiçbiri ulaşmazsa en yüksek kalite. */
async function lowestPassing(probe, [min, max], target) {
  let [lo, hi] = [min, max];
  let best = null;
  while (lo <= hi) {
    const q = Math.floor((lo + hi) / 2);
    const m = await probe(q);
    if (m.ssim >= target) {
      best = m;
      hi = q - 1;
    } else lo = q + 1;
  }
  return best ?? probe(max);
}

async function pool(items, fn) {
  const out = Array(items.length);
  let k = 0;
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      while (k < items.length) {
        const i = k++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

function totals(list, picks, aspect) {
  const total = picks.reduce((s, p) => s + p.bytes, 0);
  const first = picks.reduce((s, p, i) => (list[i].index < FRAMES_PER_SECTION ? s + p.bytes : s), 0);
  // Henüz render edilmemiş bölümler varken toplam, tam diziye oranlanarak denetlenir.
  const projected = (total / picks.length) * ((SECTIONS * FRAMES_PER_SECTION) / STEP[aspect]);
  return { total, first, projected, fits: projected <= BUDGET[aspect] && first <= BUDGET.firstSection };
}

async function encodeAspect(aspect) {
  const list = await frames(aspect);
  if (!list.length) return null;
  const probes = list.map((f) => frameProbe(f.src, "avif"));
  let target = SSIM_TARGET;
  let picks;
  let sum;
  for (;;) {
    picks = await pool(list, (_, i) => search(probes[i], AVIF_Q, target));
    sum = totals(list, picks, aspect);
    const next = Math.round((target - SSIM_STEP) * 1e4) / 1e4;
    if (sum.fits || next < SSIM_FLOOR) break;
    console.log(`${aspect}: SSIM ${target} tavanı aşıyor (tam dizi ${(sum.projected / 1e6).toFixed(2)} MB, ilk bölüm ${(sum.first / 1e6).toFixed(2)} MB); hedef ${next}`);
    target = next;
  }
  if (!sum.fits) console.warn(`${aspect}: taban SSIM ${SSIM_FLOOR}'te bile tavan aşılıyor; story-budget testi düşecek`);

  const still = new Set([list[0].index, ...stills(list.map((f) => f.index))]);
  const outDir = join(OUT, aspect);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const out = await pool(list, async (f, i) => {
    const name = `f_${String(f.index).padStart(4, "0")}`;
    const a = await encoders.avif(f.src, picks[i].q);
    await writeFile(join(outDir, `${name}.avif`), a);
    let webp = null;
    if (still.has(f.index)) {
      const w = await search(frameProbe(f.src, "webp"), WEBP_Q, target);
      const buf = await encoders.webp(f.src, w.q);
      await writeFile(join(outDir, `${name}.webp`), buf);
      webp = { path: `${aspect}/${name}.webp`, bytes: buf.length };
    }
    return {
      index: f.index,
      avif: `${aspect}/${name}.avif`,
      webp: webp?.path ?? null,
      quality: picks[i].q,
      ssim: Math.round(picks[i].ssim * 1e4) / 1e4,
      bytes: { avif: a.length, webp: webp?.bytes ?? null },
    };
  });
  const [width, height] = SIZE[aspect];
  return {
    width,
    height,
    step: STEP[aspect],
    ssimTarget: target,
    stills: stills(list.map((f) => f.index)),
    bytes: {
      avif: sum.total,
      webp: out.reduce((s, f) => s + (f.bytes.webp ?? 0), 0),
      firstSectionAvif: sum.first,
      projectedAvif: Math.round(sum.projected),
    },
    frames: out,
  };
}

async function main() {
  const variants = {};
  for (const aspect of ASPECTS) {
    const t0 = performance.now();
    const v = await encodeAspect(aspect);
    if (!v) continue;
    variants[aspect] = v;
    const s = v.frames.map((f) => f.ssim).sort((a, b) => a - b);
    console.log(
      `${aspect}: ${v.frames.length} kare, SSIM hedefi ${v.ssimTarget} (en düşük ${s[0]}), AVIF ${(v.bytes.avif / 1e6).toFixed(2)} MB` +
        ` (tam dizi tahmini ${(v.bytes.projectedAvif / 1e6).toFixed(2)} MB), ilk bölüm ${(v.bytes.firstSectionAvif / 1e6).toFixed(2)} MB,` +
        ` WebP durağan ${(v.bytes.webp / 1e6).toFixed(2)} MB; ${((performance.now() - t0) / 1e3).toFixed(0)} s`,
    );
  }
  if (!Object.keys(variants).length) throw new Error(`Kare yok: ${IN}`);
  const manifest = {
    framesPerSection: FRAMES_PER_SECTION,
    sections: SECTIONS,
    budget: { ...BUDGET, ssimTarget: SSIM_TARGET, ssimFloor: SSIM_FLOOR },
    variants,
  };
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const s = await stat(join(OUT, "manifest.json"));
  console.log(`manifest.json ${s.size} B`);
}

// Testler bütçe sabitlerini içe aktarır; kodlama yalnızca komut satırından çalışır.
if (import.meta.main) await main();
