/**
 * Auth Setup — runs once before all E2E projects.
 *
 * Authenticates via the login UI and saves browser storage state to
 * tests/e2e/.auth/user.json so every test starts already logged in.
 *
 * If E2E_TEST_EMAIL / E2E_TEST_PASSWORD are not set in .env.local,
 * this setup is skipped → all dependent tests are also skipped (not failed).
 */
import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Always ensure the auth directory exists so storageState can load.
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    // Write empty (unauthenticated) storage state so the JSON file exists.
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
    setup.skip(
      true,
      'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env.local to run E2E tests.',
    );
    return;
  }

  // ── Sign in via the login page ─────────────────────────────────────────────
  await page.goto('/login');

  // Sign In tab is active by default — fill the form
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for successful redirect to the dashboard
  await expect(page).toHaveURL('/', { timeout: 15_000 });

  // Persist the authenticated session for all dependent tests
  await page.context().storageState({ path: authFile });
});
