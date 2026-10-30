// Form alanı: etiket, ipucu ve hata bağlantısı tek yerde. Dokunma hedefi en az 44 px (M-12).
import type { ReactNode } from "react";
import { alertBox, btnPrimary } from "@/components/ui/classes";

export const control =
  "min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-ink shadow-xs aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** aria-invalid ve aria-describedby; sunucunun döndürdüğü hatalı alan adlarından. */
export const a11y = (id: string, name: string, invalid: string[] | undefined, hint = false) => ({
  id,
  name,
  "aria-invalid": invalid?.includes(name) ? true : undefined,
  "aria-describedby": hint ? `${id}-hint` : undefined,
});

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className={alertBox}>
      {message}
    </p>
  );
}

export const submit = `${btnPrimary} justify-self-start`;
