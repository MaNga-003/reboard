"use client";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { createListingAction } from "@/app/[locale]/(app)/pazar/actions";
import { FIBRES } from "@/domain/fibre";
import { LISTING_KINDS, RECURRENCES, isWaste, unitsFor, type ListingKind } from "@/domain/market";
import { Field, FormError, a11y, control, submit } from "./fields";

const FIBRE_FIELDS = FIBRES.filter((f) => f !== "unknown");

/** Yeni ilan. Tür değişince birim seçenekleri ve atığa özgü alanlar (bileşim, ipek) değişir. */
export function ListingForm({ locale, defaultKind, today, until }: { locale: string; defaultKind: ListingKind; today: string; until: string }) {
  const t = useTranslations();
  const f = (k: string) => t(`market.listingForm.${k}`);
  const [state, action, pending] = useActionState(createListingAction, null);
  const [kind, setKind] = useState<ListingKind>(defaultKind);
  const bad = state?.fields;
  const waste = isWaste(kind);

  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="kind" label={f("kind")}>
          <select {...a11y("kind", "kind", bad)} value={kind} onChange={(e) => setKind(e.target.value as ListingKind)} className={control}>
            {LISTING_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`market.kinds.${k}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="title" label={f("titleField")} hint={f("titleHint")}>
          <input {...a11y("title", "title", bad, true)} required minLength={3} maxLength={120} className={control} />
        </Field>
        <Field id="quantity" label={f("quantity")}>
          <input {...a11y("quantity", "quantity", bad)} inputMode="decimal" required className={control} />
        </Field>
        <Field id="unit" label={f("unit")}>
          {/* Tür değişince seçenekler değişir; key ile seçim sıfırlanır. */}
          <select key={kind} {...a11y("unit", "unit", bad)} defaultValue={unitsFor(kind)[0]} className={control}>
            {unitsFor(kind).map((u) => (
              <option key={u} value={u}>
                {t(`units.${u}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="recurrence" label={f("recurrence")} hint={f("recurrenceHint")}>
          <select {...a11y("recurrence", "recurrence", bad, true)} defaultValue="weekly" className={control}>
            {RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {t(`market.recurrence.${r}`)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="windowStart" label={f("windowStart")}>
            <input {...a11y("windowStart", "windowStart", bad)} type="date" defaultValue={today} className={control} />
          </Field>
          <Field id="windowEnd" label={f("windowEnd")}>
            <input {...a11y("windowEnd", "windowEnd", bad)} type="date" defaultValue={until} className={control} />
          </Field>
        </div>
      </div>

      {waste && (
        <fieldset className="grid gap-3 rounded border border-fg/30 p-4">
          <legend className="px-1 font-semibold">{f("composition")}</legend>
          <p className="text-sm">{f("compositionHint")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FIBRE_FIELDS.map((fb) => (
              <Field key={fb} id={`c_${fb}`} label={t(`fibres.${fb}`)}>
                <input {...a11y(`c_${fb}`, `c_${fb}`, bad)} type="number" min={0} max={100} step={1} inputMode="numeric" className={control} />
              </Field>
            ))}
          </div>
          <Field id="silk" label={f("silk")}>
            <select {...a11y("silk", "silk", bad)} defaultValue="no" className={`${control} sm:max-w-xs`}>
              {(["no", "yes", "unknown"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`market.silk.${s}`)}
                </option>
              ))}
            </select>
          </Field>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="payer" label={f("payer")} hint={f("amountHint")}>
          <select {...a11y("payer", "payer", bad, true)} defaultValue={waste ? "seller" : "buyer"} key={`payer-${waste}`} className={control}>
            {(["buyer", "seller", "none", "unknown"] as const).map((p) => (
              <option key={p} value={p}>
                {t(`market.payer.${p}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="amount" label={f("amount")}>
          <input {...a11y("amount", "amount", bad)} inputMode="decimal" className={control} />
        </Field>
      </div>
      <p className="text-sm">{f("location")}</p>
      <FormError message={state ? t(`market.errors.${state.error}`) : null} />
      <button type="submit" disabled={pending} className={submit}>
        {f("submit")}
      </button>
    </form>
  );
}
