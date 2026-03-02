'use client';

// ─── Offline Context — P10 Offline Sync ──────────────────────────────────────
// Tracks device connectivity and manages the offline write queue.
// Wraps dashboard layout; exposes isOnline, pendingCount, syncStatus.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { getQueueCount } from '@/lib/offline/queue';
import { syncQueue } from '@/lib/offline/sync';

// ── Types ────────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error';

interface OfflineContextValue {
  isOnline: boolean;
  pendingCount: number;
  syncStatus: SyncStatus;
  triggerSync: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  pendingCount: 0,
  syncStatus: 'idle',
  triggerSync: async () => {},
});

export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const refreshCount = useCallback(async () => {
    try {
      const count = await getQueueCount();
      setPendingCount(count);
    } catch {
      // IndexedDB may not be available (SSR, private mode)
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    try {
      await syncQueue(supabase);
      await refreshCount();
      setSyncStatus('idle');
    } catch {
      setSyncStatus('error');
    }
  }, [syncStatus, supabase, refreshCount]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync]);

  // Poll queue count every 30 seconds
  useEffect(() => {
    refreshCount();
    pollRef.current = setInterval(refreshCount, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshCount]);

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, syncStatus, triggerSync }}>
      {children}
    </OfflineContext.Provider>
  );
}
