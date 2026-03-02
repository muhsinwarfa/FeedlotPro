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

// ─── V2 Validators ───────────────────────────────────────────────────────────

const VALID_ROLES = ['OWNER', 'MANAGER', 'FARMHAND', 'VET'] as const;

export interface WorkerFormState {
  displayName: string;
  role: string;
  pin: string;
}

export interface WorkerFieldErrors {
  displayName?: string;
  role?: string;
  pin?: string;
}

/**
 * Validates the "Add Worker" form (P11 Team Management).
 */
export function validateWorkerForm(
  form: WorkerFormState,
  existingPinError?: string
): WorkerFieldErrors {
  const errors: WorkerFieldErrors = {};

  if (!form.displayName.trim()) {
    errors.displayName = 'Display name is required.';
  }

  if (!form.role || !VALID_ROLES.includes(form.role as (typeof VALID_ROLES)[number])) {
    errors.role = 'Please select a valid role.';
  }

  const pinError = validatePin(form.pin);
  if (pinError) errors.pin = pinError;
  if (existingPinError) errors.pin = existingPinError;

  return errors;
}

/**
 * Validates a 4-digit numeric PIN.
 * @returns Error message string, or empty string if valid.
 */
export function validatePin(pin: string): string {
  if (!pin) return 'PIN is required.';
  if (!/^\d{4}$/.test(pin)) return 'PIN must be exactly 4 digits.';
  return '';
}

export interface BatchFormState {
  batchCode: string;
  arrivalDate: string;
  sourceSupplier: string;
}

export interface BatchFieldErrors {
  batchCode?: string;
  arrivalDate?: string;
}

/**
 * Validates the batch creation form (P5 Enhanced Intake).
 */
export function validateBatchForm(form: BatchFormState): BatchFieldErrors {
  const errors: BatchFieldErrors = {};

  if (!form.batchCode.trim()) {
    errors.batchCode = 'Batch code is required.';
  }

  if (!form.arrivalDate) {
    errors.arrivalDate = 'Arrival date is required.';
  } else {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const arrival = new Date(form.arrivalDate);
    if (arrival > today) {
      errors.arrivalDate = 'Arrival date cannot be in the future.';
    }
  }

  return errors;
}

// ─── V2 Block 2 Validators ────────────────────────────────────────────────────

const VALID_SYMPTOMS = [
  'Bloat', 'Lameness', 'Respiratory Distress', 'Diarrhea',
  'Eye Infection', 'Skin Condition', 'Loss of Appetite', 'Other',
] as const;

const VALID_SEVERITIES = ['MILD', 'MODERATE', 'SEVERE'] as const;
const VALID_ADMIN_ROUTES = [
  'ORAL', 'INJECTION_IM', 'INJECTION_IV', 'INJECTION_SC', 'TOPICAL', 'DRENCH',
] as const;

export interface FlagSickFormState {
  primarySymptom: string;
  severity: string;
  sickPenId: string;
  notes: string;
}

export interface FlagSickFieldErrors {
  primarySymptom?: string;
  severity?: string;
  sickPenId?: string;
}

/**
 * Validates the "Flag Animal Sick" form (P6 Health Workflow).
 */
export function validateFlagSickForm(form: FlagSickFormState): FlagSickFieldErrors {
  const errors: FlagSickFieldErrors = {};

  if (!form.primarySymptom || !VALID_SYMPTOMS.includes(form.primarySymptom as (typeof VALID_SYMPTOMS)[number])) {
    errors.primarySymptom = 'Please select a primary symptom.';
  }

  if (!form.severity || !VALID_SEVERITIES.includes(form.severity as (typeof VALID_SEVERITIES)[number])) {
    errors.severity = 'Please select a severity level.';
  }

  if (!form.sickPenId) {
    errors.sickPenId = 'Please select a pen to move the animal to.';
  }

  return errors;
}

export interface TreatmentFormState {
  medicationName: string;
  dosage: string;
  administrationRoute: string;
  treatmentCost: string;
  notes: string;
  followUpDate: string;
}

export interface TreatmentFieldErrors {
  medicationName?: string;
  dosage?: string;
  administrationRoute?: string;
  treatmentCost?: string;
}

/**
 * Validates the "Record Treatment" form (P6 Vet Workflow).
 */
export function validateTreatmentForm(form: TreatmentFormState): TreatmentFieldErrors {
  const errors: TreatmentFieldErrors = {};

  if (!form.medicationName.trim()) {
    errors.medicationName = 'Medication name is required.';
  }

  if (!form.dosage.trim()) {
    errors.dosage = 'Dosage is required.';
  }

  if (
    !form.administrationRoute ||
    !VALID_ADMIN_ROUTES.includes(form.administrationRoute as (typeof VALID_ADMIN_ROUTES)[number])
  ) {
    errors.administrationRoute = 'Please select an administration route.';
  }

  if (form.treatmentCost) {
    const cost = parseFloat(form.treatmentCost);
    if (isNaN(cost) || cost < 0) {
      errors.treatmentCost = 'Treatment cost must be a positive number.';
    }
  }

  return errors;
}

