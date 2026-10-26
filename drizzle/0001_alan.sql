CREATE TYPE "public"."binder" AS ENUM('pet_copet', 'pmdi', 'none', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."biz_step" AS ENUM('receiving', 'inspecting', 'commissioning', 'shipping', 'transforming', 'accepting');--> statement-breakpoint
CREATE TYPE "public"."buyer_product" AS ENUM('particleboard', 'mdf', 'reboard');--> statement-breakpoint
CREATE TYPE "public"."cost_category" AS ENUM('material', 'binder', 'energy', 'labor', 'operations', 'fixed', 'depreciation', 'transport', 'other');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('TRY', 'EUR', 'USD');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('planned', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."distance_kind" AS ENUM('crow_flies', 'road');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('object', 'transformation', 'transaction');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('weighbridge_ticket', 'waybill', 'invoice', 'test_report', 'photo', 'other');--> statement-breakpoint
CREATE TYPE "public"."evidence_status" AS ENUM('declared', 'documented', 'reconciled');--> statement-breakpoint
CREATE TYPE "public"."listing_kind" AS ENUM('waste_offer', 'waste_request', 'panel_offer', 'panel_request');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('open', 'accepted', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."org_kind" AS ENUM('textile_factory', 'municipality', 'recycler', 'producer', 'panel_buyer', 'carrier');--> statement-breakpoint
CREATE TYPE "public"."recurrence" AS ENUM('once', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."result_class" AS ENUM('synthetic', 'sourced_estimate', 'pilot_projection', 'realized');--> statement-breakpoint
CREATE TYPE "public"."tax_basis" AS ENUM('incl_vat', 'excl_vat');--> statement-breakpoint
CREATE TYPE "public"."test_status" AS ENUM('not_tested', 'in_progress', 'passed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transaction_kind" AS ENUM('panel_sale', 'gate_fee', 'service', 'waste_purchase', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('kg', 't', 'm2', 'm3', 'kwh', 'h', 'km', 'pcs', 'trip', 'month');--> statement-breakpoint
CREATE TABLE "org_profiles" (
	"org_id" text PRIMARY KEY NOT NULL,
	"kind" "org_kind" NOT NULL,
	"district" text,
	"province" text,
	"lat" double precision,
	"lon" double precision,
	"is_public" boolean DEFAULT true NOT NULL,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"seller_org_id" text NOT NULL,
	"buyer_org_id" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit" "unit" NOT NULL,
	"unit_price" numeric(14, 2),
	"currency" "currency" DEFAULT 'TRY' NOT NULL,
	"tax_basis" "tax_basis" DEFAULT 'excl_vat' NOT NULL,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_offer_id_unique" UNIQUE("offer_id")
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"planned_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"planned_kg" numeric(14, 3) NOT NULL,
	"carrier_name" text,
	"status" "delivery_status" DEFAULT 'planned' NOT NULL,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"kind" "listing_kind" NOT NULL,
	"status" "listing_status" DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"composition" jsonb,
	"contains_silk" boolean,
	"quantity" numeric(14, 3) NOT NULL,
	"unit" "unit" NOT NULL,
	"recurrence" "recurrence" DEFAULT 'once' NOT NULL,
	"window_start" date,
	"window_end" date,
	"unit_price" numeric(14, 2),
	"price_unit" "unit",
	"currency" "currency" DEFAULT 'TRY' NOT NULL,
	"tax_basis" "tax_basis" DEFAULT 'excl_vat' NOT NULL,
	"district" text,
	"lat" double precision,
	"lon" double precision,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"org_id" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit" "unit" NOT NULL,
	"unit_price" numeric(14, 2),
	"currency" "currency" DEFAULT 'TRY' NOT NULL,
	"tax_basis" "tax_basis" DEFAULT 'excl_vat' NOT NULL,
	"proposed_date" date,
	"status" "offer_status" DEFAULT 'open' NOT NULL,
	"message" text,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_inputs" (
	"production_batch_id" uuid NOT NULL,
	"waste_batch_id" uuid NOT NULL,
	"allocated_kg" numeric(14, 3) NOT NULL,
	CONSTRAINT "batch_inputs_production_batch_id_waste_batch_id_pk" PRIMARY KEY("production_batch_id","waste_batch_id")
);
--> statement-breakpoint
CREATE TABLE "custody_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"seq" integer NOT NULL,
	"type" "event_type" NOT NULL,
	"biz_step" "biz_step" NOT NULL,
	"event_time" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custody_events_hash_unique" UNIQUE("hash"),
	CONSTRAINT "custody_events_org_seq" UNIQUE("org_id","seq")
);
--> statement-breakpoint
CREATE TABLE "evidence_links" (
	"evidence_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	CONSTRAINT "evidence_links_evidence_id_entity_type_entity_id_pk" PRIMARY KEY("evidence_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "evidence_register" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"kind" "evidence_kind" NOT NULL,
	"file_name" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"content" "bytea",
	"period" text,
	"status" "evidence_status" DEFAULT 'declared' NOT NULL,
	"uploaded_by" text,
	"checked_by" text,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "panel_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"org_id" text NOT NULL,
	"production_batch_id" uuid NOT NULL,
	"area_m2" numeric(12, 2),
	"sheet_count" integer,
	"thickness_mm" numeric(5, 1),
	"density_kg_m3" numeric(7, 1),
	"test_status" "test_status" DEFAULT 'not_tested' NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "panel_lots_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "production_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"org_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"binder" "binder" DEFAULT 'unknown' NOT NULL,
	"output_kg" numeric(14, 3),
	"scrap_kg" numeric(14, 3),
	"moisture_loss_kg" numeric(14, 3),
	"balance_note" text,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_batches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "waste_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"org_id" text NOT NULL,
	"supplier_org_id" text NOT NULL,
	"delivery_id" uuid,
	"received_at" timestamp with time zone NOT NULL,
	"declared_kg" numeric(14, 3),
	"weighed_kg" numeric(14, 3),
	"moisture_pct" numeric(5, 2),
	"rejected_kg" numeric(14, 3),
	"composition" jsonb,
	"contains_silk" boolean,
	"verified" boolean DEFAULT false NOT NULL,
	"notes" text,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waste_batches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "buyer_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"period" text NOT NULL,
	"product" "buyer_product" NOT NULL,
	"area_m2" numeric(12, 2),
	"total_cost" numeric(14, 2),
	"currency" "currency" DEFAULT 'TRY' NOT NULL,
	"tax_basis" "tax_basis" DEFAULT 'excl_vat' NOT NULL,
	"notes" text,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calc_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text,
	"formula" text NOT NULL,
	"formula_version" text NOT NULL,
	"input_hash" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"outputs" jsonb NOT NULL,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"period" text NOT NULL,
	"category" "cost_category" NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(14, 3),
	"unit" "unit",
	"unit_cost" numeric(14, 2),
	"amount" numeric(14, 2),
	"currency" "currency" DEFAULT 'TRY' NOT NULL,
	"tax_basis" "tax_basis" DEFAULT 'excl_vat' NOT NULL,
	"production_batch_id" uuid,
	"source" text,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text,
	"key" text NOT NULL,
	"value" numeric(18, 6),
	"unit" "unit",
	"currency" "currency" DEFAULT 'TRY' NOT NULL,
	"tax_basis" "tax_basis" DEFAULT 'excl_vat' NOT NULL,
	"period" text,
	"source" text,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item" text NOT NULL,
	"vendor" text NOT NULL,
	"plan" text,
	"monthly_cost" numeric(14, 2),
	"per_customer_cost" numeric(14, 2),
	"currency" "currency" DEFAULT 'TRY' NOT NULL,
	"tax_basis" "tax_basis" DEFAULT 'excl_vat' NOT NULL,
	"source_url" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_baseline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"period" text NOT NULL,
	"disposal_kg" numeric(14, 3),
	"disposal_cost" numeric(14, 2),
	"transport_cost" numeric(14, 2),
	"gate_fee" numeric(14, 2),
	"currency" "currency" DEFAULT 'TRY' NOT NULL,
	"tax_basis" "tax_basis" DEFAULT 'excl_vat' NOT NULL,
	"source" text,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"counterparty_org_id" text,
	"deal_id" uuid,
	"kind" "transaction_kind" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" "currency" DEFAULT 'TRY' NOT NULL,
	"tax_basis" "tax_basis" DEFAULT 'excl_vat' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"evidence_id" uuid,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transport_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"carrier_name" text NOT NULL,
	"origin_district" text,
	"destination_district" text,
	"distance_km" numeric(8, 1),
	"distance_kind" "distance_kind" NOT NULL,
	"price_per_trip" numeric(14, 2),
	"capacity_kg" numeric(14, 3),
	"currency" "currency" DEFAULT 'TRY' NOT NULL,
	"tax_basis" "tax_basis" DEFAULT 'excl_vat' NOT NULL,
	"period" text,
	"source" text,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_values" (
	"key" text PRIMARY KEY NOT NULL,
	"value" numeric(18, 6) NOT NULL,
	"unit" text NOT NULL,
	"currency" "currency",
	"period" text,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"license" text,
	"scope_note" text,
	"result_class" "result_class" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_profiles" ADD CONSTRAINT "org_profiles_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_seller_org_id_organization_id_fk" FOREIGN KEY ("seller_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_buyer_org_id_organization_id_fk" FOREIGN KEY ("buyer_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_inputs" ADD CONSTRAINT "batch_inputs_production_batch_id_production_batches_id_fk" FOREIGN KEY ("production_batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_inputs" ADD CONSTRAINT "batch_inputs_waste_batch_id_waste_batches_id_fk" FOREIGN KEY ("waste_batch_id") REFERENCES "public"."waste_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_evidence_id_evidence_register_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_register"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_register" ADD CONSTRAINT "evidence_register_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_register" ADD CONSTRAINT "evidence_register_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_register" ADD CONSTRAINT "evidence_register_checked_by_user_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_lots" ADD CONSTRAINT "panel_lots_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_lots" ADD CONSTRAINT "panel_lots_production_batch_id_production_batches_id_fk" FOREIGN KEY ("production_batch_id") REFERENCES "public"."production_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_batches" ADD CONSTRAINT "waste_batches_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_batches" ADD CONSTRAINT "waste_batches_supplier_org_id_organization_id_fk" FOREIGN KEY ("supplier_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waste_batches" ADD CONSTRAINT "waste_batches_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_trials" ADD CONSTRAINT "buyer_trials_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calc_runs" ADD CONSTRAINT "calc_runs_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_lines" ADD CONSTRAINT "cost_lines_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_lines" ADD CONSTRAINT "cost_lines_production_batch_id_production_batches_id_fk" FOREIGN KEY ("production_batch_id") REFERENCES "public"."production_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_inputs" ADD CONSTRAINT "model_inputs_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_baseline" ADD CONSTRAINT "supplier_baseline_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_counterparty_org_id_organization_id_fk" FOREIGN KEY ("counterparty_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_evidence_id_evidence_register_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence_register"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_quotes" ADD CONSTRAINT "transport_quotes_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;