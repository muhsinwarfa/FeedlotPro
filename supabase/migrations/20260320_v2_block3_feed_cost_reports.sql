-- ==============================================================================
-- FEEDLOTPRO KENYA — V2 Block 3: Feed Cost & Inventory (P8) + Reporting (P9)
-- Sprint Block 3 — Weeks 9-12
-- Tables: price_history, stock_transactions, ration_templates, ration_ingredients
-- Column additions: feeding_details.unit_cost_per_kg, feeding_records.total_cost
-- Triggers: log_price_change, update_stock_level, capture_feeding_cost
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. COLUMN ADDITIONS TO EXISTING TABLES
-- ------------------------------------------------------------------------------

-- P8B: Snapshot ingredient price at time of feeding (frozen cost per kg)
ALTER TABLE public.feeding_details
  ADD COLUMN IF NOT EXISTS unit_cost_per_kg NUMERIC;

-- P8B: Running total feed cost per feeding session (auto-computed by trigger)
ALTER TABLE public.feeding_records
  ADD COLUMN IF NOT EXISTS total_cost NUMERIC NOT NULL DEFAULT 0;

-- ------------------------------------------------------------------------------
-- 2. NEW TABLE: price_history
-- Immutable audit log of every price change for a pantry ingredient.
-- Populated automatically by trg_price_history_on_update trigger.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ingredient_id   UUID NOT NULL REFERENCES public.pantry_ingredients(id) ON DELETE CASCADE,
  old_price       NUMERIC,
  new_price       NUMERIC NOT NULL CHECK (new_price >= 0),
  changed_by      UUID REFERENCES public.tenant_members(id) ON DELETE SET NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_history_ingredient_idx
  ON public.price_history(ingredient_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS price_history_org_idx
  ON public.price_history(organization_id, changed_at DESC);

-- ------------------------------------------------------------------------------
-- 3. NEW TABLE: stock_transactions
-- Ledger of every stock movement: purchase, consumption (auto from feeding), or
-- manual adjustment. feeding_detail_id links CONSUMPTION rows back to the exact
-- feeding_details row for offline-sync deduplication.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stock_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ingredient_id    UUID NOT NULL REFERENCES public.pantry_ingredients(id) ON DELETE CASCADE,
  transaction_type VARCHAR NOT NULL CHECK (
    transaction_type IN ('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT')
  ),
  quantity_kg      NUMERIC NOT NULL,
  unit_cost_per_kg NUMERIC,
  total_cost       NUMERIC,
  notes            TEXT,
  -- Links CONSUMPTION rows back to the feeding_details row that caused them.
  -- Nullable (NULL for PURCHASE / ADJUSTMENT). ON DELETE SET NULL for safety.
  feeding_detail_id UUID REFERENCES public.feeding_details(id) ON DELETE SET NULL,
  performed_by      UUID REFERENCES public.tenant_members(id) ON DELETE SET NULL,
  transacted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_txn_ingredient_idx
  ON public.stock_transactions(ingredient_id, transacted_at DESC);

CREATE INDEX IF NOT EXISTS stock_txn_org_type_idx
  ON public.stock_transactions(organization_id, transaction_type, transacted_at DESC);

-- ------------------------------------------------------------------------------
-- 4. NEW TABLE: ration_templates
-- Named feed formula per organisation. UNIQUE on (org, name) → DAT-008.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ration_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ration_name     VARCHAR NOT NULL,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ration_templates_org_name_unique UNIQUE (organization_id, ration_name)
);

