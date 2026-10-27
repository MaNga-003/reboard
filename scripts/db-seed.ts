// Sentetik demo verisini yükler: DATABASE_URL varsa Postgres (Neon), yoksa .data/pglite.
import { createDb } from "../src/db/client";
import { seedDemo } from "../src/db/seed";

async function main() {
  const db = createDb();
  const counts = await seedDemo(db, { password: process.env.DEMO_PASSWORD || undefined });
  const target = process.env.DATABASE_URL ? "Postgres" : "PGlite";
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Demo verisi ${target} veritabanına yüklendi: ${total} satır`);
  console.table(counts);
  if (!process.env.DEMO_PASSWORD) console.log("DEMO_PASSWORD yok: demo hesapları parolasız (girişsiz) oluşturuldu");
  // Pool (Postgres) end, PGlite close ile kapanır.
  const c = (db as unknown as { $client: { end?: () => Promise<void>; close?: () => Promise<void> } }).$client;
  await (c.end ?? c.close)?.call(c);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
