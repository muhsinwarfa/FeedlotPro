-- ==============================================================================
-- FEEDLOTPRO KENYA — Authoritative Trigger Reference
--
-- This file is the single source of truth for ALL trigger functions defined
-- across the migration history. It is a compiled read-only reference; do NOT
-- run this file directly — apply changes via versioned migrations instead.
--
-- Trigger naming convention:
--   trg_<verb>_<subject>  e.g. trg_calculate_adg, trg_sync_current_weight
--
-- Scope convention:
--   BEFORE = validation / safeguard (can abort via RAISE EXCEPTION)
--   AFTER  = side effect / propagation (downstream writes)
--
-- Functions marked SECURITY DEFINER run as the function owner (postgres),
-- bypassing RLS on the target tables they write to.
-- ==============================================================================

-- ── BLOCK 1 (20260310) ────────────────────────────────────────────────────────

-- Function: check_pin_lockout
-- Trigger:  trg_pin_lockout — BEFORE UPDATE ON tenant_members
-- Purpose:  Atomically locks a member account after 3 failed PIN attempts.
--           Fires only once (OLD.pin_attempts < 3 guard prevents repeated locking).
CREATE OR REPLACE FUNCTION check_pin_lockout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pin_attempts >= 3 AND OLD.pin_attempts < 3 THEN
    NEW.status := 'LOCKED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_pin_lockout ON public.tenant_members;
CREATE TRIGGER trg_pin_lockout
  BEFORE UPDATE ON public.tenant_members
  FOR EACH ROW EXECUTE FUNCTION check_pin_lockout();

-- Audit triggers (AFTER I/U/D on multiple tables → audit_logs)
-- log_audit_event() is defined in the V1 base schema (Supabase dashboard).
-- Attached to: tenant_members, sessions, batches (V2 Block 1 additions)

DROP TRIGGER IF EXISTS trg_audit_tenant_members ON public.tenant_members;
CREATE TRIGGER trg_audit_tenant_members
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_members
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_sessions ON public.sessions;
CREATE TRIGGER trg_audit_sessions
  AFTER INSERT OR UPDATE OR DELETE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_batches ON public.batches;
CREATE TRIGGER trg_audit_batches
  AFTER INSERT OR UPDATE OR DELETE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- ── BLOCK 2 (20260315) ────────────────────────────────────────────────────────

-- Function: calculate_animal_adg
-- Trigger:  trg_calculate_adg — AFTER INSERT ON weight_records
-- Purpose:  Computes ADG = (new_weight - intake_weight) / days_on_feed.
--           Sets dispatch_ready = true when new_weight >= organization.target_weight.
--           Uses GREATEST(1, days) to handle same-day weigh-in (avoids div/0).
CREATE OR REPLACE FUNCTION calculate_animal_adg()
RETURNS TRIGGER AS $$
DECLARE
  v_intake_weight NUMERIC;
  v_intake_date   DATE;
  v_target_weight NUMERIC;
  v_days          NUMERIC;
  v_adg           NUMERIC;
  v_dispatch      BOOLEAN;
BEGIN
  SELECT a.intake_weight, a.intake_date::date, o.target_weight
  INTO v_intake_weight, v_intake_date, v_target_weight
  FROM public.animals a
  JOIN public.organizations o ON o.id = a.organization_id
  WHERE a.id = NEW.animal_id;

  v_days    := GREATEST(1, (NEW.weigh_date::date - v_intake_date)::NUMERIC);
  v_adg     := ROUND(((NEW.new_weight - v_intake_weight) / v_days)::NUMERIC, 3);
  v_dispatch := v_target_weight IS NOT NULL AND NEW.new_weight >= v_target_weight;

  UPDATE public.animals
  SET current_adg         = v_adg,
      dispatch_ready      = v_dispatch,
      dispatch_ready_date = CASE
                              WHEN v_dispatch AND NOT COALESCE(dispatch_ready, false)
                              THEN now()
                              ELSE dispatch_ready_date
                            END,
      updated_at          = now()
  WHERE id = NEW.animal_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_calculate_adg ON public.weight_records;
CREATE TRIGGER trg_calculate_adg
  AFTER INSERT ON public.weight_records
  FOR EACH ROW EXECUTE FUNCTION calculate_animal_adg();

