// ─── Worker Session — pure TypeScript, no React dependency ──────────────────
// Used by: WorkerSessionContext, RBAC guards, unit tests.

export type WorkerRole = 'OWNER' | 'MANAGER' | 'FARMHAND' | 'VET';
export type MemberStatus = 'ACTIVE' | 'LOCKED' | 'REMOVED';

export interface WorkerSession {
  sessionId: string;
  memberId: string;
  displayName: string;
  role: WorkerRole;
  avatarColor: string;
  expiresAt: string; // ISO 8601 timestamp
  deviceId?: string; // stable browser-local tablet identifier (localStorage UUID)
}

// ── Role hierarchy (higher = more permissions) ──────────────────────────────
export const ROLE_HIERARCHY: Record<WorkerRole, number> = {
  OWNER: 4,
  MANAGER: 3,
  VET: 2,
  FARMHAND: 1,
};

/**
 * Returns true if the session's role is equal to or above the minimum required role.
 */
export function hasMinRole(session: WorkerSession, minRole: WorkerRole): boolean {
  return ROLE_HIERARCHY[session.role] >= ROLE_HIERARCHY[minRole];
}

/**
 * Returns true if the session has expired based on the current time.
 */
export function isSessionExpired(session: WorkerSession): boolean {
  return new Date(session.expiresAt).getTime() <= Date.now();
}

/** localStorage key used to persist the active worker session. */
export const SESSION_STORAGE_KEY = 'feedlotpro_worker_session';
