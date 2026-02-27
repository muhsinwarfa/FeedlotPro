// ─── Shared pure validation utilities ──────────────────────────────────────
// Extracted from components for unit testability (no React state dependency).

export interface IntakeFormState {
  tagId: string;
  breed: string;
  penId: string;
  intakeWeight: string;
  intakeDate: string;
}

export interface IntakeFieldErrors {
  tagId?: string;
  breed?: string;
  penId?: string;
  intakeWeight?: string;
  intakeDate?: string;
}

/**
 * Pure validation of intake form state.
 * Extracted from components/animals/intake-form.tsx validate().
 * Does NOT set state — returns an error map for testing and reuse.
 *
 * @param form         Current form field values
 * @param existingTagError  Optional pre-existing tag error (from async duplicate check)
 * @returns            Map of field names to error messages; empty object = valid
 */
export function validateIntakeForm(
  form: IntakeFormState,
  existingTagError?: string
): IntakeFieldErrors {
  const errors: IntakeFieldErrors = {};

  if (!form.tagId.trim()) errors.tagId = 'Tag ID is required.';
  if (!form.breed.trim()) errors.breed = 'Breed is required.';
  if (!form.penId) errors.penId = 'Please select a pen.';

  const weight = parseFloat(form.intakeWeight);
  if (!form.intakeWeight) {
    errors.intakeWeight = 'Intake weight is required.';
  } else if (isNaN(weight) || weight <= 0) {
    errors.intakeWeight = 'Weight must be a positive number.';
  }

  if (!form.intakeDate) errors.intakeDate = 'Intake date is required.';

  // Propagate existing async tag error (duplicate-tag check result)
  if (existingTagError) errors.tagId = existingTagError;

  return errors;
}

/**
 * Pure validation of weight entry fields.
 * Extracted from components/animals/weight-form.tsx validate().
 *
 * @returns Error message string, or empty string if valid.
 */
export function validateWeightEntry(newWeight: string, weighDate: string): string {
  const w = parseFloat(newWeight);
  if (!newWeight) return 'Weight is required.';
  if (isNaN(w) || w <= 0) return 'Weight must be a positive number.';
  if (!weighDate) return 'Date is required.';
  return '';
}
