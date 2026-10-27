import { getTranslations, setRequestLocale } from "next-intl/server";
import { PersonaButtons } from "@/components/auth/PersonaButtons";
import { isRole } from "@/domain/access";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/viewer";
import { signOutAction } from "../giris/actions";

const tap = "inline-flex min-h-11 items-center rounded px-3";

export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const role = viewer.roles.find(isRole) ?? viewer.roles[0];
  const demo = process.env.DEMO_MODE === "true";

  return (
    <>
      <header className="border-b border-fg/30">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2">
          <Link href="/" className={`${tap} font-display text-xl`}>
            {t("nav.brand")}
          </Link>
          <nav aria-label={t("nav.main")}>
            <Link href="/panel" className={`${tap} underline-offset-4 hover:underline`}>
              {t("nav.dashboard")}
            </Link>
          </nav>
          <p data-testid="viewer" className="ms-auto px-3 text-sm">
            {t("auth.signedInAs", { org: viewer.orgName, role: t(`roles.${role}`) })}
          </p>
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className={`${tap} border border-fg/40 hover:bg-fg/5`}>
              {t("auth.signOut")}
            </button>
          </form>
        </div>
        {demo && (
          <details className="mx-auto w-full max-w-5xl px-4 pb-2">
            <summary className={`${tap} cursor-pointer gap-2 text-sm`}>
              <span>{t("auth.demoBar")}</span>
              <span className="font-semibold underline underline-offset-4">{t("auth.switchRole")}</span>
            </summary>
            <div className="pt-2">
              <PersonaButtons locale={locale} currentUserId={viewer.userId} />
            </div>
          </details>
        )}
      </header>
      {children}
    </>
  );
}
