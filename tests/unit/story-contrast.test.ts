// Hikâye metni okunur (STORY.md §5): metin, yarı saydam zeminli kartın üstünde durur; kartın altında herhangi bir kare olabilir.
// Kartın bileşik zemini altındaki pikselle tekdüze değişir: parlaklığı, altı saf siyahken en düşük, saf beyazken en yüksektir.
// Metnin parlaklığı bu aralığın dışındaysa en kötü kontrast iki uçtan birindedir. İki uç her palette ≥ 4,5 ise
// hiçbir kare metni okunmaz kılamaz. Kanıt kare piksellerine bağlı değildir; ileride render edilen bölümler de kapsanır.
// Kareler paletten bağımsızdır (her bölüm kendi Wada rengini taşır); palete bağlı olan yalnızca kartın zemini ve metni.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, over, relativeLuminance } from "@/design/color";
import { paletteHex } from "@/design/tokens";

const MIN = 4.5;

// Kartın saydamlığı bileşenin kendisinden okunur: sınıf değişirse test de değişir.
const source = readFileSync(join(process.cwd(), "src/components/story/StoryPlayer.tsx"), "utf8");
const card = /function Card\b[\s\S]*?className="([^"]*)"/.exec(source)?.[1] ?? "";
const alpha = Number(/\bbg-bg\/(\d+)\b/.exec(card)?.[1]) / 100;

function worst(a: number) {
  const p = paletteHex();
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

  it("kartın altında en kötü kare olsa da metin ≥ 4,5", () => {
    const w = worst(alpha);
    expect(w.between, "metin parlaklığı bileşik zemin aralığında").toBe(false);
    expect(w.ratio, `saydamlık ${alpha}, en kötü kontrast ${w.ratio.toFixed(2)}`).toBeGreaterThanOrEqual(MIN);
  });

  // Ölçünün kendisi: çok saydam bir kart düşmeli, yoksa test hiçbir şeyi yakalamıyordur.
  it("ölçü kötü örneği yakalar: %40 opak kart < 4,5", () => {
    expect(worst(0.4).ratio).toBeLessThan(MIN);
  });
});
