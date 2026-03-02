-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- V2 additions appended below existing V1 tables.

CREATE TABLE public.animals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  pen_id uuid NOT NULL,
  tag_id character varying NOT NULL,
  breed character varying NOT NULL,
  intake_weight numeric NOT NULL CHECK (intake_weight > 0::numeric),
  current_weight numeric,
  status character varying NOT NULL DEFAULT 'ACTIVE'::character varying,
  intake_date timestamp with time zone NOT NULL DEFAULT now(),
  mortality_date timestamp with time zone,
  dispatch_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT animals_pkey PRIMARY KEY (id),
  CONSTRAINT animals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT animals_pen_id_fkey FOREIGN KEY (pen_id) REFERENCES public.pens(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_name character varying NOT NULL,
  record_id uuid NOT NULL,
  action character varying NOT NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.feeding_details (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  feeding_record_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  kg_amount numeric NOT NULL CHECK (kg_amount > 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feeding_details_pkey PRIMARY KEY (id),
  CONSTRAINT feeding_details_feeding_record_id_fkey FOREIGN KEY (feeding_record_id) REFERENCES public.feeding_records(id),
  CONSTRAINT feeding_details_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.pantry_ingredients(id)
);
CREATE TABLE public.feeding_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  pen_id uuid NOT NULL,
  feeding_timestamp timestamp with time zone NOT NULL DEFAULT now(),
  total_kg_fed numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feeding_records_pkey PRIMARY KEY (id),
  CONSTRAINT feeding_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT feeding_records_pen_id_fkey FOREIGN KEY (pen_id) REFERENCES public.pens(id)
);
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  farm_name character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pantry_ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  ingredient_name character varying NOT NULL,
  unit character varying NOT NULL DEFAULT 'kg'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pantry_ingredients_pkey PRIMARY KEY (id),
  CONSTRAINT pantry_ingredients_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.pens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  pen_name character varying NOT NULL,
  capacity integer,
  status character varying NOT NULL DEFAULT 'active'::character varying,
  active_animal_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pens_pkey PRIMARY KEY (id),
  CONSTRAINT pens_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.tenant_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tenant_members_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.weight_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  animal_id uuid NOT NULL,
  new_weight numeric NOT NULL CHECK (new_weight > 0::numeric),
  weigh_date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT weight_records_pkey PRIMARY KEY (id),
  CONSTRAINT weight_records_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES public.animals(id)
);

-- ── V2 Block 1 additions ──────────────────────────────────────────────────────

-- V2: batches table — cohort grouping for animals arriving together
CREATE TABLE public.batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  batch_code character varying NOT NULL,
  source_supplier character varying,
  arrival_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT batches_pkey PRIMARY KEY (id),
  CONSTRAINT batches_org_code_unique UNIQUE (organization_id, batch_code),
  CONSTRAINT batches_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

-- V2: sessions table — worker kiosk sessions on shared tablet
CREATE TABLE public.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  member_id uuid NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT sessions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.tenant_members(id)
);

-- V2: organizations — added columns
-- target_weight numeric
-- session_ttl_hours integer NOT NULL DEFAULT 12

-- V2: pens — added columns
-- is_sick_pen boolean NOT NULL DEFAULT false
-- current_fcr numeric

-- V2: tenant_members — added columns (RBAC + PIN)
-- role varchar NOT NULL DEFAULT 'OWNER' CHECK (role IN ('OWNER','MANAGER','FARMHAND','VET'))
-- display_name varchar NOT NULL DEFAULT ''
-- avatar_color varchar NOT NULL DEFAULT '#064E3B'
-- pin_hash varchar  (bcrypt hash, nullable until PIN is set)
-- pin_attempts integer NOT NULL DEFAULT 0
-- status varchar NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LOCKED'))

-- V2: animals — added columns
-- gender varchar CHECK (gender IN ('BULL','HEIFER','STEER','COW'))
-- age_category varchar CHECK (age_category IN ('CALF','WEANER','GROWER','FINISHER'))
-- photo_url text
-- batch_id uuid REFERENCES public.batches(id)
-- source_supplier varchar
-- current_adg numeric
-- dispatch_ready boolean NOT NULL DEFAULT false
-- dispatch_ready_date timestamptz
-- sick_since timestamptz

-- V2: pantry_ingredients — added columns (prep for Block 3)
-- current_price_per_kg numeric
-- current_stock numeric NOT NULL DEFAULT 0

-- ── V2 Block 2 additions ──────────────────────────────────────────────────────

