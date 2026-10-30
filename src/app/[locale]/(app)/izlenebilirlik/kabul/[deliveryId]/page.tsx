import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { ReceiveForm } from "@/components/trace/ReceiveForm";
import { getDb } from "@/db/client";
import { receiveTarget } from "@/db/repo/trace";
import { can } from "@/domain/access";
import { Decimal } from "@/domain/result";
import { BackLink } from "@/components/ui/BackLink";
import { cardPad, h1, lead, note } from "@/components/ui/classes";
import { fmtDate, fmtNumber } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";

// Teslim alma: yalnızca alıcı kurum ve yalnızca planlı teslim. Beyan ve bileşim ilandan önerilir; tartım alıcıdan gelir.
export default async function ReceivePage({ params }: PageProps<"/[locale]/izlenebilirlik/kabul/[deliveryId]">) {
  const { locale, deliveryId } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const target = await receiveTarget(getDb(), viewer.orgId, deliveryId);
  if (!target || target.status !== "planned") notFound();
  const canReceive = can(viewer.roles.join(","), "wasteBatch", "receive");
  const silk = target.containsSilk === null ? "unknown" : target.containsSilk ? "yes" : "no";

  return (
    <main id="main" className="mx-auto grid w-full max-w-3xl flex-1 content-start gap-6 px-4 py-8 sm:px-6 lg:py-10">
      <BackLink href="/izlenebilirlik">{t("trace.back")}</BackLink>
      <h1 className={h1}>{t("trace.receive.title")}</h1>
      <p className={lead}>{t("trace.receive.lead")}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-ink">{t("trace.receive.delivery")}</span>
        <ResultClassBadge value={target.resultClass} />
      </div>
      <dl className="grid gap-x-6 gap-y-2.5 rounded-2xl border border-line bg-surface p-5 text-sm shadow-card sm:grid-cols-[max-content_1fr] [&_dd]:text-ink">
        <dt className="font-medium text-muted">{t("trace.cols.seller")}</dt>
        <dd>{target.sellerName ?? t("market.hiddenOrg")}</dd>
        <dt className="font-medium text-muted">{t("trace.cols.listing")}</dt>
        <dd>{target.listingTitle ?? t("common.unknown")}</dd>
        <dt className="font-medium text-muted">{t("trace.cols.plannedAt")}</dt>
        <dd>{fmtDate(target.plannedAt, locale)}</dd>
        <dt className="font-medium text-muted">{t("trace.cols.plannedKg")}</dt>
        <dd>{target.plannedKg === null ? t("common.unknown") : fmtNumber(target.plannedKg, locale)}</dd>
      </dl>
      {canReceive ? (
        <div className={cardPad}>
          <ReceiveForm
            locale={locale}
            deliveryId={target.id}
            d={{ declaredKg: target.plannedKg === null ? "" : new Decimal(target.plannedKg).toString(), composition: target.composition, silk }}
          />
        </div>
      ) : (
        <p role="note" className={note}>
          {t("trace.readOnly")}
        </p>
      )}
    </main>
  );
}
