-- ==============================================================================
-- FEEDLOTPRO KENYA — Onboarding RPC Function
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- Why a function instead of direct client inserts?
-- The onboarding creates an organization first, then a tenant_member row.
-- But the organizations SELECT policy requires membership (tenant_members),
-- which doesn't exist yet at insert time. PostgREST raises a 403 when
-- INSERT ... RETURNING can't find the new row via the SELECT policy.
-- A SECURITY DEFINER function bypasses RLS and runs everything atomically.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_farm_name    TEXT,
  p_pens         JSONB,   -- [{"name":"Pen A","capacity":"50"}, {"name":"Pen B","capacity":""}]
  p_ingredients  JSONB    -- [{"name":"Napier Grass"}, {"name":"Dairy Meal"}]
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

  -- 1. Create the organization
  INSERT INTO public.organizations (farm_name)
  VALUES (trim(p_farm_name))
  RETURNING id INTO v_org_id;

  -- 2. Link the caller as tenant member
  INSERT INTO public.tenant_members (user_id, organization_id)
  VALUES (v_user_id, v_org_id);

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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.complete_onboarding(TEXT, JSONB, JSONB) TO authenticated;
