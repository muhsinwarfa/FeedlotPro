import { describe, it, expect } from 'vitest';
import { TRANSITIONS } from '@/components/animals/status-form';

type AnimalStatus = 'ACTIVE' | 'SICK' | 'DEAD' | 'DISPATCHED';

const ALL_STATUSES: AnimalStatus[] = ['ACTIVE', 'SICK', 'DEAD', 'DISPATCHED'];

describe('TRANSITIONS state machine map', () => {
  describe('ACTIVE state', () => {
    // V2 Block 2: ACTIVE→SICK is handled by FlagSickForm, not StatusForm
    it('does NOT have SICK in ACTIVE transitions (handled by FlagSickForm)', () => {
      expect(TRANSITIONS.ACTIVE).not.toContain('SICK');
    });

    it('allows transition to DEAD', () => {
      expect(TRANSITIONS.ACTIVE).toContain('DEAD');
    });

    it('allows transition to DISPATCHED', () => {
      expect(TRANSITIONS.ACTIVE).toContain('DISPATCHED');
    });

    it('does NOT allow self-loop (ACTIVE → ACTIVE)', () => {
      expect(TRANSITIONS.ACTIVE).not.toContain('ACTIVE');
    });

    it('has exactly 2 valid transitions', () => {
      expect(TRANSITIONS.ACTIVE).toHaveLength(2);
    });
  });

  describe('SICK state', () => {
    // V2 Block 2: SICK→ACTIVE (recovery) is handled by HealthOutcomeForm, not StatusForm
    it('does NOT have ACTIVE in SICK transitions (handled by HealthOutcomeForm)', () => {
      expect(TRANSITIONS.SICK).not.toContain('ACTIVE');
    });

    it('allows transition to DEAD', () => {
      expect(TRANSITIONS.SICK).toContain('DEAD');
    });

    it('allows transition to DISPATCHED', () => {
      expect(TRANSITIONS.SICK).toContain('DISPATCHED');
    });

    it('does NOT allow self-loop (SICK → SICK)', () => {
      expect(TRANSITIONS.SICK).not.toContain('SICK');
    });

    it('has exactly 2 valid transitions', () => {
      expect(TRANSITIONS.SICK).toHaveLength(2);
    });
  });

  describe('DEAD state (sealed terminal)', () => {
    it('has zero valid transitions (empty array)', () => {
      expect(TRANSITIONS.DEAD).toHaveLength(0);
    });

    it('cannot transition to ACTIVE from DEAD', () => {
      expect(TRANSITIONS.DEAD).not.toContain('ACTIVE');
    });

    it('cannot transition to SICK from DEAD', () => {
      expect(TRANSITIONS.DEAD).not.toContain('SICK');
    });

    it('cannot transition to DISPATCHED from DEAD', () => {
      expect(TRANSITIONS.DEAD).not.toContain('DISPATCHED');
    });
  });

  describe('DISPATCHED state (sealed terminal)', () => {
    it('has zero valid transitions (empty array)', () => {
      expect(TRANSITIONS.DISPATCHED).toHaveLength(0);
    });

    it('cannot transition to ACTIVE from DISPATCHED', () => {
      expect(TRANSITIONS.DISPATCHED).not.toContain('ACTIVE');
    });

    it('cannot transition to SICK from DISPATCHED', () => {
      expect(TRANSITIONS.DISPATCHED).not.toContain('SICK');
    });

    it('cannot transition to DEAD from DISPATCHED', () => {
      expect(TRANSITIONS.DISPATCHED).not.toContain('DEAD');
    });
  });

  describe('exhaustiveness', () => {
    it('TRANSITIONS map covers all 4 AnimalStatus values as keys', () => {
      for (const status of ALL_STATUSES) {
        expect(TRANSITIONS).toHaveProperty(status);
      }
    });

    it('all transition targets are valid AnimalStatus values', () => {
      for (const transitions of Object.values(TRANSITIONS)) {
        for (const target of transitions) {
          expect(ALL_STATUSES).toContain(target);
        }
      }
    });

    it('exactly 4 keys in the TRANSITIONS map', () => {
      expect(Object.keys(TRANSITIONS)).toHaveLength(4);
    });

    it('ACTIVE and SICK are non-terminal (have transitions)', () => {
      expect(TRANSITIONS.ACTIVE.length).toBeGreaterThan(0);
      expect(TRANSITIONS.SICK.length).toBeGreaterThan(0);
    });

    it('DEAD and DISPATCHED are terminal (no transitions)', () => {
      expect(TRANSITIONS.DEAD.length).toBe(0);
      expect(TRANSITIONS.DISPATCHED.length).toBe(0);
    });
  });
});
