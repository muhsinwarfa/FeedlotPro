'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import type { WorkerSession } from '@/lib/worker-session';
import { isSessionExpired, SESSION_STORAGE_KEY } from '@/lib/worker-session';

// ── Context shape ─────────────────────────────────────────────────────────────

interface WorkerSessionContextValue {
  activeSession: WorkerSession | null;
  setSession: (session: WorkerSession) => void;
  clearSession: () => void;
}

const WorkerSessionContext = createContext<WorkerSessionContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function WorkerSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<WorkerSession | null>(null);

  // On mount: restore session from localStorage and validate TTL
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed: WorkerSession = JSON.parse(stored);
        if (!isSessionExpired(parsed)) {
          setActiveSession(parsed);
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  function setSession(session: WorkerSession) {
    setActiveSession(session);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  function clearSession() {
    setActiveSession(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  return (
    <WorkerSessionContext.Provider value={{ activeSession, setSession, clearSession }}>
      {children}
    </WorkerSessionContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWorkerSession(): WorkerSessionContextValue {
  const ctx = useContext(WorkerSessionContext);
  if (!ctx) {
    throw new Error('useWorkerSession must be used within a WorkerSessionProvider');
  }
  return ctx;
}
