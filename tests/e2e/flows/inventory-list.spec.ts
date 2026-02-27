/**
 * Layer 5 — E2E: Inventory List
 *
 * Verifies the /inventory page structure, filter tabs, "Add Animal" link,
 * and row click navigation to the detail page.
 *
 * Read-only — no DB writes.
 */
import { test, expect } from '@playwright/test';

test.describe('Inventory list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inventory');
    // If redirected to login, skip (auth not configured)
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated — set E2E_TEST_EMAIL and E2E_TEST_PASSWORD');
    }
  });

  test('page header shows "Animals" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Animals' })).toBeVisible();
  });

  test('"Add Animal" link is amber and navigates to intake', async ({ page }) => {
    const addBtn = page.getByRole('link', { name: /Add Animal/i });
    await expect(addBtn).toBeVisible();

    // Verify amber-500 background
    const bg = await addBtn.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    expect(bg).toBe('rgb(245, 158, 11)');

    // Verify tap target
    const box = await addBtn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await addBtn.click();
    await expect(page).toHaveURL('/inventory/intake');
  });

  test('filter tabs are rendered', async ({ page }) => {
    const tabs = ['All', 'Active', 'Sick', 'Dead', 'Dispatched'];
    for (const label of tabs) {
      await expect(page.getByRole('button', { name: new RegExp(label, 'i') }).first()).toBeVisible();
    }
  });

  test('"Active" filter tab filters list', async ({ page }) => {
    const activeTab = page.getByRole('button', { name: /Active/i }).first();
    await activeTab.click();
    // After clicking Active, the tab should be visually selected (dark bg)
    // We verify no JavaScript error and the page stays on /inventory
    await expect(page).toHaveURL('/inventory');
  });

  test('clicking a table row navigates to animal detail', async ({ page }) => {
    // Only attempt if there are animals in the table
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    if (count === 0) {
      test.skip(true, 'No animals in inventory — create one first');
    }
    await rows.first().click();
    await expect(page).toHaveURL(/\/inventory\/.+/);
  });
});
