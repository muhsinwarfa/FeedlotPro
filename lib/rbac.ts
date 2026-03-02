// ─── RBAC — Single source of truth for all role permissions ─────────────────
// Maps every user-facing action to the roles that are allowed to perform it.
// Import ACTION constants throughout the app for type-safe permission checks.

import type { WorkerRole } from '@/lib/worker-session';

// ── Action constants ─────────────────────────────────────────────────────────
export const ACTION = {
  // Available to all roles
  RECORD_FEEDING: 'RECORD_FEEDING',
  REGISTER_ANIMAL: 'REGISTER_ANIMAL',
  RECORD_WEIGHT: 'RECORD_WEIGHT',
  FLAG_SICK: 'FLAG_SICK',

  // VET + OWNER + MANAGER
  VET_TREATMENT: 'VET_TREATMENT',
  HEALTH_OUTCOME: 'HEALTH_OUTCOME',

  // OWNER + MANAGER only
  VIEW_PERFORMANCE: 'VIEW_PERFORMANCE',
  MANAGE_PRICING: 'MANAGE_PRICING',
  MANAGE_REPORTS: 'MANAGE_REPORTS',
  MANAGE_SETTINGS: 'MANAGE_SETTINGS',
  DISPATCH_ANIMAL: 'DISPATCH_ANIMAL',

  // OWNER only
  MANAGE_TEAM: 'MANAGE_TEAM',
} as const;

export type Action = (typeof ACTION)[keyof typeof ACTION];

// ── Permission matrix (matches spec section 14) ──────────────────────────────
export const ROLE_PERMISSIONS: Record<WorkerRole, Set<Action>> = {
  OWNER: new Set<Action>([
    ACTION.RECORD_FEEDING,
    ACTION.REGISTER_ANIMAL,
    ACTION.RECORD_WEIGHT,
    ACTION.FLAG_SICK,
    ACTION.VET_TREATMENT,
    ACTION.HEALTH_OUTCOME,
    ACTION.VIEW_PERFORMANCE,
    ACTION.MANAGE_PRICING,
    ACTION.MANAGE_REPORTS,
    ACTION.MANAGE_SETTINGS,
    ACTION.DISPATCH_ANIMAL,
    ACTION.MANAGE_TEAM,
  ]),

  MANAGER: new Set<Action>([
    ACTION.RECORD_FEEDING,
    ACTION.REGISTER_ANIMAL,
    ACTION.RECORD_WEIGHT,
    ACTION.FLAG_SICK,
    ACTION.VET_TREATMENT,
    ACTION.HEALTH_OUTCOME,
    ACTION.VIEW_PERFORMANCE,
    ACTION.MANAGE_PRICING,
    ACTION.MANAGE_REPORTS,
    ACTION.MANAGE_SETTINGS,
    ACTION.DISPATCH_ANIMAL,
  ]),

  FARMHAND: new Set<Action>([
    ACTION.RECORD_FEEDING,
    ACTION.REGISTER_ANIMAL,
    ACTION.RECORD_WEIGHT,
    ACTION.FLAG_SICK,
  ]),

  VET: new Set<Action>([
    ACTION.FLAG_SICK,
    ACTION.VET_TREATMENT,
    ACTION.HEALTH_OUTCOME,
  ]),
};

/**
 * Returns true if the given role is permitted to perform the action.
 */
export function checkPermission(role: WorkerRole, action: Action): boolean {
  return ROLE_PERMISSIONS[role].has(action);
}
