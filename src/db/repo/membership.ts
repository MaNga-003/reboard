// Oturumdaki kullanıcının hangi kurumda, hangi rolle çalıştığı. Rol her istekte üyelik tablosundan okunur;
// oturuma yazılmış bir role güvenilmez (üyelik kaldırılınca erişim hemen biter).
import { and, asc, eq } from "drizzle-orm";
import { rolesOf, type Role } from "../../domain/access";
import type { Db } from "../client";
import { member, orgProfiles, organization } from "../schema";

export type Membership = { userId: string; orgId: string; orgName: string; orgKind: string | null; roles: Role[] };

/** Kullanıcının ilk üyeliği (en eski); oturum açılınca etkin kurum olarak bu seçilir. */
export async function firstOrgOf(db: Db, userId: string): Promise<string | null> {
  const [m] = await db
    .select({ orgId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt), asc(member.id))
    .limit(1);
  return m?.orgId ?? null;
}

/** Etkin kurumda üyelik yoksa ilk üyeliğe düşer; hiç üyelik yoksa null. */
export async function resolveMembership(db: Db, userId: string, activeOrgId: string | null): Promise<Membership | null> {
  const orgId = activeOrgId ?? (await firstOrgOf(db, userId));
  if (!orgId) return null;
  const [row] = await db
    .select({ role: member.role, orgName: organization.name, orgKind: orgProfiles.kind })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .leftJoin(orgProfiles, eq(orgProfiles.orgId, member.organizationId))
    .where(and(eq(member.userId, userId), eq(member.organizationId, orgId)))
    .limit(1);
  if (!row) return activeOrgId ? resolveMembership(db, userId, null) : null;
  const roles = rolesOf(row.role);
  return roles.length ? { userId, orgId, orgName: row.orgName, orgKind: row.orgKind, roles } : null;
}
