-- ============================================================
-- Migration: Make complete_onboarding RPC idempotent
--
-- Root cause: migrations 20260326/20260327 broke the dashboard
-- layout, trapping users in an onboarding loop. They re-submitted
-- the onboarding form each time, creating duplicate organizations
-- and tenant_members rows for the same user_id. The dashboard
-- layout used .single() which returns null for >1 rows.
--
-- The layout fix (limit(1) + array access) is deployed via code.
-- This migration prevents future duplicates by making the RPC
-- return early if the calling user already has a membership.
--
-- Note: existing duplicate rows are intentionally left in place
-- because they are referenced by health_events and other tables
-- via FK constraints. The layout fix handles them correctly.
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_farm_name    TEXT,
  p_pens         JSONB,
  p_ingredients  JSONB,
  p_display_name TEXT DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id   uuid;
  v_user_id  uuid := auth.uid();
  v_pen      jsonb;
  v_ing      jsonb;
BEGIN
  -- Guard: must be called by an authenticated user
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Guard: farm name required
  IF p_farm_name IS NULL OR trim(p_farm_name) = '' THEN
    RAISE EXCEPTION 'Farm name is required';
  END IF;

  -- Idempotency guard: if user already has an organization, return it.
  -- Prevents duplicate orgs when onboarding is accidentally submitted twice.
  SELECT organization_id INTO v_org_id
  FROM public.tenant_members
  WHERE user_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  -- 1. Create the organization
  INSERT INTO public.organizations (farm_name)
  VALUES (trim(p_farm_name))
  RETURNING id INTO v_org_id;

  -- 2. Link the caller as OWNER with display_name
  INSERT INTO public.tenant_members (user_id, organization_id, role, display_name, avatar_color, status)
  VALUES (
    v_user_id,
    v_org_id,
    'OWNER',
    COALESCE(NULLIF(trim(p_display_name), ''), split_part(current_setting('request.jwt.claims', true)::json->>'email', '@', 1)),
    '#064E3B',
    'ACTIVE'
  );

  -- 3. Create pens
  FOR v_pen IN SELECT * FROM jsonb_array_elements(p_pens) LOOP
    INSERT INTO public.pens (organization_id, pen_name, capacity)
    VALUES (
      v_org_id,
      v_pen->>'name',
      NULLIF(trim(v_pen->>'capacity'), '')::integer
    );
  END LOOP;

  -- 4. Create pantry ingredients
  FOR v_ing IN SELECT * FROM jsonb_array_elements(p_ingredients) LOOP
    INSERT INTO public.pantry_ingredients (organization_id, ingredient_name, unit)
    VALUES (v_org_id, trim(v_ing->>'name'), 'kg');
  END LOOP;

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding(TEXT, JSONB, JSONB, TEXT) TO authenticated;
