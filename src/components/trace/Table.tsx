import type { ReactNode } from "react";

/**
 * Dar ekranda tablo kendi içinde kayar; kaydırma alanı klavyeyle de odaklanır (axe: scrollable-region-focusable).
 * relative: içerideki sr-only (mutlak konumlu) metin kapsayıcı kutusunu bulsun ve kırpılsın; yoksa sayfayı 16 px taşırıyordu (M-13).
 * Kart görünümü (T4.8): yuvarlak kenar, gölge; başlık satırı soluk zeminde.
 */
export function TableWrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
      {children}
    </div>
  );
}

// Dar ekranda yatay dolgu 8 px: tablolar 360 px'te kaymadan sığsın (M-13, M-29); geniş ekranda 16 px.
export const th = "bg-canvas px-2 py-3 align-bottom text-xs font-semibold uppercase tracking-wider text-subtle sm:px-4";
export const td = "px-2 py-3 align-top text-ink sm:px-4";
/** Tablo satırı ayracı: üst kenarlıkla; <tr> sınıfı. */
export const tr = "border-t border-line transition-colors hover:bg-canvas/60";
export const rowLink = "inline-flex min-h-11 items-center font-semibold whitespace-nowrap text-brand underline-offset-4 hover:underline";
