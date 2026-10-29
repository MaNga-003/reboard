#!/usr/bin/env node
// 8. bölümün zaman eğrisi (s8_earth.PACE). Sonda (story/blender/pace_probe.py) log genişlikte eşit adımlı küçük
// kareler üretir; her kare çiftinin farkı (M-10'un küçük resim ΔE'si) bu karelerin arasından kestirilir. Kesmedeki ve
// sondaki adım şimdiki tablodan alınır (camera_path lib.soft ile denetler); aradakiler, fark dizisinin ve zoom hızının
// ikinci farkları en az ve dedektörün üç oranı 1.–7. bölümün sağlam uçlarına yakın kalacak biçimde seçilir.
// Kullanım: node scripts/story-pace.mjs [--probe] [--in story/cache/pace] [--aspect d,m]
//   --probe sondayı önce Blender'la render eder (iki en-boy oranı ~20 dk). Çıktı: yeni PACE tablosu ve kestirimler.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readRgb, deltaE } from "./image-metrics.mjs";
import { JUMP, THUMB_WIDTH, findJumps } from "./story-continuity.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") ? true : (all[i + 1] ?? true)]] : acc), []),
);
const IN = resolve(ROOT, typeof args.in === "string" ? args.in : "story/cache/pace");
const ASPECTS = (typeof args.aspect === "string" ? args.aspect : "d,m").split(",");
const BLENDER = process.env.BLENDER ?? (process.platform === "win32" ? "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe" : "blender");

// Hedef oranlar: 1.–7. bölümün sağlam uçları (M-10) masaüstü basamak ×1,07, k–k+2 ×0,95, tümsek ×1,04; mobil ×1,19,
// ×0,81, ×1,18. Mobil yalnız çift kareleri gösterir; iki gösterilen kare arasında zoom daha büyük olabilir.
const GOAL = { d: { step: 1.08, frame: 0.92, bump: 1.08 }, m: { step: 1.15, frame: 0.82, bump: 1.18 } };
const CAP = { d: 2.25, m: 5.5 };
const STRIDE = { d: 1, m: 2 };
// Zoom hızının pürüzsüzlük ağırlığı: 0,15'te hız kareden kareye ±%20 oynuyordu, 10'da basamak ×1,20'ye çıktı; 1 ikisini dengeler.
const W_SPEED = 1;

/** s8_earth.py içindeki PACE tablosu. */
function currentPace() {
  const src = readFileSync(join(ROOT, "story", "blender", "s8_earth.py"), "utf8");
  const block = /^PACE = \{([\s\S]*?)^\}/m.exec(src)?.[1];
  if (!block) throw new Error("s8_earth.py: PACE tablosu yok");
  return Object.fromEntries([...block.matchAll(/"([dm])": \(([^)]*)\)/g)].map((m) => [m[1], m[2].split(",").map(Number)]));
}

function thumbAt(thumbs) {
  const cache = new Map();
  return (u) => {
    const key = Math.round(u * 1e6);
    if (!cache.has(key)) {
      const x = Math.min(Math.max(u, 0), 1) * (thumbs.length - 1);
      const i = Math.min(Math.floor(x), thumbs.length - 2);
      const f = x - i;
      const A = thumbs[i].data;
      const B = thumbs[i + 1].data;
      const data = Buffer.alloc(A.length);
      for (let p = 0; p < A.length; p++) data[p] = Math.round(A[p] * (1 - f) + B[p] * f);
      cache.set(key, { data, width: thumbs[i].width, height: thumbs[i].height });
    }
    return cache.get(key);
  };
}

function series(U, at) {
  const t = U.map(at);
  return {
    d: t.slice(1).map((x, k) => deltaE(t[k], x).mean),
    skip: t.slice(2).map((x, k) => deltaE(t[k], x).mean),
  };
}

function ratios(d, skip) {
  const inner = (k) => k > 0 && k < d.length - 1;
  return {
    step: d.map((x, k) => (inner(k) ? x / Math.max(d[k - 1], d[k + 1]) : 0)),
    frame: skip.map((x, k) => x / Math.max(d[k], d[k + 1])),
    bump: d.slice(0, -1).map((x, k) => (k > 0 && k + 2 < d.length ? Math.min(x, d[k + 1]) / Math.max(d[k - 1], d[k + 2]) : 0)),
  };
}

