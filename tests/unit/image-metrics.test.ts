// Ölçünün kendisi sınanır: özdeş görüntü tam puan alır, bulanıklık ve renk kayması yakalanır.
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { deltaE, readRgb, ssim } from "../../scripts/image-metrics.mjs";

// Ayrıntılı bir desen: dama tahtası üstünde gürültü; SSIM'in yapı terimini sınar.
async function pattern(w = 160, h = 90) {
  const raw = Buffer.alloc(w * h * 3);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const base = ((x >> 3) + (y >> 3)) % 2 ? 200 : 60;
      const i = 3 * (y * w + x);
      raw[i] = base + rnd() * 40;
      raw[i + 1] = base * 0.8 + rnd() * 40;
      raw[i + 2] = base * 0.5 + rnd() * 40;
    }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

describe("image-metrics", () => {
  it("özdeş görüntü: SSIM 1, ΔE 0", async () => {
    const a = await readRgb(await pattern());
    expect(ssim(a, a)).toBeCloseTo(1, 6);
    expect(deltaE(a, a).max).toBe(0);
  });

  it("bulanıklık SSIM'i düşürür; daha çok bulanıklık daha çok düşürür", async () => {
    const png = await pattern();
    const a = await readRgb(png);
    const soft = await readRgb(await sharp(png).blur(0.8).toBuffer());
    const blurry = await readRgb(await sharp(png).blur(3).toBuffer());
    expect(ssim(a, soft)).toBeLessThan(0.95);
    expect(ssim(a, blurry)).toBeLessThan(ssim(a, soft));
  });

  it("düz renk kayması ΔE'de görünür: OKLab'da beyaz ile siyah 1", async () => {
    const solid = (v: number) => sharp({ create: { width: 8, height: 8, channels: 3, background: { r: v, g: v, b: v } } }).png().toBuffer();
    const d = deltaE(await readRgb(await solid(255)), await readRgb(await solid(0)));
    expect(d.mean).toBeCloseTo(1, 3);
  });
});
