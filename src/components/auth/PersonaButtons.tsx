import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PERSONA_KEYS, personaUser } from "@/db/seed/demo";
import { signInDemo } from "@/app/[locale]/giris/actions";

const AVATAR: Record<(typeof PERSONA_KEYS)[number], string> = {
  supplier: "bg-brand",
  producer: "bg-side",
  buyer: "bg-muted",
  viewer: "bg-subtle",
};

/** Demo rolleri: her düğme ayrı bir form; JavaScript olmadan da çalışır. */
export async function PersonaButtons({ locale, currentUserId }: { locale: string; currentUserId?: string }) {
  const t = await getTranslations("personas");
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {PERSONA_KEYS.map((p) => {
        const u = personaUser(p);
        const current = u.id === currentUserId;
        return (
          <li key={p}>
            <form action={signInDemo}>
              <input type="hidden" name="persona" value={p} />
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                data-persona={p}
                aria-current={current ? "true" : undefined}
                className="group flex min-h-11 w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-line-strong hover:shadow-card aria-[current=true]:border-brand aria-[current=true]:bg-brand-soft aria-[current=true]:ring-1 aria-[current=true]:ring-brand"
              >
                <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-on-brand ${AVATAR[p]}`}>
                  {t(`${p}.label`).charAt(0)}
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-semibold text-ink">{t(`${p}.label`)}</span>
                  <span className="text-sm text-muted">
                    {u.org.name} · {t(`${p}.desc`)}
                  </span>
                </span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
