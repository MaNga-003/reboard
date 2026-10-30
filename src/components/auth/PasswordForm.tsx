"use client";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { signInPassword } from "@/app/[locale]/giris/actions";
import { alertBox, btnPrimary } from "@/components/ui/classes";

const field = "min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-ink shadow-xs";

export function PasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signInPassword, null);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <label className="grid gap-1.5 text-sm font-medium text-ink">
        <span>{t("email")}</span>
        <input name="email" type="email" autoComplete="username" required className={field} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-ink">
        <span>{t("password")}</span>
        <input name="password" type="password" autoComplete="current-password" required className={field} />
      </label>
      {state?.error && (
        <p role="alert" className={alertBox}>
          {t("invalid")}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${btnPrimary} justify-self-start`}>
        {t("submit")}
      </button>
    </form>
  );
}
