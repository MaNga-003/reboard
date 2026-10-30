import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PassportChain, PassportEvent } from "@/db/repo/passport";
import { fmtDateTime, fmtNumber } from "@/lib/format";

const short = (hash: string) => hash.slice(0, 12);

/** Her zincir ayrı satır: rol, ad (paylaşıldıysa) ve hüküm. Ad yoksa rol yeter; "bilinmiyor" yazmak yanlış olur, ad gizlidir. */
export function ChainList({ chains }: { chains: readonly PassportChain[] }) {
  const t = useTranslations();
  return (
    <ul className="grid gap-2">
      {chains.map((c, i) => {
        const Icon = c.verdict.ok ? ShieldCheck : ShieldAlert;
        return (
          <li
            key={i}
            data-chain-role={c.role}
            data-chain={c.verdict.ok ? "ok" : "broken"}
            className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm break-words text-ink ${c.verdict.ok ? "border border-line bg-canvas" : "border-2 border-danger bg-surface"}`}
          >
            <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${c.verdict.ok ? "text-brand" : "text-danger"}`} />
            <span>
              <span className="font-semibold">
                {t(`passport.roles.${c.role}`)}
                {c.name && ` · ${c.name}`}:
              </span>{" "}
              {c.verdict.ok
                ? "head" in c.verdict
                  ? t("trace.chain.ok", { count: c.verdict.count, head: short(c.verdict.head) })
                  : t("passport.verify.chainOk")
                : t("trace.chain.broken", { seq: c.verdict.brokenAt, reason: t(`trace.chain.reasons.${c.verdict.reason}`) })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Açık olay geçmişi: not ve kanıt yok; nesneler yalnızca bu lotun soy ağacından. */
export function PassportTimeline({ events, locale }: { events: readonly PassportEvent[]; locale: string }) {
  const t = useTranslations();
  if (events.length === 0) return <p className="text-sm text-muted">{t("trace.timeline.empty")}</p>;
  const qty = (qs: { ref: string; kg: string }[]) => qs.map((q) => `${q.ref} ${fmtNumber(q.kg, locale)} kg`).join(", ");
  return (
    <ol className="ms-1.5 grid gap-5 border-s-2 border-line-strong ps-6">
      {events.map((e, i) => (
        <li
          key={i}
          data-step={e.bizStep}
          data-role={e.role}
          className="relative grid gap-1 before:absolute before:-start-[2.2rem] before:top-1.5 before:size-3 before:rounded-full before:bg-brand before:ring-4 before:ring-canvas"
        >
          <p className="flex flex-wrap gap-x-3 text-sm">
            <span className="font-semibold text-ink">{t(`trace.steps.${e.bizStep}`)}</span>
            <span className="text-ink">
              {t(`passport.roles.${e.role}`)}
              {e.name && ` · ${e.name}`}
            </span>
            <time className="text-muted" dateTime={e.eventTime}>
              {fmtDateTime(e.eventTime, locale)}
            </time>
          </p>
          {e.inputs.length > 0 && (
            <p className="text-sm text-ink">
              {t("trace.timeline.inputs")}: {qty(e.inputs)}
            </p>
          )}
          {e.outputs.length > 0 && (
            <p className="text-sm text-ink">
              {t("trace.timeline.outputs")}: {qty(e.outputs)}
            </p>
          )}
          {e.hash !== null && (
            <p className="font-mono text-xs break-all text-subtle">
              #{e.seq} · {t("trace.timeline.hash")} {short(e.hash)}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
