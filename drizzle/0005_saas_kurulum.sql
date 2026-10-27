-- D-027: saas_costs satırları kaynaklı fiyatlardır ve yalnızca seed'den gelir (src/db/seed/demo.ts).
-- Yeni zorunlu alanlar (key, stage) eski satırlara yazılamaz; satırlar silinir ve `pnpm db:prices` ile yeniden yüklenir.
DELETE FROM "saas_costs";--> statement-breakpoint
CREATE TYPE "public"."saas_stage" AS ENUM('demo', 'commercial', 'both');--> statement-breakpoint
ALTER TABLE "saas_costs" ALTER COLUMN "vendor" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_costs" ADD COLUMN "key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_costs" ADD COLUMN "stage" "saas_stage" NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_costs" ADD COLUMN "unit_price" numeric(14, 6);--> statement-breakpoint
ALTER TABLE "saas_costs" ADD COLUMN "usage_unit" text;--> statement-breakpoint
ALTER TABLE "saas_costs" ADD CONSTRAINT "saas_costs_key_unique" UNIQUE("key");