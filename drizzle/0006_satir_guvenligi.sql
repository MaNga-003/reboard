-- D-016, D-033: Postgres satır güvenliği (RLS), kiracı izolasyonunun ikinci hattı.
-- Uygulama kurum verisine yalnız kapsamlı işlemde erişir: işlem başında rol reboard_app'e iner ve reboard.org_id
-- kurumu taşır (src/db/repo/scope.ts). Görünürlük politikaları src/db/repo/tenant.ts kuralının aynısıdır; M-40 ölçer.
-- Bağlantı rolü (migrasyon, seed, Better Auth) RLS'e tabi değildir: tablo sahibidir, Neon'da ayrıca BYPASSRLS taşır.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reboard_app') THEN
    CREATE ROLE reboard_app NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
--> statement-breakpoint
-- Bağlantı rolü işlem içinde reboard_app'e geçebilsin: PG 16'dan beri oluşturana SET hakkı kendiliğinden verilmez.
GRANT reboard_app TO CURRENT_USER;
--> statement-breakpoint
-- Kurum yoksa (kamu kapsamı) NULL: kurum sütunuyla hiçbir eşitlik tutmaz, yalnız herkese açık dallar kalır.
CREATE OR REPLACE FUNCTION reboard_org() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('reboard.org_id', true), '')
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reboard_app;
--> statement-breakpoint
GRANT SELECT ON organization, org_profiles, listings, offers, deals, deliveries, waste_batches, production_batches,
  batch_inputs, panel_lots, custody_events, evidence_register, evidence_links, supplier_baseline, transport_quotes,
  cost_lines, buyer_trials, transactions, saas_costs, model_inputs, calc_runs, reference_values TO reboard_app;
--> statement-breakpoint
-- Yalnız uygulamanın yazdığı tablolar ve sütunlar. Silme yetkisi yok; kimlik tabloları (user, session…) hiç açılmaz.
GRANT INSERT ON listings, offers, deals, deliveries, waste_batches, production_batches, batch_inputs, panel_lots,
  custody_events, evidence_register, evidence_links TO reboard_app;
--> statement-breakpoint
GRANT UPDATE (status) ON listings TO reboard_app;
--> statement-breakpoint
GRANT UPDATE (status) ON offers TO reboard_app;
--> statement-breakpoint
GRANT UPDATE (status, delivered_at) ON deliveries TO reboard_app;
--> statement-breakpoint
-- Tartım ve kg sonradan değişmez: partide yalnız doğrulama bayrağı güncellenir (D-013).
GRANT UPDATE (verified) ON waste_batches TO reboard_app;
--> statement-breakpoint
GRANT UPDATE (status, checked_by) ON evidence_register TO reboard_app;
--> statement-breakpoint
ALTER TABLE organization ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE org_profiles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE waste_batches ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE batch_inputs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE panel_lots ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE custody_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE evidence_register ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE evidence_links ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE supplier_baseline ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE transport_quotes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE cost_lines ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE buyer_trials ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE saas_costs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE model_inputs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE calc_runs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE reference_values ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Pazar yeri: herkese açık profiller ve açık ilanlar. Anlaşmanın tarafı, ilan kapansa da anlaştığı ilanı görür.
CREATE POLICY organization_select ON organization FOR SELECT TO reboard_app
  USING (id = reboard_org() OR id IN (SELECT org_id FROM org_profiles WHERE is_public));
--> statement-breakpoint
CREATE POLICY org_profiles_select ON org_profiles FOR SELECT TO reboard_app
  USING (org_id = reboard_org() OR is_public);
--> statement-breakpoint
CREATE POLICY listings_select ON listings FOR SELECT TO reboard_app
  USING (org_id = reboard_org() OR status = 'open'
    OR id IN (SELECT listing_id FROM deals WHERE reboard_org() IN (seller_org_id, buyer_org_id)));
