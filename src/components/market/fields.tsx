// Form alanı: etiket, ipucu ve hata bağlantısı tek yerde. Dokunma hedefi en az 44 px (M-12).
import type { ReactNode } from "react";

export const control = "min-h-11 w-full rounded border border-fg/60 bg-bg px-3 py-2 aria-[invalid=true]:border-2 aria-[invalid=true]:border-fg";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-sm">
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
    <p role="alert" className="rounded border-2 border-fg px-3 py-2">
      {message}
    </p>
  );
}

export const submit = "inline-flex min-h-11 items-center justify-self-start rounded bg-accent px-5 font-semibold text-on-accent disabled:opacity-60";
