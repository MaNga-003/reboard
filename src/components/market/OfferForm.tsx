"use client";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { placeOfferAction } from "@/app/[locale]/(app)/pazar/actions";
import { Field, FormError, a11y, control, submit } from "./fields";

export type OfferDefaults = { quantity: string; maxQuantity: string; unit: string; payer: string; amount: string; date: string; minDate: string; maxDate: string | null };

/** Teklif ilanın biriminde verilir; varsayılanlar ilandan gelir (miktar, fiyat yönü, pencere). */
export function OfferForm({ locale, listingId, d }: { locale: string; listingId: string; d: OfferDefaults }) {
  const t = useTranslations();
  const f = (k: string, v?: Record<string, string>) => t(`market.offerForm.${k}`, v);
  const [state, action, pending] = useActionState(placeOfferAction, null);
  const bad = state?.fields;
  const unit = t(`units.${d.unit}`);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="listingId" value={listingId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="quantity" label={f("quantity", { unit })} hint={f("quantityHint", { max: d.maxQuantity, unit })}>
          <input {...a11y("quantity", "quantity", bad, true)} inputMode="decimal" defaultValue={d.quantity} required className={control} />
        </Field>
        <Field id="proposedDate" label={f("date")}>
          <input
            {...a11y("proposedDate", "proposedDate", bad)}
            type="date"
            defaultValue={d.date}
            min={d.minDate}
            max={d.maxDate ?? undefined}
            required
            className={control}
          />
        </Field>
        <Field id="payer" label={f("payer")}>
          <select {...a11y("payer", "payer", bad)} defaultValue={d.payer} className={control}>
            {(["buyer", "seller", "none", "unknown"] as const).map((p) => (
              <option key={p} value={p}>
                {t(`market.payer.${p}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="amount" label={f("amount", { unit })}>
          <input {...a11y("amount", "amount", bad)} inputMode="decimal" defaultValue={d.amount} className={control} />
        </Field>
      </div>
      <Field id="message" label={f("message")}>
        <textarea {...a11y("message", "message", bad)} maxLength={300} rows={2} className={control} />
      </Field>
      <FormError message={state ? t(`market.errors.${state.error}`) : null} />
      <button type="submit" disabled={pending} className={submit}>
        {f("submit")}
      </button>
    </form>
  );
}
