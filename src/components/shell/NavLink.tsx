"use client";
import { Calculator, LayoutDashboard, PackageSearch, Store } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

const ICONS = { market: Store, trace: PackageSearch, panel: LayoutDashboard, scenario: Calculator } as const;

export type NavIcon = keyof typeof ICONS;

/** Etkin sayfa adresten bulunur (aria-current). Kenar çubuğunda yatay, mobil sekme çubuğunda dikey yerleşir. */
export function NavLink({ href, icon, label, variant }: { href: string; icon: NavIcon; label: string; variant: "side" | "tab" }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const Icon = ICONS[icon];
  const side = variant === "side";
  const shape = side
    ? "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors"
    : "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold";
  const tone = side
    ? active
      ? "bg-side-active text-side-ink"
      : "text-side-muted hover:bg-side-active hover:text-side-ink"
    : active
      ? "text-brand"
      : "text-muted";
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`${shape} ${tone}`}>
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span>{label}</span>
      {side && active && <span aria-hidden="true" className="ms-auto size-1.5 rounded-full bg-glow" />}
    </Link>
  );
}
