import { numeric, pgTable, text } from "drizzle-orm/pg-core";
import { classified, ts } from "./common";
import { currency } from "./enums";

// Kaynaklı referans değerler: her biri kaynak, tarih, lisans ve kapsam notuyla.
export const referenceValues = pgTable("reference_values", {
  key: text("key").primaryKey(),
  value: numeric("value", { precision: 18, scale: 6 }).notNull(),
  // Bileşik birimler serbest metin: "t", "TL/kWh", "TL/t", "TL/USD", "m2".
  unit: text("unit").notNull(),
  currency: currency("currency"),
  period: text("period"),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  retrievedAt: ts("retrieved_at").notNull(),
  license: text("license"),
  scopeNote: text("scope_note"),
  ...classified(),
});
