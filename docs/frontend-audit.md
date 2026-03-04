# FeedlotPro Kenya — Frontend Audit & State Propagation Matrix

**Generated:** 2026-04-01
**Scope:** All client components and pages that perform DB mutations
**DB trigger reference:** `docs/triggers.sql`, `docs/state-propagation.md`

---

## Evaluation Criteria

| Criterion | Result |
|---|---|
| Component → DB mutation mapping | ✅ |
| Error handling — all DB errors reach mapDbError() | ✅ (after Fix 1) |
| RBAC gates — all mutation forms check checkPermission() | ✅ |
| Trigger ordering — no conflicts with V2.2 immutability triggers | ✅ (after Fix 2) |
| State completeness — terminal date fields always set | ✅ (after Fix 3) |
| Offline support — critical mutations have queue fallback | ⚠️ Partial (see gaps) |

---

## Frontend Component Propagation Matrix

| Component | User Action | DB Write | Trigger(s) Fired | Side Effect | RBAC Gate | Error Handling | Offline |
|---|---|---|---|---|---|---|---|
| `intake-form.tsx` | Register animal | INSERT animals | `animals_tag_id_org_unique` | Unique violation → DAT-003 | None (any authenticated user) | ✅ mapDbError + toast | ✅ addToQueue |
| `weight-form.tsx` | Record weight | INSERT weight_records | `trg_animal_immutability_weight` (BEFORE) → `trg_calculate_adg` + `trg_sync_current_weight` (AFTER) | Raises BUS-001 if DEAD/DISPATCHED; updates current_adg, current_weight | ACTIVE animals only (UI guard) | ✅ mapDbError + toast | ✅ addToQueue |
| `flag-sick-form.tsx` | Flag animal sick | UPDATE animals (status=SICK, pen_id) + INSERT health_events | `trg_validate_animal_status` (BEFORE UPDATE) → `trg_health_event_to_animal` (AFTER INSERT, no-op) | Redundant double update — DB trigger re-sets already-set status/sick_since | ACTION.FLAG_SICK | ✅ animals UPDATE; ⚠️ health_event logged only | ✅ animals UPDATE only |
| `health-outcome-form.tsx` | Resolve sick status | INSERT health_events (DB trigger drives animals UPDATE) | `trg_animal_immutability_health` (BEFORE) → `trg_health_event_to_animal` (AFTER) | RECOVERED→ACTIVE, MORTALITY→DEAD+date, DISPATCHED_EARLY→DISPATCHED+date, FOLLOW_UP_SCHEDULED→no change | ACTION.HEALTH_OUTCOME | ✅ eventError toast | ❌ None |
| `treatment-form.tsx` | Record treatment | INSERT treatment_records + INSERT health_events (fire-and-forget) | `trg_animal_immutability_treatment` (BEFORE) | Raises BUS-001 if DEAD/DISPATCHED | ACTION.VET_TREATMENT | ✅ treatment_records; ⚠️ health_event not awaited | ❌ None |
| `status-form.tsx` | Terminal status change | UPDATE animals (status + mortality_date/dispatch_date) | `trg_validate_animal_status` (BEFORE UPDATE) | Blocks reverse-transitions from terminal states | None (any authenticated user) | ✅ mapDbError + toast | ❌ None |
| `batch-selector.tsx` | Create batch | INSERT batches | `batches_org_code_unique` | Unique violation → DAT-004 | None | ✅ mapDbError + toast | ❌ None |
| `add-worker-form.tsx` | Add team member | INSERT tenant_members | `trg_pin_lockout`, partial unique index | PIN lockout, duplicate auth user → 23505 | OWNER role (enforced at route level) | ✅ mapDbError + toast | ❌ None |
| `team-manager.tsx` | Edit role / Reset PIN / Remove / Unlock | UPDATE tenant_members + INSERT activity_log | `trg_pin_lockout`, `trg_audit_tenant_members` | PIN lockout, audit log | OWNER role | ✅ mapDbError + toast | ❌ None |
| `ration-form-dialog.tsx` | Create/edit ration | INSERT/UPDATE ration_templates + INSERT ration_ingredients | `ration_templates_org_name_unique`, FK RESTRICT | DAT-008, BUS-006 | OWNER/MANAGER (settings page) | ✅ mapDbError + toast | ❌ None |

---

## Gaps Found & Fixed

### GAP A — BUS-001 error message pattern not caught (FIXED)
**File:** [lib/errors.ts](../lib/errors.ts)

**Root cause:** `mapDbError()` checked for `ERR_INVALID_TRANSITION` (V1 pattern, never raised).
V2.2 triggers raise messages starting with `'BUS-001: Animal ...'` (ERRCODE=P0001).
All calls to `mapDbError()` on a P0001 error fell through to the generic fallback, showing raw SQL error text.

**Fix applied:** Added `|| error.message?.includes('BUS-001')` to the BUS-001 branch.

**Affected before fix:** `weight-form.tsx`, `status-form.tsx`, `treatment-form.tsx`

