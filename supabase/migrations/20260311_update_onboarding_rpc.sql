-- ==============================================================================
-- V2 Block 1 — Update complete_onboarding RPC
-- Adds p_display_name parameter; inserts owner with role='OWNER'.
-- Default value '' keeps backward-compatibility with existing callers.
-- ==============================================================================

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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_farm_name IS NULL OR trim(p_farm_name) = '' THEN
    RAISE EXCEPTION 'Farm name is required';
  END IF;

  INSERT INTO public.organizations (farm_name)
  VALUES (trim(p_farm_name))
  RETURNING id INTO v_org_id;

  INSERT INTO public.tenant_members (user_id, organization_id, role, display_name, avatar_color, status)
  VALUES (
    v_user_id,
    v_org_id,
    'OWNER',
    COALESCE(NULLIF(trim(p_display_name), ''), split_part(current_setting('request.jwt.claims', true)::json->>'email', '@', 1)),
    '#064E3B',
    'ACTIVE'
  );

  FOR v_pen IN SELECT * FROM jsonb_array_elements(p_pens) LOOP
    INSERT INTO public.pens (organization_id, pen_name, capacity)
    VALUES (
      v_org_id,
      v_pen->>'name',
      NULLIF(trim(v_pen->>'capacity'), '')::integer
    );
  END LOOP;

  FOR v_ing IN SELECT * FROM jsonb_array_elements(p_ingredients) LOOP
    INSERT INTO public.pantry_ingredients (organization_id, ingredient_name, unit)
    VALUES (v_org_id, trim(v_ing->>'name'), 'kg');
  END LOOP;

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding(TEXT, JSONB, JSONB, TEXT) TO authenticated;