-- Function: calculate_pen_fcr
-- Trigger:  trg_calculate_fcr — AFTER INSERT ON feeding_records
-- Purpose:  Computes rolling 30-day FCR = total_feed_kg / total_weight_gained_kg
--           per pen. Only updates when total_gained > 0 to avoid division by zero.
--           Reads animals.current_weight — kept accurate by trg_sync_current_weight.
CREATE OR REPLACE FUNCTION calculate_pen_fcr()
RETURNS TRIGGER AS $$
DECLARE
  v_period_start TIMESTAMPTZ := now() - INTERVAL '30 days';
  v_total_fed    NUMERIC;
  v_total_gained NUMERIC;
BEGIN
  SELECT COALESCE(SUM(fd.kg_amount), 0)
  INTO v_total_fed
  FROM public.feeding_details fd
  JOIN public.feeding_records fr ON fr.id = fd.feeding_record_id
  WHERE fr.pen_id = NEW.pen_id
    AND fr.feeding_timestamp >= v_period_start;

  SELECT COALESCE(SUM(a.current_weight - a.intake_weight), 0)
  INTO v_total_gained
  FROM public.animals a
  WHERE a.pen_id = NEW.pen_id
    AND a.status IN ('ACTIVE','SICK')
    AND a.current_weight IS NOT NULL
    AND a.current_weight > a.intake_weight;

  IF v_total_gained > 0 THEN
    UPDATE public.pens
    SET current_fcr = ROUND((v_total_fed / v_total_gained)::NUMERIC, 2)
    WHERE id = NEW.pen_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_calculate_fcr ON public.feeding_records;
CREATE TRIGGER trg_calculate_fcr
  AFTER INSERT ON public.feeding_records
  FOR EACH ROW EXECUTE FUNCTION calculate_pen_fcr();

-- ── BLOCK 3 (20260320) ────────────────────────────────────────────────────────

-- Function: log_price_change
-- Trigger:  trg_price_history_on_update — AFTER UPDATE ON pantry_ingredients
-- Purpose:  Appends an immutable audit row to price_history whenever
--           current_price_per_kg changes. Guard: IS DISTINCT FROM (handles NULLs).
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.current_price_per_kg IS DISTINCT FROM NEW.current_price_per_kg)
     AND NEW.current_price_per_kg IS NOT NULL THEN
    INSERT INTO public.price_history
      (organization_id, ingredient_id, old_price, new_price)
    VALUES
      (NEW.organization_id, NEW.id, OLD.current_price_per_kg, NEW.current_price_per_kg);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_price_history_on_update ON public.pantry_ingredients;
CREATE TRIGGER trg_price_history_on_update
  AFTER UPDATE ON public.pantry_ingredients
  FOR EACH ROW EXECUTE FUNCTION log_price_change();

-- Function: update_stock_level
-- Trigger:  trg_stock_level_on_transaction — AFTER INSERT ON stock_transactions
-- Purpose:  Applies stock_transactions to pantry_ingredients.current_stock:
--             PURCHASE    → +quantity_kg
--             CONSUMPTION → GREATEST(0, current_stock - quantity_kg)  [floor at 0]
--             ADJUSTMENT  → GREATEST(0, current_stock + quantity_kg)  [signed delta, floor at 0]
--           Note: DELETE on stock_transactions does NOT reverse stock (immutable ledger).
CREATE OR REPLACE FUNCTION update_stock_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_type = 'PURCHASE' THEN
    UPDATE public.pantry_ingredients
    SET current_stock = current_stock + NEW.quantity_kg,
        updated_at    = now()
    WHERE id = NEW.ingredient_id;

  ELSIF NEW.transaction_type = 'CONSUMPTION' THEN
    UPDATE public.pantry_ingredients
    SET current_stock = GREATEST(0, current_stock - NEW.quantity_kg),
        updated_at    = now()
    WHERE id = NEW.ingredient_id;

  ELSIF NEW.transaction_type = 'ADJUSTMENT' THEN
    UPDATE public.pantry_ingredients
    SET current_stock = GREATEST(0, current_stock + NEW.quantity_kg),
        updated_at    = now()
    WHERE id = NEW.ingredient_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_stock_level_on_transaction ON public.stock_transactions;
CREATE TRIGGER trg_stock_level_on_transaction
  AFTER INSERT ON public.stock_transactions
  FOR EACH ROW EXECUTE FUNCTION update_stock_level();

