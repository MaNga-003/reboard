// Veri erişim katmanının kapısı: oturumdaki kullanıcı, etkin kurumu ve rolü. Sayfa ve eylemler kimliği yalnızca buradan alır.
import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb } from "@/db/client";
import { resolveMembership, type Membership } from "@/db/repo/membership";
import { withTenant, type Tenant } from "@/db/repo/tenant";
import { getAuth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";

export type Viewer = Membership & { userName: string };

// Aynı istekte layout, sayfa ve bileşenler aynı sonucu paylaşır; oturum bir kez okunur.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const m = await resolveMembership(getDb(), session.user.id, session.session.activeOrganizationId ?? null);
  return m && { ...m, userName: session.user.name };
});

/** Oturum yoksa giriş sayfasına gönderir. Her sayfa kendisi çağırır: layout denetimi tek başına sınır değildir. */
export async function requireViewer(locale: string): Promise<Viewer & { tenant: Tenant }> {
  const viewer = await getViewer();
  if (!viewer) return redirect({ href: "/giris", locale });
  return { ...viewer, tenant: withTenant(getDb(), viewer.orgId) };
}
