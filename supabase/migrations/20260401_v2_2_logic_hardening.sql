-- ==============================================================================
-- FEEDLOTPRO KENYA — V2.2 Logic Hardening: Airgap the "Brain"
--
-- Closes 4 critical gaps identified by the State Propagation audit:
--
--   GAP 1  animals.current_weight never updated by DB on weight insert
--          → trg_sync_current_weight (AFTER INSERT on weight_records)
--
--   GAP 2  Health event→animal status propagation is frontend-only
--          → trg_health_event_to_animal (AFTER INSERT on health_events)
--
--   GAP 3  Animal immutability not enforced at DB level for writes
--          → trg_animal_immutability_weight / _health / _treatment
--            (BEFORE INSERT on weight_records, health_events, treatment_records)
--
--   GAP 4  Animal terminal-state reverse-transition unguarded
--          → trg_validate_animal_status (BEFORE UPDATE on animals)
--
-- Trigger scope convention used throughout:
--   BEFORE = validation / safeguard (can abort the operation via RAISE)
--   AFTER  = side effect / propagation (downstream writes)
-- ==============================================================================

-- ==============================================================================
-- GAP 3 — FIRST: define immutability guard before attaching to weight_records
--          (GAP 1's trigger also fires on weight_records — declare GAP 3 first
--           so the BEFORE trigger aborts before the AFTER triggers run)
-- ==============================================================================

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

-- Attach to weight_records (blocks new weigh-ins for dead/dispatched animals)
DROP TRIGGER IF EXISTS trg_animal_immutability_weight ON public.weight_records;
CREATE TRIGGER trg_animal_immutability_weight
  BEFORE INSERT ON public.weight_records
  FOR EACH ROW EXECUTE FUNCTION enforce_animal_immutability();

-- Attach to health_events (blocks new health events for dead/dispatched animals)
DROP TRIGGER IF EXISTS trg_animal_immutability_health ON public.health_events;
CREATE TRIGGER trg_animal_immutability_health
  BEFORE INSERT ON public.health_events
  FOR EACH ROW EXECUTE FUNCTION enforce_animal_immutability();

-- Attach to treatment_records (blocks treatments on dead/dispatched animals)
DROP TRIGGER IF EXISTS trg_animal_immutability_treatment ON public.treatment_records;
CREATE TRIGGER trg_animal_immutability_treatment
  BEFORE INSERT ON public.treatment_records
  FOR EACH ROW EXECUTE FUNCTION enforce_animal_immutability();

-- ==============================================================================
-- GAP 4 — Validate animal status state-machine on direct UPDATE
--
-- Allowed transitions (terminal states are one-way):
--   ACTIVE     → SICK | DISPATCHED | DEAD
--   SICK       → ACTIVE | DEAD | DISPATCHED
--   DEAD       → (nothing — terminal)
--   DISPATCHED → (nothing — terminal)
--
-- This guard only fires when status IS DISTINCT FROM OLD.status,
-- so normal field updates (breed, pen_id, etc.) pass through without overhead.
-- ==============================================================================

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

-- ==============================================================================
-- GAP 1 — Sync animals.current_weight from weight_records on INSERT
--
-- The existing trg_calculate_adg (AFTER INSERT) computes ADG using NEW.new_weight
-- directly, so it does NOT depend on this trigger's output.
-- The FCR trigger (trg_calculate_fcr on feeding_records) reads
-- animals.current_weight — it fires on a DIFFERENT table insert, so by the
-- time FCR is calculated, current_weight will already be up to date from
-- this trigger having run on a prior weight insert.
-- ==============================================================================

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

-- Trigger name starts with 's' — fires AFTER 'trg_calculate_adg' (starts with 'c').
-- Both are AFTER INSERT on weight_records; ordering is alphabetical in PostgreSQL.
-- Order is acceptable: ADG uses NEW.new_weight (not animals.current_weight),
-- so both triggers are independent of each other on the same row.
DROP TRIGGER IF EXISTS trg_sync_current_weight ON public.weight_records;
CREATE TRIGGER trg_sync_current_weight
  AFTER INSERT ON public.weight_records
  FOR EACH ROW EXECUTE FUNCTION sync_animal_current_weight();

-- ==============================================================================
-- GAP 2 — Propagate health_events to animals.status (DB-enforced state machine)
--
-- event_type → animals.status transition map:
--   FLAGGED_SICK          → SICK     (sets sick_since if not already set)
--   RECOVERED             → ACTIVE   (clears sick_since)
--   MORTALITY             → DEAD     (sets mortality_date)
--   DISPATCHED_EARLY      → DISPATCHED (sets dispatch_date)
--   TREATMENT_ADMINISTERED → (no status change — treatment recorded on SICK animal)
--   FOLLOW_UP_SCHEDULED   → (no status change)
--
-- Conditional UPDATE pattern: only changes status when the transition is valid
-- to avoid clobbering concurrent updates.
-- GAP 3's BEFORE trigger already blocked inserts for DEAD/DISPATCHED animals,
-- so by the time this AFTER trigger runs, the animal is ACTIVE or SICK.
-- ==============================================================================

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
      -- TREATMENT_ADMINISTERED, FOLLOW_UP_SCHEDULED: no status change needed
      NULL;

  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_health_event_to_animal ON public.health_events;
CREATE TRIGGER trg_health_event_to_animal
  AFTER INSERT ON public.health_events
  FOR EACH ROW EXECUTE FUNCTION propagate_health_event_to_animal();
