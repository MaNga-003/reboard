#!/usr/bin/env node
// Kare dizisinin sürekliliği (M-10, STORY.md §5). İki ölçü:
// 1. Sıçrama: ardışık iki karenin farkı iki komşu farkın ikisinden de çok büyükse kare atlanmış, bir nesne belirmiş
//    ya da ışık sıçramıştır. Fark küçük önizlemede (32 × 18 piksel) piksel başına OKLab ΔE ortalamasıdır: ince doku
//    (lif, örgü) her karede kayar, tam çözünürlükte SSIM ardışık karelerde bile 0,05'e iner ve sıçramayı ayırt
//    edemez. 64 px'te bile hızlı bölümde içerik bir adımda değişir (altı kare ötesi ardışık kare kadar uzak); 32 px'te
//    fark adım sayısıyla büyür, ışık ve büyük yapı kalır. Mobil iki karede bir adım atar, 9 px'e iner. Tek kare
//    bozuksa (k+1 dizinin dışında) iki fark birden büyür. İki yoldan yakalanır: k ile k+2 karşılaştırılır (k+2,
//    k+1'e göre k'ye çok daha yakınsa k+1 aradan çıkmıştır) ya da iki farkın küçüğü dıştaki iki komşu farkın
//    büyüğünü aşar (tümsek). Hızlı bölümde fark birkaç adımda doyar (mobilde 1, 2 ve 6 adım: 0,12, 0,18, 0,24);
//    k–k+2 yolu o zaman kör kalır, tümsek kalmaz. Fark tabanın altındaysa (gürültü, duraklama) bakılmaz: bölüm
//    sınırındaki bir karelik duraklama ve mobilin onu atlayan yarım adımı sıçrama sayılmaz.
// 2. Bölüm sınırı. Masaüstünde kareler ardışıktır: önceki bölümün son karesi ile sonrakinin ilki aynı görüntüdür
//    (bir karelik duraklama). Dört ölçü, 480 px genişlikte (AVIF'te iki kare ayrı sıkıştırılır; tam çözünürlükte
//    kodlama farkı ölçüye girerdi): ham SSIM; yapı SSIM'i (her kanal kendi ortalama ve sapmasıyla eşlenince);
//    ortalama renk farkı (OKLab ΔE); parlaklık eğimi (8 satır ve 8 sütun bandında L profilinin ortalaması çıkarılmış
//    RMS farkı). Mobil yalnız çift kareleri gösterir: sınır çifti duraklamayı atlar, içinde tek karelik hareket kalır;
//    farkı komşu (iki karelik) adımlardan küçük olmalıdır.
// Kullanım: node scripts/story-continuity.mjs [--in public/story | story/out] [--aspect d,m]
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { deltaE, lightProfiles, meanOklab, normalise, readRgb, slopeRms, ssim } from "./image-metrics.mjs";

export const THUMB_WIDTH = { d: 32, m: 9 };
export const CUT_WIDTH = 480;
// Eşikler: kalibrasyon VERIFICATION.md M-10'da. Sıçrama eşikleri sağlam dizinin uç oranlarından ~%15 pay bırakır;
// mobil iki karede bir adım attığı için ardışık kareleri daha az benzer, eşiği gevşektir.
export const CUT = { ssimRaw: 0.99, ssimStructure: 0.99, dE: 0.004, slope: 0.008 };
export const SEAM = 0.95;
export const JUMP = {
  d: { floor: 0.004, step: 1.25, frame: 0.82, bump: 1.2 },
  m: { floor: 0.004, step: 1.37, frame: 0.7, bump: 1.36 },
};

/** Önizlemeler arası farklar: d[k] k ile k+1, skip[k] k ile k+2 (piksel başına OKLab ΔE ortalaması). */
export function pairSeries(thumbs) {
  return {
    d: thumbs.slice(1).map((t, k) => deltaE(thumbs[k], t).mean),
    skip: thumbs.slice(2).map((t, k) => deltaE(thumbs[k], t).mean),
  };
}

