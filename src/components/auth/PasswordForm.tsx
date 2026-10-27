"use client";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { signInPassword } from "@/app/[locale]/giris/actions";

const field = "min-h-11 w-full rounded border border-fg/60 bg-bg px-3 py-2";

export function PasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signInPassword, null);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <label className="grid gap-1">
        <span>{t("email")}</span>
        <input name="email" type="email" autoComplete="username" required className={field} />
      </label>
      <label className="grid gap-1">
        <span>{t("password")}</span>
        <input name="password" type="password" autoComplete="current-password" required className={field} />
      </label>
      {state?.error && (
        <p role="alert" className="rounded border-2 border-fg px-3 py-2">
          {t("invalid")}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 justify-self-start rounded bg-accent px-5 font-semibold text-on-accent disabled:opacity-60"
      >
        {t("submit")}
      </button>
    </form>
  );
}
