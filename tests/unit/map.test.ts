// M-22: harita noktaları altlıkta seçilir; aynı ilçedeki ilanlar tek noktada sayılır.
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/design/color";
import { BASEMAP_SAMPLES, MARKER, markerColors } from "@/design/map";
import { PALETTES, type PaletteId } from "@/design/tokens";
import { groupByPoint } from "@/domain/geo";
import { CalcError } from "@/domain/result";

const UI_MIN = 3;
const TEXT_MIN = 4.5;
// Palet kullanıcının seçimini bekliyor (Q-1); üç aday da geçmeli.
const palettes = Object.keys(PALETTES) as PaletteId[];

describe("harita noktası kontrastı", () => {
  for (const id of palettes) {
    it(`palet ${id}: her nokta her altlık örneğinde ≥ ${UI_MIN}:1 bir katman taşır; etiket ≥ ${TEXT_MIN}:1`, () => {
      const m = markerColors(id);
      const weak: string[] = [];
      for (const [kind, s] of [["own", m.own], ["other", m.other]] as const) {
        for (const [where, base] of Object.entries(BASEMAP_SAMPLES)) {
          const best = Math.max(contrastRatio(s.fill, base), contrastRatio(s.ring, base));
          if (best < UI_MIN) weak.push(`${kind} ~ ${where}: ${best.toFixed(2)}`);
        }
      }
      expect(weak).toEqual([]);
      expect(contrastRatio(m.label.text, m.label.halo)).toBeGreaterThanOrEqual(TEXT_MIN);
    });
  }

  it(`arayüz paletinde (paletsiz çağrı) her nokta her altlık örneğinde ≥ ${UI_MIN}:1 bir katman taşır; etiket ≥ ${TEXT_MIN}:1`, () => {
    const m = markerColors();
    const weak: string[] = [];
    for (const [kind, s] of [["own", m.own], ["other", m.other]] as const) {
      for (const [where, base] of Object.entries(BASEMAP_SAMPLES)) {
        const best = Math.max(contrastRatio(s.fill, base), contrastRatio(s.ring, base));
        if (best < UI_MIN) weak.push(`${kind} ~ ${where}: ${best.toFixed(2)}`);
      }
    }
    expect(weak).toEqual([]);
    expect(contrastRatio(m.label.text, m.label.halo)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it("ölçü kötü örneği yakalar: eski kendi-ilanı halkası (zemin rengi) palet B'de karada 3:1'in altında", () => {
    const m = markerColors("B");
    expect(Math.max(contrastRatio(m.own.fill, BASEMAP_SAMPLES.land), contrastRatio(m.label.halo, BASEMAP_SAMPLES.land))).toBeLessThan(UI_MIN);
  });
});

it("dokunma alanı ≥ 44 px çap ve görünen en büyük noktayı kapsar (M-12)", () => {
  expect(2 * MARKER.hitRadius).toBeGreaterThanOrEqual(44);
  expect(MARKER.hitRadius).toBeGreaterThanOrEqual(MARKER.groupRadius + MARKER.ownRing);
});

describe("konuma göre gruplama", () => {
  it("aynı koordinattakileri birleştirir, sırayı ve sahipliği korur", () => {
    const g = groupByPoint([
      { id: "a", own: false, lat: 36.99, lon: 30.63 },
      { id: "b", own: true, lat: 36.99, lon: 30.63 },
      { id: "c", own: false, lat: 36.95, lon: 30.72 },
    ]);
    expect(g).toEqual([
      { lat: 36.99, lon: 30.63, ids: ["a", "b"], own: true },
      { lat: 36.95, lon: 30.72, ids: ["c"], own: false },
    ]);
  });

  it("boş liste boş; geçersiz konum reddedilir", () => {
    expect(groupByPoint([])).toEqual([]);
    expect(() => groupByPoint([{ id: "x", own: false, lat: 95, lon: 0 }])).toThrow(CalcError);
  });
});
