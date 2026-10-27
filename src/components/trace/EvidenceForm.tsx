"use client";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { uploadEvidenceAction } from "@/app/[locale]/(app)/izlenebilirlik/actions";
import { Field, FormError, a11y, control, submit } from "@/components/market/fields";
import { EVIDENCE_KINDS, EVIDENCE_MAX_BYTES, EVIDENCE_MIMES, type EvidenceKind } from "@/domain/traceability/batches";
import { keepValues } from "./keep";

/** Kanıt yükleme. Boyut tarayıcıda da denetlenir: 4 MiB üstü dosya hiç gönderilmez (Vercel 413 yerine anlaşılır hata). */
export function EvidenceForm({ locale, wasteBatchId, defaultKind }: { locale: string; wasteBatchId: string; defaultKind: EvidenceKind }) {
  const t = useTranslations();
  const f = (k: string) => t(`trace.batch.${k}`);
  const [state, dispatch, pending] = useActionState(uploadEvidenceAction, null);
  const [local, setLocal] = useState<string | null>(null);
  const bad = local ? ["file"] : state?.fields;
  const error = local ?? state?.error ?? null;

  const check = (fd: FormData) => {
    const file = fd.get("file");
    const size = file instanceof File ? file.size : 0;
    const err = size === 0 ? "file_empty" : size > EVIDENCE_MAX_BYTES ? "file_too_large" : null;
    setLocal(err);
    return err === null;
  };

  return (
    <form action={dispatch} onSubmit={keepValues(dispatch, check)} encType="multipart/form-data" className="grid gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="wasteBatchId" value={wasteBatchId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="kind" label={f("kind")}>
          <select {...a11y("kind", "kind", bad)} defaultValue={defaultKind} className={control}>
            {EVIDENCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`trace.evidenceKinds.${k}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="file" label={f("file")} hint={f("fileHint")}>
          <input {...a11y("file", "file", bad, true)} type="file" accept={EVIDENCE_MIMES.join(",")} required className={control} />
        </Field>
      </div>
      <FormError message={error ? t(`trace.errors.${error}`) : null} />
      <button type="submit" disabled={pending} className={submit}>
        {f("uploadSubmit")}
      </button>
    </form>
  );
}