function report(label, aspect, U, at, L) {
  const { d, skip } = series(U, at);
  const r = ratios(d, skip);
  const jumps = findJumps(d, skip, JUMP[aspect]).map((j) => `${j.kind} ${j.at} ×${j.ratio.toFixed(2)}`);
  console.log(`${aspect} ${label}: basamak ×${Math.max(...r.step).toFixed(2)}, k–k+2 ×${Math.min(...r.frame).toFixed(2)}, tümsek ×${Math.max(...r.bump).toFixed(2)}; sıçrama ${jumps.join(", ") || "yok"}`);
  console.log(`   ΔE ${d.map((x) => x.toFixed(3)).join(" ")}`);
  console.log(`   zoom ×${U.slice(1).map((u, i) => Math.exp((u - U[i]) * L).toFixed(2)).join(" ")}`);
}

function fit(aspect, shown, at, L) {
  const n = shown.length - 1;
  const first = shown[1] - shown[0];
  const last = shown[n] - shown[n - 1];
  const cap = Math.log(CAP[aspect]) / L;
  const goal = GOAL[aspect];
  const build = (v) => {
    const mid = v.slice(1, -1).map(Math.exp);
    const scale = (1 - first - last) / mid.reduce((a, b) => a + b, 0);
    const steps = [first, ...mid.map((x) => x * scale), last];
    const U = [0];
    for (const x of steps) U.push(U.at(-1) + x);
    return { U, steps };
  };
  const cost = (v) => {
    const { U, steps } = build(v);
    const { d, skip } = series(U, at);
    const ld = d.map(Math.log);
    const ls = steps.map(Math.log);
    let j = 0;
    for (let i = 1; i < ld.length - 1; i++) j += (ld[i + 1] - 2 * ld[i] + ld[i - 1]) ** 2;
    for (let i = 1; i < ls.length - 1; i++) j += W_SPEED * (ls[i + 1] - 2 * ls[i] + ls[i - 1]) ** 2;
    for (const x of steps) if (x > cap) j += 50 * ((x - cap) * L) ** 2;
    const r = ratios(d, skip);
    for (const x of r.step) if (x > goal.step) j += 20 * (x - goal.step) ** 2;
    for (const x of r.frame) if (x < goal.frame) j += 20 * (goal.frame - x) ** 2;
    for (const x of r.bump) if (x > goal.bump) j += 20 * (x - goal.bump) ** 2;
    return j;
  };
  // Koordinat araması: her iç adımın log'u küçülen adımlarla oynatılır.
  let v = shown.slice(1).map((u, i) => Math.log(u - shown[i]));
  let best = cost(v);
  for (let h = 0.3; h > 0.005; h *= 0.6) {
    for (let it = 0, improved = true; improved && it < 60; it++) {
      improved = false;
      for (let i = 1; i < v.length - 1; i++)
        for (const s of [h, -h]) {
          const w = v.slice();
          w[i] += s;
          const c = cost(w);
          if (c < best - 1e-12) [best, v, improved] = [c, w, true];
        }
    }
  }
  return build(v).U;
}

if (args.probe) {
  for (const aspect of ASPECTS) {
    const r = spawnSync(BLENDER, ["-b", "--factory-startup", "-P", "story/blender/pace_probe.py", "--", "--aspect", aspect, "--out", IN], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0) throw new Error(`sonda ${aspect}: Blender ${r.status}`);
  }
}

const pace = currentPace();
for (const aspect of ASPECTS) {
  const meta = join(IN, aspect, "probe.json");
  if (!existsSync(meta)) throw new Error(`${meta} yok: önce --probe`);
  const { f0, steps, w0, w1 } = JSON.parse(readFileSync(meta, "utf8"));
  const thumbs = await Promise.all(
    Array.from({ length: steps + 1 }, (_, j) => readRgb(join(IN, aspect, `f_${String(f0 + j).padStart(4, "0")}.png`), THUMB_WIDTH[aspect])),
  );
  const at = thumbAt(thumbs);
  const L = Math.log(w1 / w0);
  const shown = pace[aspect].filter((_, i) => i % STRIDE[aspect] === 0);
  report("şimdiki tablo (kestirim)", aspect, shown, at, L);
  const U = fit(aspect, shown, at, L);
  report("yeni tablo (kestirim)", aspect, U, at, L);
  const s = STRIDE[aspect];
  const full = pace[aspect].map((_, i) => (i % s === 0 ? U[i / s] : (U[(i - 1) / s] + U[(i + 1) / s]) / 2));
  console.log(`   "${aspect}": (${full.map((x) => x.toFixed(5)).join(", ")}),`);
}
