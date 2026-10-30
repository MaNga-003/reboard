import { getTranslations, setRequestLocale } from "next-intl/server";
import { ListingForm } from "@/components/market/ListingForm";
import { BackLink } from "@/components/ui/BackLink";
import { cardPad, h1, note } from "@/components/ui/classes";
import { can } from "@/domain/access";
import { addDays, defaultListingKind, istanbulDay } from "@/domain/market";
import { requireViewer } from "@/lib/viewer";

// Varsayılan pencere bugünden 30 gün; tür kurumun rolünden (üretici atık ister, alıcı panel ister).
export default async function NewListingPage({ params }: PageProps<"/[locale]/pazar/yeni">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const today = istanbulDay(new Date());

  return (
    <main id="main" className="mx-auto grid w-full max-w-3xl flex-1 content-start gap-6 px-4 py-8 sm:px-6 lg:py-10">
      <BackLink href="/pazar">{t("market.detail.back")}</BackLink>
      <h1 className={h1}>{t("market.listingForm.title")}</h1>
      {can(viewer.roles.join(","), "listing", "create") ? (
        <div className={cardPad}>
          <ListingForm locale={locale} defaultKind={defaultListingKind(viewer.orgKind)} today={today} until={addDays(today, 30)} />
        </div>
      ) : (
        <p role="note" className={note}>
          {t("market.readOnly")}
        </p>
      )}
    </main>
  );
}
