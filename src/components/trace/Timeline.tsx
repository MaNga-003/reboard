import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { alertBox, card } from "@/components/ui/classes";
import type { ChainVerdict, ChainedEvent } from "@/domain/traceability";
import { fmtDateTime, fmtNumber } from "@/lib/format";

const short = (hash: string) => hash.slice(0, 12);

/** Olay geçmişi, eskiden yeniye. Her satır zincirdeki sırasını ve hash'inin başını taşır: dışarıdan karşılaştırılabilir. */
export function Timeline({ events, locale }: { events: readonly ChainedEvent[]; locale: string }) {
  const t = useTranslations("trace");
  if (events.length === 0) return <p className="text-sm text-muted">{t("timeline.empty")}</p>;
  const qty = (qs: { ref: string; kg: string }[]) => qs.map((q) => `${q.ref} ${fmtNumber(q.kg, locale)} kg`).join(", ");
  return (
    <ol className="ms-1.5 grid gap-5 border-s-2 border-line-strong ps-6">
      {events.map((e) => (
        <li key={e.seq} data-seq={e.seq} data-step={e.bizStep} className="relative grid gap-1 before:absolute before:-start-[2.2rem] before:top-1.5 before:size-3 before:rounded-full before:bg-brand before:ring-4 before:ring-canvas">
          <p className="flex flex-wrap gap-x-3 text-sm">
            <span className="font-semibold text-ink">{t(`steps.${e.bizStep}`)}</span>
            <time className="text-muted" dateTime={new Date(e.eventTime).toISOString()}>{fmtDateTime(e.eventTime, locale)}</time>
          </p>
          {e.payload.inputs.length > 0 && (
            <p className="text-sm text-ink">
              {t("timeline.inputs")}: {qty(e.payload.inputs)}
            </p>
          )}
          {e.payload.outputs.length > 0 && (
            <p className="text-sm text-ink">
              {t("timeline.outputs")}: {qty(e.payload.outputs)}
            </p>
          )}
          {/* wrap-anywhere: notta 64 karakterlik SHA-256 durabilir; break-words ızgaranın en dar genişliğini küçültmez, sayfa 210 px taşıyordu (M-13). */}
          {e.payload.note && <p data-note className="text-sm text-ink wrap-anywhere">{e.payload.note}</p>}
          <p className="font-mono text-xs break-all text-subtle">
            #{e.seq} · {t("timeline.hash")} {short(e.hash)}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Zincir hükmü: sağlamsa olay sayısı ve son hash, bozuksa kırılan sıra ve nedeni. */
export function ChainStatus({ verdict }: { verdict: ChainVerdict }) {
  const t = useTranslations("trace.chain");
  return verdict.ok ? (
    <p data-chain="ok" className={`${card} flex items-start gap-3 p-4 text-sm text-ink break-words`}>
      <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" />
      <span>
        <span className="font-semibold">{t("title")}:</span> {t("ok", { count: verdict.count, head: short(verdict.head) })}
      </span>
    </p>
  ) : (
    <p role="alert" data-chain="broken" className={`${alertBox} text-sm`}>
      <span className="font-semibold">{t("title")}:</span> {t("broken", { seq: verdict.brokenAt, reason: t(`reasons.${verdict.reason}`) })}
    </p>
  );
}
