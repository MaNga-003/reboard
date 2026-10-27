import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScenarioCalculator } from "@/components/scenario/ScenarioCalculator";
import { ScenarioCompare } from "@/components/scenario/ScenarioParts";
import { requireViewer } from "@/lib/viewer";

// Senaryo ekranı (T2.5): rapordaki formüller, değiştirilebilir girdiler ve gizlenmeyen olumsuz senaryo. Hesap src/domain/calc'ta.
export default async function ScenarioPage({ params }: PageProps<"/[locale]/senaryo">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireViewer(locale);
  const t = await getTranslations();

  return (
    <main id="main" className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-10 px-4 py-10">
      <div className="grid gap-2">
        <h1 className="font-display text-4xl">{t("scenario.title")}</h1>
        <p className="max-w-prose">{t("scenario.intro")}</p>
      </div>
      <ScenarioCalculator />
      <ScenarioCompare />
    </main>
  );
}
