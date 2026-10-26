// Veritabanı bağlantısı (D-009): DATABASE_URL varsa Postgres (Neon), yoksa yerel PGlite.
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import * as schema from "./schema";

// İki sürücü aynı PgDatabase API'sini sunar; tip tek tutulur.
export type Db = NodePgDatabase<typeof schema>;

export const PGLITE_DIR = ".data/pglite";

export function createDb(url = process.env.DATABASE_URL): Db {
  if (url) return drizzlePg(new Pool({ connectionString: url, max: 5 }), { schema });
  mkdirSync(PGLITE_DIR, { recursive: true });
  return createPgliteDb(new PGlite(PGLITE_DIR));
}

export function createPgliteDb(client: PGlite): Db {
  return drizzlePglite(client, { schema }) as unknown as Db;
}

// Geliştirmede sıcak yeniden yüklemede tek bağlantı kalsın.
const g = globalThis as unknown as { __reboardDb?: Db };
export function getDb(): Db {
  g.__reboardDb ??= createDb();
  return g.__reboardDb;
}
