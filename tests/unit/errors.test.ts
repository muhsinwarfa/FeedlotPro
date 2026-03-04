import { describe, it, expect } from 'vitest';
import { mapDbError } from '@/lib/errors';

describe('mapDbError', () => {
  describe('BUS-001: locked animal (ERR_INVALID_TRANSITION)', () => {
    it('returns BUS-001 when message includes ERR_INVALID_TRANSITION', () => {
      const result = mapDbError({ message: 'ERR_INVALID_TRANSITION: Cannot modify a DEAD animal' });
      expect(result.title).toBe('BUS-001');
    });

    it('description mentions Dead/Dispatched', () => {
      const result = mapDbError({ message: 'ERR_INVALID_TRANSITION' });
      expect(result.description).toMatch(/Dead|Dispatched/i);
    });
  });

  describe('DAT-003: duplicate tag (unique constraint)', () => {
    it('returns DAT-003 when code is "23505"', () => {
      const result = mapDbError({ code: '23505', message: 'duplicate key value' });
      expect(result.title).toBe('DAT-003');
    });

    it('returns DAT-003 when message includes animals_tag_id_org_unique', () => {
      const result = mapDbError({ message: 'animals_tag_id_org_unique' });
      expect(result.title).toBe('DAT-003');
    });

    it('returns DAT-003 when message includes ERR_DUPLICATE_TAG', () => {
      const result = mapDbError({ message: 'ERR_DUPLICATE_TAG' });
      expect(result.title).toBe('DAT-003');
    });

    it('description mentions inventory', () => {
      const result = mapDbError({ code: '23505' });
      expect(result.description).toMatch(/inventory/i);
    });
  });

  describe('DAT-001: negative weight', () => {
    it('returns DAT-001 when message includes ERR_NEGATIVE_WEIGHT', () => {
      const result = mapDbError({ message: 'ERR_NEGATIVE_WEIGHT: weight must be positive' });
      expect(result.title).toBe('DAT-001');
    });

    it('description mentions positive number', () => {
      const result = mapDbError({ message: 'ERR_NEGATIVE_WEIGHT' });
      expect(result.description).toMatch(/positive/i);
    });
  });

  describe('BUS-002: deactivated pen', () => {
    it('returns BUS-002 when message includes ERR_PEN_DEACTIVATED', () => {
      const result = mapDbError({ message: 'ERR_PEN_DEACTIVATED: pen is inactive' });
      expect(result.title).toBe('BUS-002');
    });

    it('description mentions deactivated', () => {
      const result = mapDbError({ message: 'ERR_PEN_DEACTIVATED' });
      expect(result.description).toMatch(/deactivated/i);
    });
  });

  describe('BUS-004: empty pen', () => {
    it('returns BUS-004 when message includes ERR_EMPTY_PEN', () => {
      const result = mapDbError({ message: 'ERR_EMPTY_PEN: no active animals' });
      expect(result.title).toBe('BUS-004');
    });

    it('description mentions no active animals', () => {
      const result = mapDbError({ message: 'ERR_EMPTY_PEN' });
      expect(result.description).toMatch(/no active animals/i);
    });
  });

  describe('DAT-002: all blank ingredients', () => {
    it('returns DAT-002 when message includes ERR_ALL_BLANKS', () => {
      const result = mapDbError({ message: 'ERR_ALL_BLANKS: all ingredient amounts are zero' });
      expect(result.title).toBe('DAT-002');
    });

    it('description mentions ingredient amount', () => {
      const result = mapDbError({ message: 'ERR_ALL_BLANKS' });
      expect(result.description).toMatch(/ingredient/i);
    });
  });

  describe('SYS-001: DB unavailable', () => {
    it('returns SYS-001 when message includes ERR_DB_UNAVAILABLE', () => {
      const result = mapDbError({ message: 'ERR_DB_UNAVAILABLE' });
      expect(result.title).toBe('SYS-001');
    });

    it('returns SYS-001 when message includes ERR_DB_TIMEOUT', () => {
      const result = mapDbError({ message: 'ERR_DB_TIMEOUT: connection timed out' });
      expect(result.title).toBe('SYS-001');
    });

    it('description mentions unavailable', () => {
      const result = mapDbError({ message: 'ERR_DB_UNAVAILABLE' });
      expect(result.description).toMatch(/unavailable/i);
    });
  });

  describe('fallback: unknown errors', () => {
    it('returns generic "Error" title for unknown error messages', () => {
      const result = mapDbError({ message: 'some unknown database error' });
      expect(result.title).toBe('Error');
    });

    it('uses error.message as description when message is present', () => {
      const result = mapDbError({ message: 'custom error text' });
      expect(result.description).toBe('custom error text');
    });

    it('returns fallback description when message is undefined', () => {
      const result = mapDbError({});
      expect(result.description).toBe('An unexpected error occurred.');
    });

    it('returns fallback when only unknown code is provided', () => {
      const result = mapDbError({ code: '99999' });
      expect(result.title).toBe('Error');
    });
  });

  describe('V2.2 trigger format (ERRCODE=P0001)', () => {
    it('returns BUS-001 when message starts with "BUS-001:" (V2.2 trigger format)', () => {
      const result = mapDbError({
        message: 'BUS-001: Animal KE-2024-001 (animal-uuid) is DEAD — modifications are locked.',
        code: 'P0001',
      });
      expect(result.title).toBe('BUS-001');
      expect(result.description).toMatch(/Dead|Dispatched/i);
    });

    it('"BUS-001" prefix takes precedence over 23505 when both present', () => {
      const result = mapDbError({ code: '23505', message: 'BUS-001: locked' });
      expect(result.title).toBe('BUS-001');
    });
  });

  describe('priority ordering', () => {
    it('ERR_INVALID_TRANSITION takes precedence over 23505 code when both present', () => {
      const result = mapDbError({ code: '23505', message: 'ERR_INVALID_TRANSITION and animals_tag_id_org_unique' });
      expect(result.title).toBe('BUS-001');
    });
  });
});
