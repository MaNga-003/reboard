// Migrasyonları uygular: DATABASE_URL varsa Postgres (Neon), yoksa .data/pglite.
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { PGLITE_DIR } from "../src/db/client";

const migrationsFolder = "./drizzle";

async function main() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url });
    await migratePg(drizzlePg(pool), { migrationsFolder });
    await pool.end();
    console.log("Migrasyonlar Postgres'e uygulandı");
  } else {
    mkdirSync(PGLITE_DIR, { recursive: true });
    const client = new PGlite(PGLITE_DIR);
    await migratePglite(drizzlePglite(client), { migrationsFolder });
    await client.close();
    console.log(`Migrasyonlar PGlite'a uygulandı (${PGLITE_DIR})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
