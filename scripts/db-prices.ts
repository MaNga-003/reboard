// Kaynaklı fiyat satırlarını (saas_costs) yeniler: DATABASE_URL varsa Postgres (Neon), yoksa .data/pglite.
import { createDb } from "../src/db/client";
import { seedPrices } from "../src/db/seed";

async function main() {
  const db = createDb();
  const n = await seedPrices(db);
  console.log(`Fiyat satırları ${process.env.DATABASE_URL ? "Postgres" : "PGlite"} veritabanına yüklendi: ${n} satır`);
  // Pool (Postgres) end, PGlite close ile kapanır.
  const c = (db as unknown as { $client: { end?: () => Promise<void>; close?: () => Promise<void> } }).$client;
  await (c.end ?? c.close)?.call(c);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
