// M-26: pasaport QR'ı okunur. SVG yolu piksele çevrilir, sayfanın gerçek renkleriyle boyanır ve bağımsız bir
// çözücüyle (jsQR, ters çevirme kapalı) okunur. Okunan metin adresin kendisi olmalı; sessiz bölgede modül olmamalı.
import fc from "fast-check";
import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { QUIET, qrPath } from "@/components/passport/qr";
import { paletteHex } from "@/design/tokens";
import { contrastRatio, relativeLuminance } from "@/design/color";

const RUN = /M(\d+) (\d+)h(\d+)v1h-(\d+)z/g;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

type Patch = { x: number; y: number; s: number };

/** Yolu modül başına `scale` piksel olarak boyar; yol yalnızca yatay koşulardan oluşur. `erase` kare bir lekeyi zemin rengine boyar. */
function rasterize(text: string, scale = 4, colors = paletteHex(), erase?: Patch) {
  const { size, d } = qrPath(text);
  const w = size * scale;
  const px = new Uint8ClampedArray(w * w * 4);
  const [bg, fg] = [rgb(colors.bg), rgb(colors.text)];
  const dark = new Uint8Array(size * size);
  for (const m of d.matchAll(RUN)) {
    const [x, y, len, back] = m.slice(1).map(Number);
    expect(back).toBe(len);
    for (let i = 0; i < len; i++) dark[y * size + x + i] = 1;
  }
  if (erase) for (let y = erase.y; y < erase.y + erase.s; y++) dark.fill(0, y * size + erase.x, y * size + erase.x + erase.s);
  for (let py = 0; py < w; py++)
    for (let pxl = 0; pxl < w; pxl++) {
      const c = dark[Math.floor(py / scale) * size + Math.floor(pxl / scale)] ? fg : bg;
      px.set([...c, 255], (py * w + pxl) * 4);
    }
  return { px, w, size, dark };
}

const decode = (text: string, scale?: number) => {
  const { px, w } = rasterize(text, scale);
  return jsQR(px, w, w, { inversionAttempts: "dontInvert" })?.data ?? null;
};

const url = (host: string, code: string, count: number, head: string) => `https://${host}/tr/pasaport/${code}?a=${count}-${head}`;
const HEAD = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

describe("pasaport QR'ı (M-26)", () => {
  it("canlı adres biçimindeki bağlantı çözülür ve aynen geri okunur", () => {
    const text = url("reboard-lovat.vercel.app", "PL-2026-001", 37, HEAD);
    expect(decode(text)).toBe(text);
  });

  it("rastgele lot, çapa ve sunucu adlarında çözülen metin adresin kendisi", () => {
    fc.assert(
      fc.property(
        fc.domain(),
        fc.integer({ min: 2020, max: 2099 }),
        fc.integer({ min: 1, max: 999_999 }),
        fc.integer({ min: 1, max: 99_999 }),
        fc.string({ unit: fc.constantFrom(..."0123456789abcdef"), minLength: 64, maxLength: 64 }),
        (host, year, n, count, head) => {
          const text = url(host, `PL-${year}-${String(n).padStart(3, "0")}`, count, head);
          expect(decode(text)).toBe(text);
        },
      ),
      { numRuns: 40 },
    );
  });

  // Sabit değil boşluğun kendisi ölçülür: QUIET küçülse de test ISO/IEC 18004'ün 4 modülünü ister.
  it("sessiz bölge boş: her yanda en az 4 modül", () => {
    const { size, dark } = rasterize(url("reboard-lovat.vercel.app", "PL-2026-001", 37, HEAD), 1);
    let [minX, minY, maxX, maxY] = [size, size, -1, -1];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if (dark[y * size + x]) [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
    expect(Math.min(minX, minY, size - 1 - maxX, size - 1 - maxY)).toBeGreaterThanOrEqual(4);
    expect(QUIET).toBe(4);
  });

  it("canlı adres sürüm 8'i aşmaz: 360 px ekranda 240 px'lik QR'da modül ≥ 4 px", () => {
    const { size, version } = qrPath(url("reboard-lovat.vercel.app", "PL-2026-001", 999, HEAD));
    expect(version).toBeLessThanOrEqual(8);
    expect(240 / size).toBeGreaterThanOrEqual(4);
  });

  // Basılı etiket çizilir, lekelenir. Ölçülen (canlı adres, 999. olay): M düzeyinde kare leke sembol alanının %8,2'sine kadar
  // veri bölgesinin her konumunda okunuyor (54/54), %9,4'te 53/54. L düzeyinde %5,9'da 20/40, %7,2'de 2/35. Eşik %7: M geçer, L düşer.
  it("lekeye dayanır: sembol alanının %7'si kadar kare leke veri bölgesinin her konumunda okunur", () => {
    const text = url("reboard-lovat.vercel.app", "PL-2026-001", 999, HEAD);
    const n = qrPath(text).size - 2 * QUIET;
    const s = Math.ceil(Math.sqrt(0.07) * n);
    const misses: string[] = [];
    let tried = 0;
    // Konum desenlerinin dışı: üstte ve altta 9 modül, solda 9 modül boşluk.
    for (let y = 9; y + s <= n - 9; y += 3)
      for (let x = 9; x + s <= n - 1; x += 3) {
        tried++;
        const { px, w } = rasterize(text, 4, paletteHex(), { x: x + QUIET, y: y + QUIET, s });
        if (jsQR(px, w, w, { inversionAttempts: "dontInvert" })?.data !== text) misses.push(`${x},${y}`);
      }
    expect(tried).toBeGreaterThan(30);
    expect(misses, `${s}×${s} leke, ${misses.length}/${tried} konumda okunmadı`).toEqual([]);
  });

  // ISO/IEC 15415 sembol kontrastı SC = Rmax − Rmin; yansıma yerine göreli parlaklık. ≥ 0,55 "B" derecesi ve üstü.
  // Ters QR'ı birçok okuyucu çözemez: modül zeminden koyu olmalı. Ölçülen SC 0,601: eşiğe yakın, yani mavi açılırsa test düşer.
  it("ana palette sembol kontrastı ≥ 0,55, modül zeminden koyu ve QR o renklerle çözülür", () => {
    const text = url("reboard-lovat.vercel.app", "PL-2026-001", 37, HEAD);
    const c = paletteHex();
    const sc = relativeLuminance(c.bg) - relativeLuminance(c.text);
    expect(sc, `SC ${sc.toFixed(3)}, WCAG ${contrastRatio(c.text, c.bg).toFixed(2)}`).toBeGreaterThanOrEqual(0.55);
    const { px, w } = rasterize(text, 4, c);
    expect(jsQR(px, w, w, { inversionAttempts: "dontInvert" })?.data ?? null).toBe(text);
  });

  it("metrik kendini sınar: bir modül satırı kayınca çözücü okuyamaz", () => {
    const text = url("reboard-lovat.vercel.app", "PL-2026-001", 37, HEAD);
    const { px, w } = rasterize(text, 4);
    // Konum desenlerinden birini sil: QR artık bulunamamalı.
    for (let y = QUIET * 4; y < (QUIET + 7) * 4; y++) for (let x = QUIET * 4; x < (QUIET + 7) * 4; x++) px.set([255, 255, 255, 255], (y * w + x) * 4);
    expect(jsQR(px, w, w, { inversionAttempts: "dontInvert" })?.data ?? null).not.toBe(text);
  });
});
