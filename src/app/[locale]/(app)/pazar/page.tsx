import { getTranslations, setRequestLocale } from "next-intl/server";
import { ListingCard } from "@/components/market/ListingCard";
import { MarketMap } from "@/components/market/MarketMap";
import { control } from "@/components/market/fields";
import { getDb } from "@/db/client";
import { listMarket } from "@/db/repo/market";
import { can } from "@/domain/access";
import { LISTING_KINDS } from "@/domain/market";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/viewer";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

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
    <main id="main" className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-6 px-4 py-10">
      <div className="grid gap-2">
        <h1 className="font-display text-4xl">{t("market.title")}</h1>
        <p className="max-w-prose">{t("market.lead")}</p>
      </div>
      {error && t.has(`market.errors.${error}`) && (
        <p role="alert" className="rounded border-2 border-fg px-3 py-2">
          {t(`market.errors.${error}`)}
        </p>
      )}
      {can(roles, "listing", "create") ? (
        <Link href="/pazar/yeni" className="inline-flex min-h-11 items-center justify-self-start rounded bg-accent px-5 font-semibold text-on-accent">
          {t("market.newListing")}
        </Link>
      ) : (
        <p role="note" className="rounded border border-fg/30 px-3 py-2 text-sm">
          {t("market.readOnly")}
        </p>
      )}

      <form method="get" aria-labelledby="filter-title" className="grid gap-3 rounded border border-fg/30 p-4">
        <h2 id="filter-title" className="font-semibold">
          {t("market.filters.title")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div className="grid gap-1">
            <label htmlFor="tur">{t("market.filters.kind")}</label>
            <select id="tur" name="tur" defaultValue={kind ?? ""} className={control}>
              <option value="">{t("market.filters.all")}</option>
              {LISTING_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`market.kinds.${k}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="ipeksiz">{t("market.filters.silk")}</label>
            <select id="ipeksiz" name="ipeksiz" defaultValue={silkFree ? "1" : ""} className={control}>
              <option value="">{t("market.filters.all")}</option>
              <option value="1">{t("market.filters.silkFree")}</option>
            </select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="sirala">{t("market.filters.sort")}</label>
            <select id="sirala" name="sirala" defaultValue={sort === "new" ? "yeni" : "skor"} className={control}>
              <option value="skor">{t("market.filters.sortScore")}</option>
              <option value="yeni">{t("market.filters.sortNew")}</option>
            </select>
          </div>
          <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded border border-fg/60 px-5 font-semibold hover:bg-fg/5">
            {t("market.filters.apply")}
          </button>
        </div>
      </form>

      <MarketMap
        points={rows.flatMap(({ listing: l, own }) => (l.lat !== null && l.lon !== null ? [{ id: l.id, title: l.title, own, lon: l.lon, lat: l.lat }] : []))}
      />

      <section aria-labelledby="results-title" className="grid gap-4">
        <h2 id="results-title" className="text-2xl font-semibold">
          {t("market.results", { count: rows.length })}
        </h2>
        {rows.length === 0 ? (
          <p>{t("market.empty")}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((row) => (
              <ListingCard key={row.listing.id} row={row} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
