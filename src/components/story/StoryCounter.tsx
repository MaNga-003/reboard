"use client";
// Hikâyenin son kartındaki sayaç (D-013): /api/counter'dan okunur, sonuç sınıfı rozetiyle gösterilir (D-011).
// Bilinmeyen kalem varsa sayı alt sınırdır ve "en az" diye yazılır; okunamazsa "bilinmiyor", asla 0 değil.
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { CounterResponse } from "@/app/api/counter/route";
import { ResultClassBadge } from "@/components/ResultClassBadge";
import { fmtNumber } from "@/lib/format";

type State = { status: "loading" } | { status: "error" } | { status: "ok"; data: CounterResponse["counter"] };

export function StoryCounter() {
  const t = useTranslations("story");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/counter", { signal: abort.signal })
      .then((r) => (r.ok ? (r.json() as Promise<CounterResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((body) => setState({ status: "ok", data: body.counter }))
      .catch(() => !abort.signal.aborted && setState({ status: "error" }));
    return () => abort.abort();
  }, []);

  let value: string;
  if (state.status === "loading") value = t("counter.loading");
  else if (state.status === "error") value = tc("unknown");
  else if (!state.data) value = t("counter.none");
  else if (state.data.kg === null) value = tc("unknown");
  else {
    const kg = fmtNumber(state.data.kg, locale, 0);
    value = state.data.unknown > 0 ? t("counter.atLeast", { kg }) : t("counter.value", { kg });
  }
  const data = state.status === "ok" ? state.data : null;
  // Panelle aynı dürüstlük işaretleri (data-kpi, data-kg, data-unknown): E2E testi bunları dolaşır.
  const kg = data ? (data.kg ?? "unknown") : undefined;

  return (
    <div data-kpi={data ? "story-counter" : undefined} className="flex flex-col gap-2" aria-live="polite" aria-busy={state.status === "loading"}>
      <p className="text-lg leading-snug sm:text-xl">{t("sections.s8")}</p>
      <p className="flex flex-wrap items-center gap-3">
        <strong className="font-display text-3xl sm:text-4xl" data-testid="story-counter" data-kg={kg} data-unknown={data?.unknown}>
          {value}
        </strong>
        {data && <ResultClassBadge value={data.resultClass} />}
      </p>
      {data && <p className="text-sm">{t("counter.batches", { count: data.batches })}</p>}
    </div>
  );
}
