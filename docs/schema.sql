-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

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