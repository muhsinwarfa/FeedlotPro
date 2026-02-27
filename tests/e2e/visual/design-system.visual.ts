/**
 * Layer 5 — Visual Regression: Design System
 *
 * Takes full-page screenshots of key routes and verifies computed CSS values
 * for the "Feedlot Emerald" design system.
 *
 * First run: `npm run test:e2e:update-snapshots`  (creates baselines)
 * Subsequent: `npm run test:e2e:visual`            (compares against baselines)
 *
 * Colour reference:
 *   emerald-950  → #022c22 → rgb(2, 44, 34)
 *   amber-500    → #f59e0b → rgb(245, 158, 11)
 *   slate-50     → #f8fafc → rgb(248, 250, 252)
 *   emerald-100  → #d1fae5 → rgb(209, 250, 229)   ← ACTIVE badge
 *   amber-100    → #fef3c7 → rgb(254, 243, 199)   ← SICK badge
 */
import { test, expect } from '@playwright/test';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function skipIfUnauthenticated(page: import('@playwright/test').Page) {
  await page.goto('/');
  if (page.url().includes('/login')) {
    test.skip(true, 'Not authenticated — set E2E_TEST_EMAIL and E2E_TEST_PASSWORD');
  }
}

// ── Screenshot snapshots ──────────────────────────────────────────────────────

test.describe('Visual snapshots', () => {
  test('dashboard screenshot matches baseline', async ({ page }) => {
    await skipIfUnauthenticated(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      maxDiffPixels: 200,
    });
  });

  test('inventory page screenshot matches baseline', async ({ page }) => {
    await skipIfUnauthenticated(page);
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('inventory.png', {
      fullPage: true,
      maxDiffPixels: 200,
    });
  });

  test('animal intake form screenshot matches baseline', async ({ page }) => {
    await skipIfUnauthenticated(page);
    await page.goto('/inventory/intake');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('intake-form.png', {
      fullPage: true,
      maxDiffPixels: 200,
    });
  });

  test('feeding step 1 screenshot matches baseline', async ({ page }) => {
    await skipIfUnauthenticated(page);
    await page.goto('/feeding');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('feeding-step1.png', {
      fullPage: true,
      maxDiffPixels: 200,
    });
  });
});

// ── CSS colour assertions ─────────────────────────────────────────────────────

test.describe('Design system colours', () => {
  test('sidebar background is emerald-950', async ({ page }) => {
    await skipIfUnauthenticated(page);
    await page.goto('/');

    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();
    const bg = await sidebar.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    // emerald-950 = #022c22 = rgb(2, 44, 34)
    expect(bg).toBe('rgb(2, 44, 34)');
  });

  test('page background is slate-50', async ({ page }) => {
    await skipIfUnauthenticated(page);
    await page.goto('/inventory');

    const body = page.locator('div.min-h-screen').first();
    const bg = await body.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    // slate-50 = #f8fafc = rgb(248, 250, 252)
    expect(bg).toBe('rgb(248, 250, 252)');
  });

  test('"Add Animal" button is amber-500', async ({ page }) => {
    await skipIfUnauthenticated(page);
    await page.goto('/inventory');

    const btn = page.getByRole('link', { name: /Add Animal/i });
    await expect(btn).toBeVisible();
    const bg = await btn.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    expect(bg).toBe('rgb(245, 158, 11)');
  });

  test('ACTIVE status badge has emerald-100 background', async ({ page }) => {
    await skipIfUnauthenticated(page);
    await page.goto('/inventory');

    const activeBadge = page.locator('span').filter({ hasText: 'Active' }).first();
    const count = await activeBadge.count();
    if (count === 0) {
      test.skip(true, 'No ACTIVE animals in inventory');
    }

    const bg = await activeBadge.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    // emerald-100 = #d1fae5 = rgb(209, 250, 229)
    expect(bg).toBe('rgb(209, 250, 229)');
  });

  test('SICK status badge has amber-100 background', async ({ page }) => {
    await skipIfUnauthenticated(page);
    await page.goto('/inventory');

    const sickBadge = page.locator('span').filter({ hasText: 'Sick' }).first();
    const count = await sickBadge.count();
    if (count === 0) {
      test.skip(true, 'No SICK animals in inventory');
    }

    const bg = await sickBadge.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    // amber-100 = #fef3c7 = rgb(254, 243, 199)
    expect(bg).toBe('rgb(254, 243, 199)');
  });
});

// ── Tap target assertions ─────────────────────────────────────────────────────

test.describe('44px tap targets', () => {
  test('sidebar nav links are at least 44px tall', async ({ page }) => {
    await skipIfUnauthenticated(page);
    await page.goto('/');

    const navLinks = page.locator('aside a').filter({ hasText: /Dashboard|Inventory|Feeding|Settings/i });
    const count = await navLinks.count();
    for (let i = 0; i < count; i++) {
      const box = await navLinks.nth(i).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('"Sign Out" button is at least 44px tall', async ({ page }) => {
    await skipIfUnauthenticated(page);
    await page.goto('/');

    const signOutBtn = page.locator('aside button').filter({ hasText: /Sign Out/i });
    const box = await signOutBtn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('"Add Animal" button on inventory page is at least 44px tall', async ({ page }) => {
    await skipIfUnauthenticated(page);
    await page.goto('/inventory');

    const btn = page.getByRole('link', { name: /Add Animal/i });
    const box = await btn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

// ── Typography assertions ─────────────────────────────────────────────────────

test.describe('Typography', () => {
  test('weight column uses font-mono', async ({ page }) => {
    await skipIfUnauthenticated(page);
    await page.goto('/inventory');

    // Weight cells in the table (intake weight, current weight, gain)
    const weightCells = page.locator('td.font-mono');
    const count = await weightCells.count();
    if (count === 0) {
      test.skip(true, 'No animals in inventory to check font-mono');
    }

    const fontFamily = await weightCells.first().evaluate(
      (el) => window.getComputedStyle(el).fontFamily,
    );
    expect(fontFamily.toLowerCase()).toMatch(/mono|roboto mono|courier/i);
  });
});
