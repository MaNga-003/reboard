import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScenarioCalculator } from "@/components/scenario/ScenarioCalculator";
import { ScenarioCompare } from "@/components/scenario/ScenarioParts";
import { SaasCosts } from "@/components/scenario/SaasCosts";
import { saasCostData } from "@/db/repo/saas";
import { requireViewer } from "@/lib/viewer";

// Senaryo ekranı (T2.5): rapordaki formüller, değiştirilebilir girdiler ve gizlenmeyen olumsuz senaryo; altında kaynaklı SaaS gider tablosu (T2.6).
// Hesap src/domain/calc'ta.
export default async function ScenarioPage({ params }: PageProps<"/[locale]/senaryo">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const saas = await saasCostData(viewer.tenant);

  return (
    <main id="main" className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-10 px-4 py-10">
      <div className="grid gap-2">
        <h1 className="font-display text-4xl">{t("scenario.title")}</h1>
        <p className="max-w-prose">{t("scenario.intro")}</p>
      </div>
      <ScenarioCalculator />
      <ScenarioCompare />
      <SaasCosts data={saas} />
    </main>
  );
}
