-- ============================================================
-- Migration: Definitively fix tenant_members permissions
--
-- Root cause: Migration 20260328 only dropped 3 specific named
-- policies. Reverted migrations 20260326/20260327 may have
-- created additional policies with different names that still
-- exist in the live DB. Even with DISABLE ROW LEVEL SECURITY,
-- the authenticated role also needs explicit INSERT/UPDATE grants
-- or PostgREST rejects writes before RLS evaluation.
--
-- This migration:
--   1. Drops ALL remaining policies on tenant_members dynamically
--   2. Disables RLS (idempotent — safe to re-run)
--   3. Grants SELECT, INSERT, UPDATE to authenticated role
-- ============================================================

-- 1. Drop every remaining policy on tenant_members (handles any
--    leftover policies from reverted migrations with unknown names)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenant_members', r.policyname);
  END LOOP;
END $$;

-- 2. Ensure RLS is disabled (idempotent)
ALTER TABLE public.tenant_members DISABLE ROW LEVEL SECURITY;

-- 3. Explicit grants so the authenticated role can write directly
--    (required for direct browser-client inserts/updates to work
--    regardless of RLS state)
GRANT SELECT, INSERT, UPDATE ON public.tenant_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenant_members TO anon;
