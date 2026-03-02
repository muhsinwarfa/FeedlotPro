import { describe, it, expect } from 'vitest';
import {
  isSessionExpired,
  hasMinRole,
  ROLE_HIERARCHY,
  type WorkerSession,
  type WorkerRole,
} from '@/lib/worker-session';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<WorkerSession> = {}): WorkerSession {
  return {
    sessionId: 'session-uuid',
    memberId: 'member-uuid',
    displayName: 'Test Worker',
    role: 'FARMHAND',
    avatarColor: '#064E3B',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1h from now
    ...overrides,
  };
}

// ── isSessionExpired ──────────────────────────────────────────────────────────

describe('isSessionExpired', () => {
  it('returns false for a session that expires in the future', () => {
    const session = makeSession({ expiresAt: new Date(Date.now() + 3600_000).toISOString() });
    expect(isSessionExpired(session)).toBe(false);
  });

  it('returns true for a session whose expiresAt is in the past', () => {
    const session = makeSession({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(isSessionExpired(session)).toBe(true);
  });

  it('returns true when expiresAt is exactly now (boundary — expired)', () => {
    // Date.now() will always be >= the timestamp we just created
    const now = new Date(Date.now() - 1).toISOString();
    const session = makeSession({ expiresAt: now });
    expect(isSessionExpired(session)).toBe(true);
  });

  it('returns false for a session expiring far in the future (24 h)', () => {
    const session = makeSession({ expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect(isSessionExpired(session)).toBe(false);
  });

  it('returns true for a session that expired 1 ms ago', () => {
    const session = makeSession({ expiresAt: new Date(Date.now() - 1).toISOString() });
    expect(isSessionExpired(session)).toBe(true);
  });
});

// ── ROLE_HIERARCHY ────────────────────────────────────────────────────────────

describe('ROLE_HIERARCHY', () => {
  it('OWNER has the highest hierarchy value', () => {
    const values = Object.values(ROLE_HIERARCHY);
    expect(ROLE_HIERARCHY['OWNER']).toBe(Math.max(...values));
  });

  it('FARMHAND has the lowest hierarchy value', () => {
    const values = Object.values(ROLE_HIERARCHY);
    expect(ROLE_HIERARCHY['FARMHAND']).toBe(Math.min(...values));
  });

  it('ordering: OWNER > MANAGER > VET > FARMHAND', () => {
    expect(ROLE_HIERARCHY['OWNER']).toBeGreaterThan(ROLE_HIERARCHY['MANAGER']);
    expect(ROLE_HIERARCHY['MANAGER']).toBeGreaterThan(ROLE_HIERARCHY['VET']);
    expect(ROLE_HIERARCHY['VET']).toBeGreaterThan(ROLE_HIERARCHY['FARMHAND']);
  });
});

// ── hasMinRole ────────────────────────────────────────────────────────────────

describe('hasMinRole', () => {
  const roles: WorkerRole[] = ['OWNER', 'MANAGER', 'VET', 'FARMHAND'];

  // A role always meets the minimum of itself
  it.each(roles)('%s meets minimum of %s (self)', (role) => {
    const session = makeSession({ role });
    expect(hasMinRole(session, role)).toBe(true);
  });

  describe('OWNER session', () => {
    const session = makeSession({ role: 'OWNER' });
    it('meets MANAGER minimum', () => expect(hasMinRole(session, 'MANAGER')).toBe(true));
    it('meets VET minimum', () => expect(hasMinRole(session, 'VET')).toBe(true));
    it('meets FARMHAND minimum', () => expect(hasMinRole(session, 'FARMHAND')).toBe(true));
    it('meets OWNER minimum', () => expect(hasMinRole(session, 'OWNER')).toBe(true));
  });

  describe('MANAGER session', () => {
    const session = makeSession({ role: 'MANAGER' });
    it('does NOT meet OWNER minimum', () => expect(hasMinRole(session, 'OWNER')).toBe(false));
    it('meets MANAGER minimum', () => expect(hasMinRole(session, 'MANAGER')).toBe(true));
    it('meets VET minimum', () => expect(hasMinRole(session, 'VET')).toBe(true));
    it('meets FARMHAND minimum', () => expect(hasMinRole(session, 'FARMHAND')).toBe(true));
  });

  describe('VET session', () => {
    const session = makeSession({ role: 'VET' });
    it('does NOT meet OWNER minimum', () => expect(hasMinRole(session, 'OWNER')).toBe(false));
    it('does NOT meet MANAGER minimum', () => expect(hasMinRole(session, 'MANAGER')).toBe(false));
    it('meets VET minimum', () => expect(hasMinRole(session, 'VET')).toBe(true));
    it('meets FARMHAND minimum', () => expect(hasMinRole(session, 'FARMHAND')).toBe(true));
  });

  describe('FARMHAND session', () => {
    const session = makeSession({ role: 'FARMHAND' });
    it('does NOT meet OWNER minimum', () => expect(hasMinRole(session, 'OWNER')).toBe(false));
    it('does NOT meet MANAGER minimum', () => expect(hasMinRole(session, 'MANAGER')).toBe(false));
    it('does NOT meet VET minimum', () => expect(hasMinRole(session, 'VET')).toBe(false));
    it('meets FARMHAND minimum', () => expect(hasMinRole(session, 'FARMHAND')).toBe(true));
  });
});
