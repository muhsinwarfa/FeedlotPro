'use client';

import { useState, useEffect, useRef } from 'react';

// ─── PinPad — pure UI numeric keypad for 4-digit PIN entry ──────────────────
// No internal async logic. Calls onComplete(pin) when all 4 digits are entered
// and the user taps confirm.

interface PinPadProps {
  onComplete: (pin: string) => void;
  isLocked?: boolean;
  attemptCount?: number;
  isPending?: boolean;
}

export function PinPad({ onComplete, isLocked = false, attemptCount = 0, isPending = false }: PinPadProps) {
  const [digits, setDigits] = useState<string[]>([]);

  function handleDigit(d: string) {
    if (isLocked || isPending || digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) {
      // Auto-submit when 4th digit is entered
      onComplete(next.join(''));
    }
  }

  function handleBackspace() {
    if (isLocked || isPending) return;
    setDigits((prev) => prev.slice(0, -1));
  }

  // Reset digits when pending/locked changes (e.g. after failed attempt)
  const prevPendingRef = useRef(isPending);
  useEffect(() => {
    if (prevPendingRef.current && !isPending) {
      setDigits([]);
    }
    prevPendingRef.current = isPending;
  }, [isPending]);

  const attemptsLeft = 3 - attemptCount;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Masked dot indicators */}
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              digits.length > i
                ? 'bg-emerald-950 border-emerald-950'
                : 'bg-transparent border-slate-300'
            }`}
          />
        ))}
      </div>

      {/* Attempt counter warning */}
      {attemptCount > 0 && !isLocked && (
        <p className="text-sm text-amber-600 font-medium">
          Incorrect PIN. {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining.
        </p>
      )}

      {isLocked && (
        <p className="text-sm text-red-600 font-medium text-center">
          Account locked. Contact the farm owner to reset.
        </p>
      )}

      {/* Numeric grid: 3 columns × 4 rows */}
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            onClick={() => handleDigit(d)}
            disabled={isLocked || isPending || digits.length >= 4}
            className="w-20 h-16 rounded-xl bg-white border border-slate-200 text-2xl font-semibold text-slate-800 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            {d}
          </button>
        ))}

        {/* Bottom row: empty, 0, backspace */}
        <div />
        <button
          onClick={() => handleDigit('0')}
          disabled={isLocked || isPending || digits.length >= 4}
          className="w-20 h-16 rounded-xl bg-white border border-slate-200 text-2xl font-semibold text-slate-800 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 transition-colors"
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          disabled={isLocked || isPending || digits.length === 0}
          className="w-20 h-16 rounded-xl bg-white border border-slate-200 text-slate-500 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-30 transition-colors flex items-center justify-center"
          aria-label="Backspace"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
          </svg>
        </button>
      </div>

      {isPending && (
        <p className="text-sm text-slate-400 animate-pulse">Verifying…</p>
      )}
    </div>
  );
}
