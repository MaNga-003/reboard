"use client";
// Panel grafikleri: tek eksen, ince işaret, saç çizgisi ızgara, imleç ve klavyeyle aynı ipucu (dataviz becerisi).
// Sayılar sunucuda biçimlenip gelir; burada yalnızca ölçek ve yerleşim hesaplanır. Her grafiğin tablo karşılığı sayfadadır.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import type { Level } from "@/domain/supply";
import { ARRIVAL_R, H, M, MARKER_R, PLOT_H, niceScale, projectionLayout, type Label, type TextChoice } from "./chart-layout";
import { StatusChip } from "./Status";

function useWidth(ref: RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** İmleç ve klavye aynı etkin noktayı sürer; odak gidince ipucu kapanır. */
function useCursor(n: number) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    const next: Record<string, (i: number) => number> = {
      ArrowRight: (i) => Math.min(n - 1, i + 1),
      ArrowLeft: (i) => Math.max(0, i - 1),
      Home: () => 0,
      End: () => n - 1,
    };
    if (!next[e.key]) return;
    e.preventDefault();
    setActive((i) => next[e.key](i ?? 0));
  };
  return { active, setActive, onKeyDown, onFocus: () => setActive((i) => i ?? 0), onBlur: () => setActive(null) };
}

function Frame({
  label,
  hint,
  wrapRef,
  cursor,
  onPointerMove,
  tooltip,
  announce,
  children,
}: {
  label: string;
  hint: string;
  wrapRef: RefObject<HTMLDivElement | null>;
  cursor: ReturnType<typeof useCursor>;
  onPointerMove: (e: PointerEvent<SVGSVGElement>) => void;
  tooltip: ReactNode;
  /** Ekran okuyucuya okunacak düz metin; görsel ipucu aria-hidden. */
  announce: string | null;
  children: ReactNode;
}) {
  const hintId = useId();
  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label={label}
      aria-describedby={hintId}
      tabIndex={0}
      onKeyDown={cursor.onKeyDown}
      onFocus={cursor.onFocus}
      onBlur={cursor.onBlur}
      className="relative w-full"
    >
      <svg width="100%" height={H} aria-hidden="true" className="block touch-pan-y text-fg" onPointerMove={onPointerMove} onPointerLeave={() => cursor.setActive(null)}>
        {children}
      </svg>
      <p id={hintId} className={hidden}>
        {hint}
      </p>
      <p aria-live="polite" className={hidden}>
        {announce}
      </p>
      {tooltip}
    </div>
  );
}

// Görünmez ama okunur metin. sr-only'nin -1 px kenar boşluğu kabın dışına taşıyordu (panel.spec, gutterBreaches).
export const hidden = "pointer-events-none absolute top-0 left-0 size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]";

function Tip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  // İpucu noktanın sağına; sağ yarıdaysa soluna: kenarı aşmaz.
  const side = x > width / 2 ? { right: width - x + 12 } : { left: x + 12 };
  return (
    <div aria-hidden="true" style={{ top: M.top, ...side }} className="pointer-events-none absolute grid max-w-56 gap-1 rounded border border-fg bg-bg px-3 py-2 text-sm shadow">
      {children}
    </div>
  );
}

