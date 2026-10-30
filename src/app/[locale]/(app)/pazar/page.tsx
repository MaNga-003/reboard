import { Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ListingCard } from "@/components/market/ListingCard";
import { MarketMap } from "@/components/market/MarketMap";
import { control } from "@/components/market/fields";
import { alertBox, btnPrimary, btnSecondary, cardPad, h2, note, page } from "@/components/ui/classes";
import { PageBanner } from "@/components/ui/PageHeader";
import { getDb } from "@/db/client";
import { listMarket } from "@/db/repo/market";
import { can } from "@/domain/access";
import { LISTING_KINDS } from "@/domain/market";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/viewer";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const label = "text-sm font-medium text-ink";

// Süzgeç düz GET formudur: JavaScript olmadan da çalışır, adres paylaşılabilir.
export default async function MarketPage({ params, searchParams }: PageProps<"/[locale]/pazar">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const sp = await searchParams;
  const kind = LISTING_KINDS.find((k) => k === one(sp.tur));
  const silkFree = one(sp.ipeksiz) === "1";
  const sort = one(sp.sirala) === "yeni" ? "new" : "score";
  const error = one(sp.hata);
  const rows = await listMarket(getDb(), viewer.orgId, { kind, silkFree, sort });
  const roles = viewer.roles.join(",");

  return (
    <main id="main" className={`${page} gap-6`}>
      <PageBanner
        still="scraps"
        title={t("market.title")}
        lead={t("market.lead")}
        actions={
          can(roles, "listing", "create") ? (
            <Link href="/pazar/yeni" className={btnPrimary}>
              <Plus aria-hidden="true" className="size-4" />
              {t("market.newListing")}
            </Link>
          ) : (
            <p role="note" className="max-w-md rounded-xl border border-side-line bg-side-active px-4 py-3 text-sm text-side-ink">
              {t("market.readOnly")}
            </p>
          )
        }
      />
      {error && t.has(`market.errors.${error}`) && (
        <p role="alert" className={alertBox}>
          {t(`market.errors.${error}`)}
        </p>
      )}

      <form method="get" aria-labelledby="filter-title" className={`${cardPad} grid gap-4`}>
        <h2 id="filter-title" className="text-sm font-semibold uppercase tracking-wider text-subtle">
          {t("market.filters.title")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <label htmlFor="tur" className={label}>
              {t("market.filters.kind")}
            </label>
            <select id="tur" name="tur" defaultValue={kind ?? ""} className={control}>
              <option value="">{t("market.filters.all")}</option>
              {LISTING_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`market.kinds.${k}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="ipeksiz" className={label}>
              {t("market.filters.silk")}
            </label>
            <select id="ipeksiz" name="ipeksiz" defaultValue={silkFree ? "1" : ""} className={control}>
              <option value="">{t("market.filters.all")}</option>
              <option value="1">{t("market.filters.silkFree")}</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="sirala" className={label}>
              {t("market.filters.sort")}
            </label>
            <select id="sirala" name="sirala" defaultValue={sort === "new" ? "yeni" : "skor"} className={control}>
              <option value="skor">{t("market.filters.sortScore")}</option>
              <option value="yeni">{t("market.filters.sortNew")}</option>
            </select>
          </div>
          <button type="submit" className={btnSecondary}>
            {t("market.filters.apply")}
          </button>
        </div>
      </form>

      <MarketMap
        points={rows.flatMap(({ listing: l, own }) => (l.lat !== null && l.lon !== null ? [{ id: l.id, title: l.title, own, lon: l.lon, lat: l.lat }] : []))}
      />

      <section aria-labelledby="results-title" className="grid gap-4">
        <h2 id="results-title" className={h2}>
          {t("market.results", { count: rows.length })}
        </h2>
        {rows.length === 0 ? (
          <p className={note}>{t("market.empty")}</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <ListingCard key={row.listing.id} row={row} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