/** Sıralı karelerde bölüm değişen ardışık çiftler: [önceki sıra, sonraki sıra]. */
export function boundaryPairs(indices, framesPerSection) {
  const out = [];
  for (let k = 1; k < indices.length; k++)
    if (Math.floor(indices[k] / framesPerSection) !== Math.floor(indices[k - 1] / framesPerSection)) out.push([k - 1, k]);
  return out;
}

/**
 * d[k]: k ile k+1'in farkı; skip[k]: k ile k+2'nin farkı. Dönüş: sıçrayan çiftler (step, k → k+1; oran = fark ÷
 * komşu farkların büyüğü) ve dizinin dışında kalan kareler: frame (k+1; oran = k–k+2 farkı ÷ çift farkların büyüğü)
 * ve bump (k+1; oran = d[k] ile d[k+1]'in küçüğü ÷ d[k-1] ile d[k+2]'nin büyüğü).
 */
export function findJumps(d, skip, { floor, step, frame, bump }) {
  const out = [];
  for (let k = 0; k < d.length; k++) {
    if (d[k] < floor) continue;
    const near = Math.max(d[k - 1] ?? 0, d[k + 1] ?? 0);
    if (d[k] > step * near) out.push({ kind: "step", at: k, ratio: d[k] / near });
  }
  for (let k = 0; k < skip.length; k++) {
    const pair = Math.max(d[k], d[k + 1]);
    if (pair < floor) continue;
    if (skip[k] < frame * pair) out.push({ kind: "frame", at: k + 1, ratio: skip[k] / pair });
  }
  for (let k = 1; k + 2 < d.length; k++) {
    const pair = Math.min(d[k], d[k + 1]);
    if (pair < floor) continue;
    const outer = Math.max(d[k - 1], d[k + 2]);
    if (pair > bump * outer) out.push({ kind: "bump", at: k + 1, ratio: pair / outer });
  }
  return out;
}

/** İki karenin kesme ölçüleri (tam çözünürlük). */
export function cutMetrics(a, b) {
  const A = meanOklab(a);
  const B = meanOklab(b);
  const pa = lightProfiles(a);
  const pb = lightProfiles(b);
  return {
    ssimRaw: ssim(a, b),
    ssimStructure: ssim(normalise(a), normalise(b)),
    dE: Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]),
    slope: Math.max(slopeRms(pa.rows, pb.rows), slopeRms(pa.cols, pb.cols)),
  };
}

/**
 * Kare listesi: dizinde manifest varsa AVIF'ler, yoksa ham PNG'ler (story/out/{aspect}/f_*.png).
 * @returns {{ index: number, path: string }[]}
 */
export function listFrames(dir, aspect) {
  const man = join(dir, "manifest.json");
  if (existsSync(man)) {
    const v = JSON.parse(readFileSync(man, "utf8")).variants[aspect];
    return v ? v.frames.map((f) => ({ index: f.index, path: join(dir, f.avif) })) : [];
  }
  const sub = join(dir, aspect);
  if (!existsSync(sub)) return [];
  return readdirSync(sub)
    .filter((n) => /^f_\d{4}\.png$/.test(n))
    .sort()
    .map((n) => ({ index: Number(n.slice(2, 6)), path: join(sub, n) }));
}

/** Mobil dikiş: sınır çiftinin farkı ÷ komşu çiftlerin büyüğü. */
export function seamRatio(d, a) {
  return d[a] / Math.max(d[a - 1] ?? 0, d[a + 1] ?? 0);
}

/**
 * Dizinin bütün ölçüleri. Önizlemeler küçük; sınır kareleri yalnız ölçülürken 480 px'te açılır.
 * @param {{ index: number, path: string }[]} frames
 * @param {"d" | "m"} aspect
 * @param {number} framesPerSection
 */