-- Function: capture_feeding_cost
-- Trigger:  trg_feeding_cost_on_detail_insert — AFTER INSERT ON feeding_details
-- Purpose:  3-step cascade executed in a single atomic transaction:
--             Step 1: Snapshot current_price_per_kg → feeding_details.unit_cost_per_kg
--             Step 2: INSERT CONSUMPTION into stock_transactions
--                     → cascades into trg_stock_level_on_transaction
--                     → decrements pantry_ingredients.current_stock
--             Step 3: Roll up detail cost → feeding_records.total_cost
--           No-price guard: if ingredient has no price set, steps 1-2 are skipped
--           and detail cost is treated as 0 (no stock deduction).
CREATE OR REPLACE FUNCTION capture_feeding_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_price       NUMERIC;
  v_org_id      UUID;
  v_detail_cost NUMERIC;
BEGIN
  SELECT pi.current_price_per_kg, fr.organization_id
  INTO v_price, v_org_id
  FROM public.pantry_ingredients pi
  JOIN public.feeding_records fr ON fr.id = NEW.feeding_record_id
  WHERE pi.id = NEW.ingredient_id;

  IF v_price IS NOT NULL THEN
    v_detail_cost := ROUND((v_price * NEW.kg_amount)::NUMERIC, 2);
    UPDATE public.feeding_details
    SET unit_cost_per_kg = v_price
    WHERE id = NEW.id;
  ELSE
    v_detail_cost := 0;
  END IF;

  IF v_price IS NOT NULL THEN
    INSERT INTO public.stock_transactions (
      organization_id, ingredient_id, transaction_type,
      quantity_kg, unit_cost_per_kg, total_cost, feeding_detail_id
    ) VALUES (
      v_org_id, NEW.ingredient_id, 'CONSUMPTION',
      NEW.kg_amount, v_price, v_detail_cost, NEW.id
    );
  END IF;

  IF v_detail_cost > 0 THEN
    UPDATE public.feeding_records
    SET total_cost = total_cost + v_detail_cost,
        updated_at = now()
    WHERE id = NEW.feeding_record_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feeding_cost_on_detail_insert ON public.feeding_details;
CREATE TRIGGER trg_feeding_cost_on_detail_insert
  AFTER INSERT ON public.feeding_details
  FOR EACH ROW EXECUTE FUNCTION capture_feeding_cost();

-- ── V2.2 LOGIC HARDENING (20260401) ──────────────────────────────────────────

-- Function: enforce_animal_immutability
-- Triggers: trg_animal_immutability_weight  — BEFORE INSERT ON weight_records
--           trg_animal_immutability_health   — BEFORE INSERT ON health_events
--           trg_animal_immutability_treatment — BEFORE INSERT ON treatment_records
-- Purpose:  Enforces CLAUDE.md Golden Rule: "Once DEAD or DISPATCHED, all
--           modifications are blocked at the DB level."
--           Raises BUS-001 (ERRCODE P0001) which maps to lib/errors.ts → toast.
CREATE OR REPLACE FUNCTION enforce_animal_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_status  VARCHAR;
  v_tag_id  VARCHAR;
BEGIN
  SELECT a.status, a.tag_id
  INTO   v_status, v_tag_id
  FROM   public.animals a
  WHERE  a.id = NEW.animal_id;

  IF v_status IN ('DEAD', 'DISPATCHED') THEN
    RAISE EXCEPTION 'BUS-001: Animal % (%) is % — record is locked and cannot be modified',
      v_tag_id, NEW.animal_id, v_status
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_animal_immutability_weight ON public.weight_records;
CREATE TRIGGER trg_animal_immutability_weight
  BEFORE INSERT ON public.weight_records
  FOR EACH ROW EXECUTE FUNCTION enforce_animal_immutability();

DROP TRIGGER IF EXISTS trg_animal_immutability_health ON public.health_events;
CREATE TRIGGER trg_animal_immutability_health
  BEFORE INSERT ON public.health_events
  FOR EACH ROW EXECUTE FUNCTION enforce_animal_immutability();

DROP TRIGGER IF EXISTS trg_animal_immutability_treatment ON public.treatment_records;
CREATE TRIGGER trg_animal_immutability_treatment
  BEFORE INSERT ON public.treatment_records
  FOR EACH ROW EXECUTE FUNCTION enforce_animal_immutability();