--> statement-breakpoint
CREATE POLICY listings_insert ON listings FOR INSERT TO reboard_app
  WITH CHECK (org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY listings_update ON listings FOR UPDATE TO reboard_app
  USING (org_id = reboard_org()) WITH CHECK (org_id = reboard_org());
--> statement-breakpoint
-- Teklifi veren ve ilan sahibi görür. Teklif yalnız görülebilen ilana verilir.
CREATE POLICY offers_select ON offers FOR SELECT TO reboard_app
  USING (org_id = reboard_org() OR listing_id IN (SELECT id FROM listings WHERE org_id = reboard_org()));
--> statement-breakpoint
CREATE POLICY offers_insert ON offers FOR INSERT TO reboard_app
  WITH CHECK (org_id = reboard_org() AND listing_id IN (SELECT id FROM listings));
--> statement-breakpoint
-- Teklifi veren geri çeker; ilan sahibi kabul eder ya da reddeder.
CREATE POLICY offers_update ON offers FOR UPDATE TO reboard_app
  USING (org_id = reboard_org() OR listing_id IN (SELECT id FROM listings WHERE org_id = reboard_org()))
  WITH CHECK (org_id = reboard_org() OR listing_id IN (SELECT id FROM listings WHERE org_id = reboard_org()));
--> statement-breakpoint
CREATE POLICY deals_select ON deals FOR SELECT TO reboard_app
  USING (reboard_org() IN (seller_org_id, buyer_org_id));
--> statement-breakpoint
-- Anlaşmayı ilan sahibi, ilanına verilmiş teklifi kabul ederek açar; öteki taraf teklifi verendir.
-- Böylece bir kurum, karşı tarafın teklifi olmadan onun adına anlaşma yazamaz.
CREATE POLICY deals_insert ON deals FOR INSERT TO reboard_app
  WITH CHECK (reboard_org() IN (seller_org_id, buyer_org_id) AND EXISTS (
    SELECT 1 FROM offers o JOIN listings l ON l.id = o.listing_id
    WHERE o.id = deals.offer_id AND l.id = deals.listing_id AND l.org_id = reboard_org()
      AND o.org_id IN (deals.seller_org_id, deals.buyer_org_id)));
--> statement-breakpoint
CREATE POLICY deliveries_select ON deliveries FOR SELECT TO reboard_app
  USING (deal_id IN (SELECT id FROM deals WHERE reboard_org() IN (seller_org_id, buyer_org_id)));
--> statement-breakpoint
CREATE POLICY deliveries_insert ON deliveries FOR INSERT TO reboard_app
  WITH CHECK (deal_id IN (SELECT id FROM deals WHERE reboard_org() IN (seller_org_id, buyer_org_id)));
--> statement-breakpoint
-- Teslimi alıcı alır.
CREATE POLICY deliveries_update ON deliveries FOR UPDATE TO reboard_app
  USING (deal_id IN (SELECT id FROM deals WHERE buyer_org_id = reboard_org()))
  WITH CHECK (deal_id IN (SELECT id FROM deals WHERE buyer_org_id = reboard_org()));
--> statement-breakpoint
-- Sağlayıcı, teslim ettiği partinin tartım sonucunu görür.
CREATE POLICY waste_batches_select ON waste_batches FOR SELECT TO reboard_app
  USING (reboard_org() IN (org_id, supplier_org_id));
--> statement-breakpoint
-- Parti, alıcının teslim aldığı teslimden açılır; sağlayıcı o anlaşmanın satıcısıdır. Başka kurum adına
-- "sağlanmış" parti yazılamaz: sağlayıcı onu kendi ekranında görürdü.
CREATE POLICY waste_batches_insert ON waste_batches FOR INSERT TO reboard_app
  WITH CHECK (org_id = reboard_org() AND EXISTS (
    SELECT 1 FROM deliveries d JOIN deals x ON x.id = d.deal_id
    WHERE d.id = waste_batches.delivery_id AND x.buyer_org_id = reboard_org()
      AND x.seller_org_id = waste_batches.supplier_org_id));
--> statement-breakpoint
CREATE POLICY waste_batches_update ON waste_batches FOR UPDATE TO reboard_app
  USING (org_id = reboard_org()) WITH CHECK (org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY production_batches_select ON production_batches FOR SELECT TO reboard_app
  USING (org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY production_batches_insert ON production_batches FOR INSERT TO reboard_app
  WITH CHECK (org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY batch_inputs_select ON batch_inputs FOR SELECT TO reboard_app
  USING (production_batch_id IN (SELECT id FROM production_batches WHERE org_id = reboard_org()));
--> statement-breakpoint
-- Üretime yalnız kurumun kendi teslim aldığı parti tahsis edilir.
CREATE POLICY batch_inputs_insert ON batch_inputs FOR INSERT TO reboard_app
  WITH CHECK (production_batch_id IN (SELECT id FROM production_batches WHERE org_id = reboard_org())
    AND waste_batch_id IN (SELECT id FROM waste_batches WHERE org_id = reboard_org()));
--> statement-breakpoint
-- Herkese açık lotlar ürün pasaportunda zaten açık (D-025).
CREATE POLICY panel_lots_select ON panel_lots FOR SELECT TO reboard_app
  USING (org_id = reboard_org() OR is_public);
--> statement-breakpoint
CREATE POLICY panel_lots_insert ON panel_lots FOR INSERT TO reboard_app
  WITH CHECK (org_id = reboard_org()
    AND production_batch_id IN (SELECT id FROM production_batches WHERE org_id = reboard_org()));
--> statement-breakpoint
CREATE POLICY custody_events_select ON custody_events FOR SELECT TO reboard_app
  USING (org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY custody_events_insert ON custody_events FOR INSERT TO reboard_app
  WITH CHECK (org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY evidence_register_select ON evidence_register FOR SELECT TO reboard_app
  USING (org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY evidence_register_insert ON evidence_register FOR INSERT TO reboard_app
  WITH CHECK (org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY evidence_register_update ON evidence_register FOR UPDATE TO reboard_app
  USING (org_id = reboard_org()) WITH CHECK (org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY evidence_links_select ON evidence_links FOR SELECT TO reboard_app
  USING (evidence_id IN (SELECT id FROM evidence_register WHERE org_id = reboard_org()));
--> statement-breakpoint
-- Kanıt yalnız kurumun kendi partisine bağlanır.
CREATE POLICY evidence_links_insert ON evidence_links FOR INSERT TO reboard_app
  WITH CHECK (evidence_id IN (SELECT id FROM evidence_register WHERE org_id = reboard_org())
    AND (entity_type <> 'waste_batch' OR entity_id IN (SELECT id FROM waste_batches WHERE org_id = reboard_org())));
--> statement-breakpoint
CREATE POLICY supplier_baseline_select ON supplier_baseline FOR SELECT TO reboard_app
  USING (org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY transport_quotes_select ON transport_quotes FOR SELECT TO reboard_app
  USING (org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY cost_lines_select ON cost_lines FOR SELECT TO reboard_app
  USING (org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY buyer_trials_select ON buyer_trials FOR SELECT TO reboard_app
  USING (org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY transactions_select ON transactions FOR SELECT TO reboard_app
  USING (org_id = reboard_org());
--> statement-breakpoint
-- Kurumdan bağımsız kaynaklı değerler herkese açık.
CREATE POLICY saas_costs_select ON saas_costs FOR SELECT TO reboard_app USING (true);
--> statement-breakpoint
CREATE POLICY reference_values_select ON reference_values FOR SELECT TO reboard_app USING (true);
--> statement-breakpoint
CREATE POLICY model_inputs_select ON model_inputs FOR SELECT TO reboard_app
  USING (org_id IS NULL OR org_id = reboard_org());
--> statement-breakpoint
CREATE POLICY calc_runs_select ON calc_runs FOR SELECT TO reboard_app
  USING (org_id IS NULL OR org_id = reboard_org());
--> statement-breakpoint
-- Bilinçli kurumlar arası okumalar yalnız bu üç fonksiyondan geçer ve yalnız gereken sütunu verir.
-- Herkese açık sayaç: doğrulanmış partilerin kg'ı ve sınıfı; kurum, kod ve dönem çıkmaz (D-013).
CREATE OR REPLACE FUNCTION reboard_verified_batches()
  RETURNS TABLE (weighed_kg numeric, rejected_kg numeric, result_class public.result_class)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT b.weighed_kg, b.rejected_kg, b.result_class FROM public.waste_batches b WHERE b.verified
$$;
--> statement-breakpoint
-- Parti, üretim ve lot kodları platform genelinde tektir: yılın en büyük numarası, satırın kendisi değil.
CREATE OR REPLACE FUNCTION reboard_max_code(p_prefix text, p_year integer) RETURNS integer
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT max((regexp_match(c.code, '^' || p_prefix || '-' || p_year || '-(\d+)$'))[1]::integer)
  FROM (
    SELECT code FROM public.waste_batches WHERE p_prefix = 'WB'
    UNION ALL SELECT code FROM public.production_batches WHERE p_prefix = 'PB'
    UNION ALL SELECT code FROM public.panel_lots WHERE p_prefix = 'PL'
  ) c
$$;
--> statement-breakpoint
-- Açık pasaport: lotun soy ağacına dokunan zincirlerin yalnız kurum kimliği (D-025). Zincirin kendisi o kurumun
-- kapsamında okunur.
CREATE OR REPLACE FUNCTION reboard_chains_touching(p_refs text[]) RETURNS SETOF text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT DISTINCT e.org_id FROM public.custody_events e, unnest(p_refs) AS r(ref)
  WHERE e.payload -> 'inputs' @> jsonb_build_array(jsonb_build_object('ref', r.ref))
     OR e.payload -> 'outputs' @> jsonb_build_array(jsonb_build_object('ref', r.ref))
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION reboard_verified_batches(), reboard_max_code(text, integer), reboard_chains_touching(text[]) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION reboard_verified_batches(), reboard_max_code(text, integer), reboard_chains_touching(text[]) TO reboard_app;
