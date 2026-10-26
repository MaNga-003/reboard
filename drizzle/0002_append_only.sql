-- D-012: custody_events yalnızca eklenir. Satır düzeyinde UPDATE ve DELETE her zaman reddedilir.
-- TRUNCATE yalnızca demo sıfırlamasında, aynı işlemde `SET LOCAL reboard.allow_reset = 'on'` ile yapılabilir.
CREATE OR REPLACE FUNCTION custody_events_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'custody_events yalnızca eklenir (D-012): % reddedildi', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION custody_events_guard_truncate() RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('reboard.allow_reset', true), '') <> 'on' THEN
    RAISE EXCEPTION 'custody_events yalnızca eklenir (D-012): TRUNCATE yalnızca demo sıfırlamasında'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER custody_events_no_update_delete
  BEFORE UPDATE OR DELETE ON custody_events
  FOR EACH ROW EXECUTE FUNCTION custody_events_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER custody_events_no_truncate
  BEFORE TRUNCATE ON custody_events
  FOR EACH STATEMENT EXECUTE FUNCTION custody_events_guard_truncate();
