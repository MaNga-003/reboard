// Grafik ölçeği ve yazı yerleşimi (saf, React'sız). Charts.tsx yalnızca çizer.
// Yazı veri çizgisine, noktalara ve öteki yazılara değmez; boş yer yoksa yazı çizilmez, bilgi uyarıda ve tabloda kalır.
// tests/unit/chart-layout.test.ts bunu rastgele projeksiyonlarda, panel.spec gerçek yazı kutularıyla ölçer (M-25).

export const M = { top: 12, right: 12, bottom: 28, left: 44 };
export const PLOT_H = 200;
export const H = M.top + PLOT_H + M.bottom;
/** 12 px yazıda harf başına genişlik üst tahmini; panel.spec gerçek genişliğin bunu aşmadığını ölçer. */
export const CHAR_W = 7;
// Taban çizgisinden yukarı ve aşağı yazı kutusu; çizgiyle yazı arasında en az 3 px boşluk.
const ASCENT = 12;
const DESCENT = 3;
const GAP = 3;

export type Box = { x0: number; x1: number; y0: number; y1: number };
export type Pt = { x: number; y: number };
export type Anchor = "start" | "end";
export type Label = { text: string; x: number; base: number; anchor: Anchor; box: Box };

/** 1-2-5 adımlı temiz eksen: en çok ~4 aralık. */
export function niceScale(raw: number) {
  const target = Math.max(raw, 1) / 4;
  const pow = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= target)!;
  const max = Math.ceil(Math.max(raw, 1) / step) * step;
  return { max, ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step) };
}

export const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const grow = (b: Box, d: number): Box => ({ x0: b.x0 - d, x1: b.x1 + d, y0: b.y0 - d, y1: b.y1 + d });
const around = (p: Pt, r: number): Box => ({ x0: p.x - r, x1: p.x + r, y0: p.y - r, y1: p.y + r });

