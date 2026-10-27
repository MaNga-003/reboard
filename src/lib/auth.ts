import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, ownerAc } from "better-auth/plugins/organization/access";
import { getDb, type Db } from "@/db/client";
import { firstOrgOf } from "@/db/repo/membership";
import * as schema from "@/db/schema";
import { GRANTS, STATEMENTS } from "@/domain/access";

// D-010: roller src/domain/access.ts tablosundan kurulur; Better Auth yalnızca kurum yönetimi izinlerini ekler.
export const ac = createAccessControl({ ...defaultStatements, ...STATEMENTS });
export const roles = {
  owner: ac.newRole({ ...ownerAc.statements, ...STATEMENTS }),
  admin: ac.newRole({ ...adminAc.statements, ...STATEMENTS }),
  operator: ac.newRole({ ...GRANTS.operator }),
  viewer: ac.newRole({}),
};

export type AuthOptions = { secret?: string; baseURL?: string };

export function createAuth(db: Db = getDb(), opts: AuthOptions = {}) {
  return betterAuth({
    ...opts,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    // Hesap ve kurum yalnızca seed ya da (Faz 5'te) davetle açılır; açık demoda kayıt yüzeyi yok.
    emailAndPassword: { enabled: true, disableSignUp: true },
    databaseHooks: {
      session: {
        create: {
          // Girişte etkin kurum seçilir; yoksa her istekte "kurum seç" adımı gerekirdi.
          before: async (s) => {
            const active = (s as { activeOrganizationId?: string | null }).activeOrganizationId;
            return { data: { ...s, activeOrganizationId: active ?? (await firstOrgOf(db, s.userId)) } };
          },
        },
      },
    },
    plugins: [organization({ ac, roles, allowUserToCreateOrganization: false }), nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Tembel: build sırasında modül yüklenince veritabanı ve secret denetimi tetiklenmesin.
let instance: Auth | undefined;
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
