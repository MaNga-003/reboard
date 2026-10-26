// Better Auth'un beklediği her alan Drizzle şemasında aynı adla ve aynı zorunlulukla bulunur.
import { getAuthTables } from "better-auth/db";
import { organization } from "better-auth/plugins";
import { getTableColumns, type Table } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

const expected = getAuthTables({ plugins: [organization()] });

describe("Better Auth şema eşleşmesi", () => {
  for (const def of Object.values(expected)) {
    it(`${def.modelName} tablosu`, () => {
      const table = (schema as Record<string, unknown>)[def.modelName] as Table | undefined;
      expect(table, `şemada ${def.modelName} yok`).toBeDefined();
      const cols = getTableColumns(table!);
      const problems: string[] = [];
      for (const [field, f] of Object.entries(def.fields)) {
        const col = cols[field];
        if (!col) problems.push(`${field} eksik`);
        else if (f.required && !col.notNull) problems.push(`${field} zorunlu olmalı`);
        else if (f.unique && !col.isUnique) problems.push(`${field} benzersiz olmalı`);
      }
      expect(problems).toEqual([]);
    });
  }
});
