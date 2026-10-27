"use server";
// Giriş ve çıkış eylemleri. Kimlik Better Auth'ta; burada yalnızca girdi doğrulanır ve yönlendirilir.
import { headers } from "next/headers";
import { z } from "zod";
import { demoEmail, PERSONA_KEYS, personaUser } from "@/db/seed/demo";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getAuth } from "@/lib/auth";

const locale = z.enum(routing.locales);

async function endSession(h: Headers) {
  // Oturum yoksa Better Auth hata verir; çıkışta bu önemli değil.
  await getAuth()
    .api.signOut({ headers: h })
    .catch(() => undefined);
}

/** Demo rolüyle giriş; rol değiştirmek de budur (önceki oturum kapanır). */
export async function signInDemo(formData: FormData): Promise<void> {
  const parsed = z.object({ persona: z.enum(PERSONA_KEYS), locale }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return redirect({ href: "/giris", locale: routing.defaultLocale });
  const { persona, locale: lang } = parsed.data;
  const password = process.env.DEMO_PASSWORD;
  if (process.env.DEMO_MODE !== "true" || !password) return redirect({ href: "/giris", locale: lang });
  const h = await headers();
  await endSession(h);
  try {
    await getAuth().api.signInEmail({ body: { email: demoEmail(personaUser(persona)), password }, headers: h });
  } catch {
    // Seed ile ortamdaki parola uyuşmazsa jüri boş bir hata sayfası görmesin.
    return redirect({ href: { pathname: "/giris", query: { hata: "demo" } }, locale: lang });
  }
  redirect({ href: "/panel", locale: lang });
}

export type PasswordState = { error: "invalid" } | null;

export async function signInPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = z
    .object({ email: z.email().max(254), password: z.string().min(1).max(256), locale })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { email, password, locale: lang } = parsed.data;
  const h = await headers();
  await endSession(h);
  try {
    await getAuth().api.signInEmail({ body: { email, password }, headers: h });
  } catch {
    // Hesabın var olup olmadığı sızdırılmaz: tek hata metni.
    return { error: "invalid" };
  }
  return redirect({ href: "/panel", locale: lang });
}

export async function signOutAction(formData: FormData): Promise<void> {
  const parsed = locale.safeParse(formData.get("locale"));
  await endSession(await headers());
  redirect({ href: "/giris", locale: parsed.success ? parsed.data : routing.defaultLocale });
}
