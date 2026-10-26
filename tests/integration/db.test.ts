// Migrasyonlar bellek içi PGlite'ta baştan sona çalışır.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, describe, expect, it } from "vitest";

describe("migrasyonlar", () => {
  const client = new PGlite();
  afterAll(() => client.close());

  it("boş veritabanına uygulanır ve kimlik tabloları oluşur", async () => {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    const { rows } = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining(["account", "invitation", "member", "organization", "session", "user", "verification"]),
    );
  });
});
