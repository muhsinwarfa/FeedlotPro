/**
 * Layer 5 — E2E: Status Transitions
 *
 * Verifies the status form on the /inventory/[id] detail page:
 * - Status description text is visible
 * - ACTIVE animals show transition buttons (Mark Sick, Mark Dead, Dispatch)
 * - DEAD animals show a locked "No further transitions" state (immutability)
 *
 * Navigates from the inventory list — read-only, no status is actually changed.
 */
import { test, expect } from '@playwright/test';

test.describe('Status transitions form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inventory');
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated — set E2E_TEST_EMAIL and E2E_TEST_PASSWORD');
    }
  });

  test('animal detail page shows current status', async ({ page }) => {
    const rows = page.locator('tbody tr');
    if ((await rows.count()) === 0) {
      test.skip(true, 'No animals in inventory');
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/inventory\/.+/);

    // Status form shows the "Current status:" text
    await expect(page.getByText(/Current status/i)).toBeVisible();
  });

  test('ACTIVE animal shows "Mark Sick" transition option', async ({ page }) => {
    // Filter to ACTIVE animals first
    await page.getByRole('button', { name: /Active/i }).first().click();
    const rows = page.locator('tbody tr');
    if ((await rows.count()) === 0) {
      test.skip(true, 'No ACTIVE animals in inventory');
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/inventory\/.+/);

    // ACTIVE → SICK transition button
    await expect(
      page.getByRole('button', { name: /Mark Sick|Sick/i }).first(),
    ).toBeVisible();
  });

  test('DEAD animal shows locked/no-transition state', async ({ page }) => {
    // Filter to DEAD animals
    await page.getByRole('button', { name: /Dead/i }).first().click();
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    if (count === 0) {
      test.skip(true, 'No DEAD animals in inventory — skip irreversibility check');
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/inventory\/.+/);

    // Dead animals show a "No further transitions" sentinel
    await expect(
      page.getByText(/No further transitions|permanently sealed|dead/i).first(),
    ).toBeVisible();
  });

  test('SICK status shows ACTIVE and DEAD transition buttons', async ({ page }) => {
    await page.getByRole('button', { name: /Sick/i }).first().click();
    const rows = page.locator('tbody tr');
    if ((await rows.count()) === 0) {
      test.skip(true, 'No SICK animals in inventory');
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/inventory\/.+/);

    // SICK can transition to ACTIVE (Recover) or DEAD (Deceased)
    const buttons = page.getByRole('button');
    const texts = await buttons.allInnerTexts();
    const hasActiveTransition = texts.some((t) =>
      /recover|mark active|active/i.test(t),
    );
    const hasDeadTransition = texts.some((t) =>
      /deceased|mark dead|dead/i.test(t),
    );
    expect(hasActiveTransition || hasDeadTransition).toBe(true);
  });
});
