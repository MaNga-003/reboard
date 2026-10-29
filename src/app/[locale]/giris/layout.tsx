import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { clientMessages } from "@/i18n/client-messages";

export default async function SignInLayout({ children, params }: LayoutProps<"/[locale]/giris">) {
  setRequestLocale((await params).locale);
  return <NextIntlClientProvider messages={await clientMessages("giris")}>{children}</NextIntlClientProvider>;
}
