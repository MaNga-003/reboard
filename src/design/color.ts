// Renk ölçümleri: WCAG 2 kontrastı, OKLab ΔE, OKLCh ton açısı, Machado 2009 renk körlüğü benzetimi.
// Testler ve palet önizleme sayfası aynı fonksiyonları kullanır; sayılar tek yerden gelir.

export type Rgb = readonly [number, number, number]; // 0–1, sRGB

export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Geçersiz hex: ${hex}`);
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (c: number) => Math.min(1, Math.max(0, c));

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type Oklab = readonly [number, number, number];

function linearToOklab([r, g, b]: Rgb): Oklab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklab(hex: string): Oklab {
  const [r, g, b] = hexToRgb(hex);
  return linearToOklab([toLinear(r), toLinear(g), toLinear(b)]);
}

export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** OKLCh: kroma ve derece cinsinden ton. */
export function oklch(hex: string): { l: number; c: number; h: number } {
  const [l, a, b] = oklab(hex);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

export function hueDifference(a: string, b: string): number {
  const d = Math.abs(oklch(a).h - oklch(b).h) % 360;
  return d > 180 ? 360 - d : d;
}

// Machado, Oliveira ve Fernandes (2009), şiddet 1,0; doğrusal RGB'de uygulanır.
const CVD = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const;

export type CvdKind = keyof typeof CVD;
export const CVD_KINDS = Object.keys(CVD) as CvdKind[];

export function simulateCvd(hex: string, kind: CvdKind): string {
  const lin = hexToRgb(hex).map(toLinear);
  const m = CVD[kind];
  const out = m.map((row) => clamp01(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]));
  return (
    "#" +
    out
      .map((c) => Math.round(toGamma(c) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Üç renk körlüğü türünde en küçük ΔE. */
export function minCvdDeltaE(a: string, b: string): number {
  return Math.min(...CVD_KINDS.map((k) => deltaE(simulateCvd(a, k), simulateCvd(b, k))));
}
