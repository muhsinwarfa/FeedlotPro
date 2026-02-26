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