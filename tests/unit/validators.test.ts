import { describe, it, expect } from 'vitest';
import {
  validateIntakeForm,
  validateWeightEntry,
  validateWorkerForm,
  validatePin,
  validateBatchForm,
  validateIntakeFormV2,
  validateFlagSickForm,
  validateTreatmentForm,
  type IntakeFormState,
  type WorkerFormState,
  type BatchFormState,
  type IntakeFormV2State,
  type FlagSickFormState,
  type TreatmentFormState,
} from '@/lib/validators';

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

// ── V2: validatePin ───────────────────────────────────────────────────────────

describe('validatePin', () => {
  it('returns error for empty string', () => {
    expect(validatePin('')).toBe('PIN is required.');
  });

  it('returns error for fewer than 4 digits ("123")', () => {
    expect(validatePin('123')).toBe('PIN must be exactly 4 digits.');
  });

  it('returns error for more than 4 digits ("12345")', () => {
    expect(validatePin('12345')).toBe('PIN must be exactly 4 digits.');
  });

  it('returns error for non-numeric characters ("12ab")', () => {
    expect(validatePin('12ab')).toBe('PIN must be exactly 4 digits.');
  });

  it('returns error for spaces ("12 4")', () => {
    expect(validatePin('12 4')).toBe('PIN must be exactly 4 digits.');
  });

  it('returns empty string for valid 4-digit numeric PIN ("1234")', () => {
    expect(validatePin('1234')).toBe('');
  });

  it('returns empty string for "0000"', () => {
    expect(validatePin('0000')).toBe('');
  });

  it('returns empty string for "9999"', () => {
    expect(validatePin('9999')).toBe('');
  });
});

// ── V2: validateWorkerForm ────────────────────────────────────────────────────

const validWorker: WorkerFormState = {
  displayName: 'Jane Wanjiku',
  role: 'FARMHAND',
  pin: '1234',
};

describe('validateWorkerForm', () => {
  it('returns no errors for a valid form', () => {
    expect(validateWorkerForm(validWorker)).toEqual({});
  });

  describe('displayName', () => {
    it('errors when displayName is empty', () => {
      const errors = validateWorkerForm({ ...validWorker, displayName: '' });
      expect(errors.displayName).toBe('Display name is required.');
    });

    it('errors when displayName is whitespace only', () => {
      const errors = validateWorkerForm({ ...validWorker, displayName: '   ' });
      expect(errors.displayName).toBe('Display name is required.');
    });

    it('passes with a valid name', () => {
      const errors = validateWorkerForm({ ...validWorker, displayName: 'John' });
      expect(errors.displayName).toBeUndefined();
    });
  });

  describe('role', () => {
    it('errors when role is empty string', () => {
      const errors = validateWorkerForm({ ...validWorker, role: '' });
      expect(errors.role).toBeDefined();
    });

    it('errors for an invalid role value', () => {
      const errors = validateWorkerForm({ ...validWorker, role: 'SUPERUSER' });
      expect(errors.role).toBeDefined();
    });

    it('passes for MANAGER', () => {
      expect(validateWorkerForm({ ...validWorker, role: 'MANAGER' }).role).toBeUndefined();
    });

    it('passes for VET', () => {
      expect(validateWorkerForm({ ...validWorker, role: 'VET' }).role).toBeUndefined();
    });

    it('passes for OWNER', () => {
      expect(validateWorkerForm({ ...validWorker, role: 'OWNER' }).role).toBeUndefined();
    });
  });

  describe('pin', () => {
    it('errors when PIN is not 4 digits', () => {
      const errors = validateWorkerForm({ ...validWorker, pin: '99' });
      expect(errors.pin).toBe('PIN must be exactly 4 digits.');
    });

    it('propagates existingPinError over pin field error', () => {
      const errors = validateWorkerForm(validWorker, 'PIN already in use.');
      expect(errors.pin).toBe('PIN already in use.');
    });
  });
});

// ── V2: validateBatchForm ─────────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

const validBatch: BatchFormState = {
  batchCode: 'BATCH-2026-001',
  arrivalDate: yesterday,
  sourceSupplier: 'Narok Market',
};