-- V2 Block 2: health_events — structured health event log per animal
CREATE TABLE IF NOT EXISTS public.health_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id          UUID NOT NULL REFERENCES public.animals(id),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id),
  event_type         VARCHAR NOT NULL CHECK (event_type IN (
                       'FLAGGED_SICK','TREATMENT_ADMINISTERED','RECOVERED',
                       'FOLLOW_UP_SCHEDULED','MORTALITY','DISPATCHED_EARLY')),
  primary_symptom    VARCHAR,
  secondary_symptoms JSONB NOT NULL DEFAULT '[]',
  severity           VARCHAR CHECK (severity IN ('MILD','MODERATE','SEVERE')),
  notes              TEXT,
  photo_url          TEXT,
  performed_by       UUID REFERENCES public.tenant_members(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- V2 Block 2: treatment_records — medication administered to a sick animal
CREATE TABLE IF NOT EXISTS public.treatment_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id            UUID NOT NULL REFERENCES public.animals(id),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id),
  medication_name      VARCHAR NOT NULL,
  dosage               VARCHAR NOT NULL,
  administration_route VARCHAR NOT NULL CHECK (administration_route IN (
                          'ORAL','INJECTION_IM','INJECTION_IV','INJECTION_SC','TOPICAL','DRENCH')),
  treatment_cost       NUMERIC,
  notes                TEXT,
  follow_up_date       DATE,
  treated_by           UUID REFERENCES public.tenant_members(id),
  treated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- V2 Block 2: sync_conflicts — server-side log when offline queue item conflicts
CREATE TABLE IF NOT EXISTS public.sync_conflicts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name     VARCHAR NOT NULL,
  record_id      TEXT NOT NULL,
  local_payload  JSONB NOT NULL,
  server_payload JSONB,
  error_message  TEXT,
  resolved_at    TIMESTAMPTZ,
  resolved_by    UUID REFERENCES public.tenant_members(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── V2 Block 3: Feed Cost & Inventory (P8) + Reports (P9) ────────────────────

-- Column additions to existing tables (added in migration 20260320)
-- feeding_details.unit_cost_per_kg  NUMERIC  — snapshotted by trg_feeding_cost_on_detail_insert
-- feeding_records.total_cost        NUMERIC  — rolled up by trg_feeding_cost_on_detail_insert

-- V2B3: price_history — immutable audit log of ingredient price changes
CREATE TABLE IF NOT EXISTS public.price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ingredient_id   UUID NOT NULL REFERENCES public.pantry_ingredients(id) ON DELETE CASCADE,
  old_price       NUMERIC,
  new_price       NUMERIC NOT NULL CHECK (new_price >= 0),
  changed_by      UUID REFERENCES public.tenant_members(id),
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- INDEX: (ingredient_id, changed_at DESC)

-- V2B3: stock_transactions — ledger of all stock movements (PURCHASE/CONSUMPTION/ADJUSTMENT)
CREATE TABLE IF NOT EXISTS public.stock_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ingredient_id     UUID NOT NULL REFERENCES public.pantry_ingredients(id) ON DELETE CASCADE,
  transaction_type  VARCHAR NOT NULL CHECK (transaction_type IN ('PURCHASE','CONSUMPTION','ADJUSTMENT')),
  quantity_kg       NUMERIC NOT NULL CHECK (quantity_kg > 0),
  unit_cost_per_kg  NUMERIC,
  total_cost        NUMERIC,
  notes             TEXT,
  feeding_detail_id UUID REFERENCES public.feeding_details(id) ON DELETE SET NULL,
  performed_by      UUID REFERENCES public.tenant_members(id),
  transacted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- INDEX: (ingredient_id, transacted_at DESC), (organization_id, transaction_type, transacted_at DESC)

-- V2B3: ration_templates — named feed formulas saved for reuse
CREATE TABLE IF NOT EXISTS public.ration_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ration_name     VARCHAR NOT NULL,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, ration_name)  -- DAT-008
);

-- V2B3: ration_ingredients — line items within a ration template
CREATE TABLE IF NOT EXISTS public.ration_ingredients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ration_template_id  UUID NOT NULL REFERENCES public.ration_templates(id) ON DELETE CASCADE,
  ingredient_id       UUID NOT NULL REFERENCES public.pantry_ingredients(id) ON DELETE RESTRICT,  -- BUS-006
  kg_per_animal_per_day NUMERIC NOT NULL CHECK (kg_per_animal_per_day > 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ration_template_id, ingredient_id)
);
-- current_price_per_kg numeric
-- current_stock numeric NOT NULL DEFAULT 0