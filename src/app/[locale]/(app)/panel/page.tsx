import { getTranslations, setRequestLocale } from "next-intl/server";
import { permissionList } from "@/domain/access";
import { requireViewer } from "@/lib/viewer";

// Geçici panel (T1.5): oturum, kurum ve rol farkını gösterir. Göstergeler T2.3'te gelir.
export default async function PanelPage({ params }: PageProps<"/[locale]/panel">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const perms = permissionList(viewer.roles.join(","));

  return (
    <main id="main" className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-8 px-4 py-10">
      <div className="grid gap-2">
        <h1 className="font-display text-4xl">{t("panel.title")}</h1>
        <p>{t("panel.welcome", { name: viewer.userName })}</p>
      </div>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[max-content_1fr]">
        <dt className="font-semibold">{t("panel.organization")}</dt>
        <dd>{viewer.orgName}</dd>
        <dt className="font-semibold">{t("panel.kind")}</dt>
        <dd>{viewer.orgKind ? t(`orgKind.${viewer.orgKind}`) : t("common.unknown")}</dd>
        <dt className="font-semibold">{t("panel.role")}</dt>
        <dd>{viewer.roles.map((r) => t(`roles.${r}`)).join(", ")}</dd>
      </dl>
      <section aria-labelledby="perm-title" className="grid gap-3">
        <h2 id="perm-title" className="text-2xl font-semibold">
          {t("panel.permissionsTitle")}
        </h2>
        <p className="max-w-prose">{t("panel.permissionsLead")}</p>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {perms.map((p) => (
            <li
              key={`${p.resource}.${p.action}`}
              data-allowed={p.allowed}
              className="flex justify-between gap-4 border-b border-fg/20 py-2"
            >
              <span>{t(`permissions.${p.resource}.${p.action}`)}</span>
              <span className={p.allowed ? "font-semibold" : "line-through"}>{p.allowed ? t("panel.allowed") : t("panel.denied")}</span>
            </li>
          ))}
        </ul>
      </section>
      <p role="note" className="rounded border border-fg/30 px-3 py-2 text-sm">
        {t("panel.comingSoon")}
      </p>
    </main>
  );
}
