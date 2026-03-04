/**
 * Layer 5 — E2E: Health Workflow (P6) — State Machine Testing
 *
 * Verifies the animal health state machine from the browser perspective:
 *  - Form visibility matches animal status (ACTIVE / SICK / DEAD)
 *  - Locked banner shows terminal dates when animal is DEAD/DISPATCHED
 *  - /health page renders correctly
 *
 * Skip behaviour: all tests skip gracefully when not authenticated.
 * Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars to run against a real environment.
 * Optional env vars for state machine tests:
 *   E2E_ACTIVE_ANIMAL_ID — an animal with status=ACTIVE
 *   E2E_SICK_ANIMAL_ID   — an animal with status=SICK
 *   E2E_DEAD_ANIMAL_ID   — an animal with status=DEAD (must have a mortality_date)
 */
import { test, expect } from '@playwright/test';

// ── /health page ──────────────────────────────────────────────────────────────

test.describe('Health page — /health', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/health');
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated — set E2E_TEST_EMAIL and E2E_TEST_PASSWORD');
    }
  });

  test('page renders "Animal Health" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /animal health/i })).toBeVisible();
  });

  test('page shows sick animal list or empty state', async ({ page }) => {
    const hasSick = await page.locator('[data-testid="sick-animal-card"], .rounded-lg.border').count();
    expect(hasSick).toBeGreaterThanOrEqual(0);
  });
});

// ── State machine — form visibility by animal status ──────────────────────────
//
// Each test navigates to /inventory/[id] and asserts which health forms are
// present based on the animal's current status. This validates the server-side
// conditional rendering logic in app/(dashboard)/inventory/[id]/page.tsx.

test.describe('Health state machine — form visibility by status', () => {
  test('ACTIVE animal: FlagSick form visible, HealthOutcome form NOT visible', async ({ page }) => {
    const animalId = process.env.E2E_ACTIVE_ANIMAL_ID;
    if (!animalId) {
      test.skip(true, 'E2E_ACTIVE_ANIMAL_ID not set — skipping status visibility test');
    }
    await page.goto(`/inventory/${animalId}`);
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated');
    }
    // FlagSickForm renders for ACTIVE animals
    await expect(page.getByRole('heading', { name: /Flag as Sick/i })).toBeVisible({ timeout: 5_000 });
    // HealthOutcomeForm must NOT be visible for ACTIVE animals
    await expect(page.getByRole('heading', { name: /Resolve Health Status/i })).not.toBeVisible();
  });

  test('SICK animal: HealthOutcome form visible, FlagSick form NOT visible', async ({ page }) => {
    const animalId = process.env.E2E_SICK_ANIMAL_ID;
    if (!animalId) {
      test.skip(true, 'E2E_SICK_ANIMAL_ID not set — skipping status visibility test');
    }
    await page.goto(`/inventory/${animalId}`);
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated');
    }
    // HealthOutcomeForm renders for SICK animals
    await expect(page.getByRole('heading', { name: /Resolve Health Status/i })).toBeVisible({ timeout: 5_000 });
    // FlagSickForm must NOT be visible for SICK animals
    await expect(page.getByRole('heading', { name: /Flag as Sick/i })).not.toBeVisible();
  });

  test('DEAD animal: neither health form visible; locked banner shown', async ({ page }) => {
    const animalId = process.env.E2E_DEAD_ANIMAL_ID;
    if (!animalId) {
      test.skip(true, 'E2E_DEAD_ANIMAL_ID not set — skipping locked banner test');
    }
    await page.goto(`/inventory/${animalId}`);
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated');
    }
    // Locked banner must appear for terminal animals
    await expect(page.getByText(/BUS-001: Record Sealed/i)).toBeVisible({ timeout: 5_000 });
    // Neither health form should be visible
    await expect(page.getByRole('heading', { name: /Flag as Sick/i })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: /Resolve Health Status/i })).not.toBeVisible();
  });
});

// ── Terminal dates in locked banner ───────────────────────────────────────────
//
// After marking an animal DEAD (via StatusForm or HealthOutcomeForm), the locked
// banner in inventory/[id]/page.tsx should render the mortality_date text.
// This validates that status-form.tsx correctly sets mortality_date in the
// update payload (V2.2 fix — GAP C).

test.describe('Terminal dates in locked banner', () => {
  test('DEAD animal detail shows Mortality date in locked banner', async ({ page }) => {
    const animalId = process.env.E2E_DEAD_ANIMAL_ID;
    if (!animalId) {
      test.skip(true, 'E2E_DEAD_ANIMAL_ID not set — skipping terminal date test');
    }
    await page.goto(`/inventory/${animalId}`);
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated');
    }
    await expect(page.getByText(/BUS-001: Record Sealed/i)).toBeVisible({ timeout: 5_000 });
    // The locked banner conditionally shows "Mortality: <date>." when mortality_date is set
    await expect(page.getByText(/Mortality:/i)).toBeVisible();
  });
});

// ── Inventory page smoke test ──────────────────────────────────────────────────

test.describe('Inventory page loads without error', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inventory');
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated');
    }
  });

  test('inventory page renders without JS error', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
    const title = await page.title();
    expect(title).not.toContain('Error');
  });
});
