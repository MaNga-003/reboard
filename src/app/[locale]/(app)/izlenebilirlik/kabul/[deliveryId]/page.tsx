import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { ReceiveForm } from "@/components/trace/ReceiveForm";
import { getDb } from "@/db/client";
import { receiveTarget } from "@/db/repo/trace";
import { can } from "@/domain/access";
import { Decimal } from "@/domain/result";
import { Link } from "@/i18n/navigation";
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
    <main id="main" className="mx-auto grid w-full max-w-3xl flex-1 content-start gap-6 px-4 py-10">
      <Link href="/izlenebilirlik" className="inline-flex min-h-11 items-center justify-self-start underline underline-offset-4">
        {t("trace.back")}
      </Link>
      <h1 className="font-display text-4xl">{t("trace.receive.title")}</h1>
      <p className="max-w-prose">{t("trace.receive.lead")}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{t("trace.receive.delivery")}</span>
        <ResultClassBadge value={target.resultClass} />
      </div>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="font-semibold">{t("trace.cols.seller")}</dt>
        <dd>{target.sellerName ?? t("market.hiddenOrg")}</dd>
        <dt className="font-semibold">{t("trace.cols.listing")}</dt>
        <dd>{target.listingTitle ?? t("common.unknown")}</dd>
        <dt className="font-semibold">{t("trace.cols.plannedAt")}</dt>
        <dd>{fmtDate(target.plannedAt, locale)}</dd>
        <dt className="font-semibold">{t("trace.cols.plannedKg")}</dt>
        <dd>{target.plannedKg === null ? t("common.unknown") : fmtNumber(target.plannedKg, locale)}</dd>
      </dl>
      {canReceive ? (
        <ReceiveForm
          locale={locale}
          deliveryId={target.id}
          d={{ declaredKg: target.plannedKg === null ? "" : new Decimal(target.plannedKg).toString(), composition: target.composition, silk }}
        />
      ) : (
        <p role="note" className="rounded border border-fg/30 px-3 py-2">
          {t("trace.readOnly")}
        </p>
      )}
    </main>
  );
}
