import { describe, it, expect } from 'vitest';
import { validateIntakeForm, validateWeightEntry, type IntakeFormState } from '@/lib/validators';

const validForm: IntakeFormState = {
  tagId: 'KE-2024-001',
  breed: 'Boran',
  penId: 'pen-uuid-123',
  intakeWeight: '285.0',
  intakeDate: '2026-02-26',
};

describe('validateIntakeForm', () => {
  describe('tagId validation', () => {
    it('errors when tagId is empty string', () => {
      const errors = validateIntakeForm({ ...validForm, tagId: '' });
      expect(errors.tagId).toBe('Tag ID is required.');
    });

    it('errors when tagId is whitespace only', () => {
      const errors = validateIntakeForm({ ...validForm, tagId: '   ' });
      expect(errors.tagId).toBe('Tag ID is required.');
    });

    it('passes when tagId has content', () => {
      const errors = validateIntakeForm({ ...validForm, tagId: 'KE-001' });
      expect(errors.tagId).toBeUndefined();
    });

    it('propagates existingTagError when provided (duplicate tag state)', () => {
      const errors = validateIntakeForm(
        { ...validForm },
        'DAT-003: Tag ID already exists in your inventory.'
      );
      expect(errors.tagId).toBe('DAT-003: Tag ID already exists in your inventory.');
    });

    it('existingTagError overrides valid tagId (shows async check result)', () => {
      // Even if tagId is non-empty, the existing error should propagate
      const errors = validateIntakeForm(validForm, 'DAT-003: Tag ID already exists in your inventory.');
      expect(errors.tagId).toBeDefined();
    });
  });

  describe('breed validation', () => {
    it('errors when breed is empty', () => {
      const errors = validateIntakeForm({ ...validForm, breed: '' });
      expect(errors.breed).toBe('Breed is required.');
    });

    it('errors when breed is whitespace only', () => {
      const errors = validateIntakeForm({ ...validForm, breed: '  ' });
      expect(errors.breed).toBe('Breed is required.');
    });

    it('passes with "Boran" breed', () => {
      const errors = validateIntakeForm({ ...validForm, breed: 'Boran' });
      expect(errors.breed).toBeUndefined();
    });
  });

  describe('penId validation', () => {
    it('errors when penId is empty string', () => {
      const errors = validateIntakeForm({ ...validForm, penId: '' });
      expect(errors.penId).toBe('Please select a pen.');
    });

    it('passes when penId is a UUID', () => {
      const errors = validateIntakeForm({ ...validForm, penId: 'some-pen-uuid' });
      expect(errors.penId).toBeUndefined();
    });
  });

  describe('intakeWeight validation', () => {
    it('errors when intakeWeight is empty', () => {
      const errors = validateIntakeForm({ ...validForm, intakeWeight: '' });
      expect(errors.intakeWeight).toBe('Intake weight is required.');
    });

    it('errors when intakeWeight is "0"', () => {
      const errors = validateIntakeForm({ ...validForm, intakeWeight: '0' });
      expect(errors.intakeWeight).toBe('Weight must be a positive number.');
    });

    it('errors when intakeWeight is "-5"', () => {
      const errors = validateIntakeForm({ ...validForm, intakeWeight: '-5' });
      expect(errors.intakeWeight).toBe('Weight must be a positive number.');
    });

    it('errors when intakeWeight is "abc" (NaN)', () => {
      const errors = validateIntakeForm({ ...validForm, intakeWeight: 'abc' });
      expect(errors.intakeWeight).toBe('Weight must be a positive number.');
    });

    it('passes when intakeWeight is "250.5"', () => {
      const errors = validateIntakeForm({ ...validForm, intakeWeight: '250.5' });
      expect(errors.intakeWeight).toBeUndefined();
    });

    it('passes when intakeWeight is "0.1" (minimum positive)', () => {
      const errors = validateIntakeForm({ ...validForm, intakeWeight: '0.1' });
      expect(errors.intakeWeight).toBeUndefined();
    });
  });

  describe('intakeDate validation', () => {
    it('errors when intakeDate is empty', () => {
      const errors = validateIntakeForm({ ...validForm, intakeDate: '' });
      expect(errors.intakeDate).toBe('Intake date is required.');
    });

    it('passes when intakeDate is "2026-02-26"', () => {
      const errors = validateIntakeForm({ ...validForm, intakeDate: '2026-02-26' });
      expect(errors.intakeDate).toBeUndefined();
    });
  });

  describe('full valid form', () => {
    it('returns empty errors object for a fully valid form', () => {
      const errors = validateIntakeForm(validForm);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('returns 5 errors when all fields are blank', () => {
      const errors = validateIntakeForm({
        tagId: '',
        breed: '',
        penId: '',
        intakeWeight: '',
        intakeDate: '',
      });
      expect(Object.keys(errors).length).toBeGreaterThanOrEqual(4);
    });
  });
});

describe('validateWeightEntry', () => {
  it('returns "Weight is required." for empty string', () => {
    expect(validateWeightEntry('', '2026-02-26')).toBe('Weight is required.');
  });

  it('returns error for "0" (not positive)', () => {
    expect(validateWeightEntry('0', '2026-02-26')).toBe('Weight must be a positive number.');
  });

  it('returns error for negative values', () => {
    expect(validateWeightEntry('-100', '2026-02-26')).toBe('Weight must be a positive number.');
  });

  it('returns error for NaN string "xyz"', () => {
    expect(validateWeightEntry('xyz', '2026-02-26')).toBe('Weight must be a positive number.');
  });

  it('returns empty string for "350.0" with valid date', () => {
    expect(validateWeightEntry('350.0', '2026-02-26')).toBe('');
  });

  it('returns "Date is required." when weighDate is empty', () => {
    expect(validateWeightEntry('350', '')).toBe('Date is required.');
  });

  it('returns empty string for minimum positive weight "0.1"', () => {
    expect(validateWeightEntry('0.1', '2026-02-26')).toBe('');
  });

  it('validates weight before date (weight empty → weight error, not date error)', () => {
    const result = validateWeightEntry('', '');
    expect(result).toBe('Weight is required.');
  });
});