-- ------------------------------------------------------------------------------
-- 5. NEW TABLE: ration_ingredients
-- Line items within a ration template. ON DELETE RESTRICT on ingredient_id
-- enforces BUS-006: cannot delete a pantry ingredient used in a ration.
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ration_ingredients (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ration_template_id    UUID NOT NULL REFERENCES public.ration_templates(id) ON DELETE CASCADE,
  -- RESTRICT: raises 23503 FK violation → BUS-006 in mapDbError
  ingredient_id         UUID NOT NULL REFERENCES public.pantry_ingredients(id) ON DELETE RESTRICT,
  kg_per_animal_per_day NUMERIC NOT NULL CHECK (kg_per_animal_per_day > 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ration_ingredients_unique UNIQUE (ration_template_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS ration_ingredients_template_idx
  ON public.ration_ingredients(ration_template_id);

-- ==============================================================================
-- 6. ROW-LEVEL SECURITY (org-isolation pattern consistent with all V2 tables)
-- ==============================================================================

-- price_history
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "price_history_org_isolation" ON public.price_history;
CREATE POLICY "price_history_org_isolation" ON public.price_history
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

-- stock_transactions
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_txn_org_isolation" ON public.stock_transactions;
CREATE POLICY "stock_txn_org_isolation" ON public.stock_transactions
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

-- ration_templates
ALTER TABLE public.ration_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ration_templates_org_isolation" ON public.ration_templates;
CREATE POLICY "ration_templates_org_isolation" ON public.ration_templates
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
  );

-- ration_ingredients (isolation via ration_template → organization_id join)
ALTER TABLE public.ration_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ration_ingredients_isolation" ON public.ration_ingredients;
CREATE POLICY "ration_ingredients_isolation" ON public.ration_ingredients
  FOR ALL USING (
    ration_template_id IN (
      SELECT rt.id
      FROM public.ration_templates rt
      JOIN public.tenant_members tm ON tm.organization_id = rt.organization_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- ==============================================================================
-- 7. TRIGGER: log_price_change
-- Fires AFTER UPDATE on pantry_ingredients when current_price_per_kg changes.
-- Auto-inserts an immutable audit row into price_history.
-- ==============================================================================

CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when the price field actually changed
  IF (OLD.current_price_per_kg IS DISTINCT FROM NEW.current_price_per_kg)
     AND NEW.current_price_per_kg IS NOT NULL THEN
    INSERT INTO public.price_history
      (organization_id, ingredient_id, old_price, new_price)
    VALUES
      (NEW.organization_id, NEW.id, OLD.current_price_per_kg, NEW.current_price_per_kg);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_price_history_on_update ON public.pantry_ingredients;
CREATE TRIGGER trg_price_history_on_update
  AFTER UPDATE ON public.pantry_ingredients
  FOR EACH ROW EXECUTE FUNCTION log_price_change();

-- ==============================================================================
-- 8. TRIGGER: update_stock_level
-- Fires AFTER INSERT on stock_transactions.
-- Updates pantry_ingredients.current_stock based on transaction_type:
--   PURCHASE   → add quantity
--   CONSUMPTION → subtract (floored at 0)
--   ADJUSTMENT  → signed delta add (floored at 0)
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_stock_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_type = 'PURCHASE' THEN
    UPDATE public.pantry_ingredients
    SET current_stock = current_stock + NEW.quantity_kg,
        updated_at    = now()
    WHERE id = NEW.ingredient_id;

  ELSIF NEW.transaction_type = 'CONSUMPTION' THEN
    -- Floor at 0: negative stock is not allowed
    UPDATE public.pantry_ingredients
    SET current_stock = GREATEST(0, current_stock - NEW.quantity_kg),
        updated_at    = now()
    WHERE id = NEW.ingredient_id;

  ELSIF NEW.transaction_type = 'ADJUSTMENT' THEN
    -- quantity_kg is the signed delta (positive = restock, negative = write-off)
    UPDATE public.pantry_ingredients
    SET current_stock = GREATEST(0, current_stock + NEW.quantity_kg),
        updated_at    = now()
    WHERE id = NEW.ingredient_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_stock_level_on_transaction ON public.stock_transactions;
CREATE TRIGGER trg_stock_level_on_transaction
  AFTER INSERT ON public.stock_transactions
  FOR EACH ROW EXECUTE FUNCTION update_stock_level();

-- ==============================================================================
-- 9. TRIGGER: capture_feeding_cost
-- Fires AFTER INSERT on feeding_details.
-- 1. Snapshots the ingredient's current_price_per_kg onto feeding_details.unit_cost_per_kg
-- 2. Creates a CONSUMPTION stock_transaction (with feeding_detail_id for dedup)
-- 3. Rolls up total_cost on the parent feeding_records row
-- ==============================================================================

CREATE OR REPLACE FUNCTION capture_feeding_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_price       NUMERIC;
  v_org_id      UUID;
  v_detail_cost NUMERIC;
BEGIN
  -- 1. Resolve the price and org_id for this ingredient + feeding record
  SELECT pi.current_price_per_kg, fr.organization_id
  INTO v_price, v_org_id
  FROM public.pantry_ingredients pi
  JOIN public.feeding_records fr ON fr.id = NEW.feeding_record_id
  WHERE pi.id = NEW.ingredient_id;

  -- 2. Snapshot price onto the newly-inserted feeding_detail row
  IF v_price IS NOT NULL THEN
    v_detail_cost := ROUND((v_price * NEW.kg_amount)::NUMERIC, 2);
    UPDATE public.feeding_details
    SET unit_cost_per_kg = v_price
    WHERE id = NEW.id;
  ELSE
    -- No price set for this ingredient: zero cost, no stock deduction
    v_detail_cost := 0;
  END IF;

  -- 3. Create a CONSUMPTION ledger entry (only when price is set)
  --    feeding_detail_id enables offline-sync deduplication
  IF v_price IS NOT NULL THEN
    INSERT INTO public.stock_transactions (
      organization_id, ingredient_id, transaction_type,
      quantity_kg, unit_cost_per_kg, total_cost, feeding_detail_id
    ) VALUES (
      v_org_id, NEW.ingredient_id, 'CONSUMPTION',
      NEW.kg_amount, v_price, v_detail_cost, NEW.id
    );
  END IF;

  -- 4. Roll up total_cost on the parent feeding_records row
  IF v_detail_cost > 0 THEN
    UPDATE public.feeding_records
    SET total_cost = total_cost + v_detail_cost,
        updated_at = now()
    WHERE id = NEW.feeding_record_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feeding_cost_on_detail_insert ON public.feeding_details;
CREATE TRIGGER trg_feeding_cost_on_detail_insert
  AFTER INSERT ON public.feeding_details
  FOR EACH ROW EXECUTE FUNCTION capture_feeding_cost();
