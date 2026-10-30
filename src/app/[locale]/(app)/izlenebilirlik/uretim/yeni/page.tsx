import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductionForm, type StockOption } from "@/components/trace/ProductionForm";
import { getDb } from "@/db/client";
import { stock } from "@/db/repo/trace";
import { can } from "@/domain/access";
import { producible } from "@/domain/traceability";
import { BackLink } from "@/components/ui/BackLink";
import { cardPad, h1, lead, note } from "@/components/ui/classes";
import { fmtNumber } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";

// Yeni üretim partisi: yalnızca doğrulanmış ve stokta kalan partiler listelenir (alan kuralı da aynısını reddeder).
export default async function NewProductionPage({ params }: PageProps<"/[locale]/izlenebilirlik/uretim/yeni">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const roles = viewer.roles.join(",");
  const canProduce = can(roles, "production", "create");
  const db = getDb();
  const rows = canProduce ? await stock(db, viewer.orgId) : [];
  const tenant = viewer.tenant;
  const names = new Map((await tenant.list("organizations")).map((o) => [o.id, o.name]));
  const options: StockOption[] = rows
    .filter((r) => producible({ verified: r.batch.verified, remainingKg: r.remaining }))
    .map((r) => ({
      id: r.batch.id,
      code: r.batch.code,
      remaining: r.remaining!.toString(),
      remainingText: fmtNumber(r.remaining!, locale),
      supplier: names.get(r.batch.supplierOrgId) ?? t("market.hiddenOrg"),
    }));

  return (
    <main id="main" className="mx-auto grid w-full max-w-3xl flex-1 content-start gap-6 px-4 py-8 sm:px-6 lg:py-10">
      <BackLink href="/izlenebilirlik">{t("trace.back")}</BackLink>
      <h1 className={h1}>{t("trace.production.title")}</h1>
      <p className={lead}>{t("trace.production.lead")}</p>
      {!canProduce ? (
        <p role="note" className={note}>
          {t("trace.readOnly")}
        </p>
      ) : options.length === 0 ? (
        <p role="note" className={note}>
          {t("trace.production.noStock")}
        </p>
      ) : (
        <div className={cardPad}>
          <ProductionForm locale={locale} stock={options} canLot={can(roles, "panelLot", "create")} />
        </div>
      )}
    </main>
  );
}
