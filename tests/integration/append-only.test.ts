// M-6: custody_events yalnızca eklenir; tetikleyici değişikliği veritabanı düzeyinde reddeder.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const client = new PGlite();

async function insertEvent(seq: number, hash: string) {
  await client.query(
    `insert into custody_events (org_id, seq, type, biz_step, event_time, payload, prev_hash, hash)
     values ('org-a', $1, 'object', 'receiving', now(), '{"kg":"100.000"}', '', $2)`,
    [seq, hash],
  );
}

beforeAll(async () => {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.query(`insert into organization (id, name, slug) values ('org-a', 'A', 'a')`);
  await insertEvent(1, "h1");
});
afterAll(() => client.close());

describe("custody_events yalnızca eklenir", () => {
  it("ekleme çalışır", async () => {
    await insertEvent(2, "h2");
    const { rows } = await client.query<{ n: number }>("select count(*)::int as n from custody_events");
    expect(rows[0].n).toBe(2);
  });

  it("UPDATE reddedilir", async () => {
    await expect(client.query(`update custody_events set payload = '{"kg":"999"}' where seq = 1`)).rejects.toThrow(/yalnızca eklenir/);
  });

  it("DELETE reddedilir", async () => {
    await expect(client.query(`delete from custody_events where seq = 1`)).rejects.toThrow(/yalnızca eklenir/);
  });

  it("organizasyon silinince zincir de silinemez (cascade da reddedilir)", async () => {
    await expect(client.query(`delete from organization where id = 'org-a'`)).rejects.toThrow(/yalnızca eklenir/);
  });

  it("aynı org içinde aynı sıra numarası ikinci kez yazılamaz (çatal yok)", async () => {
    await expect(insertEvent(1, "h1-fork")).rejects.toThrow(/custody_events_org_seq/);
  });

  it("izinsiz TRUNCATE reddedilir", async () => {
    await expect(client.query(`truncate custody_events`)).rejects.toThrow(/demo sıfırlamasında/);
  });

  it("demo sıfırlaması aynı işlemde izinle TRUNCATE yapabilir", async () => {
    await client.transaction(async (tx) => {
      await tx.query(`set local reboard.allow_reset = 'on'`);
      await tx.query(`truncate custody_events`);
    });
    const { rows } = await client.query<{ n: number }>("select count(*)::int as n from custody_events");
    expect(rows[0].n).toBe(0);
    // İzin işlem bitince düşer.
    await insertEvent(1, "h1-new");
    await expect(client.query(`truncate custody_events`)).rejects.toThrow(/demo sıfırlamasında/);
  });
});
