// Renk tokenları (D-014): yalnızca Sanzo Wada sözlüğündeki adlarla tanımlanır, hex sözlükten çözülür.
import wada from "./wada.json";

export type WadaColor = { name: string; hex: string; combinations: number[] };
export const WADA: readonly WadaColor[] = wada;

export function wadaHex(name: string): string {
  const c = WADA.find((x) => x.name === name);
  if (!c) throw new Error(`Wada sözlüğünde yok: ${name}`);
  return c.hex;
}

/**
 * Ana palet: Wada kombinasyonu 343 (kullanıcı seçti, 2026-10-30; Q-1). Rol → Wada renk adı.
 * Düğme yazısı kombinasyonun kendi Ivory Buff'ı değil White: Burnt Sienna üstünde Ivory Buff 3,56:1 kalıyordu,
 * White 5,21:1 veriyor (DESIGN_SYSTEM §1). Aynı eşiği geçen tek başka açık renk Pale Lemon Yellow 4,52:1 ile sınırdaydı.
 */
export const PALETTE = {
  combination: 343,
  roles: { bg: "Ivory Buff", text: "Vandar Poel's Blue", accent: "Burnt Sienna", onAccent: "White", secondary: "Deep Grayish Olive" },
} as const;

export type RoleName = keyof typeof PALETTE.roles;

export function paletteHex(): Record<RoleName, string> {
  return Object.fromEntries(Object.entries(PALETTE.roles).map(([role, name]) => [role, wadaHex(name)])) as Record<RoleName, string>;
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

export function statusHex(): Record<StatusName, { fill: string; on: string }> {
  const hex = paletteHex();
  return Object.fromEntries(
    Object.entries(STATUS).map(([k, s]) => [k, { fill: wadaHex(s.fill), on: hex[s.on] }]),
  ) as Record<StatusName, { fill: string; on: string }>;
}

/** <html> üzerine yazılan CSS değişkenleri; globals.css bunları Tailwind temasına bağlar. */
export function cssVariables(): Record<string, string> {
  const hex = paletteHex();
  const status = statusHex();
  return {
    "--rb-bg": hex.bg,
    "--rb-text": hex.text,
    "--rb-accent": hex.accent,
    "--rb-on-accent": hex.onAccent,
    "--rb-secondary": hex.secondary,
    ...Object.fromEntries(Object.entries(status).flatMap(([k, v]) => [[`--rb-${k}`, v.fill], [`--rb-on-${k}`, v.on]])),
  };
}
