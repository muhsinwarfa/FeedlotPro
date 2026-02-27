-- ==============================================================================
-- FEEDLOTPRO KENYA — Row Level Security Policies (Idempotent)
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to run multiple times — drops existing policies before recreating them.
-- ==============================================================================

-- Step 1: Enable RLS on every table (safe to run even if already enabled)
ALTER TABLE public.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pens                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_ingredients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feeding_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feeding_details      ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- Step 2: Drop all existing policies so re-runs don't fail with "already exists"
-- ==============================================================================

DROP POLICY IF EXISTS "Authenticated users can create an organization" ON public.organizations;
DROP POLICY IF EXISTS "Members can view their organization"             ON public.organizations;
DROP POLICY IF EXISTS "Members can update their organization"           ON public.organizations;

DROP POLICY IF EXISTS "Users can insert their own membership"  ON public.tenant_members;
DROP POLICY IF EXISTS "Users can view their own memberships"   ON public.tenant_members;

DROP POLICY IF EXISTS "Members can view their pens"    ON public.pens;
DROP POLICY IF EXISTS "Members can insert pens"        ON public.pens;
DROP POLICY IF EXISTS "Members can update their pens"  ON public.pens;
DROP POLICY IF EXISTS "Members can delete their pens"  ON public.pens;

DROP POLICY IF EXISTS "Members can view their pantry"          ON public.pantry_ingredients;
DROP POLICY IF EXISTS "Members can insert pantry ingredients"  ON public.pantry_ingredients;
DROP POLICY IF EXISTS "Members can update their pantry"        ON public.pantry_ingredients;
DROP POLICY IF EXISTS "Members can delete from their pantry"   ON public.pantry_ingredients;

DROP POLICY IF EXISTS "Members can view their animals"    ON public.animals;
DROP POLICY IF EXISTS "Members can insert animals"        ON public.animals;
DROP POLICY IF EXISTS "Members can update their animals"  ON public.animals;

DROP POLICY IF EXISTS "Members can view weight records for their animals"    ON public.weight_records;
DROP POLICY IF EXISTS "Members can insert weight records for their animals"  ON public.weight_records;

DROP POLICY IF EXISTS "Members can view their feeding records"  ON public.feeding_records;
DROP POLICY IF EXISTS "Members can insert feeding records"      ON public.feeding_records;

DROP POLICY IF EXISTS "Members can view feeding details"    ON public.feeding_details;
DROP POLICY IF EXISTS "Members can insert feeding details"  ON public.feeding_details;

-- ==============================================================================
-- Step 3: Recreate all policies
-- ==============================================================================

-- 1. ORGANIZATIONS
-- No user_id column — INSERT allows any authenticated user (onboarding).
-- SELECT/UPDATE are restricted to members via tenant_members.

CREATE POLICY "Authenticated users can create an organization"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Members can view their organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can update their organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

-- 2. TENANT_MEMBERS
-- Users can only insert/view their own membership rows.

CREATE POLICY "Users can insert their own membership"
ON public.tenant_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own memberships"
ON public.tenant_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. PENS
-- Full CRUD for members of the owning organization.

CREATE POLICY "Members can view their pens"
ON public.pens
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can insert pens"
ON public.pens
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can update their pens"
ON public.pens
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can delete their pens"
ON public.pens
FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

-- 4. PANTRY_INGREDIENTS
-- Full CRUD for members of the owning organization.

CREATE POLICY "Members can view their pantry"
ON public.pantry_ingredients
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can insert pantry ingredients"
ON public.pantry_ingredients
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can update their pantry"
ON public.pantry_ingredients
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can delete from their pantry"
ON public.pantry_ingredients
FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

-- 5. ANIMALS
-- Full CRUD for members of the owning organization.

CREATE POLICY "Members can view their animals"
ON public.animals
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can insert animals"
ON public.animals
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can update their animals"
ON public.animals
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

-- 6. WEIGHT_RECORDS
-- Joins via animals → organization.

CREATE POLICY "Members can view weight records for their animals"
ON public.weight_records
FOR SELECT
TO authenticated
USING (
  animal_id IN (
    SELECT a.id FROM public.animals a
    WHERE a.organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Members can insert weight records for their animals"
ON public.weight_records
FOR INSERT
TO authenticated
WITH CHECK (
  animal_id IN (
    SELECT a.id FROM public.animals a
    WHERE a.organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  )
);

-- 7. FEEDING_RECORDS
-- Full CRUD for members of the owning organization.

CREATE POLICY "Members can view their feeding records"
ON public.feeding_records
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can insert feeding records"
ON public.feeding_records
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
  )
);

-- 8. FEEDING_DETAILS
-- Joins via feeding_records → organization.

CREATE POLICY "Members can view feeding details"
ON public.feeding_details
FOR SELECT
TO authenticated
USING (
  feeding_record_id IN (
    SELECT fr.id FROM public.feeding_records fr
    WHERE fr.organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Members can insert feeding details"
ON public.feeding_details
FOR INSERT
TO authenticated
WITH CHECK (
  feeding_record_id IN (
    SELECT fr.id FROM public.feeding_records fr
    WHERE fr.organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  )
);

-- ==============================================================================
-- Step 4: Verify — run this SELECT to confirm all 18 policies exist.
-- Expected: 18 rows returned.
-- ==============================================================================

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
