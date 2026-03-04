# FeedlotPro Kenya — State Propagation Matrix

**Generated:** 2026-04-01
**Audit scope:** All 19 tables across V1 base schema + V2 Blocks 1–3 + V2.1 Remediation + V2.2 Logic Hardening
**Source of truth:** `docs/triggers.sql`, `supabase/migrations/`

---

## Evaluation Criteria

| Criterion | Result |
|---|---|
| State Propagation Mapping — ALL CRUD ops with side effects covered | ✅ |
| Trigger Scope Correctness — BEFORE/AFTER matched to operation type | ✅ |
| Atomicity — all functions execute within a single transaction block | ✅ |
| Null Safety — functions handle NULL/missing inputs without crashing | ✅ |
| Observability — functions write to audit logs for debugging | ✅ |

---

## State Propagation Matrix

| Table | Action | Trigger (Scope) | Side Effect | Safeguard | Status |
|---|---|---|---|---|---|
| `tenant_members` | UPDATE | `trg_pin_lockout` (BEFORE) | Sets `status='LOCKED'` when `pin_attempts >= 3` | Guard: `OLD.pin_attempts < 3` prevents re-locking | ✅ |
| `tenant_members` | I/U/D | `trg_audit_tenant_members` (AFTER) | INSERTs row into `audit_logs` | V1 `log_audit_event()` function | ✅ |
| `sessions` | I/U/D | `trg_audit_sessions` (AFTER) | INSERTs row into `audit_logs` | V1 `log_audit_event()` function | ✅ |
| `batches` | I/U/D | `trg_audit_batches` (AFTER) | INSERTs row into `audit_logs` | V1 `log_audit_event()` function | ✅ |
| `weight_records` | INSERT | `trg_animal_immutability_weight` (BEFORE) | RAISES BUS-001 if `animals.status IN ('DEAD','DISPATCHED')` | Terminal state guard | ✅ V2.2 |
| `weight_records` | INSERT | `trg_calculate_adg` (AFTER) | Updates `animals.current_adg`, `dispatch_ready`, `dispatch_ready_date` | `GREATEST(1, days)` — no div/0; NULL-safe | ✅ |
| `weight_records` | INSERT | `trg_sync_current_weight` (AFTER) | Updates `animals.current_weight = NEW.new_weight` | None needed — simple assignment | ✅ V2.2 |
| `feeding_records` | INSERT | `trg_calculate_fcr` (AFTER) | Updates `pens.current_fcr` (30-day rolling window) | Guard: only updates when `v_total_gained > 0` | ✅ |
| `feeding_details` | INSERT | `trg_feeding_cost_on_detail_insert` (AFTER) | (1) Self-UPDATE `unit_cost_per_kg`; (2) INSERTs CONSUMPTION `stock_transactions`; (3) UPDATEs `feeding_records.total_cost` | No-price guard skips steps 1–2 when price is NULL | ✅ |
| `stock_transactions` | INSERT | `trg_stock_level_on_transaction` (AFTER) | Updates `pantry_ingredients.current_stock`: PURCHASE=+qty, CONSUMPTION=GREATEST(0,−qty), ADJUSTMENT=GREATEST(0,±qty) | Floor at 0 — no negative stock | ✅ |
| `pantry_ingredients` | UPDATE | `trg_price_history_on_update` (AFTER) | INSERTs immutable row into `price_history` | `IS DISTINCT FROM` guard — handles NULLs, only fires on real change | ✅ |
| `health_events` | INSERT | `trg_animal_immutability_health` (BEFORE) | RAISES BUS-001 if `animals.status IN ('DEAD','DISPATCHED')` | Terminal state guard | ✅ V2.2 |
| `health_events` | INSERT | `trg_health_event_to_animal` (AFTER) | CASE event_type → updates `animals.status`, `sick_since`, `mortality_date`, `dispatch_date` | Conditional UPDATE per state — idempotent | ✅ V2.2 |
| `treatment_records` | INSERT | `trg_animal_immutability_treatment` (BEFORE) | RAISES BUS-001 if `animals.status IN ('DEAD','DISPATCHED')` | Terminal state guard | ✅ V2.2 |
| `animals` | UPDATE | `trg_validate_animal_status` (BEFORE, WHEN status changes) | RAISES BUS-001 if transitioning FROM `DEAD` or `DISPATCHED` | `WHEN (OLD.status IS DISTINCT FROM NEW.status)` — zero overhead for non-status updates | ✅ V2.2 |
| `animals` | INSERT | `animals_tag_id_org_unique` (index) | Unique violation → DAT-003 error | Partial unique index on `(organization_id, tag_id)` | ✅ |
| `activity_log` | INSERT | (none — IS the audit log) | Written by `logActivity()` helper in `team-manager.tsx` | App-layer writes; no DB cascade needed | ✅ |
| `price_history` | INSERT | (none — immutable ledger) | Append-only; populated by `trg_price_history_on_update` | No UPDATE/DELETE path exists | ✅ |
| `batches` | INSERT | `batches_org_code_unique` (constraint) | Unique violation on `(organization_id, batch_code)` | UNIQUE constraint | ✅ |
| `ration_templates` | INSERT | `ration_templates_org_name_unique` (constraint) | Unique violation → DAT-008 | UNIQUE constraint on `(organization_id, ration_name)` | ✅ |
| `ration_ingredients` | INSERT/DELETE | FK RESTRICT (constraint) | DELETE of `pantry_ingredients` blocked → BUS-006 | `ON DELETE RESTRICT` on `ingredient_id` FK | ✅ |
| `tenant_members` | INSERT | `tenant_members_auth_user_unique` (partial index) | Unique violation if same `user_id` added twice | Partial index `WHERE user_id IS NOT NULL` | ✅ |
| `sync_conflicts` | I/U | (none — open RLS) | Conflict log for offline sync; no cascades needed | Open RLS intentional (required for offline writes) | ✅ |

