-- ============================================================
-- Migration: Deduplicate tenant_members + make onboarding RPC idempotent
--
-- Root cause: migrations 20260326/20260327 broke the dashboard
-- layout by enabling RLS on tenant_members, causing an infinite
-- redirect to /onboarding. Users re-submitted the onboarding form
-- repeatedly (thinking it failed), which called complete_onboarding
-- multiple times. Each call created a new organization + a new
-- tenant_members row for the same user_id. The dashboard layout
-- used .single() which returns null for >1 rows — identical to
-- "no rows" — so the redirect loop continued even after RLS was
-- disabled in 20260328.
-- ============================================================

-- Step 1: Remove duplicate tenant_members rows for the same user_id,
-- keeping only the most recently created one per user.
DELETE FROM public.tenant_members
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id
             ORDER BY created_at DESC NULLS LAST
           ) AS rn
    FROM public.tenant_members
    WHERE user_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Step 2: Remove orphaned organizations that have no tenant_members
-- (leftover from the duplicate onboarding submissions).
DELETE FROM public.organizations
WHERE id NOT IN (
  SELECT DISTINCT organization_id FROM public.tenant_members
);

-- Step 3: Make the complete_onboarding RPC idempotent — if the
-- calling user already has a tenant_members row, return their
-- existing organization_id immediately rather than creating a
-- duplicate.
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

  -- Idempotency: if user already has an organization, return it immediately.
  -- This prevents duplicate orgs when onboarding is submitted more than once.
  SELECT organization_id INTO v_org_id
  FROM public.tenant_members
  WHERE user_id = v_user_id
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
