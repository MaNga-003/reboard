import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Link } from "@/i18n/navigation";

export default function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");

  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-24">
      <h1 className="font-display text-4xl leading-tight sm:text-5xl">{t("headline")}</h1>
      <p className="text-lg">{t("lead")}</p>
      <p role="note" className="rounded border border-fg/30 px-3 py-2 text-sm">
        {t("demoNotice")}
      </p>
      <Link href="/giris" className="inline-flex min-h-11 items-center self-start rounded bg-accent px-5 font-semibold text-on-accent">
        {t("signIn")}
      </Link>
    </main>
  );
}
