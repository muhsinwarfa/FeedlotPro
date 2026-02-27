-- ==============================================================================
-- FEEDLOTPRO KENYA — Fix Trigger Function Security
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- Problem: Trigger functions run as SECURITY INVOKER (default), meaning they
-- execute as the calling user (authenticated role). This causes:
--   - log_audit_event()       → INSERT on audit_logs blocked (no policy for authenticated)
--   - sync_pen_animal_count() → UPDATE on pens may fail if RLS context is lost
--   - propagate_animal_weight → UPDATE on animals may fail if RLS context is lost
--
-- Fix: Add SECURITY DEFINER so trigger functions run as the function owner
-- (postgres superuser), bypassing RLS. This is standard Supabase practice
-- for trigger functions that write to internal/system tables.
-- ==============================================================================

-- 1. Audit logging — writes to audit_logs (no INSERT policy for authenticated)
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD)::jsonb);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Pen animal count sync — updates pens.active_animal_count
CREATE OR REPLACE FUNCTION public.sync_pen_animal_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status IN ('ACTIVE', 'SICK') THEN
            UPDATE public.pens SET active_animal_count = active_animal_count + 1 WHERE id = NEW.pen_id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.pen_id != NEW.pen_id AND OLD.status IN ('ACTIVE', 'SICK') AND NEW.status IN ('ACTIVE', 'SICK') THEN
            UPDATE public.pens SET active_animal_count = active_animal_count - 1 WHERE id = OLD.pen_id;
            UPDATE public.pens SET active_animal_count = active_animal_count + 1 WHERE id = NEW.pen_id;
        ELSIF OLD.status IN ('ACTIVE', 'SICK') AND NEW.status IN ('DEAD', 'DISPATCHED') THEN
            UPDATE public.pens SET active_animal_count = active_animal_count - 1 WHERE id = OLD.pen_id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('ACTIVE', 'SICK') THEN
            UPDATE public.pens SET active_animal_count = active_animal_count - 1 WHERE id = OLD.pen_id;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Weight propagation — updates animals.current_weight
CREATE OR REPLACE FUNCTION public.propagate_animal_weight()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.new_weight IS NOT NULL THEN
        UPDATE public.animals
        SET current_weight = NEW.new_weight,
            updated_at = now()
        WHERE id = NEW.animal_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Status safeguard — no cross-table writes, SECURITY INVOKER is fine,
--    but add SECURITY DEFINER for consistency
CREATE OR REPLACE FUNCTION public.check_animal_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('DEAD', 'DISPATCHED') THEN
        RAISE EXCEPTION 'ERR_INVALID_TRANSITION: Cannot modify a % animal', OLD.status;
    END IF;

    IF NEW.status = 'DEAD' AND OLD.status != 'DEAD' THEN
        NEW.mortality_date := COALESCE(NEW.mortality_date, now());
    END IF;

    IF NEW.status = 'DISPATCHED' AND OLD.status != 'DISPATCHED' THEN
        NEW.dispatch_date := COALESCE(NEW.dispatch_date, now());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
