import { getTranslations, setRequestLocale } from "next-intl/server";
import { ListingForm } from "@/components/market/ListingForm";
import { can } from "@/domain/access";
import { addDays, defaultListingKind, istanbulDay } from "@/domain/market";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/viewer";

// Varsayılan pencere bugünden 30 gün; tür kurumun rolünden (üretici atık ister, alıcı panel ister).
export default async function NewListingPage({ params }: PageProps<"/[locale]/pazar/yeni">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const today = istanbulDay(new Date());

  return (
    <main id="main" className="mx-auto grid w-full max-w-3xl flex-1 content-start gap-6 px-4 py-10">
      <Link href="/pazar" className="inline-flex min-h-11 items-center justify-self-start underline underline-offset-4">
        {t("market.detail.back")}
      </Link>
      <h1 className="font-display text-4xl">{t("market.listingForm.title")}</h1>
      {can(viewer.roles.join(","), "listing", "create") ? (
        <ListingForm locale={locale} defaultKind={defaultListingKind(viewer.orgKind)} today={today} until={addDays(today, 30)} />
      ) : (
        <p role="note" className="rounded border border-fg/30 px-3 py-2">
          {t("market.readOnly")}
        </p>
      )}
    </main>
  );
}
