// Harita noktası renkleri (M-22). Altlık dışarıdan gelir; ölçülen örneklerine karşı her noktanın görünür bir katmanı
// ≥ 3:1 (WCAG 1.4.11), sayı etiketi zemin hale üstünde ≥ 4,5:1 olmalı. Etiket dolgunun üstüne değil yanına yazılır:
// A ve C paletlerinde vurgu üstü yazı küçük metin eşiğini geçmiyor.
import { paletteHex, uiHex, type PaletteId } from "./tokens";

/** OpenFreeMap "positron" altlığından piksel örnekleri (ekran görüntüsü, 2026-10-27): kara, su, yol. */
export const BASEMAP_SAMPLES = { land: "#f2f3f0", water: "#c2c8ca", road: "#ffffff" } as const;

/** Görünen nokta 16–28 px; dokunma alanı görünmez bir katmanla 44 px çapa çıkar (M-12). */
export const MARKER = { radius: 8, groupRadius: 11, ownRing: 3, ring: 2, hitRadius: 22 } as const;

export type MarkerStyle = { fill: string; ring: string };

/** Paletsiz çağrı arayüz paletini (UI) kullanır; palet kimliği verilirse eski aday paleti ölçülür (testler). */
export function markerColors(id?: PaletteId) {
  if (!id) {
    const u = uiHex();
    return {
      own: { fill: u.brand, ring: u.ink } satisfies MarkerStyle,
      other: { fill: u.ink, ring: u.surface } satisfies MarkerStyle,
      label: { text: u.ink, halo: u.surface },
    };
  }
  const c = paletteHex(id);
  return {
    // Kendi ilanı vurgu dolgulu; vurgu açık altlıkta seçilmediği için halka koyu metin rengidir.
    own: { fill: c.accent, ring: c.text } satisfies MarkerStyle,
    other: { fill: c.text, ring: c.bg } satisfies MarkerStyle,
    label: { text: c.text, halo: c.bg },
  };
}
