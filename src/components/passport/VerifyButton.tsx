"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { fmtTime } from "@/lib/format";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; ok: boolean; chains: number; at: string } | { kind: "failed" };

/** Doğrulamayı açık uçtan yeniden çalıştırır: sayfa açıldıktan sonra da zincirin hâlâ sağlam olduğunu gösterir. */
export function VerifyButton({ code, anchor, locale }: { code: string; anchor: string | null; locale: string }) {
  const t = useTranslations("passport.verify");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function run() {
    setState({ kind: "busy" });
    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(code)}${anchor ? `?a=${anchor}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { ok: boolean; checkedAt: string; chains: unknown[] };
      setState({ kind: "done", ok: body.ok, chains: body.chains.length, at: body.checkedAt });
    } catch {
      setState({ kind: "failed" });
    }
  }

  return (
    <div className="grid justify-items-start gap-2">
      <button
        type="button"
        onClick={run}
        disabled={state.kind === "busy"}
        className="inline-flex min-h-11 items-center rounded bg-accent px-5 font-semibold text-on-accent disabled:opacity-70"
      >
        {state.kind === "busy" ? t("busy") : t("again")}
      </button>
      <p role="status" data-verify-result={state.kind === "done" ? (state.ok ? "ok" : "broken") : state.kind} className="text-sm">
        {state.kind === "done" &&
          t("result", { time: fmtTime(state.at, locale), verdict: state.ok ? t("ok", { count: state.chains }) : t("broken") })}
        {state.kind === "failed" && t("failed")}
      </p>
    </div>
  );
}
