// Token kataloğu ölçümleri (M-1 metin kısmı, M-8 durum kısmı). Paletler ve durumlar dolaşılır: eklenen her öğe kendiliğinden denetlenir.
import { describe, expect, it } from "vitest";
import { contrastRatio, deltaE, hueDifference, minCvdDeltaE } from "@/design/color";
import { PALETTES, STATUS, WADA, cssVariables, paletteHex, statusHex, type PaletteId, type StatusName } from "@/design/tokens";

const ids = Object.keys(PALETTES) as PaletteId[];
const names = Object.keys(STATUS) as StatusName[];
const pairs = names.flatMap((a, i) => names.slice(i + 1).map((b) => [a, b] as const));
const fmt = (n: number) => n.toFixed(3);

// Eşikler (DESIGN_SYSTEM §3):
// - Çip yazısı normal metindir: WCAG ≥ 4,5. Kenarlık metin rengindedir ve arayüz öğesidir: zemine ≥ 3.
// - Dolgu zeminden seçilmeli: ΔE ≥ 0,1 (göz eşiği ≈ 0,02'nin 5 katı; en kötü ölçülen C/ok 0,109).
// - Durumlar birbirinden: ton ≥ 30°, ΔE ≥ 0,15 (aynı ailenin değişkeni eşiği), CVD ≥ 0,1.
//   Kategori eşiği 0,25 burada aranmaz: durum hiçbir zaman yalnızca renkle anlatılmaz (simge + yazı).
//   Zemine 3:1 tutan koyu üçlüler CVD'de en çok 0,089'a ulaştı; açık dolgu + kenarlık bu yüzden seçildi.
const MIN = { text: 4.5, ui: 3, fillVsBg: 0.1, hue: 30, deltaE: 0.15, cvd: 0.1 };

describe("renkler Wada sözlüğünden", () => {
  it("her rol ve durum adı sözlükte var ve hex'i sözlükteki", () => {
    const hexes = new Set(WADA.map((c) => c.hex));
    for (const id of ids) for (const [role, hex] of Object.entries(paletteHex(id))) expect(hexes.has(hex), `${id}.${role} ${hex}`).toBe(true);
    for (const n of names) expect(hexes.has(statusHex()[n].fill), n).toBe(true);
  });

  it("CSS değişkenleri tokenlardan; durumların hepsi yayımlanır", () => {
    const vars = cssVariables();
    for (const n of names) {
      expect(vars[`--rb-${n}`]).toBe(statusHex()[n].fill);
      expect(vars[`--rb-on-${n}`]).toBe(statusHex()[n].on);
    }
  });
});

describe.each(ids)("palet %s", (id) => {
  const p = paletteHex(id);
  const s = statusHex(id);

  it("gövde metni zemine ≥ 4,5", () => expect(contrastRatio(p.text, p.bg)).toBeGreaterThanOrEqual(MIN.text));

  it.each(names)("durum %s: çip yazısı dolguya ≥ 4,5, kenarlık zemine ≥ 3, dolgu zeminden ΔE ≥ 0,1", (n) => {
    const onFill = contrastRatio(s[n].on, s[n].fill);
    expect(onFill, `${id}.${n} yazı/dolgu ${onFill.toFixed(2)}`).toBeGreaterThanOrEqual(MIN.text);
    expect(contrastRatio(p.text, p.bg)).toBeGreaterThanOrEqual(MIN.ui);
    const vsBg = deltaE(s[n].fill, p.bg);
    expect(vsBg, `${id}.${n} dolgu/zemin ΔE ${fmt(vsBg)}`).toBeGreaterThanOrEqual(MIN.fillVsBg);
  });
});

describe("durumlar birbirinden ayrışır", () => {
  const s = statusHex();
  it.each(pairs)("%s ~ %s: ton ≥ 30°, ΔE ≥ 0,15, renk körlüğünde ΔE ≥ 0,1", (a, b) => {
    const [x, y] = [s[a].fill, s[b].fill];
    expect(hueDifference(x, y), `${a}~${b} ton ${hueDifference(x, y).toFixed(1)}°`).toBeGreaterThanOrEqual(MIN.hue);
    expect(deltaE(x, y), `${a}~${b} ΔE ${fmt(deltaE(x, y))}`).toBeGreaterThanOrEqual(MIN.deltaE);
    expect(minCvdDeltaE(x, y), `${a}~${b} CVD ${fmt(minCvdDeltaE(x, y))}`).toBeGreaterThanOrEqual(MIN.cvd);
  });
});
