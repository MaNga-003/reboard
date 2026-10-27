import { useTranslations } from "next-intl";
import type { ChainVerdict, ChainedEvent } from "@/domain/traceability";
import { fmtDateTime, fmtNumber } from "@/lib/format";

const short = (hash: string) => hash.slice(0, 12);

/** Olay geçmişi, eskiden yeniye. Her satır zincirdeki sırasını ve hash'inin başını taşır: dışarıdan karşılaştırılabilir. */
export function Timeline({ events, locale }: { events: readonly ChainedEvent[]; locale: string }) {
  const t = useTranslations("trace");
  if (events.length === 0) return <p>{t("timeline.empty")}</p>;
  const qty = (qs: { ref: string; kg: string }[]) => qs.map((q) => `${q.ref} ${fmtNumber(q.kg, locale)} kg`).join(", ");
  return (
    <ol className="grid gap-3 border-s-2 border-fg/30 ps-4">
      {events.map((e) => (
        <li key={e.seq} data-seq={e.seq} data-step={e.bizStep} className="grid gap-1">
          <p className="flex flex-wrap gap-x-3 text-sm">
            <span className="font-semibold">{t(`steps.${e.bizStep}`)}</span>
            <time dateTime={new Date(e.eventTime).toISOString()}>{fmtDateTime(e.eventTime, locale)}</time>
          </p>
          {e.payload.inputs.length > 0 && (
            <p className="text-sm">
              {t("timeline.inputs")}: {qty(e.payload.inputs)}
            </p>
          )}
          {e.payload.outputs.length > 0 && (
            <p className="text-sm">
              {t("timeline.outputs")}: {qty(e.payload.outputs)}
            </p>
          )}
          {/* wrap-anywhere: notta 64 karakterlik SHA-256 durabilir; break-words ızgaranın en dar genişliğini küçültmez, sayfa 210 px taşıyordu (M-13). */}
          {e.payload.note && <p data-note className="text-sm wrap-anywhere">{e.payload.note}</p>}
          <p className="font-mono text-xs break-all">
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
    <p data-chain="ok" className="rounded border border-fg/30 px-3 py-2 text-sm break-words">
      <span className="font-semibold">{t("title")}:</span> {t("ok", { count: verdict.count, head: short(verdict.head) })}
    </p>
  ) : (
    <p role="alert" data-chain="broken" className="rounded border-2 border-fg px-3 py-2 text-sm">
      <span className="font-semibold">{t("title")}:</span> {t("broken", { seq: verdict.brokenAt, reason: t(`reasons.${verdict.reason}`) })}
    </p>
  );
}
