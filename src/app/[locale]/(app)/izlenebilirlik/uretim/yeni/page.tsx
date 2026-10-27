import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductionForm, type StockOption } from "@/components/trace/ProductionForm";
import { getDb } from "@/db/client";
import { stock } from "@/db/repo/trace";
import { can } from "@/domain/access";
import { producible } from "@/domain/traceability";
import { Link } from "@/i18n/navigation";
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
    <main id="main" className="mx-auto grid w-full max-w-3xl flex-1 content-start gap-6 px-4 py-10">
      <Link href="/izlenebilirlik" className="inline-flex min-h-11 items-center justify-self-start underline underline-offset-4">
        {t("trace.back")}
      </Link>
      <h1 className="font-display text-4xl">{t("trace.production.title")}</h1>
      <p className="max-w-prose">{t("trace.production.lead")}</p>
      {!canProduce ? (
        <p role="note" className="rounded border border-fg/30 px-3 py-2">
          {t("trace.readOnly")}
        </p>
      ) : options.length === 0 ? (
        <p role="note" className="rounded border border-fg/30 px-3 py-2">
          {t("trace.production.noStock")}
        </p>
      ) : (
        <ProductionForm locale={locale} stock={options} canLot={can(roles, "panelLot", "create")} />
      )}
    </main>
  );
}
