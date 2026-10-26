import { numeric, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { currency, resultClass, taxBasis } from "./enums";

export const ts = (name: string) => timestamp(name, { withTimezone: true });
export const id = () => uuid("id").primaryKey().defaultRandom();
export const orgId = () =>
  text("org_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });
export const kg = (name: string) => numeric(name, { precision: 14, scale: 3 });
export const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

/** Para alanı her zaman para birimi ve vergi temeliyle gelir (D-011). */
export const moneyMeta = () => ({
  currency: currency("currency").notNull().default("TRY"),
  taxBasis: taxBasis("tax_basis").notNull().default("excl_vat"),
});

export const classified = () => ({
  resultClass: resultClass("result_class").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});
