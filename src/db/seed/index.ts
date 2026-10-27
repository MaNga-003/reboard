// Demo verisini sıfırlar ve yeniden yükler (T1.4). Yalnızca DEMO_MODE=true iken çalışır: tablolar boşaltılır.
// Sıfırlama ve yükleme tek işlemdedir; bir ekleme düşerse eski demo verisi yerinde kalır.
import { hashPassword } from "better-auth/crypto";
import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import type { Db } from "../client";
import * as schema from "../schema";
import { buildDemo, DEMO_USERS, type DemoData } from "./demo";

export { buildDemo } from "./demo";

// Yabancı anahtar sırası: önce bağlanılan tablo.
const ORDER = [
  "organization",
  "user",
  "member",
  "orgProfiles",
  "referenceValues",
  "saasCosts",
  "modelInputs",
  "listings",
  "offers",
  "deals",
  "deliveries",
  "evidenceRegister",
  "wasteBatches",
  "productionBatches",
  "batchInputs",
  "panelLots",
  "evidenceLinks",
  "custodyEvents",
  "supplierBaseline",
  "transportQuotes",
  "costLines",
  "buyerTrials",
  "transactions",
  "calcRuns",
] as const satisfies readonly (keyof DemoData)[];

const CHUNK = 200;

export type SeedOptions = { now?: Date; password?: string; env?: Record<string, string | undefined> };

/** Uygulamanın bütün tabloları (drizzle şemasından); migrasyon kaydı bu listede yoktur. */
export const appTables = () =>
  Object.values(schema as Record<string, unknown>)
    .filter((t): t is PgTable => is(t, PgTable))
    .map((t) => getTableName(t));

export async function seedDemo(db: Db, { now = new Date(), password, env = process.env }: SeedOptions = {}) {
  if (env.DEMO_MODE !== "true") throw new Error("Demo seed yalnızca DEMO_MODE=true iken çalışır; bütün tabloları boşaltır.");
  const data = buildDemo(now);
  // Parola yoksa hesaplar girişsiz kalır; rol değiştirici T1.5'te parolayı kullanır.
  const accounts = password
    ? await Promise.all(
        DEMO_USERS.map(async (u) => ({
          id: `demo-account-${u.key}`,
          accountId: u.id,
          providerId: "credential",
          userId: u.id,
          password: await hashPassword(password),
        })),
      )
    : [];

  const counts: Record<string, number> = {};
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local reboard.allow_reset = 'on'`);
    const list = appTables()
      .map((n) => `"${n}"`)
      .join(", ");
    await tx.execute(sql.raw(`truncate table ${list} restart identity cascade`));
    for (const key of ORDER) {
      const rows = data[key];
      const table = schema[key] as PgTable;
      for (let i = 0; i < rows.length; i += CHUNK) await tx.insert(table).values(rows.slice(i, i + CHUNK) as never);
      counts[key] = rows.length;
      if (key === "user" && accounts.length) {
        await tx.insert(schema.account).values(accounts);
        counts.account = accounts.length;
      }
    }
  });
  return counts;
}

/**
 * Yalnızca kaynaklı fiyat satırlarını (saas_costs) seed'deki hâliyle yeniler. Zincire, kurum verisine ve kura dokunmaz;
 * bu yüzden canlıda pasaport hash'leri değişmeden çalıştırılabilir (D-027). Silme ve ekleme tek işlemdedir.
 */
export async function seedPrices(db: Db, now = new Date()) {
  const rows = buildDemo(now).saasCosts;
  await db.transaction(async (tx) => {
    await tx.delete(schema.saasCosts);
    await tx.insert(schema.saasCosts).values(rows);
  });
  return rows.length;
}
