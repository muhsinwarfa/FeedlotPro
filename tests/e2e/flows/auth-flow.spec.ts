/**
 * Layer 5 — E2E: Auth Flow
 *
 * Tests unauthenticated access to protected routes.
 * Does NOT require the auth setup — runs without storageState.
 *
 * Project: auth-flow-chrome (configured via `use: {}` below)
 * Note: this file matches both mobile-chrome and desktop-chrome projects
 * but the storageState is intentionally overridden per test to empty.
 */
import { test, expect } from '@playwright/test';

// Override storageState per test so these run without auth,
// even though the parent project loads user.json.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Unauthenticated access', () => {
  const protectedRoutes = [
    '/',
    '/inventory',
    '/inventory/intake',
    '/feeding',
    '/feeding/history',
    '/settings',
  ];

  for (const route of protectedRoutes) {
    test(`GET ${route} → redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    });
  }

  test('login page renders with Sign In and Sign Up tabs', async ({ page }) => {
    await page.goto('/login');
    // The mode-tab buttons sit in a flex div above the form (not type="submit").
    // Use .first() because "Sign In" text also appears on the submit button.
    await expect(page.getByRole('button', { name: 'Sign In' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign Up' }).first()).toBeVisible();
  });

  test('login page has amber-500 submit button', async ({ page }) => {
    await page.goto('/login');
    // Target the submit button specifically (amber-500 bg-amber-500 class)
    const btn = page.locator('form button[type="submit"]');
    await expect(btn).toBeVisible();
    const bgColor = await btn.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    // amber-500 = #f59e0b = rgb(245, 158, 11)
    expect(bgColor).toBe('rgb(245, 158, 11)');
  });

  test('login page inputs meet 44px tap target minimum', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.getByLabel('Email');
    const box = await emailInput.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
