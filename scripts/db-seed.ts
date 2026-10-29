// Sentetik demo verisini yükler: DATABASE_URL varsa Postgres (Neon), yoksa .data/pglite.
// DEMO_NOW (YYYY-AA-GG ya da ISO zaman) verilirse veri o güne göre kurulur. Zincir yalnızca seed'in UTC gününe bağlıdır:
// aynı günle yeniden yükleme aynı etiket çapalarını verir, basılı QR geçerli kalır (D-030, DEMO.md).
import { createDb } from "../src/db/client";
import { seedDemo } from "../src/db/seed";

function seedNow(raw = process.env.DEMO_NOW) {
  if (!raw) return new Date();
  const now = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00Z` : raw);
  if (Number.isNaN(now.getTime())) throw new Error(`DEMO_NOW okunamadı: ${raw}`);
  return now;
}

async function main() {
  const db = createDb();
  const now = seedNow();
  const counts = await seedDemo(db, { now, password: process.env.DEMO_PASSWORD || undefined });
  const target = process.env.DATABASE_URL ? "Postgres" : "PGlite";
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Demo verisi ${target} veritabanına yüklendi: ${total} satır`);
  console.log(`Seed günü (UTC): ${now.toISOString().slice(0, 10)}; aynı çapalar için DEMO_NOW=${now.toISOString().slice(0, 10)}`);
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
