import { describe, it, expect } from 'vitest';
import { checkPermission, ACTION, ROLE_PERMISSIONS, type Action } from '@/lib/rbac';
import type { WorkerRole } from '@/lib/worker-session';

const ALL_ACTIONS = Object.values(ACTION) as Action[];
const ALL_ROLES: WorkerRole[] = ['OWNER', 'MANAGER', 'VET', 'FARMHAND'];

// ── OWNER permissions ─────────────────────────────────────────────────────────

describe('OWNER permissions', () => {
  it('can perform every defined action', () => {
    for (const action of ALL_ACTIONS) {
      expect(checkPermission('OWNER', action)).toBe(true);
    }
  });
});

// ── MANAGER permissions ───────────────────────────────────────────────────────

describe('MANAGER permissions', () => {
  const allowed: Action[] = [
    ACTION.RECORD_FEEDING, ACTION.REGISTER_ANIMAL, ACTION.RECORD_WEIGHT,
    ACTION.FLAG_SICK, ACTION.VET_TREATMENT, ACTION.HEALTH_OUTCOME,
    ACTION.VIEW_PERFORMANCE, ACTION.MANAGE_PRICING, ACTION.MANAGE_REPORTS,
    ACTION.MANAGE_SETTINGS, ACTION.DISPATCH_ANIMAL,
  ];

  it.each(allowed)('can %s', (action) => {
    expect(checkPermission('MANAGER', action)).toBe(true);
  });

  it('cannot MANAGE_TEAM', () => {
    expect(checkPermission('MANAGER', ACTION.MANAGE_TEAM)).toBe(false);
  });
});

// ── FARMHAND permissions ──────────────────────────────────────────────────────

describe('FARMHAND permissions', () => {
  const allowed: Action[] = [
    ACTION.RECORD_FEEDING, ACTION.REGISTER_ANIMAL, ACTION.RECORD_WEIGHT, ACTION.FLAG_SICK,
  ];

  it.each(allowed)('can %s', (action) => {
    expect(checkPermission('FARMHAND', action)).toBe(true);
  });

  const denied: Action[] = [
    ACTION.VET_TREATMENT, ACTION.HEALTH_OUTCOME, ACTION.VIEW_PERFORMANCE,
    ACTION.MANAGE_PRICING, ACTION.MANAGE_REPORTS, ACTION.MANAGE_SETTINGS,
    ACTION.DISPATCH_ANIMAL, ACTION.MANAGE_TEAM,
  ];

  it.each(denied)('cannot %s', (action) => {
    expect(checkPermission('FARMHAND', action)).toBe(false);
  });
});

// ── VET permissions ───────────────────────────────────────────────────────────

describe('VET permissions', () => {
  const allowed: Action[] = [
    ACTION.FLAG_SICK, ACTION.VET_TREATMENT, ACTION.HEALTH_OUTCOME,
  ];

  it.each(allowed)('can %s', (action) => {
    expect(checkPermission('VET', action)).toBe(true);
  });

  const denied: Action[] = [
    ACTION.RECORD_FEEDING, ACTION.REGISTER_ANIMAL, ACTION.RECORD_WEIGHT,
    ACTION.VIEW_PERFORMANCE, ACTION.MANAGE_PRICING, ACTION.MANAGE_REPORTS,
    ACTION.MANAGE_SETTINGS, ACTION.DISPATCH_ANIMAL, ACTION.MANAGE_TEAM,
  ];

  it.each(denied)('cannot %s', (action) => {
    expect(checkPermission('VET', action)).toBe(false);
  });
});

// ── MANAGE_TEAM is OWNER-only ─────────────────────────────────────────────────

describe('MANAGE_TEAM is OWNER-only', () => {
  const nonOwner: WorkerRole[] = ['MANAGER', 'FARMHAND', 'VET'];

  it.each(nonOwner)('%s cannot MANAGE_TEAM', (role) => {
    expect(checkPermission(role, ACTION.MANAGE_TEAM)).toBe(false);
  });
});

// ── DISPATCH_ANIMAL is OWNER + MANAGER only ───────────────────────────────────

describe('DISPATCH_ANIMAL access', () => {
  it('OWNER can DISPATCH_ANIMAL', () => {
    expect(checkPermission('OWNER', ACTION.DISPATCH_ANIMAL)).toBe(true);
  });
  it('MANAGER can DISPATCH_ANIMAL', () => {
    expect(checkPermission('MANAGER', ACTION.DISPATCH_ANIMAL)).toBe(true);
  });
  it('FARMHAND cannot DISPATCH_ANIMAL', () => {
    expect(checkPermission('FARMHAND', ACTION.DISPATCH_ANIMAL)).toBe(false);
  });
  it('VET cannot DISPATCH_ANIMAL', () => {
    expect(checkPermission('VET', ACTION.DISPATCH_ANIMAL)).toBe(false);
  });
});

// ── ROLE_PERMISSIONS completeness ─────────────────────────────────────────────

describe('ROLE_PERMISSIONS completeness', () => {
  it('all four roles are represented in the permission matrix', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(ROLE_PERMISSIONS[role]).toBeInstanceOf(Set);
    }
  });

  it('no permission set contains an action string not in ACTION constant', () => {
    const validActions = new Set(ALL_ACTIONS);
    for (const role of ALL_ROLES) {
      for (const action of ROLE_PERMISSIONS[role]) {
        expect(validActions.has(action)).toBe(true);
      }
    }
  });
});
