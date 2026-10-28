// Görüntü ölçüleri (VERIFICATION.md): SSIM ve OKLab ΔE. Hikâye karelerinin sürekliliği, render kalitesi ve
// kodlama kaybı bunlarla sayıya çevrilir. Girdi: sharp'ın raw RGB(A) tamponu, 8 bit sRGB.
import sharp from "sharp";

/** Dosyayı (ya da tamponu) en fazla `maxWidth` genişlikte 8 bit RGB'ye açar. */
export async function readRgb(src, maxWidth = 0) {
  let img = sharp(src).removeAlpha().toColourspace("srgb");
  if (maxWidth) img = img.resize({ width: maxWidth, withoutEnlargement: true });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const LIN = Float32Array.from({ length: 256 }, (_, i) => toLinear(i / 255));

function oklab(r, g, b) {
  const R = LIN[r];
  const G = LIN[g];
  const B = LIN[b];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Piksel başına OKLab ΔE dağılımı: ortalama, p95, p99, en büyük. */
export function deltaE(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error("boyutlar farklı");
  const n = a.width * a.height;
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = oklab(a.data[3 * i], a.data[3 * i + 1], a.data[3 * i + 2]);
    const q = oklab(b.data[3 * i], b.data[3 * i + 1], b.data[3 * i + 2]);
    d[i] = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }
  const sorted = d.slice().sort();
  const at = (f) => sorted[Math.min(n - 1, Math.floor(f * n))];
  return { mean: d.reduce((s, x) => s + x, 0) / n, p95: at(0.95), p99: at(0.99), max: sorted[n - 1] };
}

function luma(img) {
  const n = img.width * img.height;
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = 0.299 * img.data[3 * i] + 0.587 * img.data[3 * i + 1] + 0.114 * img.data[3 * i + 2];
  return y;
}

// 11×11 Gauss (σ = 1,5), ayrılabilir: Wang ve ark. 2004'teki pencere.
const KERNEL = (() => {
  const k = Float32Array.from({ length: 11 }, (_, i) => Math.exp(-((i - 5) ** 2) / (2 * 1.5 ** 2)));
  const s = k.reduce((a, b) => a + b, 0);
  return k.map((v) => v / s);
})();

function blur(src, w, h) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -5; k <= 5; k++) s += KERNEL[k + 5] * src[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = s;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -5; k <= 5; k++) s += KERNEL[k + 5] * tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      out[y * w + x] = s;
    }
  return out;
}

/** Parlaklık kanalında ortalama SSIM (Wang ve ark. 2004; K1 = 0,01, K2 = 0,03, L = 255). */
export function ssim(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error("boyutlar farklı");
  const { width: w, height: h } = a;
  const x = luma(a);
  const y = luma(b);
  const n = w * h;
  const xx = new Float32Array(n);
  const yy = new Float32Array(n);
  const xy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xx[i] = x[i] * x[i];
    yy[i] = y[i] * y[i];
    xy[i] = x[i] * y[i];
  }
  const [mx, my, sxx, syy, sxy] = [x, y, xx, yy, xy].map((v) => blur(v, w, h));
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const vx = sxx[i] - mx[i] * mx[i];
    const vy = syy[i] - my[i] * my[i];
    const cxy = sxy[i] - mx[i] * my[i];
    sum += ((2 * mx[i] * my[i] + C1) * (2 * cxy + C2)) / ((mx[i] ** 2 + my[i] ** 2 + C1) * (vx + vy + C2));
  }
  return sum / n;
}