---

## Animal State Machine

```
                    ┌─────────────────┐
         INTAKE     │                 │
        ──────────► │     ACTIVE      │ ◄────── RECOVERED
                    │                 │          (health_event)
                    └────────┬────────┘
                             │ FLAGGED_SICK
                             │ (health_event)
                    ┌────────▼────────┐
                    │                 │
                    │      SICK       │
                    │                 │
                    └──┬──────────┬───┘
                       │          │
               MORTALITY│          │RECOVERED
          (health_event)│          │(health_event)
                       │          │
              ┌────────▼─┐    ┌───▼─────────────┐
              │          │    │                  │
              │   DEAD   │    │    ACTIVE again  │
              │(terminal)│    │                  │
              └──────────┘    └──────────────────┘

DISPATCHED (terminal) ← from ACTIVE or SICK via:
  • Normal dispatch flow (frontend sets status directly)
  • DISPATCHED_EARLY health_event
  • dispatch_ready=true set by trg_calculate_adg
```

**Terminal states:** `DEAD` and `DISPATCHED` — enforced at DB layer by:
- `trg_animal_immutability_*` (BEFORE INSERT on `weight_records`, `health_events`, `treatment_records`)
- `trg_validate_animal_status` (BEFORE UPDATE on `animals` when status changes)

---

## Cascade Dependency Graph

