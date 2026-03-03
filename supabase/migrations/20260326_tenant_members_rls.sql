-- ============================================================
-- Migration: Add RLS policies for tenant_members
-- Fixes: OWNER gets RLS violation when creating team members
--
-- Root cause: tenant_members had RLS enabled (from V1) but no
-- INSERT/SELECT/UPDATE policies. Supabase default-denies all
-- operations when no policy is found. The onboarding RPC used
-- SECURITY DEFINER which bypassed RLS, hiding this gap.
-- ============================================================

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated member can read their own org's roster
DROP POLICY IF EXISTS "tenant_members_select" ON public.tenant_members;
CREATE POLICY "tenant_members_select" ON public.tenant_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

-- INSERT: a member can add new rows to their own org (OWNER uses this to create team members)
DROP POLICY IF EXISTS "tenant_members_insert" ON public.tenant_members;
CREATE POLICY "tenant_members_insert" ON public.tenant_members
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

-- UPDATE: a member can update rows in their own org (PIN changes, role edits, status changes)
DROP POLICY IF EXISTS "tenant_members_update" ON public.tenant_members;
CREATE POLICY "tenant_members_update" ON public.tenant_members
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );
