// ─── Offline Write Queue — IndexedDB via `idb` ───────────────────────────────
// Stores failed Supabase mutations when the device is offline.
// The sync engine (sync.ts) drains this queue on reconnect.
//
// This module is pure TypeScript with no React dependency so it can be
// imported from server utilities, tests, and client components alike.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'feedlotpro-offline';
const DB_VERSION = 1;
const STORE = 'queue';

// ── Types ────────────────────────────────────────────────────────────────────

export interface QueuedOperation {
  id?: number;           // autoIncrement — undefined before insert
  table: string;
  method: 'INSERT' | 'UPDATE';
  payload: Record<string, unknown>;
  localTimestamp: string; // ISO-8601
  attempts: number;
  memberId: string | null;
}

interface OfflineDB extends DBSchema {
  [STORE]: {
    key: number;
    value: QueuedOperation;
    indexes: { 'by-table': string };
  };
}

// ── DB singleton ──────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

export function openOfflineDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by-table', 'table', { unique: false });
      },
    });
  }
  return dbPromise;
}

// ── Queue operations ──────────────────────────────────────────────────────────

/** Add a failed operation to the offline queue. */
export async function addToQueue(
  op: Omit<QueuedOperation, 'id' | 'attempts'>
): Promise<number> {
  const db = await openOfflineDB();
  return db.add(STORE, { ...op, attempts: 0 });
}

/** Return all pending operations in FIFO order. */
export async function getQueue(): Promise<QueuedOperation[]> {
  const db = await openOfflineDB();
  return db.getAll(STORE);
}

/** Return the count of pending operations. */
export async function getQueueCount(): Promise<number> {
  const db = await openOfflineDB();
  return db.count(STORE);
}

/** Remove a synced operation from the queue. */
export async function markSynced(id: number): Promise<void> {
  const db = await openOfflineDB();
  await db.delete(STORE, id);
}

/** Increment the attempt counter for a failed operation. */
export async function incrementAttempts(id: number): Promise<void> {
  const db = await openOfflineDB();
  const tx = db.transaction(STORE, 'readwrite');
  const op = await tx.store.get(id);
  if (op) {
    await tx.store.put({ ...op, attempts: op.attempts + 1 });
  }
  await tx.done;
}
