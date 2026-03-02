-- ==============================================================================
-- FEEDLOTPRO KENYA - L2 Logic (The Brain)
-- Target: Supabase (PostgreSQL)
-- Responsibilities: State Propagation, Safeguards, Audit Logging
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. OBSERVABILITY: Audit Logging Subsystem
-- ------------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD)::jsonb);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply Audit Triggers to critical core tables
CREATE TRIGGER trg_audit_animals
    AFTER INSERT OR UPDATE OR DELETE ON animals
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_audit_feeding_records
    AFTER INSERT OR UPDATE OR DELETE ON feeding_records
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- ------------------------------------------------------------------------------
-- 2. SAFEGUARDS: Complex State Machine Rules (Animals)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_animal_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Business Rule: DEAD or DISPATCHED animals are locked and cannot be modified.
    IF OLD.status IN ('DEAD', 'DISPATCHED') THEN
        RAISE EXCEPTION 'ERR_INVALID_TRANSITION: Cannot modify a % animal', OLD.status;
    END IF;

    -- Side Effect: Auto-stamp mortality/dispatch dates upon status change
    IF NEW.status = 'DEAD' AND OLD.status != 'DEAD' THEN
        NEW.mortality_date := COALESCE(NEW.mortality_date, now());
    END IF;
    
    IF NEW.status = 'DISPATCHED' AND OLD.status != 'DISPATCHED' THEN
        NEW.dispatch_date := COALESCE(NEW.dispatch_date, now());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_animal_status_safeguard
    BEFORE UPDATE ON animals
    FOR EACH ROW EXECUTE FUNCTION check_animal_status_transition();

-- ------------------------------------------------------------------------------
-- 3. STATE PROPAGATION: Maintain Active Animal Count in Pens
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_pen_animal_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Action: INSERT (Animal Intake)
    IF TG_OP = 'INSERT' THEN
        IF NEW.status IN ('ACTIVE', 'SICK') THEN
            UPDATE pens SET active_animal_count = active_animal_count + 1 WHERE id = NEW.pen_id;
        END IF;
        RETURN NEW;
    END IF;

    -- Action: UPDATE (Pen Moves & Status Changes)
    IF TG_OP = 'UPDATE' THEN
        -- Case A: Animal moved to a new pen (e.g., ACTIVE -> SICK move)
        IF OLD.pen_id != NEW.pen_id AND OLD.status IN ('ACTIVE', 'SICK') AND NEW.status IN ('ACTIVE', 'SICK') THEN
            UPDATE pens SET active_animal_count = active_animal_count - 1 WHERE id = OLD.pen_id;
            UPDATE pens SET active_animal_count = active_animal_count + 1 WHERE id = NEW.pen_id;
        
        -- Case B: Animal died or was dispatched (removed from active count)
        ELSIF OLD.status IN ('ACTIVE', 'SICK') AND NEW.status IN ('DEAD', 'DISPATCHED') THEN
            UPDATE pens SET active_animal_count = active_animal_count - 1 WHERE id = OLD.pen_id;
        END IF;
        
        RETURN NEW;
    END IF;

    -- Action: DELETE (Cleanup/Rollback)
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('ACTIVE', 'SICK') THEN
            UPDATE pens SET active_animal_count = active_animal_count - 1 WHERE id = OLD.pen_id;
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_pen_count
    AFTER INSERT OR UPDATE OR DELETE ON animals
    FOR EACH ROW EXECUTE FUNCTION sync_pen_animal_count();

-- ------------------------------------------------------------------------------
-- 4. STATE PROPAGATION: Periodic Weighing
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION propagate_animal_weight()
RETURNS TRIGGER AS $$
BEGIN
    -- Null Safety check
    IF NEW.new_weight IS NOT NULL THEN
        -- Updates the current weight on the parent animal record when a new weight log is inserted
        UPDATE animals 
        SET current_weight = NEW.new_weight, 
            updated_at = now() 
        WHERE id = NEW.animal_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_propagate_weight
    AFTER INSERT ON weight_records
    FOR EACH ROW EXECUTE FUNCTION propagate_animal_weight();

-- ==============================================================================
-- V2 BLOCK 1: PIN Lockout Safeguard
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 5. SAFEGUARD: Auto-lock worker after 3 failed PIN attempts (P4)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_pin_lockout()
RETURNS TRIGGER AS $$
BEGIN
    -- When pin_attempts reaches 3, automatically lock the member account.
    -- The frontend increments pin_attempts on each failed attempt.
    -- This trigger fires BEFORE UPDATE, so it can modify NEW before writing.
    IF NEW.pin_attempts >= 3 AND OLD.pin_attempts < 3 THEN
        NEW.status := 'LOCKED';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_pin_lockout
    BEFORE UPDATE ON tenant_members
    FOR EACH ROW EXECUTE FUNCTION check_pin_lockout();

-- ==============================================================================
-- V2 BLOCK 2: ADG / FCR Performance Triggers (P7)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 6. PERFORMANCE: Auto-compute ADG + dispatch_ready on weight_records INSERT (P7A)
-- ------------------------------------------------------------------------------
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
        WHEN v_dispatch AND NOT COALESCE(dispatch_ready, false) THEN now()
        ELSE dispatch_ready_date
      END,
      updated_at          = now()
  WHERE id = NEW.animal_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_calculate_adg
  AFTER INSERT ON public.weight_records
  FOR EACH ROW EXECUTE FUNCTION calculate_animal_adg();

