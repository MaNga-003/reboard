import { useTranslations } from "next-intl";
import type { PassportChain, PassportEvent } from "@/db/repo/passport";
import { fmtDateTime, fmtNumber } from "@/lib/format";

const short = (hash: string) => hash.slice(0, 12);

/** Her zincir ayrı satır: rol, ad (paylaşıldıysa) ve hüküm. Ad yoksa rol yeter; "bilinmiyor" yazmak yanlış olur, ad gizlidir. */
export function ChainList({ chains }: { chains: readonly PassportChain[] }) {
  const t = useTranslations();
  return (
    <ul className="grid gap-2">
      {chains.map((c, i) => (
        <li
          key={i}
          data-chain-role={c.role}
          data-chain={c.verdict.ok ? "ok" : "broken"}
          className={`rounded px-3 py-2 text-sm break-words ${c.verdict.ok ? "border border-fg/30" : "border-2 border-fg"}`}
        >
          <span className="font-semibold">
            {t(`passport.roles.${c.role}`)}
            {c.name && ` · ${c.name}`}:
          </span>{" "}
          {c.verdict.ok
            ? "head" in c.verdict
              ? t("trace.chain.ok", { count: c.verdict.count, head: short(c.verdict.head) })
              : t("passport.verify.chainOk")
            : t("trace.chain.broken", { seq: c.verdict.brokenAt, reason: t(`trace.chain.reasons.${c.verdict.reason}`) })}
        </li>
      ))}
    </ul>
  );
}

/** Açık olay geçmişi: not ve kanıt yok; nesneler yalnızca bu lotun soy ağacından. */
export function PassportTimeline({ events, locale }: { events: readonly PassportEvent[]; locale: string }) {
  const t = useTranslations();
  if (events.length === 0) return <p>{t("trace.timeline.empty")}</p>;
  const qty = (qs: { ref: string; kg: string }[]) => qs.map((q) => `${q.ref} ${fmtNumber(q.kg, locale)} kg`).join(", ");
  return (
    <ol className="grid gap-3 border-s-2 border-fg/30 ps-4">
      {events.map((e, i) => (
        <li key={i} data-step={e.bizStep} data-role={e.role} className="grid gap-1">
          <p className="flex flex-wrap gap-x-3 text-sm">
            <span className="font-semibold">{t(`trace.steps.${e.bizStep}`)}</span>
            <span>
              {t(`passport.roles.${e.role}`)}
              {e.name && ` · ${e.name}`}
            </span>
            <time dateTime={e.eventTime}>{fmtDateTime(e.eventTime, locale)}</time>
          </p>
          {e.inputs.length > 0 && (
            <p className="text-sm">
              {t("trace.timeline.inputs")}: {qty(e.inputs)}
            </p>
          )}
          {e.outputs.length > 0 && (
            <p className="text-sm">
              {t("trace.timeline.outputs")}: {qty(e.outputs)}
            </p>
          )}
          {e.hash !== null && (
            <p className="font-mono text-xs break-all">
              #{e.seq} · {t("trace.timeline.hash")} {short(e.hash)}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