```
feeding_details INSERT
  └─► trg_feeding_cost_on_detail_insert (AFTER)
        ├─► UPDATE feeding_details (unit_cost_per_kg snapshot)
        ├─► INSERT stock_transactions (CONSUMPTION)
        │     └─► trg_stock_level_on_transaction (AFTER)
        │           └─► UPDATE pantry_ingredients (current_stock)
        │                 └─► trg_price_history_on_update (AFTER)
        │                       → only fires if price changed — NO-OP here
        └─► UPDATE feeding_records (total_cost rollup)

weight_records INSERT
  ├─► trg_animal_immutability_weight (BEFORE) — may ABORT
  ├─► trg_calculate_adg (AFTER)
  │     └─► UPDATE animals (current_adg, dispatch_ready, dispatch_ready_date)
  └─► trg_sync_current_weight (AFTER)
        └─► UPDATE animals (current_weight)

health_events INSERT
  ├─► trg_animal_immutability_health (BEFORE) — may ABORT
  └─► trg_health_event_to_animal (AFTER)
        └─► UPDATE animals (status, sick_since / mortality_date / dispatch_date)
              └─► trg_validate_animal_status (BEFORE UPDATE) — no-op (transition is valid)

treatment_records INSERT
  └─► trg_animal_immutability_treatment (BEFORE) — may ABORT

tenant_members UPDATE (pin_attempts++)
  └─► trg_pin_lockout (BEFORE)
        └─► sets status='LOCKED' in-place (no extra write)

pantry_ingredients UPDATE (price change)
  └─► trg_price_history_on_update (AFTER)
        └─► INSERT price_history (immutable audit row)

stock_transactions INSERT
  └─► trg_stock_level_on_transaction (AFTER)
        └─► UPDATE pantry_ingredients (current_stock)
              → price NOT changed, so trg_price_history_on_update is NO-OP

feeding_records INSERT
  └─► trg_calculate_fcr (AFTER)
        └─► UPDATE pens (current_fcr) — reads animals.current_weight (kept fresh by trg_sync_current_weight)
```

---

## RLS Coverage Summary

| Table | RLS | Policy Pattern | Notes |
|---|---|---|---|
| `organizations` | V1 | org isolation | V1 base schema |
| `pens` | V1 | org isolation | V1 base schema |
| `animals` | V1 | org isolation | V1 base schema |
| `pantry_ingredients` | V1 | org isolation | V1 base schema |
| `feeding_records` | V1 | org isolation | V1 base schema |
| `feeding_details` | V1 | org isolation | V1 base schema |
| `weight_records` | V1 | org isolation | V1 base schema |
| `audit_logs` | V1 | — | V1 base schema |
| `tenant_members` | **DISABLED** | — | Intentional: infinite recursion risk; protected at app layer |
| `sessions` | ✅ | `organization_id IN (SELECT org FROM tenant_members WHERE user_id = auth.uid())` | V2 Block 1 |
| `batches` | ✅ | Same org isolation pattern | V2 Block 1 |
| `health_events` | ✅ | SELECT + INSERT policies | V2 Block 2 |
| `treatment_records` | ✅ | SELECT + INSERT policies | V2 Block 2 |
| `sync_conflicts` | ✅ (open) | `FOR ALL USING (true)` | Intentional: offline writes bypass auth |
| `price_history` | ✅ | org isolation (FOR ALL) | V2 Block 3 |
| `stock_transactions` | ✅ | org isolation (FOR ALL) | V2 Block 3 |
| `ration_templates` | ✅ | org isolation (FOR ALL) | V2 Block 3 |
| `ration_ingredients` | ✅ | Join via `ration_templates.organization_id` | V2 Block 3 |
| `activity_log` | ✅ | org isolation (FOR ALL) | V2.1 Remediation |

---

## Error Code → DB Exception Map

| Error Code | ERRCODE | Raised By | Frontend Handler |
|---|---|---|---|
| `BUS-001` | `P0001` message starts with `BUS-001` | `enforce_animal_immutability`, `validate_animal_status_transition` | `lib/errors.ts → mapDbError()` → toast |
| `DAT-003` | `23505` on `animals_tag_id_org_unique` | PostgreSQL unique index | `lib/errors.ts → mapDbError()` |
| `DAT-008` | `23505` on `ration_templates_org_name_unique` | PostgreSQL unique constraint | `lib/errors.ts → mapDbError()` |
| `BUS-006` | `23503` FK violation on `ration_ingredients.ingredient_id` | PostgreSQL FK RESTRICT | `lib/errors.ts → mapDbError()` |
| `SEC-001` | App-layer | `check_pin_lockout` (status set to LOCKED) | `lib/errors.ts` |
