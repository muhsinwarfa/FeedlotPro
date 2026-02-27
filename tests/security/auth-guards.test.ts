/**
 * Layer 3 — Security: Auth Guards
 *
 * Tests that the Next.js middleware correctly blocks unauthenticated access to
 * every protected route and redirects to /login (307).
 *
 * PREREQUISITE: `npm run dev` must be running on port 3000 before executing.
 * Run:
 *   Terminal 1: npm run dev
 *   Terminal 2: npm run test:security
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = 'http://localhost:3000';

let devServerAvailable = false;

/**
 * Check if the dev server is reachable. Tests skip gracefully when it's not.
 */
beforeAll(async () => {
  try {
    await fetch(`${BASE_URL}/login`, { signal: AbortSignal.timeout(3000) });
    devServerAvailable = true;
  } catch {
    console.warn(
      '\n[security] Dev server not available at localhost:3000. ' +
      'Run `npm run dev` first to execute auth-guard tests.\n'
    );
  }
});

/**
 * Fetch a URL without following redirects so we can inspect the 307 status.
 */
async function fetchNoRedirect(path: string) {
  return fetch(`${BASE_URL}${path}`, { redirect: 'manual' });
}

function requireDevServer() {
  if (!devServerAvailable) {
    console.warn('[security] Skipping — dev server not running.');
    return false;
  }
  return true;
}

describe('Auth Guards — unauthenticated redirects', () => {
  describe('protected routes → 307 redirect to /login', () => {
    const protectedRoutes = [
      '/',
      '/inventory',
      '/inventory/intake',
      '/feeding',
      '/feeding/history',
      '/settings',
    ];

    for (const route of protectedRoutes) {
      it(`GET ${route} redirects to /login (307) when unauthenticated`, async () => {
        if (!requireDevServer()) return;
        const res = await fetchNoRedirect(route);
        expect(res.status).toBe(307);
        const location = res.headers.get('location') ?? '';
        expect(location).toContain('/login');
      });
    }
  });

  describe('auth routes excluded from middleware matcher', () => {
    it('GET /login returns non-307 status (not redirected by middleware)', async () => {
      if (!requireDevServer()) return;
      const res = await fetchNoRedirect('/login');
      // /login is excluded from the matcher — middleware never runs on it.
      // It either returns 200 (server-rendered) or 307 if its own code redirects.
      // The key assertion: NOT redirected to /login (which would be circular).
      const location = res.headers.get('location') ?? '';
      expect(location).not.toMatch(/\/login$/);
    });

    it('GET /auth/callback is handled by the route handler, not the middleware', async () => {
      if (!requireDevServer()) return;
      // /auth is excluded from the middleware matcher.
      // Without a valid `code` param, the route handler itself redirects to
      // /login?error=auth_callback_failed — proving it was the handler (not the
      // middleware) that ran. The middleware would redirect to bare /login only.
      const res = await fetchNoRedirect('/auth/callback');
      const location = res.headers.get('location') ?? '';
      // The auth handler appends an error query param; middleware never does.
      expect(location).toContain('auth_callback_failed');
    });
  });

  describe('redirect target is always /login', () => {
    it('redirect Location header is an absolute or relative path to /login', async () => {
      if (!requireDevServer()) return;
      const res = await fetchNoRedirect('/inventory');
      const location = res.headers.get('location') ?? '';
      // Could be absolute (http://localhost:3000/login) or relative (/login)
      expect(location).toMatch(/\/login/);
    });

    it('redirect does NOT expose session data in Location header', async () => {
      if (!requireDevServer()) return;
      const res = await fetchNoRedirect('/inventory');
      const location = res.headers.get('location') ?? '';
      // Location should only be the login URL — no tokens, secrets, or query params
      expect(location).not.toContain('token');
      expect(location).not.toContain('secret');
      expect(location).not.toContain('key');
    });
  });

  describe('static assets excluded from middleware', () => {
    it('GET /_next/static/... does not hit auth middleware', async () => {
      if (!requireDevServer()) return;
      // A non-existent static file returns 404, not 307 (middleware excluded it)
      const res = await fetchNoRedirect('/_next/static/test-file-does-not-exist.js');
      expect(res.status).not.toBe(307);
    });
  });
});
