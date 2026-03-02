import { describe, it, expect } from 'vitest';
import { mapDbError } from '@/lib/errors';

// ─── V2 Block 3 error codes: BUS-006, DAT-007, DAT-008 ───────────────────────

describe('mapDbError — BUS-006 (deactivated ingredient in ration)', () => {
  it('maps 23503 FK violation on ration_ingredients table to BUS-006', () => {
    const result = mapDbError({ code: '23503', message: 'violates FK constraint on ration_ingredients' });
    expect(result.title).toBe('BUS-006');
    expect(result.description).toMatch(/ingredient/i);
  });

  it('maps ERR_DEACTIVATED_INGREDIENT message to BUS-006', () => {
    const result = mapDbError({ message: 'ERR_DEACTIVATED_INGREDIENT' });
    expect(result.title).toBe('BUS-006');
  });

  it('does NOT map 23503 on a non-ration_ingredients table to BUS-006', () => {
    const result = mapDbError({ code: '23503', message: 'violates FK constraint on feeding_details' });
    expect(result.title).not.toBe('BUS-006');
  });
});

describe('mapDbError — DAT-007 (negative ingredient price)', () => {
  it('maps ERR_NEGATIVE_PRICE to DAT-007', () => {
    const result = mapDbError({ message: 'ERR_NEGATIVE_PRICE: new_price must be >= 0' });
    expect(result.title).toBe('DAT-007');
    expect(result.description).toMatch(/negative/i);
  });

  it('maps CHECK constraint violation on price_history new_price to DAT-007', () => {
    const result = mapDbError({ message: 'violates check constraint on new_price in price_history' });
    expect(result.title).toBe('DAT-007');
  });

  it('does NOT trigger DAT-007 for an unrelated message', () => {
    const result = mapDbError({ message: 'some other database error' });
    expect(result.title).not.toBe('DAT-007');
  });
});

describe('mapDbError — DAT-008 (duplicate ration name)', () => {
  it('maps ration_templates_org_name_unique constraint to DAT-008', () => {
    const result = mapDbError({ code: '23505', message: 'duplicate key value violates unique constraint ration_templates_org_name_unique' });
    expect(result.title).toBe('DAT-008');
    expect(result.description).toMatch(/ration/i);
  });

  it('maps ERR_DUPLICATE_RATION to DAT-008', () => {
    const result = mapDbError({ message: 'ERR_DUPLICATE_RATION' });
    expect(result.title).toBe('DAT-008');
  });

  it('does NOT map animals_tag_id_org_unique 23505 to DAT-008', () => {
    const result = mapDbError({ code: '23505', message: 'duplicate key value violates unique constraint animals_tag_id_org_unique' });
    expect(result.title).toBe('DAT-003');
  });
});

describe('mapDbError — fallback for unknown errors', () => {
  it('returns generic Error title for unknown error messages', () => {
    const result = mapDbError({ message: 'completely unknown error' });
    expect(result.title).toBe('Error');
    expect(result.description).toBe('completely unknown error');
  });

  it('handles undefined message gracefully', () => {
    const result = mapDbError({});
    expect(result.title).toBe('Error');
    expect(result.description).toBeTruthy();
  });
});

describe('mapDbError — pre-existing error codes still work after Block 3 additions', () => {
  it('BUS-001: ERR_INVALID_TRANSITION still maps correctly', () => {
    const result = mapDbError({ message: 'ERR_INVALID_TRANSITION: animal is DEAD' });
    expect(result.title).toBe('BUS-001');
  });

  it('DAT-003: animals_tag_id_org_unique still maps correctly', () => {
    const result = mapDbError({ code: '23505', message: 'animals_tag_id_org_unique' });
    expect(result.title).toBe('DAT-003');
  });

  it('BUS-005: ERR_ANIMAL_ALREADY_TERMINAL still maps correctly', () => {
    const result = mapDbError({ message: 'ERR_ANIMAL_ALREADY_TERMINAL' });
    expect(result.title).toBe('BUS-005');
  });
});
