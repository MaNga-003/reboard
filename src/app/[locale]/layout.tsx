import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { clientMessages } from "@/i18n/client-messages";
import { routing } from "@/i18n/routing";
import { cssVariables } from "@/design/tokens";
import "../globals.css";

// latin-ext: ğ, ş, ı, İ için gerekli.
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin", "latin-ext"] });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${inter.variable} ${fraunces.variable} h-full antialiased`} style={cssVariables()}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={await clientMessages("root")}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
