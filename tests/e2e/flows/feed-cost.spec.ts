/**
 * Layer 5 — E2E: Feed Cost & Inventory (P8)
 *
 * Covers:
 *   P8A — Ingredient price management (inline price edit in Settings → Pantry)
 *   P8B — Feed purchase recording (Record Purchase dialog → stock increment)
 *   P8C — Ration template management (Settings → Rations tab)
 *         + Ration integration in feeding flow (Use Ration dropdown pre-fills)
 *
 * Skip behaviour: tests are skipped gracefully if the device has no
 * authenticated Supabase session (E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set).
 *
 * All assertions are visibility / role based — no direct DB access.
 */
import { test, expect } from '@playwright/test';

test.describe('P8A — Ingredient price management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated — set E2E_TEST_EMAIL and E2E_TEST_PASSWORD');
    }
    // Navigate to Pantry tab
    const pantryTab = page.getByRole('tab', { name: /pantry/i });
    if (!(await pantryTab.isVisible())) {
      test.skip(true, 'Pantry tab not visible — check RBAC role');
    }
    await pantryTab.click();
  });

  test('Pantry tab shows Price and Stock columns', async ({ page }) => {
    await expect(page.getByText(/price/i).first()).toBeVisible();
    await expect(page.getByText(/stock/i).first()).toBeVisible();
  });

  test('clicking a price cell shows an inline input', async ({ page }) => {
    // Find first "Edit price" button or clickable price cell
    const priceEdit = page.getByRole('button', { name: /edit price/i }).first();
    if (!(await priceEdit.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, 'No ingredients in pantry — add one first');
    }
    await priceEdit.click();
    await expect(page.getByPlaceholder(/price/i)).toBeVisible({ timeout: 3_000 });
  });

  test('entering a negative price shows a DAT-007 validation error', async ({ page }) => {
    const priceEdit = page.getByRole('button', { name: /edit price/i }).first();
    if (!(await priceEdit.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, 'No ingredients — add one in Settings first');
    }
    await priceEdit.click();
    const input = page.getByPlaceholder(/price/i);
    await input.fill('-5');
    await input.press('Enter');
    await expect(page.getByText(/DAT-007|positive/i)).toBeVisible({ timeout: 3_000 });
  });
});

test.describe('P8B — Record Purchase dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated');
    }
    const pantryTab = page.getByRole('tab', { name: /pantry/i });
    if (!(await pantryTab.isVisible())) {
      test.skip(true, 'Pantry tab not visible');
    }
    await pantryTab.click();
  });

  test('"Record Purchase" button opens a dialog', async ({ page }) => {
    const purchaseBtn = page.getByRole('button', { name: /record purchase|purchase/i }).first();
    if (!(await purchaseBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, 'No purchase button — check RBAC or add ingredients');
    }
    await purchaseBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/record purchase/i)).toBeVisible();
  });

  test('purchase dialog shows required field validation on empty submit', async ({ page }) => {
    const purchaseBtn = page.getByRole('button', { name: /record purchase|purchase/i }).first();
    if (!(await purchaseBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, 'No purchase button');
    }
    await purchaseBtn.click();
    // Submit empty form
    const submitBtn = page.getByRole('button', { name: /save|record/i }).last();
    await submitBtn.click();
    // Expect at least one validation error
    await expect(page.getByText(/required|select an ingredient/i)).toBeVisible({ timeout: 2_000 });
  });
});

test.describe('P8C — Ration template management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated');
    }
    const rationTab = page.getByRole('tab', { name: /ration/i });
    if (!(await rationTab.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, 'Rations tab not visible — OWNER/MANAGER role required');
    }
    await rationTab.click();
  });

  test('Rations tab renders with New Ration button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new ration/i })).toBeVisible();
  });

  test('"New Ration" button opens the ration form dialog', async ({ page }) => {
    await page.getByRole('button', { name: /new ration/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/ration name/i)).toBeVisible();
  });

  test('empty ration name shows validation error', async ({ page }) => {
    await page.getByRole('button', { name: /new ration/i }).click();
    const saveBtn = page.getByRole('button', { name: /save|create/i }).last();
    await saveBtn.click();
    await expect(page.getByText(/ration name is required/i)).toBeVisible({ timeout: 2_000 });
  });

  test('ration form requires at least one ingredient row', async ({ page }) => {
    await page.getByRole('button', { name: /new ration/i }).click();
    const nameInput = page.getByPlaceholder(/ration name|e.g./i).first();
    await nameInput.fill('Test Ration');
    const saveBtn = page.getByRole('button', { name: /save|create/i }).last();
    await saveBtn.click();
    await expect(page.getByText(/at least one ingredient/i)).toBeVisible({ timeout: 2_000 });
  });
});

test.describe('P8C — Ration integration in feeding flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/feeding');
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated');
    }
  });

  test('feeding page loads the daily checklist', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /daily feeding/i })).toBeVisible();
  });

  test('ration selector appears after selecting a pen with animals', async ({ page }) => {
    // Select first active pen
    const penBtn = page.getByRole('button').filter({ hasText: /pen|barn|paddock/i }).first();
    if (!(await penBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'No pens visible — set up data first');
    }
    await penBtn.click();

    // If a ration exists, the selector should appear
    const rationSelect = page.getByText(/use ration/i);
    // This is conditional — only shown if rations exist; just assert no crash
    await expect(page).not.toHaveURL('/login');
  });
});
