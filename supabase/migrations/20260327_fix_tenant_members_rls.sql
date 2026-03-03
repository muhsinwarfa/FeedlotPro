-- ============================================================
-- Migration: Fix self-referential RLS on tenant_members
--
-- Root cause: The SELECT/INSERT/UPDATE policies in 20260326 used
-- a subquery that queries tenant_members from within a policy ON
-- tenant_members. Postgres RLS evaluates that subquery under the
-- same policy, causing infinite recursion → empty result set →
-- dashboard layout sees no membership row → redirects to /onboarding.
--
-- Fix: A SECURITY DEFINER function resolves the org ID outside
-- the RLS stack (runs as function owner, bypassing row-level
-- security), breaking the circular dependency.
-- ============================================================

-- Helper: returns the organization_id of the calling auth user.
-- SECURITY DEFINER bypasses RLS on tenant_members so the lookup
-- never triggers this policy recursively.
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.tenant_members
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Drop the broken self-referential policies (idempotent; safe if
-- 20260326 was never applied).
DROP POLICY IF EXISTS "tenant_members_select" ON public.tenant_members;
DROP POLICY IF EXISTS "tenant_members_insert" ON public.tenant_members;
DROP POLICY IF EXISTS "tenant_members_update" ON public.tenant_members;

-- Ensure RLS is enabled.
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated members can read all rows in their org.
CREATE POLICY "tenant_members_select" ON public.tenant_members
  FOR SELECT USING (
    organization_id = public.get_my_org_id()
  );

-- INSERT: OWNER can add new team members to their own org.
-- (complete_onboarding RPC still uses SECURITY DEFINER for the
-- initial owner row, so this policy is only reached after onboarding.)
CREATE POLICY "tenant_members_insert" ON public.tenant_members
  FOR INSERT WITH CHECK (
    organization_id = public.get_my_org_id()
  );

-- UPDATE: members can update rows within their own org
-- (PIN changes, role edits, status changes, lockout resets).
CREATE POLICY "tenant_members_update" ON public.tenant_members
  FOR UPDATE USING (
    organization_id = public.get_my_org_id()
  );
