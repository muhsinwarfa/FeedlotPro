/**
 * Layer 5 — E2E: Animal Intake Form
 *
 * Verifies the /inventory/intake page structure, validation errors on empty
 * submit, the amber-500 submit button, and 44px tap targets.
 *
 * No animal is actually created — validation tests submit without valid data.
 */
import { test, expect } from '@playwright/test';

test.describe('Animal intake form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inventory/intake');
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated — set E2E_TEST_EMAIL and E2E_TEST_PASSWORD');
    }
  });

  test('page header shows "Animal Intake" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Animal Intake' })).toBeVisible();
  });

  test('form renders with all required fields', async ({ page }) => {
    await expect(page.getByLabel(/Tag ID/i)).toBeVisible();
    await expect(page.getByLabel(/Breed/i)).toBeVisible();
    await expect(page.getByLabel(/Intake Weight/i)).toBeVisible();
    await expect(page.getByLabel(/Intake Date/i)).toBeVisible();
  });

  test('empty form submission shows validation errors', async ({ page }) => {
    // Clear any pre-filled date and submit
    const dateInput = page.getByLabel(/Intake Date/i);
    await dateInput.fill('');

    await page.getByRole('button', { name: /Register Animal/i }).click();

    // At least one validation error should appear
    await expect(page.getByText(/required|DAT-00|BUS-00/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('"Register Animal" button has amber-500 colour', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Register Animal/i });
    await expect(btn).toBeVisible();
    const bg = await btn.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    // amber-500 = rgb(245, 158, 11)
    expect(bg).toBe('rgb(245, 158, 11)');
  });

  test('"Register Animal" button meets 44px tap target', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Register Animal/i });
    const box = await btn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('Tag ID input meets 44px tap target', async ({ page }) => {
    const input = page.getByLabel(/Tag ID/i);
    const box = await input.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
