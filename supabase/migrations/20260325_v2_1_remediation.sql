-- ==============================================================================
-- FEEDLOTPRO KENYA — V2.1 Remediation: BPMN Compliance Gaps
-- Closes 10 FAILs + 14 PARTIALs from the March 2026 compliance audit.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Fix tenant_members status CHECK constraint to include REMOVED
-- Original: CHECK (status IN ('ACTIVE', 'LOCKED'))
-- BUS-007 / P11 soft-delete requires REMOVED as a valid status value.
-- The AS NEVER cast in team-manager.tsx was papering over this missing value.
-- ------------------------------------------------------------------------------
ALTER TABLE public.tenant_members
  DROP CONSTRAINT IF EXISTS tenant_members_status_check;

ALTER TABLE public.tenant_members
  ADD CONSTRAINT tenant_members_status_check
    CHECK (status IN ('ACTIVE', 'LOCKED', 'REMOVED'));

-- ------------------------------------------------------------------------------
-- 2. Add device_id to sessions (P4 Step 8 — tablet hardware identifier)
-- Spec: sessions table requires deviceId for audit trail.
-- Populated by the browser via localStorage UUID fingerprint.
-- ------------------------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS device_id TEXT;

-- ------------------------------------------------------------------------------
-- 3. Add target_age_category to ration_templates (P8C Step 2)
-- Spec: Ration builder form requires targetAgeCategory dropdown.
-- Values: CALF | WEANER | GROWER | FINISHER | ALL
-- NULL = not specified (applies to all).
-- ------------------------------------------------------------------------------
ALTER TABLE public.ration_templates
  ADD COLUMN IF NOT EXISTS target_age_category VARCHAR
    CHECK (target_age_category IN ('CALF', 'WEANER', 'GROWER', 'FINISHER', 'ALL'));

-- ------------------------------------------------------------------------------
-- 4. Create activity_log table (P11 Step 6 — team management audit trail)
-- Spec Section 13: System-wide audit trail for all user actions.
-- Inserted on every team management action: role change, PIN reset, remove, unlock.
-- performed_by is nullable (FK to tenant_members) to survive member removal.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action          VARCHAR NOT NULL,         -- e.g. 'ROLE_CHANGED', 'MEMBER_REMOVED'
  target_entity   VARCHAR NOT NULL,         -- e.g. 'tenant_member'
  target_id       UUID,                     -- ID of the affected record
  performed_by    UUID REFERENCES public.tenant_members(id) ON DELETE SET NULL,
  metadata        JSONB,                    -- action-specific detail (e.g. {from_role, to_role})
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_org_idx
  ON public.activity_log(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_log_performed_by_idx
  ON public.activity_log(performed_by, created_at DESC);

-- Row-level security: org isolation (same pattern as all V2 tables)
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_log_org_isolation" ON public.activity_log;
CREATE POLICY "activity_log_org_isolation" ON public.activity_log
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );
