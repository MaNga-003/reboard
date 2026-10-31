// Token kataloğu ölçümleri (M-1 metin kısmı, M-8 durum kısmı). Roller ve durumlar dolaşılır: eklenen her öğe kendiliğinden denetlenir.
import { describe, expect, it } from "vitest";
import { contrastRatio, deltaE, hueDifference, minCvdDeltaE } from "@/design/color";
import { PALETTE, STATUS, WADA, cssVariables, paletteHex, statusHex, wadaHex, type StatusName } from "@/design/tokens";

const names = Object.keys(STATUS) as StatusName[];
const pairs = names.flatMap((a, i) => names.slice(i + 1).map((b) => [a, b] as const));
const fmt = (n: number) => n.toFixed(3);

// Eşikler (DESIGN_SYSTEM §3):
// - Çip yazısı normal metindir: WCAG ≥ 4,5. Kenarlık metin rengindedir ve arayüz öğesidir: zemine ≥ 3.
// - Düğme yazısı normal metindir (16 px yarı kalın büyük metin sayılmaz): vurgu dolgusuna ≥ 4,5. Vurgu dolgusu ve kenarlığı
//   arayüz öğesidir: zemine ≥ 3.
// - Dolgu zeminden seçilmeli: ΔE ≥ 0,1 (göz eşiği ≈ 0,02'nin 5 katı; en kötü ölçülen ok 0,109).
// - Durumlar birbirinden: ton ≥ 30°, ΔE ≥ 0,15 (aynı ailenin değişkeni eşiği), CVD ≥ 0,1.
//   Kategori eşiği 0,25 burada aranmaz: durum hiçbir zaman yalnızca renkle anlatılmaz (simge + yazı).
//   Zemine 3:1 tutan koyu üçlüler CVD'de en çok 0,089'a ulaştı; açık dolgu + kenarlık bu yüzden seçildi.
const MIN = { text: 4.5, ui: 3, fillVsBg: 0.1, hue: 30, deltaE: 0.15, cvd: 0.1 };

describe("renkler Wada sözlüğünden", () => {
  it("her rol ve durum adı sözlükte var ve hex'i sözlükteki", () => {
    const hexes = new Set(WADA.map((c) => c.hex));
    for (const [role, hex] of Object.entries(paletteHex())) expect(hexes.has(hex), `${role} ${hex}`).toBe(true);
    for (const n of names) expect(hexes.has(statusHex()[n].fill), n).toBe(true);
  });

  it("CSS değişkenleri tokenlardan; roller ve durumların hepsi yayımlanır", () => {
    const vars = cssVariables();
    const hex = paletteHex();
    expect(vars["--rb-bg"]).toBe(hex.bg);
    expect(vars["--rb-text"]).toBe(hex.text);
    expect(vars["--rb-accent"]).toBe(hex.accent);
    expect(vars["--rb-on-accent"]).toBe(hex.onAccent);
    for (const n of names) {
      expect(vars[`--rb-${n}`]).toBe(statusHex()[n].fill);
      expect(vars[`--rb-on-${n}`]).toBe(statusHex()[n].on);
    }
  });
});

describe(`ana palet (Wada #${PALETTE.combination})`, () => {
  const p = paletteHex();
  const s = statusHex();

  it("gövde metni zemine ≥ 4,5", () => expect(contrastRatio(p.text, p.bg)).toBeGreaterThanOrEqual(MIN.text));

  it("düğme yazısı vurgu dolgusuna ≥ 4,5", () => {
    const r = contrastRatio(p.onAccent, p.accent);
    expect(r, `onAccent ${p.onAccent} / accent ${p.accent} ${r.toFixed(2)}`).toBeGreaterThanOrEqual(MIN.text);
  });

  it("vurgu dolgusu ve kenarlığı zemine ≥ 3", () => {
    const r = contrastRatio(p.accent, p.bg);
    expect(r, `accent ${p.accent} / bg ${p.bg} ${r.toFixed(2)}`).toBeGreaterThanOrEqual(MIN.ui);
  });

  // Ölçünün kendisi: paletin ilk hâlindeki düğme yazısı (kombinasyonun kendi Ivory Buff'ı) bu eşiği geçmiyordu (3,56).
  it("ölçü kötü örneği yakalar: Ivory Buff yazısı Burnt Sienna üstünde < 4,5", () => {
    expect(contrastRatio(wadaHex("Ivory Buff"), p.accent)).toBeLessThan(MIN.text);
  });

  it.each(names)("durum %s: çip yazısı dolguya ≥ 4,5, kenarlık zemine ≥ 3, dolgu zeminden ΔE ≥ 0,1", (n) => {
    const onFill = contrastRatio(s[n].on, s[n].fill);
    expect(onFill, `${n} yazı/dolgu ${onFill.toFixed(2)}`).toBeGreaterThanOrEqual(MIN.text);
    expect(contrastRatio(p.text, p.bg)).toBeGreaterThanOrEqual(MIN.ui);
    const vsBg = deltaE(s[n].fill, p.bg);
    expect(vsBg, `${n} dolgu/zemin ΔE ${fmt(vsBg)}`).toBeGreaterThanOrEqual(MIN.fillVsBg);
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
