-- ==============================================================================
-- V2 BLOCK 2: Health & Vet Workflow (P6) + Performance Intelligence (P7)
-- + Offline Sync conflict log (P10)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. New tables
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.health_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id          UUID NOT NULL REFERENCES public.animals(id),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id),
  event_type         VARCHAR NOT NULL CHECK (event_type IN (
                       'FLAGGED_SICK','TREATMENT_ADMINISTERED','RECOVERED',
                       'FOLLOW_UP_SCHEDULED','MORTALITY','DISPATCHED_EARLY')),
  primary_symptom    VARCHAR,
  secondary_symptoms JSONB NOT NULL DEFAULT '[]',
  severity           VARCHAR CHECK (severity IN ('MILD','MODERATE','SEVERE')),
  notes              TEXT,
  photo_url          TEXT,
  performed_by       UUID REFERENCES public.tenant_members(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_events_animal
  ON public.health_events(animal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS health_events_org
  ON public.health_events(organization_id, event_type);

CREATE TABLE IF NOT EXISTS public.treatment_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id            UUID NOT NULL REFERENCES public.animals(id),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id),
  medication_name      VARCHAR NOT NULL,
  dosage               VARCHAR NOT NULL,
  administration_route VARCHAR NOT NULL CHECK (administration_route IN (
                          'ORAL','INJECTION_IM','INJECTION_IV','INJECTION_SC','TOPICAL','DRENCH')),
  treatment_cost       NUMERIC,
  notes                TEXT,
  follow_up_date       DATE,
  treated_by           UUID REFERENCES public.tenant_members(id),
  treated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS treatment_records_animal
  ON public.treatment_records(animal_id, treated_at DESC);

-- Server-side conflict log (offline_queue lives in IndexedDB, not Supabase)
CREATE TABLE IF NOT EXISTS public.sync_conflicts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name     VARCHAR NOT NULL,
  record_id      TEXT NOT NULL,
  local_payload  JSONB NOT NULL,
  server_payload JSONB,
  error_message  TEXT,
  resolved_at    TIMESTAMPTZ,
  resolved_by    UUID REFERENCES public.tenant_members(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. Triggers: ADG + FCR auto-calculation (P7)
-- ------------------------------------------------------------------------------

-- P7A: Calculate ADG on weight_records INSERT
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

-- Drop and recreate trigger to avoid duplicate
DROP TRIGGER IF EXISTS trg_calculate_adg ON public.weight_records;
CREATE TRIGGER trg_calculate_adg
  AFTER INSERT ON public.weight_records
  FOR EACH ROW EXECUTE FUNCTION calculate_animal_adg();

-- P7B: Calculate Pen FCR on feeding_records INSERT (rolling 30-day window)
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

-- ------------------------------------------------------------------------------
-- 3. RLS Policies
-- ------------------------------------------------------------------------------

ALTER TABLE public.health_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "health_events_org_select" ON public.health_events;
CREATE POLICY "health_events_org_select" ON public.health_events
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "health_events_org_insert" ON public.health_events;
CREATE POLICY "health_events_org_insert" ON public.health_events
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.treatment_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "treatment_records_org_select" ON public.treatment_records;
CREATE POLICY "treatment_records_org_select" ON public.treatment_records
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "treatment_records_org_insert" ON public.treatment_records;
CREATE POLICY "treatment_records_org_insert" ON public.treatment_records
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_conflicts_org_select" ON public.sync_conflicts;
CREATE POLICY "sync_conflicts_org_select" ON public.sync_conflicts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "sync_conflicts_org_insert" ON public.sync_conflicts;
CREATE POLICY "sync_conflicts_org_insert" ON public.sync_conflicts
  FOR INSERT WITH CHECK (true);
