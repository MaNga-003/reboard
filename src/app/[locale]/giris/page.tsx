import { Boxes, ScanSearch, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PasswordForm } from "@/components/auth/PasswordForm";
import { PersonaButtons } from "@/components/auth/PersonaButtons";
import { LocaleSwitch } from "@/components/shell/LocaleSwitch";
import { BrandMark, Wordmark } from "@/components/ui/Brand";
import { alertBox, cardPad, h1, h2, lead, note } from "@/components/ui/classes";
import { Still } from "@/components/ui/Still";
import { Link, redirect } from "@/i18n/navigation";
import { getViewer } from "@/lib/viewer";

const PILLARS = [
  { icon: Boxes, key: "market" },
  { icon: ScanSearch, key: "continuity" },
  { icon: ShieldCheck, key: "verified" },
] as const;

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/giris">) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getViewer()) redirect({ href: "/panel", locale });
  const { hata } = await searchParams;
  const t = await getTranslations();
  const demo = process.env.DEMO_MODE === "true";

  return (
    <div className="rb-app grid min-h-screen flex-1 bg-canvas text-ink lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="rb-aurora rb-dark relative isolate hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Still
          name="fibre"
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-35 [mask-image:linear-gradient(to_bottom,transparent,black_55%)]"
        />
        <Link href="/" className="inline-flex min-h-11 items-center gap-3 self-start">
          <BrandMark className="size-10" />
          <Wordmark>{t("nav.brand")}</Wordmark>
        </Link>
        <div className="grid gap-8">
          <div className="grid gap-4">
            <p className="font-display text-4xl leading-tight text-side-ink xl:text-5xl">{t("home.headline")}</p>
            <p className="max-w-md text-base leading-relaxed text-side-muted">{t("home.lead")}</p>
          </div>
          <ul className="grid gap-3">
            {PILLARS.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-center gap-3 text-sm font-medium text-side-ink">
                <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-side-active ring-1 ring-side-line">
                  <Icon className="size-4.5" />
                </span>
                {t(`shell.pillars.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-side-muted">{t("home.demoNotice")}</p>
      </aside>

      <main id="main" className="mx-auto grid w-full max-w-2xl flex-1 content-center gap-8 px-4 py-10 sm:px-8 lg:py-16">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex min-h-11 items-center gap-3 text-ink lg:hidden">
            <BrandMark className="size-9" />
            <Wordmark>{t("nav.brand")}</Wordmark>
          </Link>
          <div className="ms-auto">
            <LocaleSwitch label={t("nav.language")} />
          </div>
        </div>
        <h1 className={h1}>{t("auth.title")}</h1>
        <section aria-labelledby="demo-title" className={`${cardPad} grid gap-4`}>
          <h2 id="demo-title" className={h2}>
            {t("auth.demoTitle")}
          </h2>
          {hata === "demo" && (
            <p role="alert" className={alertBox}>
              {t("auth.demoFailed")}
            </p>
          )}
          {demo ? (
            <>
              <p className={lead}>{t("auth.demoLead")}</p>
              <PersonaButtons locale={locale} />
            </>
          ) : (
            <p className={note}>{t("auth.demoUnavailable")}</p>
          )}
        </section>
        <section aria-labelledby="email-title" className={`${cardPad} grid max-w-md gap-4`}>
          <h2 id="email-title" className={h2}>
            {t("auth.emailTitle")}
          </h2>
          <PasswordForm locale={locale} />
        </section>
      </main>
    </div>
  );
}
