import { useLocale, useTranslations } from "next-intl";
import { StatusChip } from "@/components/panel/Status";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { scenarioAlerts, type ScenarioRun } from "@/domain/calc";
import { weakestClass, type Decimal, type Result } from "@/domain/result";
import { fmtMoney, fmtNumber } from "@/lib/format";

export const RESULT_IDS = ["factory", "customer", "reboard", "corridor", "saas"] as const;
export type ResultId = (typeof RESULT_IDS)[number];

/** Koridorun sınıfı iki sınırın en zayıfıdır; koşulları alt sınırda taşınır. */
const resultOf = (run: ScenarioRun, id: ResultId): Result => (id === "corridor" ? run.corridor.lower : run[id]);
const classOf = (run: ScenarioRun, id: ResultId) =>
  id === "corridor" ? weakestClass([run.corridor.lower.resultClass, run.corridor.upper.resultClass]) : run[id].resultClass;

/** Sonuç ve ara toplam metinleri. Bilinmeyen "bilinmiyor" yazar, asla 0 (D-011). */
function useScenarioText() {
  const t = useTranslations();
  const locale = useLocale();
  const unknown = t("common.unknown");
  const num = (v: Decimal | null) => (v === null ? unknown : fmtMoney(v, locale));
  const money = (v: Decimal | null) => (v === null ? unknown : t("scenario.money", { amount: fmtMoney(v, locale) }));
  const perM2 = (v: Decimal | null) => (v === null ? unknown : t("scenario.perM2", { amount: fmtMoney(v, locale) }));
  const area = (v: Decimal | null) => (v === null ? unknown : t("scenario.m2", { value: fmtNumber(v, locale, 2) }));

  const value = (run: ScenarioRun, id: ResultId) => {
    if (id !== "corridor") return money(run[id].value);
    const { lower, upper } = run.corridor;
    if (lower.value === null && upper.value === null) return unknown;
    return t("scenario.perM2", { amount: t("scenario.corridorValue", { lower: num(lower.value), upper: num(upper.value) }) });
  };

  const parts = (run: ScenarioRun, id: ResultId) => {
    const p = run.parts;
    switch (id) {
      case "factory":
        return t("scenario.results.factory.parts", { now: money(p.factory.currentNet), next: money(p.factory.newNet), result: value(run, id) });
      case "customer":
        return t("scenario.results.customer.parts", { now: money(p.customer.current), next: money(p.customer.reboard), result: value(run, id) });
      case "reboard":
        return t("scenario.results.reboard.parts", { now: money(p.reboard.revenue), next: money(p.reboard.cost), result: value(run, id) });
      case "saas":
        return t("scenario.results.saas.parts", { now: money(p.saas.subscription), next: money(p.saas.customerCost), result: value(run, id) });
      case "corridor":
        return t("scenario.results.corridor.parts", {
          lowerNum: money(p.corridor.lowerNumerator),
          upperNum: money(p.corridor.upperNumerator),
          area: area(p.corridor.areaM2),
          lower: perM2(run.corridor.lower.value),
          upper: perM2(run.corridor.upper.value),
        });
    }
  };

  return { value, parts, area };
}

/**
 * Sonuç kutusu. Sınıf rozeti zorunlu (D-011); data-kpi dürüstlük testinin kataloğudur.
 * Zarar ve oluşmayan koridor kırmızıdır, ama hiçbir zaman yalnızca renkle değil: simge, yazı ve açıklama birlikte.
 */
export function ResultCard({ run, id }: { run: ScenarioRun; id: ResultId }) {
  const t = useTranslations();
  const text = useScenarioText();
  const alert = scenarioAlerts(run)[id];
  // Koridorun yokluğu çipte yazar; aynı cümleyi koşul olarak tekrarlamak gürültü olur.
  const conditions = resultOf(run, id).conditions.filter((c) => c !== "no_corridor");
  return (
    <div data-kpi={`scenario-${id}`} data-alert={alert} className={`grid min-w-0 content-start gap-1 pt-2 ${alert ? "border-t-4 border-danger" : "border-t-2 border-fg"}`}>
      <dt className="font-semibold">{t(`scenario.results.${id}.title`)}</dt>
      <dd data-value className="text-3xl font-semibold break-words [font-variant-numeric:normal]">
        {text.value(run, id)}
      </dd>
      <dd className="flex flex-wrap items-center gap-2 text-sm">
        <ResultClassBadge value={classOf(run, id)} />
        {alert && <StatusChip level="danger" label={t(id === "corridor" ? "scenario.noCorridor" : "scenario.loss")} />}
        {conditions.map((c) => (
          <span key={c} data-condition={c}>
            {t(`scenario.conditions.${c}`)}
          </span>
        ))}
      </dd>
      {alert && (
        <dd data-explain className="text-sm font-semibold">
          {t(`scenario.results.${id}.alert`)}
        </dd>
      )}
      <dd className="text-sm">{t(`scenario.results.${id}.formula`)}</dd>
      <dd data-parts className="text-sm break-words">
        {text.parts(run, id)}
      </dd>
      {id === "customer" && (
        <dd className="text-sm">{t("scenario.usableArea", { area: text.area(run.usableAreaM2) })}</dd>
      )}
    </div>
  );
}