const VALID_GENDERS = ['BULL', 'HEIFER', 'STEER', 'COW'] as const;
const VALID_AGE_CATEGORIES = ['CALF', 'WEANER', 'GROWER', 'FINISHER'] as const;

export interface IntakeFormV2State extends IntakeFormState {
  gender: string;
  ageCategory: string;
  batchId: string;
  sourceSupplier: string;
}

export interface IntakeV2FieldErrors extends IntakeFieldErrors {
  gender?: string;
  ageCategory?: string;
}

/**
 * V2 validation of intake form — extends V1 with optional gender/ageCategory checks.
 * The original validateIntakeForm() is preserved unchanged for V1 test compatibility.
 */
export function validateIntakeFormV2(
  form: IntakeFormV2State,
  existingTagError?: string
): IntakeV2FieldErrors {
  // Run base V1 validation
  const errors: IntakeV2FieldErrors = validateIntakeForm(form, existingTagError);

  // V2: gender is optional but if provided must be a valid enum value
  if (form.gender && !VALID_GENDERS.includes(form.gender as (typeof VALID_GENDERS)[number])) {
    errors.gender = 'Please select a valid gender.';
  }

  // V2: age category is optional but if provided must be a valid enum value
  if (
    form.ageCategory &&
    !VALID_AGE_CATEGORIES.includes(form.ageCategory as (typeof VALID_AGE_CATEGORIES)[number])
  ) {
    errors.ageCategory = 'Please select a valid age category.';
  }

  return errors;
}

// ─── V2 Block 3 Validators ───────────────────────────────────────────────────

// P8A: Ingredient price update form
export interface PriceFormState {
  pricePerKg: string;
}
export interface PriceFieldErrors {
  pricePerKg?: string;
}
/**
 * Validates the ingredient price update form (P8A).
 * Price is required and must be >= 0 (zero is valid for free inputs).
 */
export function validatePriceForm(form: PriceFormState): PriceFieldErrors {
  const errors: PriceFieldErrors = {};
  if (!form.pricePerKg.trim()) {
    errors.pricePerKg = 'Price is required.';
  } else {
    const price = parseFloat(form.pricePerKg);
    if (isNaN(price) || price < 0) {
      errors.pricePerKg = 'DAT-007: Price must be zero or a positive number.';
    }
  }
  return errors;
}

// P8B: Feed purchase recording form
export interface PurchaseFormState {
  ingredientId: string;
  quantityKg: string;
  totalCost: string;
  purchaseDate: string;
  notes: string;
}
export interface PurchaseFieldErrors {
  ingredientId?: string;
  quantityKg?: string;
  totalCost?: string;
  purchaseDate?: string;
}
/**
 * Validates the "Record Purchase" form (P8B).
 */
export function validatePurchaseForm(form: PurchaseFormState): PurchaseFieldErrors {
  const errors: PurchaseFieldErrors = {};

  if (!form.ingredientId) {
    errors.ingredientId = 'Please select an ingredient.';
  }

  if (!form.quantityKg.trim()) {
    errors.quantityKg = 'Quantity is required.';
  } else {
    const qty = parseFloat(form.quantityKg);
    if (isNaN(qty) || qty <= 0) {
      errors.quantityKg = 'Quantity must be a positive number.';
    }
  }

  if (!form.totalCost.trim()) {
    errors.totalCost = 'Total cost is required.';
  } else {
    const cost = parseFloat(form.totalCost);
    if (isNaN(cost) || cost <= 0) {
      errors.totalCost = 'Total cost must be a positive number.';
    }
  }

  if (!form.purchaseDate) {
    errors.purchaseDate = 'Purchase date is required.';
  }

  return errors;
}

// P8C: Ration template header form
export interface RationFormState {
  rationName: string;
  notes: string;
}
export interface RationFieldErrors {
  rationName?: string;
}
/**
 * Validates the ration template header form (P8C).
 * Uniqueness (DAT-008) is validated asynchronously via DB constraint.
 */
export function validateRationForm(form: RationFormState): RationFieldErrors {
  const errors: RationFieldErrors = {};
  if (!form.rationName.trim()) {
    errors.rationName = 'Ration name is required.';
  }
  return errors;
}

// P8C: Individual ingredient row within a ration template
export interface RationIngredientRowState {
  ingredientId: string;
  kgPerAnimalPerDay: string;
}
export interface RationIngredientRowErrors {
  ingredientId?: string;
  kgPerAnimalPerDay?: string;
}
/**
 * Validates a single ingredient row in a ration template (P8C).
 */
export function validateRationIngredientRow(
  row: RationIngredientRowState
): RationIngredientRowErrors {
  const errors: RationIngredientRowErrors = {};
  if (!row.ingredientId) {
    errors.ingredientId = 'Please select an ingredient.';
  }
  if (!row.kgPerAnimalPerDay.trim()) {
    errors.kgPerAnimalPerDay = 'Amount is required.';
  } else {
    const kg = parseFloat(row.kgPerAnimalPerDay);
    if (isNaN(kg) || kg <= 0) {
      errors.kgPerAnimalPerDay = 'Amount must be a positive number.';
    }
  }
  return errors;
}