-- Function: validate_animal_status_transition
-- Trigger:  trg_validate_animal_status — BEFORE UPDATE ON animals
--           (fires only WHEN OLD.status IS DISTINCT FROM NEW.status)
-- Purpose:  Blocks reverse-transitions FROM terminal states (DEAD, DISPATCHED).
--           Complements trg_health_event_to_animal which auto-drives transitions
--           via health events. This guard protects against direct UPDATE on animals.
CREATE OR REPLACE FUNCTION validate_animal_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('DEAD', 'DISPATCHED') THEN
    RAISE EXCEPTION
      'BUS-001: Cannot change status of animal % — already in terminal state %',
      OLD.tag_id, OLD.status
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_animal_status ON public.animals;
CREATE TRIGGER trg_validate_animal_status
  BEFORE UPDATE ON public.animals
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION validate_animal_status_transition();

-- Function: sync_animal_current_weight
-- Trigger:  trg_sync_current_weight — AFTER INSERT ON weight_records
-- Purpose:  Keeps animals.current_weight in sync with the latest weight_records
--           row. Required for accurate FCR calculation in calculate_pen_fcr(),
--           which reads animals.current_weight directly.
--           Fires AFTER trg_calculate_adg (alphabetical: 'c' < 's') — acceptable
--           because calculate_animal_adg uses NEW.new_weight, not current_weight.
CREATE OR REPLACE FUNCTION sync_animal_current_weight()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.animals
  SET    current_weight = NEW.new_weight,
         updated_at     = now()
  WHERE  id = NEW.animal_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_current_weight ON public.weight_records;
CREATE TRIGGER trg_sync_current_weight
  AFTER INSERT ON public.weight_records
  FOR EACH ROW EXECUTE FUNCTION sync_animal_current_weight();

-- Function: propagate_health_event_to_animal
-- Trigger:  trg_health_event_to_animal — AFTER INSERT ON health_events
-- Purpose:  DB-level enforcement of the animal state machine:
--             FLAGGED_SICK     → status='SICK',       sick_since=now()
--             RECOVERED        → status='ACTIVE',     sick_since=NULL
--             MORTALITY        → status='DEAD',        mortality_date=now()::date
--             DISPATCHED_EARLY → status='DISPATCHED',  dispatch_date=now()::date
--             TREATMENT_ADMINISTERED / FOLLOW_UP_SCHEDULED → no status change
--
--           Conditional UPDATE guards prevent double-transition:
--             FLAGGED_SICK only fires when NOT IN ('DEAD','DISPATCHED')
--             RECOVERED    only fires when status = 'SICK'
--             MORTALITY    only fires when NOT IN ('DEAD','DISPATCHED')
--             DISPATCHED_EARLY only fires when NOT IN ('DEAD','DISPATCHED')
--
--           The BEFORE trigger trg_animal_immutability_health already blocks
--           inserts for DEAD/DISPATCHED animals, so by the time this AFTER
--           trigger runs the animal is guaranteed to be ACTIVE or SICK.
CREATE OR REPLACE FUNCTION propagate_health_event_to_animal()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.event_type

    WHEN 'FLAGGED_SICK' THEN
      UPDATE public.animals
      SET    status     = 'SICK',
             sick_since = COALESCE(sick_since, now()),
             updated_at = now()
      WHERE  id = NEW.animal_id
        AND  status NOT IN ('DEAD', 'DISPATCHED');

    WHEN 'RECOVERED' THEN
      UPDATE public.animals
      SET    status     = 'ACTIVE',
             sick_since = NULL,
             updated_at = now()
      WHERE  id = NEW.animal_id
        AND  status = 'SICK';

    WHEN 'MORTALITY' THEN
      UPDATE public.animals
      SET    status         = 'DEAD',
             mortality_date = COALESCE(mortality_date, now()::date),
             updated_at     = now()
      WHERE  id = NEW.animal_id
        AND  status NOT IN ('DEAD', 'DISPATCHED');

    WHEN 'DISPATCHED_EARLY' THEN
      UPDATE public.animals
      SET    status        = 'DISPATCHED',
             dispatch_date = COALESCE(dispatch_date, now()::date),
             updated_at    = now()
      WHERE  id = NEW.animal_id
        AND  status NOT IN ('DEAD', 'DISPATCHED');

    ELSE
      NULL; -- TREATMENT_ADMINISTERED, FOLLOW_UP_SCHEDULED: no status change

  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_health_event_to_animal ON public.health_events;
CREATE TRIGGER trg_health_event_to_animal
  AFTER INSERT ON public.health_events
  FOR EACH ROW EXECUTE FUNCTION propagate_health_event_to_animal();
