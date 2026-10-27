"use client";
// Senaryo hesaplayıcı (T2.5). Hesap tarayıcıda, sunucudakiyle aynı alan işleviyle (runScenario) yapılır:
// girdi değişince sonuç beklemeden yenilenir. Girdiler kaydedilmez (D-026). Varsayılan yalnız kaynaklı girdilerdir;
// her girdinin altında dayanağı ya da neden bilinmediği yazar (D-029).
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { control, Field } from "@/components/market/fields";
import { hidden } from "@/components/panel/Charts";
import {
  SCENARIO_FIELDS,
  SOURCED_SCENARIO,
  formFromParams,
  paramsFromForm,
  runScenario,
  scenarioAlerts,
  type ScenarioForm,
  type ScenarioGroup,
} from "@/domain/calc";
import { RESULT_IDS, ResultCard } from "./ScenarioParts";

const GROUPS: ScenarioGroup[] = ["volume", "factory", "customer", "reboard", "saas"];
const SOURCED_FORM = formFromParams(SOURCED_SCENARIO);
const same = (a: ScenarioForm, b: ScenarioForm) => SCENARIO_FIELDS.every((f) => a[f.key] === b[f.key]);

export function ScenarioCalculator() {
  const t = useTranslations();
  const [form, setForm] = useState<ScenarioForm>(SOURCED_FORM);
  const { params, invalid } = useMemo(() => paramsFromForm(form), [form]);
  const run = useMemo(() => runScenario(params), [params]);
  const alerts = Object.values(scenarioAlerts(run)).filter(Boolean).length;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Kaynaklı girdilerdeyken düğme kapalıdır: dönülecek bir şey yok. */}
        <button
          type="button"
          data-preset="sourced"
          disabled={same(form, SOURCED_FORM)}
          onClick={() => setForm(SOURCED_FORM)}
          className="inline-flex min-h-11 items-center rounded border border-fg px-4 text-start font-semibold disabled:border-fg/40 disabled:text-fg/70"
        >
          {t("scenario.presets.sourced")}
        </button>
      </div>

      <section aria-labelledby="sc-results" className="relative grid gap-4">
        <h2 id="sc-results" className="text-2xl font-semibold">
          {t("scenario.resultsTitle")}
        </h2>
        <p className="text-sm">{t("scenario.taxNote")}</p>
        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {RESULT_IDS.map((id) => (
            <ResultCard key={id} run={run} id={id} />
          ))}
        </dl>
        <p role="status" className={hidden}>
          {t("scenario.updated", { count: alerts })}
        </p>
      </section>

      <section aria-labelledby="sc-inputs" className="grid gap-4">
        <h2 id="sc-inputs" className="text-2xl font-semibold">
          {t("scenario.inputsTitle")}
        </h2>
        <form onSubmit={(e) => e.preventDefault()} className="grid gap-6 md:grid-cols-2">
          {GROUPS.map((g) => (
            <fieldset key={g} data-group={g} className="grid min-w-0 content-start gap-3 rounded border border-fg/30 p-4">
              <legend className="px-1 font-semibold">{t(`scenario.groups.${g}`)}</legend>
              {SCENARIO_FIELDS.filter((f) => f.group === g).map((f) => {
                const id = `sc-${f.key}`;
                const bad = invalid.includes(f.key);
                return (
                  <Field
                    key={f.key}
                    id={id}
                    label={t("scenario.fieldLabel", { label: t(`scenario.fields.${f.key}`), unit: t(`scenario.units.${f.unit}`) })}
                    hint={bad ? t(f.unit === "percent" ? "scenario.invalidPercent" : "scenario.invalid") : t(`scenario.basis.${f.basis}`)}
                  >
                    <input
                      id={id}
                      name={f.key}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={form[f.key]}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((prev) => ({ ...prev, [f.key]: v }));
                      }}
                      aria-invalid={bad || undefined}
                      aria-describedby={`${id}-hint`}
                      className={control}
                    />
                  </Field>
                );
              })}
            </fieldset>
          ))}
        </form>
      </section>
    </div>
  );
}
