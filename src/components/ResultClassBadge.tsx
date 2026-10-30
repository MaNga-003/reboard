import { useTranslations } from "next-intl";
import type { ResultClass } from "@/domain/result";

/** Sınıfı ayıran nokta yalnızca süs; sınıf her zaman yazıyla da söylenir. */
const DOT: Record<ResultClass, string> = {
  synthetic: "bg-subtle",
  sourced_estimate: "bg-glow",
  pilot_projection: "bg-brand",
  realized: "bg-ok",
};

/** D-011: ekrandaki her kayıt ve sayı sınıfını taşır. Prop zorunlu; sınıfsız gösterim derlenmez. */
export function ResultClassBadge({ value }: { value: ResultClass }) {
  const t = useTranslations("resultClass");
  return (
    <span
      data-result-class={value}
      className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-canvas px-2.5 text-xs font-semibold leading-6 text-muted"
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT[value]}`} />
      {t(value)}
    </span>
  );
}
