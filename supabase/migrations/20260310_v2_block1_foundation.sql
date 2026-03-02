-- ==============================================================================
-- FEEDLOTPRO KENYA — V2 Block 1: Foundation Migration
-- Adds: RBAC columns, worker sessions, batch management, V2 animal fields
-- All changes are additive and idempotent (ADD COLUMN IF NOT EXISTS).
-- Run: npx supabase db push
-- ==============================================================================

-- ── 0. New tables must be created BEFORE ALTER TABLE references them ──────────

-- batches (P5 — groups animals arriving on the same day from the same source)
CREATE TABLE IF NOT EXISTS public.batches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_code       VARCHAR NOT NULL,
  source_supplier  VARCHAR,
  arrival_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT batches_org_code_unique UNIQUE (organization_id, batch_code)
);

-- sessions (P4 — worker kiosk sessions on shared tablet)
CREATE TABLE IF NOT EXISTS public.sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id        UUID NOT NULL REFERENCES public.tenant_members(id) ON DELETE CASCADE,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_org_active
  ON public.sessions(organization_id, expires_at)
  WHERE ended_at IS NULL;

-- ── 1. Extend organizations ───────────────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS target_weight       NUMERIC,
  ADD COLUMN IF NOT EXISTS session_ttl_hours   INTEGER NOT NULL DEFAULT 12;

-- ── 2. Extend pens ────────────────────────────────────────────────────────────
ALTER TABLE public.pens
  ADD COLUMN IF NOT EXISTS is_sick_pen  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_fcr  NUMERIC;

-- ── 3. Extend tenant_members (add RBAC + worker session fields) ───────────────
ALTER TABLE public.tenant_members
  ADD COLUMN IF NOT EXISTS role          VARCHAR NOT NULL DEFAULT 'OWNER'
                           CHECK (role IN ('OWNER','MANAGER','FARMHAND','VET')),
  ADD COLUMN IF NOT EXISTS display_name  VARCHAR NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_color  VARCHAR NOT NULL DEFAULT '#064E3B',
  ADD COLUMN IF NOT EXISTS pin_hash      VARCHAR,
  ADD COLUMN IF NOT EXISTS pin_attempts  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status        VARCHAR NOT NULL DEFAULT 'ACTIVE'
                           CHECK (status IN ('ACTIVE','LOCKED'));

-- ── 4. Extend animals with V2 fields (batch_id FK to batches created above) ───
ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS gender               VARCHAR
                           CHECK (gender IN ('BULL','HEIFER','STEER','COW')),
  ADD COLUMN IF NOT EXISTS age_category         VARCHAR
                           CHECK (age_category IN ('CALF','WEANER','GROWER','FINISHER')),
  ADD COLUMN IF NOT EXISTS photo_url            TEXT,
  ADD COLUMN IF NOT EXISTS batch_id             UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_supplier      VARCHAR,
  ADD COLUMN IF NOT EXISTS current_adg          NUMERIC,
  ADD COLUMN IF NOT EXISTS dispatch_ready       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispatch_ready_date  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sick_since           TIMESTAMPTZ;

-- ── 5. Extend pantry_ingredients (prep for Block 3 cost tracking) ─────────────
ALTER TABLE public.pantry_ingredients
  ADD COLUMN IF NOT EXISTS current_price_per_kg  NUMERIC,
  ADD COLUMN IF NOT EXISTS current_stock          NUMERIC NOT NULL DEFAULT 0;

-- ── 6. Trigger: auto-lock member after 3 failed PIN attempts ──────────────────
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

-- ── 7. Audit triggers for new tables ─────────────────────────────────────────
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

-- ── 8. RLS: Enable on new tables ─────────────────────────────────────────────
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- batches: members can only see batches for their own organization
DROP POLICY IF EXISTS "batches_org_isolation" ON public.batches;
CREATE POLICY "batches_org_isolation" ON public.batches
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.tenant_members
      WHERE user_id = auth.uid()
    )
  );

-- sessions: members can only see sessions for their own organization
DROP POLICY IF EXISTS "sessions_org_isolation" ON public.sessions;
CREATE POLICY "sessions_org_isolation" ON public.sessions
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.tenant_members
      WHERE user_id = auth.uid()
    )
  );
