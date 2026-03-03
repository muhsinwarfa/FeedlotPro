-- ============================================================
-- Migration: Fix tenant_members.user_id for non-auth workers
--
-- Root cause: V1 schema had a UNIQUE constraint on user_id,
-- designed for one-Supabase-auth-user-per-org. V2's shared-
-- tablet model adds non-auth workers (farmhands, vets, managers)
-- that have no Supabase Auth account. add-worker-form.tsx used
-- a hardcoded placeholder UUID '00000000-...' for all of them,
-- causing a 23505 unique violation when adding a second worker.
--
-- Fix:
--   1. Drop any UNIQUE constraint on user_id dynamically
--      (handles any naming convention from V1)
--   2. Make user_id nullable — non-auth workers store NULL
--   3. Add a partial unique index so real auth users (IS NOT NULL)
--      still cannot belong to multiple orgs via user_id
-- ============================================================

-- 1. Dynamically drop any unique constraint whose only column is user_id
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.tenant_members'::regclass
      AND c.contype = 'u'
    GROUP BY c.conname, array_length(c.conkey, 1)
    HAVING array_length(c.conkey, 1) = 1
       AND bool_and(a.attname = 'user_id')
  LOOP
    EXECUTE format('ALTER TABLE public.tenant_members DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Also drop any standalone unique index on user_id by common naming conventions
DROP INDEX IF EXISTS public.tenant_members_user_id_key;
DROP INDEX IF EXISTS public.tenant_members_user_id_unique;

-- 2. Make user_id nullable — non-auth workers have no Supabase Auth account
ALTER TABLE public.tenant_members ALTER COLUMN user_id DROP NOT NULL;

-- 3. Partial unique index: enforce uniqueness only for real auth users
--    NULL values are intentionally excluded (NULL != NULL in SQL, so
--    multiple NULL user_ids are allowed without this index anyway, but
--    the explicit WHERE clause makes the design intent clear)
CREATE UNIQUE INDEX IF NOT EXISTS tenant_members_auth_user_unique
  ON public.tenant_members(user_id)
  WHERE user_id IS NOT NULL;