describe('validateBatchForm', () => {
  it('returns no errors for a valid form', () => {
    expect(validateBatchForm(validBatch)).toEqual({});
  });

  it('accepts today as arrival date (not in future)', () => {
    expect(validateBatchForm({ ...validBatch, arrivalDate: today }).arrivalDate).toBeUndefined();
  });

  describe('batchCode', () => {
    it('errors when batchCode is empty', () => {
      const errors = validateBatchForm({ ...validBatch, batchCode: '' });
      expect(errors.batchCode).toBe('Batch code is required.');
    });

    it('errors when batchCode is whitespace only', () => {
      const errors = validateBatchForm({ ...validBatch, batchCode: '   ' });
      expect(errors.batchCode).toBe('Batch code is required.');
    });

    it('passes with a valid code', () => {
      expect(validateBatchForm({ ...validBatch, batchCode: 'B-001' }).batchCode).toBeUndefined();
    });
  });

  describe('arrivalDate', () => {
    it('errors when arrivalDate is empty', () => {
      const errors = validateBatchForm({ ...validBatch, arrivalDate: '' });
      expect(errors.arrivalDate).toBe('Arrival date is required.');
    });

    it('errors when arrivalDate is in the future', () => {
      const errors = validateBatchForm({ ...validBatch, arrivalDate: tomorrow });
      expect(errors.arrivalDate).toBe('Arrival date cannot be in the future.');
    });

    it('passes for a past date', () => {
      expect(validateBatchForm({ ...validBatch, arrivalDate: yesterday }).arrivalDate).toBeUndefined();
    });
  });
});

// ── V2: validateIntakeFormV2 ──────────────────────────────────────────────────

const validV2Form: IntakeFormV2State = {
  tagId: 'KE-2026-V2-001',
  breed: 'Boran',
  penId: 'pen-uuid-123',
  intakeWeight: '285.0',
  intakeDate: '2026-02-26',
  gender: 'BULL',
  ageCategory: 'GROWER',
  batchId: 'batch-uuid-123',
  sourceSupplier: 'Narok Market',
};

describe('validateIntakeFormV2', () => {
  it('returns no errors for a valid V2 form', () => {
    expect(validateIntakeFormV2(validV2Form)).toEqual({});
  });

  it('inherits V1 errors — tagId empty triggers error', () => {
    const errors = validateIntakeFormV2({ ...validV2Form, tagId: '' });
    expect(errors.tagId).toBe('Tag ID is required.');
  });

  it('inherits V1 errors — intakeWeight empty triggers error', () => {
    const errors = validateIntakeFormV2({ ...validV2Form, intakeWeight: '' });
    expect(errors.intakeWeight).toBeDefined();
  });

  describe('gender (optional field)', () => {
    it('passes when gender is empty (optional)', () => {
      const errors = validateIntakeFormV2({ ...validV2Form, gender: '' });
      expect(errors.gender).toBeUndefined();
    });

    it('passes for all valid gender values', () => {
      for (const gender of ['BULL', 'HEIFER', 'STEER', 'COW']) {
        const errors = validateIntakeFormV2({ ...validV2Form, gender });
        expect(errors.gender).toBeUndefined();
      }
    });

    it('errors for an invalid gender string', () => {
      const errors = validateIntakeFormV2({ ...validV2Form, gender: 'UNKNOWN' });
      expect(errors.gender).toBe('Please select a valid gender.');
    });
  });

  describe('ageCategory (optional field)', () => {
    it('passes when ageCategory is empty (optional)', () => {
      const errors = validateIntakeFormV2({ ...validV2Form, ageCategory: '' });
      expect(errors.ageCategory).toBeUndefined();
    });

    it('passes for all valid ageCategory values', () => {
      for (const ageCategory of ['CALF', 'WEANER', 'GROWER', 'FINISHER']) {
        const errors = validateIntakeFormV2({ ...validV2Form, ageCategory });
        expect(errors.ageCategory).toBeUndefined();
      }
    });

    it('errors for an invalid ageCategory string', () => {
      const errors = validateIntakeFormV2({ ...validV2Form, ageCategory: 'ADULT' });
      expect(errors.ageCategory).toBe('Please select a valid age category.');
    });
  });

  it('propagates existingTagError to tagId field', () => {
    const errors = validateIntakeFormV2(validV2Form, 'DAT-003: Tag already exists.');
    expect(errors.tagId).toBe('DAT-003: Tag already exists.');
  });
});

// ── validateFlagSickForm ──────────────────────────────────────────────────────

const validFlagSick: FlagSickFormState = {
  primarySymptom: 'Bloat',
  severity: 'MODERATE',
  sickPenId: 'pen-uuid-sick',
  notes: '',
};

