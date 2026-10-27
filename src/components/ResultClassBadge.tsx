import { useTranslations } from "next-intl";
import type { ResultClass } from "@/domain/result";

/** D-011: ekrandaki her kayıt ve sayı sınıfını taşır. Prop zorunlu; sınıfsız gösterim derlenmez. */
export function ResultClassBadge({ value }: { value: ResultClass }) {
  const t = useTranslations("resultClass");
  return (
    <span data-result-class={value} className="inline-flex items-center rounded border border-fg/60 px-2 text-xs font-semibold leading-6">
      {t(value)}
    </span>
  );
}
