import { boolean, doublePrecision, pgTable, text } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { orgKind } from "./enums";
import { classified } from "./common";

// Organizasyonun platformdaki profili. Konum ilçe ya da ~1 km'ye yuvarlanmış tutulur.
export const orgProfiles = pgTable("org_profiles", {
  orgId: text("org_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  kind: orgKind("kind").notNull(),
  district: text("district"),
  province: text("province"),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  isPublic: boolean("is_public").notNull().default(true),
  ...classified(),
});