function YAxis({ ticks, y, width, fmt }: { ticks: number[]; y: (v: number) => number; width: number; fmt: (v: number) => string }) {
  return (
    <g>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} className="stroke-fg/15" strokeWidth={1} />
          <text x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-fg text-xs">
            {fmt(v)}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Yerleşimi hesaplanmış yazı. data-box yerleşimin varsaydığı kutudur; panel.spec gerçek yazı kutusunun bunun içinde kaldığını ölçer. */
function PlacedText({ label, className = "" }: { label: Label; className?: string }) {
  const { x0, y0, x1, y1 } = label.box;
  return (
    <text data-box={[x0, y0, x1, y1].map((v) => v.toFixed(1)).join(" ")} x={label.x} y={label.base} textAnchor={label.anchor} className={`fill-fg text-xs ${className}`}>
      {label.text}
    </text>
  );
}

export type ProjectionDatum = { day: number; days: number; date: string; detail: string; level: Level; levelLabel: string; arrival: string | null };

/** Kaç günlük hammadde, bugünden 30 gün ileriye. Eşikler kesikli çizgi ve yazıyla; kırmızıya inilen gün işaretli. */
export function ProjectionChart({
  label,
  hint,
  locale,
  points,
  thresholds,
  marker,
  ticks,
}: {
  label: string;
  hint: string;
  locale: string;
  points: ProjectionDatum[];
  thresholds: ({ days: number } & TextChoice)[];
  marker: ({ day: number } & TextChoice) | null;
  ticks: { day: number; label: string }[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useWidth(wrapRef);
  const cursor = useCursor(points.length);
  const g = projectionLayout(
    width,
    points.map((p) => ({ day: p.day, days: p.days, arrival: p.arrival !== null })),
    thresholds,
    marker,
  );
  const { plotW, maxDay, x, y } = g;
  const fmt = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { maximumFractionDigits: 0 });
  const line = g.line.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
  const a = cursor.active === null ? null : points[cursor.active];

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const day = Math.round(((px - M.left) / plotW) * maxDay);
    cursor.setActive(Math.max(0, Math.min(points.length - 1, points.findIndex((p) => p.day >= day))));
  };

  return (
    <Frame
      label={label}
      hint={hint}
      wrapRef={wrapRef}
      cursor={cursor}
      onPointerMove={onPointerMove}
      announce={a && [a.date, a.detail, a.levelLabel, a.arrival].filter(Boolean).join(", ")}
      tooltip={
        a && (
          <Tip x={x(a.day)} width={width}>
            <span>{a.date}</span>
            <strong className="text-base">{a.detail}</strong>
            <span>
              <StatusChip level={a.level} label={a.levelLabel} />
            </span>
            {a.arrival && <span>{a.arrival}</span>}
          </Tip>
        )
      }
    >
      <YAxis ticks={g.ticks} y={y} width={width} fmt={(v) => fmt.format(v)} />
      {ticks.map((t) => (
        <text key={t.day} x={x(t.day)} y={H - 8} textAnchor={t.day === 0 ? "start" : t.day === maxDay ? "end" : "middle"} className="fill-fg text-xs">
          {t.label}
        </text>
      ))}
      {g.thresholds.map((t, i) => (
        <g key={i} data-threshold={t.days}>
          {t.segments.map(([a, b]) => (
            <line key={a} x1={a} x2={b} y1={t.ty} y2={t.ty} className="stroke-fg" strokeWidth={1} strokeDasharray="4 4" />
          ))}
          {t.label && <PlacedText label={t.label} />}
        </g>
      ))}
      <path data-series="stock" d={line} fill="none" className="stroke-fg" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {g.arrivals.map((p) => (
        <circle key={p.x} data-mark="arrival" cx={p.x} cy={p.y} r={ARRIVAL_R - 2} className="fill-fg stroke-bg" strokeWidth={2} />
      ))}
      {g.marker && (
        <g data-marker-day={g.marker.day}>
          <circle data-mark="marker" cx={g.marker.at.x} cy={g.marker.at.y} r={MARKER_R - 2} className="fill-danger stroke-bg" strokeWidth={2} />
          {g.marker.label && <PlacedText label={g.marker.label} className="font-semibold" />}
        </g>
      )}
      {a && <line x1={x(a.day)} x2={x(a.day)} y1={M.top} y2={M.top + PLOT_H} className="stroke-fg" strokeWidth={1} />}
    </Frame>
  );
}

export type MonthDatum = { key: string; label: string; value: number; display: string };

/** Aylık doğrulanmış kg: tek seri sütun; değer yalnızca son ayın tepesinde, gerisi eksen, ipucu ve tabloda. */
export function MonthlyChart({ label, hint, locale, bars }: { label: string; hint: string; locale: string; bars: MonthDatum[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useWidth(wrapRef);
  const cursor = useCursor(bars.length);
  const plotW = width - M.left - M.right;
  const band = plotW / bars.length;
  const barW = Math.min(24, band * 0.6);
  const scale = niceScale(Math.max(...bars.map((b) => b.value)) * 1.15);
  const cx = (i: number) => M.left + band * (i + 0.5);
  const y = (v: number) => M.top + PLOT_H - (v / scale.max) * PLOT_H;
  const compact = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { notation: "compact", maximumFractionDigits: 1 });
  const base = M.top + PLOT_H;
  const a = cursor.active === null ? null : bars[cursor.active];
  const last = bars.length - 1;

  // Üstü 4 px yuvarlak, tabanı düz sütun; kısa sütunda yarıçap boyu aşmaz.
  const column = (i: number, v: number) => {
    const top = y(v);
    const r = Math.min(4, base - top, barW / 2);
    const l = cx(i) - barW / 2;
    return `M${l},${base}V${top + r}Q${l},${top} ${l + r},${top}H${l + barW - r}Q${l + barW},${top} ${l + barW},${top + r}V${base}Z`;
  };

  return (
    <Frame
      label={label}
      hint={hint}
      wrapRef={wrapRef}
      cursor={cursor}
      onPointerMove={(e) => {
        const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
        cursor.setActive(Math.max(0, Math.min(last, Math.floor((px - M.left) / band))));
      }}
      announce={a && `${a.label}, ${a.display}`}
      tooltip={
        a && (
          <Tip x={cx(cursor.active!)} width={width}>
            <span>{a.label}</span>
            <strong className="text-base">{a.display}</strong>
          </Tip>
        )
      }
    >
      <YAxis ticks={scale.ticks} y={y} width={width} fmt={(v) => compact.format(v)} />
      {bars.map((b, i) => (
        <g key={b.key} data-month={b.key}>
          {b.value > 0 && <path data-series="verified" d={column(i, b.value)} className={cursor.active === i ? "fill-fg/70" : "fill-fg"} />}
          <text x={cx(i)} y={H - 8} textAnchor="middle" className="fill-fg text-xs">
            {b.label}
          </text>
        </g>
      ))}
      <text x={cx(last)} y={y(bars[last].value) - 6} textAnchor="middle" className="fill-fg text-xs font-semibold">
        {bars[last].display}
      </text>
      <line x1={M.left} x2={width - M.right} y1={base} y2={base} className="stroke-fg" strokeWidth={1} />
    </Frame>
  );
}
