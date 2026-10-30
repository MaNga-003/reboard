import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScenarioCalculator } from "@/components/scenario/ScenarioCalculator";
import { ScenarioReferences } from "@/components/scenario/ScenarioReferences";
import { SaasCosts } from "@/components/scenario/SaasCosts";
import { PageBanner } from "@/components/ui/PageHeader";
import { page } from "@/components/ui/classes";
import { saasCostData } from "@/db/repo/saas";
import { scenarioReferences } from "@/db/repo/scenario";
import { requireViewer } from "@/lib/viewer";

// Senaryo ekranı (T2.5): rapordaki formüller ve değiştirilebilir girdiler; varsayılan yalnız kaynaklı girdilerdir (D-029).
// Altında karşılaştırma için kaynaklı değerler ve kaynaklı SaaS gider tablosu (T2.6).
// Hesap src/domain/calc'ta.
export default async function ScenarioPage({ params }: PageProps<"/[locale]/senaryo">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await requireViewer(locale);
  const t = await getTranslations();
  const [saas, references] = await Promise.all([saasCostData(viewer.tenant), scenarioReferences(viewer.tenant)]);

  return (
    <main id="main" className={`${page} gap-10`}>
      <PageBanner still="earth" title={t("scenario.title")} lead={t("scenario.intro")} />
      <ScenarioCalculator />
      <ScenarioReferences items={references} />
      <SaasCosts data={saas} />
    </main>
  );
}