/** Doğru parçası kutuya değiyor mu (Liang–Barsky kırpması); örnekleme yok, ince bir uç kaçmaz. */
export function segmentHits(p: Pt, q: Pt, b: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  for (const [k, d] of [
    [-dx, p.x - b.x0],
    [dx, b.x1 - p.x],
    [-dy, p.y - b.y0],
    [dy, b.y1 - p.y],
  ]) {
    if (k === 0) {
      if (d < 0) return false;
      continue;
    }
    const r = d / k;
    if (k < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

export const polylineHits = (line: readonly Pt[], b: Box) => line.some((p, i) => i > 0 && segmentHits(line[i - 1], p, b));

export function textBox(x: number, base: number, anchor: Anchor, text: string): Box {
  const w = text.length * CHAR_W;
  const x0 = anchor === "end" ? x - w : x;
  return { x0, x1: x0 + w, y0: base - ASCENT, y1: base + DESCENT };
}

export type ProjectionInput = { day: number; days: number; arrival: boolean };
/** Yazı ve sığmazsa denenecek kısa biçimi. */
export type TextChoice = { label: string; short?: string };

export type ProjectionLayout = {
  plotW: number;
  maxDay: number;
  ticks: number[];
  x: (day: number) => number;
  y: (days: number) => number;
  line: Pt[];
  arrivals: Pt[];
  /** segments: çizilecek kesikli çizgi parçaları; yazı çizginin üstüne oturduysa orada boşluk kalır. */
  thresholds: { days: number; ty: number; label: Label | null; segments: [number, number][] }[];
  marker: { day: number; at: Pt; label: Label | null } | null;
  /** Çizilen işaretler: nokta halkaları ve eşik çizgisi parçaları (test yazıların bunlara değmediğini denetler). */
  obstacles: Box[];
};

export const ARRIVAL_R = 6; // 4 px nokta + 2 px zemin halkası
export const MARKER_R = 7; // 5 px nokta + 2 px halka

/**
 * Projeksiyon grafiğinin geometrisi. Önce kırmızıya iniş yazısı yerleşir (uyarının grafikteki karşılığı),
 * sonra eşik yazıları. Her yazı için aday konumlar sırayla denenir; ilk boş olan seçilir.
 * Uzun yazı hiçbir yere sığmazsa kısası denenir; o da sığmazsa yazı çizilmez.
 */
export function projectionLayout(
  width: number,
  points: readonly ProjectionInput[],
  thresholds: readonly ({ days: number } & TextChoice)[],
  marker: ({ day: number } & TextChoice) | null,
): ProjectionLayout {
  const plotW = width - M.left - M.right;
  const maxDay = points[points.length - 1].day;
  const scale = niceScale(Math.max(...points.map((p) => p.days), ...thresholds.map((t) => t.days)) * 1.1);
  const x = (d: number) => M.left + (d / maxDay) * plotW;
  const y = (v: number) => M.top + PLOT_H - (v / scale.max) * PLOT_H;
  const line = points.map((p) => ({ x: x(p.day), y: y(p.days) }));
  const arrivals = points.filter((p) => p.arrival).map((p) => ({ x: x(p.day), y: y(p.days) }));
  const mk = marker && points.find((p) => p.day === marker.day);
  const mkAt = mk ? { x: x(mk.day), y: y(mk.days) } : null;
  const ty = thresholds.map((t) => y(t.days));

  const marks = [...arrivals.map((p) => around(p, ARRIVAL_R)), ...(mkAt ? [around(mkAt, MARKER_R)] : [])];
  const tline = (v: number, x0 = M.left, x1 = width - M.right): Box => ({ x0, x1, y0: v - 0.5, y1: v + 0.5 });
  const plot: Box = { x0: M.left, x1: width - M.right, y0: 0, y1: M.top + PLOT_H };
  const taken: Box[] = [];
  // own: yazı bu eşik çizgisinin üstüne oturuyor; çizgi orada kesileceği için engel sayılmaz.
  const free = (b: Box, own?: number) =>
    b.x0 >= plot.x0 &&
    b.x1 <= plot.x1 &&
    b.y0 >= plot.y0 &&
    b.y1 <= plot.y1 &&
    !polylineHits(line, grow(b, GAP)) &&
    ![...marks, ...taken, ...ty.filter((_, j) => j !== own).map((v) => tline(v))].some((o) => overlaps(b, o));
  type Candidate = { x: number; base: number; anchor: Anchor; own?: number };
  const place = (texts: string[], candidates: (text: string) => Candidate[]): { label: Label; own?: number } | null => {
    for (const text of texts)
      for (const { own, ...c } of candidates(text)) {
        const box = textBox(c.x, c.base, c.anchor, text);
        if (free(box, own)) {
          taken.push(box);
          return { label: { text, ...c, box }, own };
        }
      }
    return null;
  };
  const texts = (t: TextChoice) => (t.short ? [t.label, t.short] : [t.label]);

  // Noktanın altı ve üstü sırayla, 4 px adımla uzaklaşarak; her adımda önce sol, sonra sağ.
  // Seyrek adım (12 px) iki yakın eşik çizgisinin arasındaki boşluğu atlıyordu (244 px, eşik 5/4 gün).
  const markerPlaced =
    marker &&
    mkAt &&
    place(texts(marker), () =>
      Array.from({ length: 10 }, (_, k) => [18 + 4 * k, -10 - 4 * k]).flat().flatMap((dy) => [
        { x: mkAt.x - 8, base: mkAt.y + dy, anchor: "end" as const },
        { x: mkAt.x + 8, base: mkAt.y + dy, anchor: "start" as const },
      ]),
    );

  // Eşik yazısı çizginin hemen üstünde ya da altında: önce uçlar, sonra çizgi boyunca yedi ara konum.
  // Son çare çizginin üstüne oturmak; çizgi yazının iki yanında 4 px boşlukla kesilir. Ölçek büyüyünce 14 ve 7 günlük
  // çizgiler 9 px kadar yaklaşıyor ve arada ne üst ne alt yazıya yer kalıyor (demo verisi, 150 günlük eksen).
  const thresholdLabels = thresholds.map((t, i) => {
    const candidates = (text: string): Candidate[] => {
      const w = text.length * CHAR_W;
      const xs: { x: number; anchor: Anchor }[] = [
        { x: width - M.right, anchor: "end" },
        { x: M.left + 4, anchor: "start" },
        ...Array.from({ length: 7 }, (_, k) => ({ x: M.left + 4 + ((k + 1) * (plotW - 8 - w)) / 8, anchor: "start" as const })),
      ];
      return [...[ty[i] - 4, ty[i] + 14].flatMap((base) => xs.map((c) => ({ ...c, base }))), ...xs.map((c) => ({ ...c, base: ty[i] + 4, own: i }))];
    };
    const placed = place(texts(t), candidates);
    const cut = placed?.own === i ? placed.label.box : null;
    const segments: [number, number][] = cut
      ? ([
          [plot.x0, cut.x0 - 4],
          [cut.x1 + 4, plot.x1],
        ] as [number, number][]).filter(([a, b]) => b > a)
      : [[plot.x0, plot.x1]];
    return { days: t.days, ty: ty[i], label: placed?.label ?? null, segments };
  });

  return {
    plotW,
    maxDay,
    ticks: scale.ticks,
    x,
    y,
    line,
    arrivals,
    thresholds: thresholdLabels,
    marker: marker && mkAt && { day: marker.day, at: mkAt, label: markerPlaced?.label ?? null },
    obstacles: [...marks, ...thresholdLabels.flatMap((t) => t.segments.map(([a, b]) => tline(t.ty, a, b)))],
  };
}
