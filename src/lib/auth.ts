import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

// D-010: e-posta ve parola, organizasyon eklentisi. Özel roller (operator, viewer) T1.5'te eklenir.
function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: { enabled: true },
    plugins: [organization(), nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Tembel: build sırasında modül yüklenince veritabanı ve secret denetimi tetiklenmesin.
let instance: Auth | undefined;
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
