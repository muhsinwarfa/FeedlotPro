// ─── Shared pure formatting & calculation utilities ─────────────────────────
// Extracted from components for unit testability (no React, no DB dependency).

export type AnimalForWeightGain = {
  intake_weight: number;
  current_weight: number | null;
};

/**
 * Calculates weight gain string from an animal row.
 * Extracted from components/animals/animal-list.tsx.
 * Returns "+12.5" for gains, "-3.0" for losses.
 */
export function weightGain(animal: AnimalForWeightGain): string {
  const current = animal.current_weight ?? animal.intake_weight;
  const gain = current - animal.intake_weight;
  return gain >= 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1);
}

/**
 * Formats an ISO date string to Kenyan locale display.
 * Extracted from components/animals/animal-list.tsx.
 * Example output: "26 Feb 2026"
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Formats a Date object to Kenyan locale datetime display.
 * Extracted from components/feeding/feeding-summary.tsx.
 * Example output: "Thu, 26 Feb 2026, 14:30"
 */
export function formatDateTime(d: Date): string {
  return d.toLocaleString('en-KE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculates total feed in kg from an ingredient inputs array.
 * Extracted from components/feeding/feeding-flow.tsx.
 * Treats null kgAmount as 0.
 */
export function totalFeedKg(inputs: Array<{ kgAmount: number | null }>): number {
  return inputs.reduce((sum, i) => sum + (i.kgAmount ?? 0), 0);
}
