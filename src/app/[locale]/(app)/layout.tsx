import { ChevronDown, LogOut, PlayCircle } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PersonaButtons } from "@/components/auth/PersonaButtons";
import { LocaleSwitch } from "@/components/shell/LocaleSwitch";
import { NavLink, type NavIcon } from "@/components/shell/NavLink";
import { BrandMark, Wordmark } from "@/components/ui/Brand";
import { Still } from "@/components/ui/Still";
import { isRole } from "@/domain/access";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/viewer";
import { signOutAction } from "../giris/actions";

const NAV: { href: string; icon: NavIcon; key: "market" | "traceability" | "dashboard" | "scenario" }[] = [
  { href: "/pazar", icon: "market", key: "market" },
  { href: "/izlenebilirlik", icon: "trace", key: "traceability" },
  { href: "/panel", icon: "panel", key: "dashboard" },
  { href: "/senaryo", icon: "scenario", key: "scenario" },
];

// Uygulama kabuğu (T4.8): koyu kenar çubuğu, açık üst başlık, mobilde alt sekme çubuğu.
// Testler tek <nav> görünür olmasını, başlıkta tek <summary> (rol menüsü) bulunmasını ve tek data-testid="viewer" öğesini bekler.
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const role = viewer.roles.find(isRole) ?? viewer.roles[0];
  const demo = process.env.DEMO_MODE === "true";

  return (
    <div className="rb-app flex min-h-screen flex-1 flex-col bg-canvas pb-[calc(3.5rem+env(safe-area-inset-bottom))] text-ink lg:pb-0 lg:pl-64">
      <aside className="rb-dark hidden bg-side text-side-ink lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
        <Link href="/" className="flex min-h-11 items-center gap-3 px-6 pb-4 pt-7">
          <BrandMark className="size-9" />
          <Wordmark>{t("nav.brand")}</Wordmark>
        </Link>
        <nav aria-label={t("nav.main")} className="grid gap-1 px-3 pt-4">
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href} icon={n.icon} label={t(`nav.${n.key}`)} variant="side" />
          ))}
        </nav>
        <div className="mt-auto p-3">
          <Link
            href="/"
            className="group relative isolate block min-h-11 overflow-hidden rounded-2xl border border-side-line"
          >
            <Still name="earth" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-105" />
            <span className="absolute inset-0 -z-10 bg-gradient-to-t from-side to-transparent" />
            <span className="flex items-end gap-2 px-4 pb-3 pt-16 text-sm font-semibold text-side-ink">
              <PlayCircle aria-hidden="true" className="size-5 shrink-0" />
              {t("shell.watchStory")}
            </span>
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-2 sm:px-6">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-ink lg:hidden">
            <BrandMark className="size-8" />
            <Wordmark>{t("nav.brand")}</Wordmark>
          </Link>
          <div className="flex-1" />
          {demo && (
            <details className="group">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-line-strong bg-surface px-3 text-sm hover:bg-canvas [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="size-2 rounded-full bg-glow ring-2 ring-line" />
                <span className="hidden text-muted xl:inline">{t("auth.demoBar")}</span>
                <span className="font-semibold text-ink">{t("auth.switchRole")}</span>
                <ChevronDown aria-hidden="true" className="size-4 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="fixed inset-x-4 top-16 z-40 rounded-2xl border border-line bg-surface p-3 shadow-pop sm:absolute sm:inset-x-auto sm:right-6 sm:top-[3.75rem] sm:w-[36rem]">
                <PersonaButtons locale={locale} currentUserId={viewer.userId} />
              </div>
            </details>
          )}
          {/* Dar ekranda başlık sığmaz; orada dil anahtarı giriş sayfasında ve pasaportta. */}
          <div className="hidden sm:block">
            <LocaleSwitch label={t("nav.language")} />
          </div>
          <p data-testid="viewer" className="hidden max-w-[16rem] truncate rounded-full bg-canvas px-3 text-sm font-medium leading-9 text-ink md:block">
            {t("auth.signedInAs", { org: viewer.orgName, role: t(`roles.${role}`) })}
          </p>
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-canvas"
            >
              <LogOut aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">{t("auth.signOut")}</span>
              <span className="sr-only sm:hidden">{t("auth.signOut")}</span>
            </button>
          </form>
        </div>
      </header>

      {children}

      <nav
        aria-label={t("nav.main")}
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {NAV.map((n) => (
          <NavLink key={n.href} href={n.href} icon={n.icon} label={t(`nav.${n.key}`)} variant="tab" />
        ))}
      </nav>
    </div>
  );
}
