import type { ReactNode } from "react";

/**
 * Dar ekranda tablo kendi içinde kayar; kaydırma alanı klavyeyle de odaklanır (axe: scrollable-region-focusable).
 * relative: içerideki sr-only (mutlak konumlu) metin kapsayıcı kutusunu bulsun ve kırpılsın; yoksa sayfayı 16 px taşırıyordu (M-13).
 */
export function TableWrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="relative overflow-x-auto">
      {children}
    </div>
  );
}

export const th = "py-1 pe-3 align-bottom";
export const td = "py-1 pe-3 align-top";
export const rowLink = "inline-flex min-h-11 items-center font-semibold whitespace-nowrap underline underline-offset-4";
