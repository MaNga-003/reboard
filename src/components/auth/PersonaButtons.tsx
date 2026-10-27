import { getTranslations } from "next-intl/server";
import { PERSONA_KEYS, personaUser } from "@/db/seed/demo";
import { signInDemo } from "@/app/[locale]/giris/actions";

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
                className="flex min-h-11 w-full flex-col items-start gap-1 rounded border border-fg/40 px-4 py-3 text-left hover:bg-fg/5 aria-[current=true]:border-fg aria-[current=true]:border-2"
              >
                <span className="font-semibold">{t(`${p}.label`)}</span>
                <span className="text-sm">
                  {u.org.name} · {t(`${p}.desc`)}
                </span>
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
