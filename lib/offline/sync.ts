// ─── Offline Sync Engine ──────────────────────────────────────────────────────
// Drains the IndexedDB write queue by replaying each operation against Supabase.
// Called by OfflineContext whenever the device comes back online.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js';
import { getQueue, markSynced, incrementAttempts } from './queue';

const MAX_ATTEMPTS = 5;

export interface SyncResult {
  synced: number;
  failed: number;
  conflicts: number;
}

/**
 * Replay all pending offline operations against Supabase in FIFO order.
 *
 * - On success → markSynced(id)
 * - On 23505 (unique conflict) → log to sync_conflicts table, markSynced
 * - On network error → incrementAttempts; skip if attempts > MAX_ATTEMPTS
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncQueue(
  supabase: SupabaseClient<any>
): Promise<SyncResult> {
  const ops = await getQueue();
  let synced = 0;
  let failed = 0;
  let conflicts = 0;

  for (const op of ops) {
    if (op.attempts > MAX_ATTEMPTS) {
      // Too many retries — skip silently (will be cleaned up manually)
      continue;
    }

    try {
      let error: { code?: string; message?: string } | null = null;

      if (op.method === 'INSERT') {
        const result = await supabase.from(op.table).insert(op.payload);
        error = result.error;
      } else if (op.method === 'UPDATE') {
        const { id, ...rest } = op.payload as { id: string } & Record<string, unknown>;
        const result = await supabase.from(op.table).update(rest).eq('id', id);
        error = result.error;
      }

      if (!error) {
        await markSynced(op.id!);
        synced++;
      } else if (error.code === '23505') {
        // Unique constraint violation — log conflict and move on
        await supabase.from('sync_conflicts').insert({
          table_name: op.table,
          record_id: String((op.payload as Record<string, unknown>).id ?? op.id),
          local_payload: op.payload,
          server_payload: null,
          error_message: error.message ?? null,
          resolved_at: null,
          resolved_by: null,
        });
        await markSynced(op.id!);
        conflicts++;
      } else {
        await incrementAttempts(op.id!);
        failed++;
      }
    } catch (networkErr) {
      // Network-level error — stop processing, will retry later
      await incrementAttempts(op.id!);
      failed++;
      break;
    }
  }

  return { synced, failed, conflicts };
}
