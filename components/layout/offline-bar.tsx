'use client';

// ─── Offline Bar — P10 ────────────────────────────────────────────────────────
// Renders a status bar at the top of the dashboard when offline or syncing.
// Block 3: Added slide-down animation + Sync Now button.

import { useOffline } from '@/contexts/offline-context';
import { WifiOff, RefreshCw } from 'lucide-react';

export function OfflineBar() {
  const { isOnline, pendingCount, syncStatus, triggerSync } = useOffline();

  const visible = !isOnline || pendingCount > 0;

  if (!visible) return null;

  if (!isOnline) {
    return (
      <div className="flex items-center justify-center gap-2 bg-red-600 text-white text-sm font-medium py-2 px-4 animate-in slide-in-from-top duration-300">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>
          Offline{pendingCount > 0 ? ` — ${pendingCount} item${pendingCount !== 1 ? 's' : ''} queued` : ''}
        </span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-medium py-2 px-4 animate-in slide-in-from-top duration-300">
        <RefreshCw className={`h-4 w-4 shrink-0 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
        <span>
          {syncStatus === 'syncing'
            ? `Syncing ${pendingCount} item${pendingCount !== 1 ? 's' : ''}…`
            : `${pendingCount} item${pendingCount !== 1 ? 's' : ''} pending sync`}
        </span>
        {syncStatus !== 'syncing' && (
          <button
            onClick={() => triggerSync()}
            className="text-xs font-medium underline ml-1 hover:no-underline"
          >
            Sync Now
          </button>
        )}
      </div>
    );
  }

  return null;
}
