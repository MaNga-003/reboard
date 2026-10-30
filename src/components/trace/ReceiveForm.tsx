"use client";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { receiveAction } from "@/app/[locale]/(app)/izlenebilirlik/actions";
import { Field, FormError, a11y, control, submit } from "@/components/market/fields";
import { FIBRES, type Composition } from "@/domain/fibre";
import { keepValues } from "./keep";

const FIBRE_FIELDS = FIBRES.filter((f) => f !== "unknown");

export type ReceiveDefaults = { declaredKg: string; composition: Composition | null; silk: "yes" | "no" | "unknown" };

/** Teslim alma: beyan ilandan gelir, tartım ve ayıklama alıcıdan. Boş alan bilinmeyen olarak kaydedilir. */
export function ReceiveForm({ locale, deliveryId, d }: { locale: string; deliveryId: string; d: ReceiveDefaults }) {
  const t = useTranslations();
  const f = (k: string) => t(`trace.receive.${k}`);
  const [state, dispatch, pending] = useActionState(receiveAction, null);
  const bad = state?.fields;

  return (
    <form action={dispatch} onSubmit={keepValues(dispatch)} className="grid gap-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="declaredKg" label={f("declaredKg")} hint={f("declaredHint")}>
          <input {...a11y("declaredKg", "declaredKg", bad, true)} inputMode="decimal" defaultValue={d.declaredKg} className={control} />
        </Field>
        <Field id="weighedKg" label={f("weighedKg")} hint={f("weighedHint")}>
          <input {...a11y("weighedKg", "weighedKg", bad, true)} inputMode="decimal" className={control} />
        </Field>
        <Field id="rejectedKg" label={f("rejectedKg")} hint={f("rejectedHint")}>
          <input {...a11y("rejectedKg", "rejectedKg", bad, true)} inputMode="decimal" className={control} />
        </Field>
        <Field id="moisturePct" label={f("moisturePct")}>
          <input {...a11y("moisturePct", "moisturePct", bad)} inputMode="decimal" className={control} />
        </Field>
      </div>

      <fieldset className="grid gap-3 rounded-2xl border border-line bg-canvas p-4">
        <legend className="px-1 font-semibold text-ink">{f("composition")}</legend>
        <p className="text-sm text-muted">{f("compositionHint")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FIBRE_FIELDS.map((fb) => (
            <Field key={fb} id={`c_${fb}`} label={t(`fibres.${fb}`)}>
              <input
                {...a11y(`c_${fb}`, `c_${fb}`, bad)}
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                defaultValue={d.composition?.[fb] ?? ""}
                className={control}
              />
            </Field>
          ))}
        </div>
        <Field id="silk" label={f("silk")}>
          <select {...a11y("silk", "silk", bad)} defaultValue={d.silk} className={`${control} sm:max-w-xs`}>
            {(["no", "yes", "unknown"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`market.silk.${s}`)}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <Field id="notes" label={f("notes")}>
        <textarea {...a11y("notes", "notes", bad)} maxLength={500} rows={2} className={control} />
      </Field>
      <FormError message={state ? t(`trace.errors.${state.error}`) : null} />
      <button type="submit" disabled={pending} className={submit}>
        {f("submit")}
      </button>
    </form>
  );
}
