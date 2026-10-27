// Projeksiyon grafiğinde yazı yerleşimi (M-25). Gerçek projectStock çıktısı, rastgele genişlik, stok, eşik ve teslimle:
// yazı veri çizgisine, noktalara, eşik çizgilerine ve birbirine değmez; çizim alanından taşmaz.
// Gerçek yazı genişliğinin CHAR_W tahminini aşmadığını panel.spec tarayıcıda ölçer.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CHAR_W, INK, M, PLOT_H, overlaps, polylineHits, projectionLayout, segmentHits, type Box, type ProjectionLayout } from "@/components/panel/chart-layout";
import { Decimal } from "@/domain/result";
import { coverLevel, coverThresholds, projectStock } from "@/domain/supply";
import en from "../../messages/en.json";
import tr from "../../messages/tr.json";

const now = new Date("2026-10-27T12:00:00Z");
const fill = (tpl: string, v: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));

const scenario = fc.record({
  width: fc.integer({ min: 240, max: 1400 }),
  need: fc.integer({ min: 50, max: 2000 }),
  stockDays: fc.double({ min: 0, max: 60, noNaN: true }),
  green: fc.integer({ min: 2, max: 30 }),
  yellowShare: fc.double({ min: 0.1, max: 1, noNaN: true }),
  arrivals: fc.array(fc.record({ hours: fc.integer({ min: 0, max: 35 * 24 }), needs: fc.option(fc.double({ min: 0, max: 30, noNaN: true }), { nil: null }) }), { maxLength: 12 }),
  locale: fc.constantFrom("tr", "en"),
});
type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;

/** Sayfanın kurduğu girdiyle aynı: 0. gün bugünkü stok, sonra 30 günlük projeksiyon; eşik ve iniş yazısı mesaj dosyasından. */
function build(s: Scenario) {
  const m = s.locale === "tr" ? tr.panel : en.panel;
  const need = new Decimal(s.need);
  const stock = need.mul(s.stockDays);
  const yellow = Math.max(1, Math.round(s.green * s.yellowShare));
  const t = coverThresholds(s.green, yellow);
  const p = projectStock(
    stock,
    need,
    s.arrivals.map((a) => ({ at: new Date(now.getTime() + a.hours * 3_600_000), kg: a.needs === null ? null : need.mul(a.needs) })),
    now,
    t,
  )!;
  const today = stock.div(need);
  const points = [{ day: 0, days: today.toNumber(), arrival: false }, ...p.points.map((q) => ({ day: q.day, days: q.days.toNumber(), arrival: q.arrivals > 0 }))];
  const first = coverLevel(today, t) !== "danger" ? p.points.find((q) => q.level === "danger") : undefined;
  const thresholds = [
    { days: s.green, label: fill(m.supply.thresholdLine, { days: s.green, level: m.level.ok }), short: fill(m.supply.thresholdShort, { days: s.green }) },
    { days: yellow, label: fill(m.supply.thresholdLine, { days: yellow, level: m.level.danger }), short: fill(m.supply.thresholdShort, { days: yellow }) },
  ];
  const marker = first ? { day: first.day, label: fill(m.supply.marker, { day: first.day }), short: fill(m.supply.markerShort, { day: first.day }) } : null;
  return { layout: projectionLayout(s.width, points, thresholds, marker), thresholds, marker, width: s.width };
}

/** Yerleşimden bağımsız denetim: yazı kutusu 3 px büyütülüp çizgi 0,25 px adımla örneklenir. */
function sampledHit(l: ProjectionLayout, b: Box) {
  const g = { x0: b.x0 - 3, x1: b.x1 + 3, y0: b.y0 - 3, y1: b.y1 + 3 };
  for (let i = 1; i < l.line.length; i++) {
    const [p, q] = [l.line[i - 1], l.line[i]];
    const n = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 0.25);
    for (let k = 0; k <= n; k++) {
      const x = p.x + ((q.x - p.x) * k) / n;
      const y = p.y + ((q.y - p.y) * k) / n;
      if (x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1) return true;
    }
  }
  return false;
}

function collisions(r: ReturnType<typeof build>) {
  const { layout: l, width } = r;
  const labels = [...l.thresholds.map((t) => t.label), l.marker?.label ?? null].filter((x) => x !== null);
  const out: string[] = [];
  labels.forEach((a, i) => {
    const b = a.box;
    if (b.x0 < M.left || b.x1 > width - M.right || b.y0 < 0 || b.y1 > M.top + PLOT_H) out.push(`"${a.text}" çizim alanı dışında`);
    if (Math.abs(b.x1 - b.x0 - a.text.length * CHAR_W - 2 * INK) > 1e-9) out.push(`"${a.text}" kutusu tahminden farklı`);
    if (sampledHit(l, b)) out.push(`"${a.text}" veri çizgisine değiyor`);
    for (const o of l.obstacles) if (overlaps(b, o)) out.push(`"${a.text}" bir işarete ya da eşik çizgisine değiyor`);
    for (const c of labels.slice(i + 1)) if (overlaps(b, c.box)) out.push(`"${a.text}" ~ "${c.text}"`);
  });
  // Eşik çizgisi yalnızca kendi yazısı üstüne oturduğunda ve yalnızca yazı (+ iki yanda 4 px) kadar kesilir.
  const full = width - M.right - M.left;
  for (const t of l.thresholds) {
    const cut = full - t.segments.reduce((s, [a, b]) => s + b - a, 0);
    if (cut < 1e-9) continue;
    const b = t.label?.box;
    if (!b || b.y0 > t.ty || b.y1 < t.ty || cut > b.x1 - b.x0 + 8 + 1e-9) out.push(`${t.days} günlük çizgi gereksiz kesilmiş (${cut.toFixed(1)} px)`);
  }
  return out;
}

