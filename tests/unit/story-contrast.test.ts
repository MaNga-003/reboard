// Hikâye metni okunur (STORY.md §5): metin, yarı saydam zeminli kartın üstünde durur; kartın altında herhangi bir kare olabilir.
// Kartın bileşik zemini altındaki pikselle tekdüze değişir: parlaklığı, altı saf siyahken en düşük, saf beyazken en yüksektir.
// Metnin parlaklığı bu aralığın dışındaysa en kötü kontrast iki uçtan birindedir. İki uç her palette ≥ 4,5 ise
// hiçbir kare metni okunmaz kılamaz. Kanıt kare piksellerine bağlı değildir; ileride render edilen bölümler de kapsanır.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, over, relativeLuminance } from "@/design/color";
import { PALETTES, paletteHex, type PaletteId } from "@/design/tokens";

const MIN = 4.5;
const ids = Object.keys(PALETTES) as PaletteId[];

// Kartın saydamlığı bileşenin kendisinden okunur: sınıf değişirse test de değişir.
const source = readFileSync(join(process.cwd(), "src/components/story/StoryPlayer.tsx"), "utf8");
const card = /function Card\b[\s\S]*?className="([^"]*)"/.exec(source)?.[1] ?? "";
const alpha = Number(/\bbg-bg\/(\d+)\b/.exec(card)?.[1]) / 100;

function worst(id: PaletteId, a: number) {
  const p = paletteHex(id);
  const [dark, light] = [over(p.bg, a, "#000000"), over(p.bg, a, "#ffffff")];
  const lt = relativeLuminance(p.text);
  const between = lt >= relativeLuminance(dark) && lt <= relativeLuminance(light);
  return { between, ratio: between ? 1 : Math.min(contrastRatio(p.text, dark), contrastRatio(p.text, light)) };
}

describe("hikâye kartı", () => {
  it("zemini bg tokenı ve yarı saydam, metni fg tokenı", () => {
    expect(card, "StoryPlayer.tsx içinde Card sınıfı bulunamadı").toContain("text-fg");
    expect(alpha, `bg-bg/NN okunamadı: "${card}"`).toBeGreaterThan(0);
    expect(alpha).toBeLessThanOrEqual(1);
  });

  it.each(ids)("palet %s: kartın altında en kötü kare olsa da metin ≥ 4,5", (id) => {
    const w = worst(id, alpha);
    expect(w.between, `${id}: metin parlaklığı bileşik zemin aralığında`).toBe(false);
    expect(w.ratio, `${id}: saydamlık ${alpha}, en kötü kontrast ${w.ratio.toFixed(2)}`).toBeGreaterThanOrEqual(MIN);
  });

  // Ölçünün kendisi: çok saydam bir kart en az bir palette düşmeli, yoksa test hiçbir şeyi yakalamıyordur.
  it("ölçü kötü örneği yakalar: %40 opak kart en az bir palette < 4,5", () => {
    expect(Math.min(...ids.map((id) => worst(id, 0.4).ratio))).toBeLessThan(MIN);
  });
});
