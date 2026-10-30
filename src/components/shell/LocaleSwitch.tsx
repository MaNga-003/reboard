"use client";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * Dil anahtarı (D-005): aynı sayfayı öbür dilde açar. Site tarayıcı diline göre açıldığı için, yanlış dilde açılan
 * kişi buradan geçer; seçim çereze yazılır. <nav> değil grup: testler tek görünür <nav> bekler. Dokunma hedefi 44 px.
 */
export function LocaleSwitch({ label }: { label: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border border-line-strong bg-surface p-0.5 text-sm font-semibold">
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          lang={l}
          aria-current={l === locale ? "true" : undefined}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 transition-colors ${
            l === locale ? "bg-ink text-surface" : "text-muted hover:text-ink"
          }`}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