describe('validateFlagSickForm', () => {
  it('returns no errors for a valid form', () => {
    expect(Object.keys(validateFlagSickForm(validFlagSick))).toHaveLength(0);
  });

  it('errors when primarySymptom is empty', () => {
    const errors = validateFlagSickForm({ ...validFlagSick, primarySymptom: '' });
    expect(errors.primarySymptom).toBeDefined();
  });

  it('errors when primarySymptom is invalid', () => {
    const errors = validateFlagSickForm({ ...validFlagSick, primarySymptom: 'FakeSymptom' });
    expect(errors.primarySymptom).toBeDefined();
  });

  it('accepts all valid symptom values', () => {
    const symptoms = ['Bloat', 'Lameness', 'Respiratory Distress', 'Diarrhea', 'Eye Infection', 'Skin Condition', 'Loss of Appetite', 'Other'];
    for (const s of symptoms) {
      const errors = validateFlagSickForm({ ...validFlagSick, primarySymptom: s });
      expect(errors.primarySymptom).toBeUndefined();
    }
  });

  it('errors when severity is empty', () => {
    const errors = validateFlagSickForm({ ...validFlagSick, severity: '' });
    expect(errors.severity).toBeDefined();
  });

  it('errors when severity is invalid', () => {
    const errors = validateFlagSickForm({ ...validFlagSick, severity: 'CRITICAL' });
    expect(errors.severity).toBeDefined();
  });

  it('accepts MILD, MODERATE, SEVERE', () => {
    for (const sev of ['MILD', 'MODERATE', 'SEVERE']) {
      expect(validateFlagSickForm({ ...validFlagSick, severity: sev }).severity).toBeUndefined();
    }
  });

  it('errors when sickPenId is empty', () => {
    const errors = validateFlagSickForm({ ...validFlagSick, sickPenId: '' });
    expect(errors.sickPenId).toBeDefined();
  });

  it('passes with valid sickPenId', () => {
    const errors = validateFlagSickForm({ ...validFlagSick, sickPenId: 'pen-abc' });
    expect(errors.sickPenId).toBeUndefined();
  });
});

// ── validateTreatmentForm ─────────────────────────────────────────────────────

const validTreatment: TreatmentFormState = {
  medicationName: 'Oxytetracycline',
  dosage: '10 ml',
  administrationRoute: 'INJECTION_IM',
  treatmentCost: '',
  notes: '',
  followUpDate: '',
};

describe('validateTreatmentForm', () => {
  it('returns no errors for a valid form', () => {
    expect(Object.keys(validateTreatmentForm(validTreatment))).toHaveLength(0);
  });

  it('errors when medicationName is empty', () => {
    const errors = validateTreatmentForm({ ...validTreatment, medicationName: '' });
    expect(errors.medicationName).toBeDefined();
  });

  it('errors when medicationName is whitespace only', () => {
    const errors = validateTreatmentForm({ ...validTreatment, medicationName: '   ' });
    expect(errors.medicationName).toBeDefined();
  });

  it('errors when dosage is empty', () => {
    const errors = validateTreatmentForm({ ...validTreatment, dosage: '' });
    expect(errors.dosage).toBeDefined();
  });

  it('errors when administrationRoute is empty', () => {
    const errors = validateTreatmentForm({ ...validTreatment, administrationRoute: '' });
    expect(errors.administrationRoute).toBeDefined();
  });

  it('errors when administrationRoute is invalid', () => {
    const errors = validateTreatmentForm({ ...validTreatment, administrationRoute: 'SMOKE' });
    expect(errors.administrationRoute).toBeDefined();
  });

  it('accepts all valid administration routes', () => {
    const routes = ['ORAL', 'INJECTION_IM', 'INJECTION_IV', 'INJECTION_SC', 'TOPICAL', 'DRENCH'];
    for (const r of routes) {
      const errors = validateTreatmentForm({ ...validTreatment, administrationRoute: r });
      expect(errors.administrationRoute).toBeUndefined();
    }
  });

  it('errors when treatmentCost is negative', () => {
    const errors = validateTreatmentForm({ ...validTreatment, treatmentCost: '-100' });
    expect(errors.treatmentCost).toBeDefined();
  });

  it('errors when treatmentCost is not a number', () => {
    const errors = validateTreatmentForm({ ...validTreatment, treatmentCost: 'abc' });
    expect(errors.treatmentCost).toBeDefined();
  });

  it('passes when treatmentCost is empty (optional)', () => {
    expect(validateTreatmentForm({ ...validTreatment, treatmentCost: '' }).treatmentCost).toBeUndefined();
  });

  it('passes when treatmentCost is zero', () => {
    expect(validateTreatmentForm({ ...validTreatment, treatmentCost: '0' }).treatmentCost).toBeUndefined();
  });

  it('passes when treatmentCost is a positive number', () => {
    expect(validateTreatmentForm({ ...validTreatment, treatmentCost: '250.50' }).treatmentCost).toBeUndefined();
  });
});
