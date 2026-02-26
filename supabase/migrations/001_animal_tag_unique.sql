-- Migration: Enforce unique tag_id per organization
-- This underpins the DAT-003 error path in the Animal Intake flow.
-- A single feedlot may not register two animals with the same ear-tag.

CREATE UNIQUE INDEX animals_tag_id_org_unique
ON public.animals (organization_id, tag_id);