export async function measure(frames, aspect, framesPerSection, width = THUMB_WIDTH[aspect]) {
  const thumbs = await Promise.all(frames.map((f) => readRgb(f.path, width)));
  const { d, skip } = pairSeries(thumbs);
  const cuts = [];
  const seams = [];
  for (const [a, b] of boundaryPairs(frames.map((f) => f.index), framesPerSection)) {
    const pair = { from: frames[a].index, to: frames[b].index, at: a };
    if (frames[b].index - frames[a].index !== 1) {
      seams.push({ ...pair, ratio: seamRatio(d, a) });
      continue;
    }
    const [A, B] = await Promise.all([readRgb(frames[a].path, CUT_WIDTH), readRgb(frames[b].path, CUT_WIDTH)]);
    cuts.push({ ...pair, ...cutMetrics(A, B) });
  }
  return { indices: frames.map((f) => f.index), thumbs, d, skip, cuts, seams };
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
  );
  const dir = resolve(import.meta.dirname, "..", args.in ?? "public/story");
  for (const aspect of (args.aspect ?? "d,m").split(",")) {
    const frames = listFrames(dir, aspect);
    if (frames.length < 3) continue;
    const t0 = performance.now();
    const m = await measure(frames, aspect, 30, args.width ? Number(args.width) : undefined);
    const at = (k) => m.indices[k];
    const sorted = [...m.d].sort((a, b) => a - b);
    const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].toFixed(4);
    // Kalibrasyon: tabanın üstündeki çiftlerde komşuya oran ve k–k+2 oranı, en uç değerler.
    const floor = JUMP[aspect].floor;
    const steps = m.d
      .map((v, k) => ({ k, v, r: v / Math.max(m.d[k - 1] ?? 0, m.d[k + 1] ?? 0) }))
      .filter((s) => s.v >= floor)
      .sort((a, b) => b.r - a.r)
      .slice(0, 8)
      .map(({ k, v, r }) => `${at(k)}→${at(k + 1)} ${v.toFixed(4)} ×${r.toFixed(2)}`);
    const triples = m.skip
      .map((v, k) => ({ k, r: v / Math.max(m.d[k], m.d[k + 1]), pair: Math.max(m.d[k], m.d[k + 1]) }))
      .filter((s) => s.pair >= floor)
      .sort((a, b) => a.r - b.r)
      .slice(0, 8)
      .map(({ k, r, pair }) => `${at(k + 1)} ×${r.toFixed(2)} (${pair.toFixed(4)})`);
    const bumps = findJumps(m.d, m.skip, { floor, step: Infinity, frame: 0, bump: 0 })
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 8)
      .map((j) => `${at(j.at)} ×${j.ratio.toFixed(2)}`);
    console.log(`${aspect}: ${frames.length} kare, ${((performance.now() - t0) / 1e3).toFixed(0)} s`);
    console.log(`  ardışık ΔE: ortanca ${q(0.5)}, p10 ${q(0.1)}, p90 ${q(0.9)}, en büyük ${q(1)}`);
    console.log(`  komşusuna en çok fark atan çiftler: ${steps.join("; ")}`);
    console.log(`  k–k+2 farkının çifte en küçük oranı: ${triples.join("; ")}`);
    console.log(`  iki farkın dıştaki komşulara en büyük oranı (tümsek): ${bumps.join("; ")}`);
    for (const c of m.cuts)
      console.log(
        `  kesme ${c.from}→${c.to}: ham ${c.ssimRaw.toFixed(4)}, yapı ${c.ssimStructure.toFixed(4)}, ΔE ${c.dE.toFixed(4)}, eğim ${c.slope.toFixed(4)}`,
      );
    for (const s of m.seams) console.log(`  dikiş ${s.from}→${s.to}: komşu adımın ×${s.ratio.toFixed(2)}`);
    const jumps = findJumps(m.d, m.skip, JUMP[aspect]).map((j) => `${j.kind} ${at(j.at)} ×${j.ratio.toFixed(2)}`);
    console.log(`  sıçrama (eşiklerle): ${jumps.length ? jumps.join("; ") : "yok"}`);
  }
}

if (import.meta.main) await main();
