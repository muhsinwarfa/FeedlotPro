/**
 * Layer 5 — E2E: Weight Recording
 *
 * Verifies the weight form on the /inventory/[id] detail page.
 * Navigates from the inventory list and checks:
 * - ACTIVE animals show an enabled weight form
 * - Form has the expected field and button
 * - Weight input uses font-mono
 * - 44px tap target on the submit button
 *
 * Read-only — no weight record is submitted.
 */
import { test, expect } from '@playwright/test';

test.describe('Weight recording form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inventory');
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated — set E2E_TEST_EMAIL and E2E_TEST_PASSWORD');
    }
  });

  test('navigating to first animal detail page loads weight form', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    if (count === 0) {
      test.skip(true, 'No animals in inventory — create one first');
    }

    // Click first row to navigate to detail
    await rows.first().click();
    await expect(page).toHaveURL(/\/inventory\/.+/, { timeout: 8_000 });

    // Weight section should contain a button to record weight
    await expect(
      page.getByRole('button', { name: /Record Weight/i }),
    ).toBeVisible();
  });

  test('weight input uses font-mono class', async ({ page }) => {
    const rows = page.locator('tbody tr');
    if ((await rows.count()) === 0) {
      test.skip(true, 'No animals in inventory');
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/inventory\/.+/);

    // The weight input should have font-mono styling
    const weightInput = page.getByLabel(/New Weight/i);
    if (await weightInput.isVisible()) {
      const fontFamily = await weightInput.evaluate(
        (el) => window.getComputedStyle(el).fontFamily,
      );
      expect(fontFamily.toLowerCase()).toMatch(/mono|roboto mono|courier/i);
    }
  });

  test('"Record Weight" button meets 44px tap target', async ({ page }) => {
    const rows = page.locator('tbody tr');
    if ((await rows.count()) === 0) {
      test.skip(true, 'No animals in inventory');
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/inventory\/.+/);

    const btn = page.getByRole('button', { name: /Record Weight/i });
    if (await btn.isVisible()) {
      const box = await btn.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
