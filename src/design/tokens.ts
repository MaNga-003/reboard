// Renk tokenları (D-014): yalnızca Sanzo Wada sözlüğündeki adlarla tanımlanır, hex sözlükten çözülür.
// Ana palet kullanıcının seçimini bekliyor (Q-1); seçilene kadar geçici olarak B kullanılır.
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

/** <html> üzerine yazılan CSS değişkenleri; globals.css bunları Tailwind temasına bağlar. */
export function cssVariables(id: PaletteId = ACTIVE_PALETTE): Record<string, string> {
  const hex = paletteHex(id);
  const status = statusHex(id);
  return {
    "--rb-bg": hex.bg,
    "--rb-text": hex.text,
    "--rb-accent": hex.accent,
    "--rb-on-accent": hex.onAccent,
    "--rb-secondary": hex.secondary,
    ...Object.fromEntries(Object.entries(status).flatMap(([k, v]) => [[`--rb-${k}`, v.fill], [`--rb-on-${k}`, v.on]])),
  };
}
