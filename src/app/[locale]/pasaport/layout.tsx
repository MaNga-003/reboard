import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { clientMessages } from "@/i18n/client-messages";

export default async function PassportLayout({ children, params }: LayoutProps<"/[locale]/pasaport">) {
  setRequestLocale((await params).locale);
  return <NextIntlClientProvider messages={await clientMessages("pasaport")}>{children}</NextIntlClientProvider>;
}
