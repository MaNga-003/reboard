"use client";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { createProductionAction } from "@/app/[locale]/(app)/izlenebilirlik/actions";
import { Field, FormError, a11y, control, submit } from "@/components/market/fields";
import { BINDERS } from "@/domain/panel";
import { keepValues } from "./keep";

/** Üretime girebilecek parti: kalan kg sunucuda biçimlenip gelir; tarayıcı hesap yapmaz. */
export type StockOption = { id: string; code: string; remaining: string; remainingText: string; supplier: string };

/** Üretim partisi: doğrulanmış stoktan tahsis (a_<parti>), kütle dengesi ve isteğe bağlı panel lotu. */
export function ProductionForm({ locale, stock, canLot }: { locale: string; stock: StockOption[]; canLot: boolean }) {
  const t = useTranslations();
  const f = (k: string, v?: Record<string, string>) => t(`trace.production.${k}`, v);
  const [state, dispatch, pending] = useActionState(createProductionAction, null);
  const bad = state?.fields;

  return (
    <form action={dispatch} onSubmit={keepValues(dispatch)} className="grid gap-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <fieldset className="grid gap-3 rounded-2xl border border-line bg-canvas p-4">
        <legend className="px-1 font-semibold text-ink">{f("stock")}</legend>
        <p className="text-sm text-muted">{f("stockHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {stock.map((s) => (
            <Field key={s.id} id={`a_${s.id}`} label={f("allocate", { code: s.code })} hint={f("remaining", { kg: s.remainingText, supplier: s.supplier })}>
              <input {...a11y(`a_${s.id}`, `a_${s.id}`, bad, true)} inputMode="decimal" data-remaining={s.remaining} className={control} />
            </Field>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-2xl border border-line bg-canvas p-4">
        <legend className="px-1 font-semibold text-ink">{t("trace.lot.massBalance")}</legend>
        <p className="text-sm text-muted">{f("balanceHint")}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["outputKg", "scrapKg", "moistureLossKg"] as const).map((k) => (
            <Field key={k} id={k} label={f(k)}>
              <input {...a11y(k, k, bad)} inputMode="decimal" required className={control} />
            </Field>
          ))}
        </div>
        <Field id="balanceNote" label={f("balanceNote")}>
          <textarea {...a11y("balanceNote", "balanceNote", bad)} maxLength={500} rows={2} className={control} />
        </Field>
      </fieldset>

      <Field id="binder" label={f("binder")} hint={f("binderHint")}>
        <select {...a11y("binder", "binder", bad, true)} defaultValue="unknown" className={`${control} sm:max-w-xs`}>
          {BINDERS.map((b) => (
            <option key={b} value={b}>
              {t(`trace.binders.${b}`)}
            </option>
          ))}
        </select>
      </Field>

      {canLot ? (
        <fieldset className="grid gap-3 rounded-2xl border border-line bg-canvas p-4">
          <legend className="px-1 font-semibold text-ink">{f("lot")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="sheetCount" label={f("sheetCount")} hint={f("sheetHint")}>
              <input {...a11y("sheetCount", "sheetCount", bad, true)} type="number" min={1} step={1} inputMode="numeric" className={control} />
            </Field>
            <Field id="densityKgM3" label={f("density")} hint={f("densityHint")}>
              <input {...a11y("densityKgM3", "densityKgM3", bad, true)} inputMode="decimal" className={control} />
            </Field>
          </div>
        </fieldset>
      ) : (
        <>
          <input type="hidden" name="sheetCount" value="" />
          <input type="hidden" name="densityKgM3" value="" />
        </>
      )}
      <FormError message={state ? t(`trace.errors.${state.error}`) : null} />
      <button type="submit" disabled={pending} className={submit}>
        {f("submit")}
      </button>
    </form>
  );
}
