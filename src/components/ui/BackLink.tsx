import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/** Üst sayfaya dönüş bağlantısı; dokunma hedefi 44 px. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-2 justify-self-start text-sm font-semibold text-muted transition-colors hover:text-ink">
      <ArrowLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}
