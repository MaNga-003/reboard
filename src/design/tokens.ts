// Renk tokenları (D-014): yalnızca Sanzo Wada sözlüğündeki adlarla tanımlanır, hex sözlükten çözülür.
// İki katman vardır: hikâye ve eski sınıflar PALETTES[ACTIVE_PALETTE] rollerini (bg, fg…) kullanır; uygulama arayüzü
// (kenar çubuğu, kartlar, düğmeler) UI rollerini kullanır (T4.8).
import { over } from "./color";
import wada from "./wada.json";

export type WadaColor = { name: string; hex: string; combinations: number[] };
export const WADA: readonly WadaColor[] = wada;

export function wadaHex(name: string): string {
  const c = WADA.find((x) => x.name === name);
  if (!c) throw new Error(`Wada sözlüğünde yok: ${name}`);
  return c.hex;
}

export type PaletteId = "A" | "B" | "C";

type PaletteDef = {
  id: PaletteId;
  combination: number;
  /** Rol → Wada renk adı */
  roles: { bg: string; text: string; accent: string; onAccent: string; secondary: string };
};

export const PALETTES: Record<PaletteId, PaletteDef> = {
  A: {
    id: "A",
    combination: 303,
    roles: { bg: "Naples Yellow", text: "Deep Slate Olive", accent: "Peach Red", onAccent: "Deep Slate Olive", secondary: "Neutral Gray" },
  },
  B: {
    id: "B",
    combination: 310,
    roles: { bg: "Sulpher Yellow", text: "Deep Slate Olive", accent: "Pinkish Cinnamon", onAccent: "Deep Slate Olive", secondary: "Olive" },
  },
  C: {
    id: "C",
    combination: 343,
    roles: { bg: "Ivory Buff", text: "Vandar Poel's Blue", accent: "Burnt Sienna", onAccent: "Ivory Buff", secondary: "Deep Grayish Olive" },
  },
};

export const ACTIVE_PALETTE: PaletteId = "B";

export type RoleName = keyof PaletteDef["roles"];

export function paletteHex(id: PaletteId): Record<RoleName, string> {
  const roles = PALETTES[id].roles;
  return Object.fromEntries(Object.entries(roles).map(([role, name]) => [role, wadaHex(name)])) as Record<RoleName, string>;
}

export type StatusName = "ok" | "warn" | "danger";

/**
 * Durum dolguları paletten bağımsızdır; üstündeki yazı paletin metin ya da zemin rengidir (hangisi okunursa).
 * Açık dolgular zemine karşı 3:1 tutmaz; bu yüzden durum çipi metin renginde kenarlık taşır ve durum hiçbir zaman
 * yalnızca renkle anlatılmaz (simge + yazı). Ölçümler: tests/unit/design-tokens.test.ts, DESIGN_SYSTEM §3.
 */
export const STATUS: Record<StatusName, { fill: string; on: "text" | "bg" }> = {
  ok: { fill: "Cobalt Green", on: "text" },
  warn: { fill: "Orange Yellow", on: "text" },
  danger: { fill: "Carmine Red", on: "bg" },
};

export function statusHex(id: PaletteId = ACTIVE_PALETTE): Record<StatusName, { fill: string; on: string }> {
  const hex = paletteHex(id);
  return Object.fromEntries(
    Object.entries(STATUS).map(([k, s]) => [k, { fill: wadaHex(s.fill), on: hex[s.on] }]),
  ) as Record<StatusName, { fill: string; on: string }>;
}

/**
 * Arayüz paleti (T4.8): hikâyenin kimliğinden. Koyu indigo uzay finalinden, terrakota atölyenin sıcak ışığından gelir.
 * Her rol bir Wada rengidir; ton açıkları (canvas, line…) Wada rengi + saydamlıktır ve hex'e çözülür, testler ölçebilsin.
 */
export const UI = {
  ink: "Deep Indigo",
  muted: "Slate Color",
  subtle: "Dark Medici Blue",
  surface: "White",
  brand: "Burnt Sienna",
  onBrand: "White",
  side: "Deep Indigo",
  sideInk: "White",
  glow: "Golden Yellow",
  sky: "Pale King's Blue",
} as const;

export type UiRole = keyof typeof UI;

export function uiHex(): Record<UiRole, string> {
  return Object.fromEntries(Object.entries(UI).map(([role, name]) => [role, wadaHex(name)])) as Record<UiRole, string>;
}

export function uiTints() {
  const c = uiHex();
  return {
    canvas: over(c.ink, 0.035, c.surface),
    line: over(c.ink, 0.12, c.surface),
    lineStrong: over(c.ink, 0.5, c.surface),
    brandSoft: over(c.brand, 0.1, c.surface),
    sideMuted: over(c.sideInk, 0.68, c.side),
    sideLine: over(c.sideInk, 0.12, c.side),
    sideActive: over(c.sideInk, 0.1, c.side),
  };
}

function uiVariables(): Record<string, string> {
  const c = uiHex();
  const t = uiTints();
  return {
    "--rb-ink": c.ink,
    "--rb-muted": c.muted,
    "--rb-subtle": c.subtle,
    "--rb-surface": c.surface,
    "--rb-canvas": t.canvas,
    "--rb-line": t.line,
    "--rb-line-strong": t.lineStrong,
    "--rb-brand": c.brand,
    "--rb-on-brand": c.onBrand,
    "--rb-brand-soft": t.brandSoft,
    "--rb-side": c.side,
    "--rb-side-ink": c.sideInk,
    "--rb-side-muted": t.sideMuted,
    "--rb-side-line": t.sideLine,
    "--rb-side-active": t.sideActive,
    "--rb-glow": c.glow,
    "--rb-sky": c.sky,
  };
}

/** <html> üzerine yazılan CSS değişkenleri; globals.css bunları Tailwind temasına bağlar. */
export function cssVariables(id: PaletteId = ACTIVE_PALETTE): Record<string, string> {
  const hex = paletteHex(id);
  const status = statusHex(id);
  return {
    ...uiVariables(),
    "--rb-bg": hex.bg,
    "--rb-text": hex.text,
    "--rb-accent": hex.accent,
    "--rb-on-accent": hex.onAccent,
    "--rb-secondary": hex.secondary,
    ...Object.fromEntries(Object.entries(status).flatMap(([k, v]) => [[`--rb-${k}`, v.fill], [`--rb-on-${k}`, v.on]])),
  };
}
