import { describe, it, expect } from 'vitest';
import {
  validatePriceForm,
  validatePurchaseForm,
  validateRationForm,
  validateRationIngredientRow,
  type PriceFormState,
  type PurchaseFormState,
  type RationFormState,
  type RationIngredientRowState,
} from '@/lib/validators';

// ─── validatePriceForm ────────────────────────────────────────────────────────

const validPrice: PriceFormState = { pricePerKg: '45.50' };

describe('validatePriceForm', () => {
  it('errors when pricePerKg is empty', () => {
    const e = validatePriceForm({ pricePerKg: '' });
    expect(e.pricePerKg).toBe('Price is required.');
  });

  it('errors when pricePerKg is whitespace only', () => {
    const e = validatePriceForm({ pricePerKg: '   ' });
    expect(e.pricePerKg).toBe('Price is required.');
  });

  it('errors when pricePerKg is NaN (non-numeric string)', () => {
    const e = validatePriceForm({ pricePerKg: 'abc' });
    expect(e.pricePerKg).toMatch(/DAT-007/);
  });

  it('errors when pricePerKg is negative', () => {
    const e = validatePriceForm({ pricePerKg: '-1' });
    expect(e.pricePerKg).toMatch(/DAT-007/);
  });

  it('passes when pricePerKg is "0" (free ingredient)', () => {
    const e = validatePriceForm({ pricePerKg: '0' });
    expect(e.pricePerKg).toBeUndefined();
  });

  it('passes when pricePerKg is a valid positive number', () => {
    const e = validatePriceForm(validPrice);
    expect(e.pricePerKg).toBeUndefined();
  });

  it('returns empty errors object for valid input', () => {
    const e = validatePriceForm(validPrice);
    expect(Object.keys(e)).toHaveLength(0);
  });
});

// ─── validatePurchaseForm ─────────────────────────────────────────────────────

const validPurchase: PurchaseFormState = {
  ingredientId: 'ing-uuid-123',
  quantityKg: '500',
  totalCost: '25000',
  purchaseDate: '2026-03-01',
  notes: 'Bulk buy',
};

describe('validatePurchaseForm', () => {
  it('errors when ingredientId is missing', () => {
    const e = validatePurchaseForm({ ...validPurchase, ingredientId: '' });
    expect(e.ingredientId).toBeTruthy();
  });

  it('errors when quantityKg is empty', () => {
    const e = validatePurchaseForm({ ...validPurchase, quantityKg: '' });
    expect(e.quantityKg).toBeTruthy();
  });

  it('errors when quantityKg is zero', () => {
    const e = validatePurchaseForm({ ...validPurchase, quantityKg: '0' });
    expect(e.quantityKg).toBeTruthy();
  });

  it('errors when quantityKg is negative', () => {
    const e = validatePurchaseForm({ ...validPurchase, quantityKg: '-10' });
    expect(e.quantityKg).toBeTruthy();
  });

  it('errors when quantityKg is non-numeric', () => {
    const e = validatePurchaseForm({ ...validPurchase, quantityKg: 'abc' });
    expect(e.quantityKg).toBeTruthy();
  });

  it('errors when totalCost is empty', () => {
    const e = validatePurchaseForm({ ...validPurchase, totalCost: '' });
    expect(e.totalCost).toBeTruthy();
  });

  it('errors when totalCost is zero', () => {
    const e = validatePurchaseForm({ ...validPurchase, totalCost: '0' });
    expect(e.totalCost).toBeTruthy();
  });

  it('errors when totalCost is negative', () => {
    const e = validatePurchaseForm({ ...validPurchase, totalCost: '-500' });
    expect(e.totalCost).toBeTruthy();
  });

  it('errors when purchaseDate is missing', () => {
    const e = validatePurchaseForm({ ...validPurchase, purchaseDate: '' });
    expect(e.purchaseDate).toBeTruthy();
  });

  it('passes for completely valid input', () => {
    const e = validatePurchaseForm(validPurchase);
    expect(Object.keys(e)).toHaveLength(0);
  });

  it('passes with empty notes (notes is optional)', () => {
    const e = validatePurchaseForm({ ...validPurchase, notes: '' });
    expect(Object.keys(e)).toHaveLength(0);
  });
});

// ─── validateRationForm ───────────────────────────────────────────────────────

const validRation: RationFormState = { rationName: 'Starter Mix', notes: '' };

describe('validateRationForm', () => {
  it('errors when rationName is empty', () => {
    const e = validateRationForm({ ...validRation, rationName: '' });
    expect(e.rationName).toBe('Ration name is required.');
  });

  it('errors when rationName is whitespace only', () => {
    const e = validateRationForm({ ...validRation, rationName: '   ' });
    expect(e.rationName).toBe('Ration name is required.');
  });

  it('passes when rationName is a valid non-empty string', () => {
    const e = validateRationForm(validRation);
    expect(e.rationName).toBeUndefined();
  });

  it('returns empty errors object for valid input', () => {
    const e = validateRationForm(validRation);
    expect(Object.keys(e)).toHaveLength(0);
  });

  it('passes when notes is empty (optional field)', () => {
    const e = validateRationForm({ rationName: 'Finisher', notes: '' });
    expect(Object.keys(e)).toHaveLength(0);
  });
});

// ─── validateRationIngredientRow ──────────────────────────────────────────────

const validRow: RationIngredientRowState = {
  ingredientId: 'ing-uuid-456',
  kgPerAnimalPerDay: '3.5',
};

describe('validateRationIngredientRow', () => {
  it('errors when ingredientId is missing', () => {
    const e = validateRationIngredientRow({ ...validRow, ingredientId: '' });
    expect(e.ingredientId).toBeTruthy();
  });

  it('errors when kgPerAnimalPerDay is empty', () => {
    const e = validateRationIngredientRow({ ...validRow, kgPerAnimalPerDay: '' });
    expect(e.kgPerAnimalPerDay).toBeTruthy();
  });

  it('errors when kgPerAnimalPerDay is zero', () => {
    const e = validateRationIngredientRow({ ...validRow, kgPerAnimalPerDay: '0' });
    expect(e.kgPerAnimalPerDay).toBeTruthy();
  });

  it('errors when kgPerAnimalPerDay is negative', () => {
    const e = validateRationIngredientRow({ ...validRow, kgPerAnimalPerDay: '-2' });
    expect(e.kgPerAnimalPerDay).toBeTruthy();
  });

  it('errors when kgPerAnimalPerDay is non-numeric', () => {
    const e = validateRationIngredientRow({ ...validRow, kgPerAnimalPerDay: 'abc' });
    expect(e.kgPerAnimalPerDay).toBeTruthy();
  });

  it('passes for a valid row', () => {
    const e = validateRationIngredientRow(validRow);
    expect(Object.keys(e)).toHaveLength(0);
  });

  it('passes with fractional kgPerAnimalPerDay', () => {
    const e = validateRationIngredientRow({ ...validRow, kgPerAnimalPerDay: '0.5' });
    expect(Object.keys(e)).toHaveLength(0);
  });
});
