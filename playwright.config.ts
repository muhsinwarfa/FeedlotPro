import { defineConfig, devices } from '@playwright/test';

/**
 * Layer 5 — E2E + Visual Tests
 *
 * Prerequisites:
 *   1. Add test credentials to .env.local:
 *      E2E_TEST_EMAIL=your-test-account@example.com
 *      E2E_TEST_PASSWORD=your-password
 *   2. The account must have completed onboarding (has an organization).
 *   3. Run `npm run dev` OR let Playwright start it via webServer below.
 *
 * Auth state is saved to tests/e2e/.auth/user.json (gitignored).
 * Visual baselines live in tests/e2e/visual/__snapshots__/ (committed to git).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── Step 0: authenticate once, save cookies ─────────────────────────────
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },

    // ── Unauthenticated tests: run independently (no setup dependency) ───────
    // auth-flow.spec.ts explicitly overrides storageState to empty cookies
    // so it tests the un-authed redirect behaviour even without credentials.
    {
      name: 'no-auth',
      testMatch: 'tests/e2e/flows/auth-flow.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },

    // ── Flow tests: mobile viewport ─────────────────────────────────────────
    {
      name: 'mobile-chrome',
      testMatch: 'tests/e2e/flows/!(auth-flow)*.spec.ts',
      use: {
        ...devices['Pixel 5'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // ── Flow tests: desktop viewport ────────────────────────────────────────
    {
      name: 'desktop-chrome',
      testMatch: 'tests/e2e/flows/!(auth-flow)*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // ── Visual regression: desktop only ────────────────────────────────────
    {
      name: 'visual-regression',
      testMatch: 'tests/e2e/visual/**/*.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