---

### GAP B — `health-outcome-form.tsx` ordering conflict with V2.2 triggers (FIXED)
**File:** [components/health/health-outcome-form.tsx](../components/health/health-outcome-form.tsx)

**Root cause:** Original flow:
1. `UPDATE animals SET status='DEAD'`
2. `INSERT health_events(MORTALITY)` ← blocked by `trg_animal_immutability_health` because status is already DEAD

For DEAD and DISPATCHED_EARLY outcomes, the health_events INSERT silently failed (was not awaited),
leaving the animal in a terminal state with no health history entry.

**Fix applied:** Reversed the order — INSERT health_event FIRST (DB trigger auto-propagates status,
mortality_date, dispatch_date). Removed the redundant `UPDATE animals` block entirely.
Added proper `await` and `toast` on the health_event INSERT error.

**Trigger chain for each outcome:**
- RECOVERED → `trg_health_event_to_animal` sets status=ACTIVE, sick_since=NULL
- MORTALITY → `trg_health_event_to_animal` sets status=DEAD, mortality_date=now()
- DISPATCHED_EARLY → `trg_health_event_to_animal` sets status=DISPATCHED, dispatch_date=now()
- FOLLOW_UP_SCHEDULED → trigger ELSE branch (no status change)

---

### GAP C — `status-form.tsx` missing terminal dates (FIXED)
**File:** [components/animals/status-form.tsx](../components/animals/status-form.tsx)

**Root cause:** `handleConfirm()` only set `status` — no `mortality_date` or `dispatch_date`.
The locked banner in `inventory/[id]/page.tsx` conditionally renders these dates (`if animal.mortality_date`),
so they always showed blank for animals terminated via StatusForm.

**Fix applied:** Added `mortality_date` (for DEAD) and `dispatch_date` (for DISPATCHED) to the update payload.

---

## Remaining Known Limitations (Out of Scope)

| Component | Issue | Severity | Notes |
|---|---|---|---|
| `flag-sick-form.tsx` | health_event INSERT errors logged but not toasted | Low | Not blocking; animal status already updated via separate animals UPDATE |
| `flag-sick-form.tsx` | Offline queue only covers animals UPDATE, not health_event INSERT | Low | Health event will be missing for offline-queued sick flags; re-inserted on refresh |
| `treatment-form.tsx` | health_event INSERT (TREATMENT_ADMINISTERED) not awaited | Low | Doesn't change status; only affects audit trail completeness |
| `treatment-form.tsx` / `health-outcome-form.tsx` | No offline queue fallback | Medium | VET workflow requires connectivity; tablet must be online for health operations |

---

## RBAC Coverage Summary

| Route / Component | Permission Check | Method | Notes |
|---|---|---|---|
| `/performance` page | ACTION.VIEW_PERFORMANCE | Server-side role check | OWNER/MANAGER only |
| `/reports` page | ACTION.VIEW_PERFORMANCE | Server-side role check | OWNER/MANAGER only |
| `/team` page | OWNER role | Server-side role check | OWNER only |
| `flag-sick-form.tsx` | ACTION.FLAG_SICK | `checkPermission()` → returns null | OWNER/MANAGER/VET |
| `treatment-form.tsx` | ACTION.VET_TREATMENT | `checkPermission()` → returns null | VET only |
| `health-outcome-form.tsx` | ACTION.HEALTH_OUTCOME | `checkPermission()` → returns null | OWNER/MANAGER/VET |
| `sick-animal-card.tsx` | ACTION.VET_TREATMENT + ACTION.HEALTH_OUTCOME | `checkPermission()` → hides buttons | Per action |
| `team-manager.tsx` | OWNER role | Rendered only in OWNER route | Route-guarded |

---

## Error Code Coverage Matrix

| Error Code | DB Source | mapDbError() Pattern | Components That May Receive It |
|---|---|---|---|
| BUS-001 | `enforce_animal_immutability()`, `validate_animal_status_transition()` | `BUS-001` in message OR `ERR_INVALID_TRANSITION` | weight-form, treatment-form, status-form, health-outcome-form |
| DAT-003 | `animals_tag_id_org_unique` index (23505) | `23505` code | intake-form |
| DAT-004 | `batches_org_code_unique` (23505) | `batches_org_code_unique` in message | batch-selector |
| DAT-008 | `ration_templates_org_name_unique` (23505) | `ration_templates_org_name_unique` in message | ration-form-dialog |
| BUS-006 | `ration_ingredients` FK RESTRICT (23503) | `23503` + `ration_ingredients` in message | ration-form-dialog |
| BUS-008 | Frontend validation (pen capacity) | `BUS-008` in message | intake-form |
| SEC-001 | `trg_pin_lockout` → status=LOCKED | `ERR_PIN_LOCKED` in message | session-kiosk (PIN entry) |
| SYS-009 | Frontend Promise.race() timeout | `SYS-009` in message | reports page |
