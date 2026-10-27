import { getTranslations, setRequestLocale } from "next-intl/server";
import { PasswordForm } from "@/components/auth/PasswordForm";
import { PersonaButtons } from "@/components/auth/PersonaButtons";
import { redirect } from "@/i18n/navigation";
import { getViewer } from "@/lib/viewer";

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/giris">) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getViewer()) redirect({ href: "/panel", locale });
  const { hata } = await searchParams;
  const t = await getTranslations("auth");
  const demo = process.env.DEMO_MODE === "true";

  return (
    <main id="main" className="mx-auto grid w-full max-w-3xl flex-1 content-start gap-10 px-4 py-16">
      <h1 className="font-display text-4xl">{t("title")}</h1>
      <section aria-labelledby="demo-title" className="grid gap-4">
        <h2 id="demo-title" className="text-2xl font-semibold">
          {t("demoTitle")}
        </h2>
        {hata === "demo" && (
          <p role="alert" className="rounded border-2 border-fg px-3 py-2">
            {t("demoFailed")}
          </p>
        )}
        {demo ? (
          <>
            <p>{t("demoLead")}</p>
            <PersonaButtons locale={locale} />
          </>
        ) : (
          <p>{t("demoUnavailable")}</p>
        )}
      </section>
      <section aria-labelledby="email-title" className="grid max-w-md gap-4">
        <h2 id="email-title" className="text-2xl font-semibold">
          {t("emailTitle")}
        </h2>
        <PasswordForm locale={locale} />
      </section>
    </main>
  );
}