-- ------------------------------------------------------------------------------
-- 7. PERFORMANCE: Auto-compute pen FCR on feeding_records INSERT (P7B, 30-day rolling)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_pen_fcr()
RETURNS TRIGGER AS $$
DECLARE
  v_period_start TIMESTAMPTZ := now() - INTERVAL '30 days';
  v_total_fed    NUMERIC;
  v_total_gained NUMERIC;
BEGIN
  SELECT COALESCE(SUM(fd.kg_amount), 0) INTO v_total_fed
  FROM public.feeding_details fd
  JOIN public.feeding_records fr ON fr.id = fd.feeding_record_id
  WHERE fr.pen_id = NEW.pen_id AND fr.feeding_timestamp >= v_period_start;

  SELECT COALESCE(SUM(a.current_weight - a.intake_weight), 0) INTO v_total_gained
  FROM public.animals a
  WHERE a.pen_id = NEW.pen_id
    AND a.status IN ('ACTIVE', 'SICK')
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

CREATE TRIGGER trg_calculate_fcr
  AFTER INSERT ON public.feeding_records
  FOR EACH ROW EXECUTE FUNCTION calculate_pen_fcr();

-- ── V2 Block 3: Feed Cost & Inventory Triggers ────────────────────────────────

-- trg_price_history_on_update
-- Fires: AFTER UPDATE on pantry_ingredients
-- Purpose: When current_price_per_kg changes, insert a row in price_history.
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.current_price_per_kg IS DISTINCT FROM NEW.current_price_per_kg THEN
    INSERT INTO public.price_history (organization_id, ingredient_id, old_price, new_price)
    VALUES (NEW.organization_id, NEW.id, OLD.current_price_per_kg, NEW.current_price_per_kg);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_price_history_on_update ON public.pantry_ingredients;
CREATE TRIGGER trg_price_history_on_update
  AFTER UPDATE ON public.pantry_ingredients
  FOR EACH ROW EXECUTE FUNCTION log_price_change();

-- trg_stock_level_on_transaction
-- Fires: AFTER INSERT on stock_transactions
-- Purpose: Update pantry_ingredients.current_stock based on transaction_type.
--   PURCHASE:    current_stock += quantity_kg
--   CONSUMPTION: current_stock = GREATEST(0, current_stock - quantity_kg)
--   ADJUSTMENT:  current_stock = GREATEST(0, current_stock + quantity_kg)  (signed delta)
CREATE OR REPLACE FUNCTION update_stock_level()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.transaction_type = 'PURCHASE' THEN
    UPDATE public.pantry_ingredients
    SET current_stock = COALESCE(current_stock, 0) + NEW.quantity_kg
    WHERE id = NEW.ingredient_id;
  ELSIF NEW.transaction_type = 'CONSUMPTION' THEN
    UPDATE public.pantry_ingredients
    SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - NEW.quantity_kg)
    WHERE id = NEW.ingredient_id;
  ELSIF NEW.transaction_type = 'ADJUSTMENT' THEN
    UPDATE public.pantry_ingredients
    SET current_stock = GREATEST(0, COALESCE(current_stock, 0) + NEW.quantity_kg)
    WHERE id = NEW.ingredient_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_level_on_transaction ON public.stock_transactions;
CREATE TRIGGER trg_stock_level_on_transaction
  AFTER INSERT ON public.stock_transactions
  FOR EACH ROW EXECUTE FUNCTION update_stock_level();

-- trg_feeding_cost_on_detail_insert
-- Fires: AFTER INSERT on feeding_details
-- Purpose:
--   1. Snapshot pantry_ingredients.current_price_per_kg → feeding_details.unit_cost_per_kg
--   2. Insert a CONSUMPTION row into stock_transactions (feeding_detail_id for dedup)
--   3. Roll up feeding_records.total_cost by adding this detail's cost
CREATE OR REPLACE FUNCTION capture_feeding_cost()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_price       NUMERIC;
  v_detail_cost NUMERIC;
  v_org_id      UUID;
BEGIN
  -- Get current price from pantry
  SELECT current_price_per_kg, organization_id
  INTO v_price, v_org_id
  FROM public.pantry_ingredients
  WHERE id = NEW.ingredient_id;

  -- Snapshot price onto detail row
  UPDATE public.feeding_details
  SET unit_cost_per_kg = v_price
  WHERE id = NEW.id;

  -- Compute detail cost
  v_detail_cost := COALESCE(v_price, 0) * NEW.kg_amount;

  -- Insert CONSUMPTION stock transaction (idempotent via feeding_detail_id FK)
  INSERT INTO public.stock_transactions (
    organization_id, ingredient_id, transaction_type,
    quantity_kg, unit_cost_per_kg, total_cost, feeding_detail_id
  ) VALUES (
    v_org_id, NEW.ingredient_id, 'CONSUMPTION',
    NEW.kg_amount, v_price, v_detail_cost, NEW.id
  )
  ON CONFLICT DO NOTHING;

  -- Roll up total_cost on feeding_records
  UPDATE public.feeding_records
  SET total_cost = COALESCE(total_cost, 0) + v_detail_cost
  WHERE id = NEW.feeding_record_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feeding_cost_on_detail_insert ON public.feeding_details;
CREATE TRIGGER trg_feeding_cost_on_detail_insert
  AFTER INSERT ON public.feeding_details
  FOR EACH ROW EXECUTE FUNCTION capture_feeding_cost();