describe("çakışma ölçüsünün kendisi", () => {
  const box = { x0: 10, x1: 20, y0: 10, y1: 20 };
  it("kutuyu kesen, içinde biten ve köşesine değen parçayı yakalar; uzaktakini ve yanından geçeni geçirir", () => {
    expect(segmentHits({ x: 0, y: 15 }, { x: 30, y: 15 }, box)).toBe(true);
    expect(segmentHits({ x: 15, y: 15 }, { x: 15, y: 16 }, box)).toBe(true);
    expect(segmentHits({ x: 0, y: 0 }, { x: 10, y: 10 }, box)).toBe(true);
    expect(segmentHits({ x: 0, y: 0 }, { x: 30, y: 5 }, box)).toBe(false);
    expect(segmentHits({ x: 0, y: 41 }, { x: 41, y: 0 }, box)).toBe(false);
    expect(segmentHits({ x: 21, y: 0 }, { x: 21, y: 30 }, box)).toBe(false);
  });

  it("kesin hesap ile 0,25 px örnekleme her rastgele parçada uyuşur", () => {
    // Örnekleme kutuyu 3 px büyütür: kesin "değer" diyorsa örnekleme de değer; örnekleme değiyorsa kesin hesap büyütülmüş kutuda değer.
    const big = { x0: box.x0 - 3, x1: box.x1 + 3, y0: box.y0 - 3, y1: box.y1 + 3 };
    fc.assert(
      fc.property(fc.array(fc.double({ min: -50, max: 80, noNaN: true }), { minLength: 4, maxLength: 4 }), ([ax, ay, bx, by]) => {
        const l = { line: [{ x: ax, y: ay }, { x: bx, y: by }] } as ProjectionLayout;
        if (polylineHits(l.line, box)) expect(sampledHit(l, box)).toBe(true);
        if (sampledHit(l, box)) expect(polylineHits(l.line, big)).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("projeksiyon grafiği yazı yerleşimi", () => {
  it("ilk günde büyük teslim (dik çıkış) ve geç kırmızı iniş: bütün yazılar yerleşir, hiçbir şeye değmez", () => {
    // Eski yerleşim çizgiyi 2 px adımla örnekliyordu; dik çıkış iki örnek arasından kutunun içinden geçebiliyordu.
    for (const width of [240, 328, 342, 704, 1376]) {
      const r = build({ width, need: 400, stockDays: 8, green: 14, yellowShare: 0.5, arrivals: [{ hours: 20, needs: 25 }], locale: "tr" });
      expect(r.marker).not.toBeNull();
      expect([...r.layout.thresholds.map((t) => t.label), r.layout.marker!.label].every((l) => l !== null), `${width}px`).toBe(true);
      expect(collisions(r), `${width}px`).toEqual([]);
    }
  });

  it("rastgele 3.000 projeksiyonda yerleşen hiçbir yazı çizgiye, işarete ya da başka yazıya değmez", () => {
    fc.assert(
      fc.property(scenario, (s) => {
        expect(collisions(build(s))).toEqual([]);
      }),
      { numRuns: 3000 },
    );
  });

  // Sığmayan yazı çizilmez; oran sabit tohumla ölçülür. 2026-10-27 ölçümü (20.000 senaryo):
  // varsayılan eşiklerde (14/7, ≥ 328 px, bugün ≤ 30 gün, teslimlerle eksen 390 güne kadar) 0/41.286 yazı düştü,
  // 5 eşik yazısı çizginin üstüne oturdu; bütün aralıkta 412/40.058 (%1,03), düşenlerin hepsi alt eşik yazısı:
  // iki eşik çizgisi 15 px'ten yakınsa (ör. 3 ve 2 gün, 100 günlük eksen) arada yazıya yer yok.
  // Önceki adımlar: yalnız uzun yazı %0,24 / %1,88; kısa biçimle %0,015 / %1,27; çizgi üstü yerleşimle %1,03.
  // Kutu iki yandan INK (2 px) büyüyünce (aynı tohum, 10.000'er senaryo): varsayılanda 0/20.710, bütün aralıkta 254/20.030 (%1,27).
  function dropRate(arb: fc.Arbitrary<Scenario>) {
    const n = { total: 0, dropped: 0, marker: 0 };
    fc.assert(
      fc.property(arb, (s) => {
        const { layout } = build(s);
        for (const l of [...layout.thresholds.map((t) => t.label), ...(layout.marker ? [layout.marker.label] : [])]) {
          n.total++;
          if (l === null) n.dropped++;
        }
        if (layout.marker && layout.marker.label === null) n.marker++;
      }),
      { numRuns: 10_000, seed: 20261027 },
    );
    return n;
  }

  it("varsayılan eşiklerde (14/7 gün, ≥ 328 px) her yazı yerleşir", () => {
    const n = dropRate(scenario.map((s) => ({ ...s, width: Math.max(328, s.width), stockDays: Math.min(30, s.stockDays), green: 14, yellowShare: 0.5 })));
    expect(n).toMatchObject({ dropped: 0, marker: 0 });
  });

  it("bütün aralıkta yazıların ≥ %98,5'i yerleşir; kırmızıya iniş yazısı hiç düşmez", () => {
    const n = dropRate(scenario);
    expect(n.dropped / n.total).toBeLessThan(0.015);
    expect(n.marker).toBe(0);
  });
});
