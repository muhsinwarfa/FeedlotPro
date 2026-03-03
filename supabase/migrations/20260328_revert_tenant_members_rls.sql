-- ============================================================
-- Migration: Revert all RLS changes on tenant_members
--
-- History of the damage:
--   20260326 → first time ENABLE ROW LEVEL SECURITY was called on
--              tenant_members; added self-referential SELECT policy
--              that caused infinite recursion → empty result set →
--              dashboard layout redirected every user to /onboarding
--   20260327 → attempted fix with SECURITY DEFINER function; still
--              not working reliably
--
-- Correct state: V1 never had RLS on tenant_members (not in
-- docs/schema.sql, not in any migration before 20260326).
-- Disabling RLS here restores the working pre-20260326 state.
-- ============================================================

-- Drop policies created by 20260326 / 20260327
DROP POLICY IF EXISTS "tenant_members_select" ON public.tenant_members;
DROP POLICY IF EXISTS "tenant_members_insert" ON public.tenant_members;
DROP POLICY IF EXISTS "tenant_members_update" ON public.tenant_members;

-- Drop the helper function added by 20260327
DROP FUNCTION IF EXISTS public.get_my_org_id();

-- Disable RLS — tenant_members is protected at the application layer
-- (organization_id scoping in every query + RBAC route guards)
ALTER TABLE public.tenant_members DISABLE ROW LEVEL SECURITY;
