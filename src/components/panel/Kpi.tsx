import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import type { KgTotal } from "@/domain/impact";
import type { ResultClass } from "@/domain/result";
import { fmtNumber } from "@/lib/format";

/**
 * Gösterge kutusu. D-011: sınıf zorunlu prop; sınıfsız gösterge derlenmez. data-kpi, dürüstlük testinin dolaştığı katalogdur.
 * Büyük tek başına sayıda orantılı rakam: eşit genişlikli rakam "121"i dağınık gösterir.
 */
const ACCENT = { ink: "border-t-ink", brand: "border-t-brand", glow: "border-t-glow", sky: "border-t-sky", muted: "border-t-subtle" } as const;

export function Kpi({
  id,
  label,
  value,
  resultClass,
  note,
  accent = "ink",
}: {
  id: string;
  label: string;
  value: ReactNode;
  resultClass: ResultClass;
  note?: ReactNode;
  accent?: keyof typeof ACCENT;
}) {
  return (
    <div data-kpi={id} className={`grid content-start gap-2 rounded-2xl border border-t-4 border-line bg-surface p-5 shadow-card ${ACCENT[accent]}`}>
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="text-3xl font-semibold tracking-tight text-ink [font-variant-numeric:normal]">{value}</dd>
      <dd className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <ResultClassBadge value={resultClass} />
        {note}
      </dd>
    </div>
  );
}

/** Toplam kg: hepsi bilinmiyorsa "bilinmiyor", bir kısmı bilinmiyorsa "en az" (alt sınır); null asla 0 yazılmaz. */
export function KgTotalText({ total, locale, perDay }: { total: KgTotal; locale: string; perDay?: boolean }) {
  const t = useTranslations();
  if (total.kg === null) return <span data-kg="unknown">{t("common.unknown")}</span>;
  const text = t(perDay ? "panel.kgPerDay" : "panel.kg", { kg: fmtNumber(total.kg, locale, 1) });
  return (
    <span data-kg={total.kg.toString()} data-unknown={total.unknown}>
      {total.unknown > 0 ? t("panel.atLeast", { value: text }) : text}
    </span>
  );
}
