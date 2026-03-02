export interface ToastPayload {
  title: string;
  description: string;
}

interface DbError {
  message?: string;
  code?: string;
}

/**
 * Maps Supabase/PostgreSQL errors to user-facing toast messages.
 *
 * V1 sources:
 *  - ERR_INVALID_TRANSITION: raised by trg_animal_status_safeguard (triggers.sql:57)
 *    → BUS-001: Record Locked (animal is DEAD or DISPATCHED)
 *  - 23505 unique_violation: raised by animals_tag_id_org_unique index
 *    → DAT-003: Tag ID already exists in this organization's inventory
 *  - ERR_NEGATIVE_WEIGHT → DAT-001
 *  - ERR_PEN_DEACTIVATED → BUS-002 / BUS-003
 *  - ERR_EMPTY_PEN → BUS-004
 *  - ERR_ALL_BLANKS → DAT-002
 *  - ERR_DB_UNAVAILABLE / ERR_DB_TIMEOUT → SYS-001
 *
 * V2 additions:
 *  - ERR_PIN_LOCKED: trg_pin_lockout fires, member.status = LOCKED → SEC-001
 *  - ERR_INSUFFICIENT_ROLE → SEC-002
 *  - batches_org_code_unique (23505 on batches) → DAT-004
 *  - ERR_INVALID_PIN / DAT-005 → DAT-005
 */
export function mapDbError(error: DbError): ToastPayload {
  if (error.message?.includes('ERR_INVALID_TRANSITION')) {
    return {
      title: 'BUS-001',
      description: 'Error: Record Locked (Animal Dead/Dispatched)',
    };
  }

  // Check specific 23505 constraint names BEFORE the generic 23505 catch-all

  // DAT-004: duplicate batch code
  if (
    error.message?.includes('batches_org_code_unique') ||
    error.message?.includes('ERR_DUPLICATE_BATCH')
  ) {
    return {
      title: 'DAT-004',
      description: 'A batch with this code already exists for your organisation.',
    };
  }

  // DAT-008: duplicate ration name
  if (
    error.message?.includes('ration_templates_org_name_unique') ||
    error.message?.includes('ERR_DUPLICATE_RATION')
  ) {
    return {
      title: 'DAT-008',
      description: 'A ration with this name already exists. Choose a different name.',
    };
  }

  // DAT-003: duplicate tag ID (generic 23505 catch-all for animals)
  if (
    error.code === '23505' ||
    error.message?.includes('animals_tag_id_org_unique') ||
    error.message?.includes('ERR_DUPLICATE_TAG')
  ) {
    return {
      title: 'DAT-003',
      description: 'Error: Tag ID already exists in your inventory.',
    };
  }

  if (error.message?.includes('ERR_NEGATIVE_WEIGHT')) {
    return {
      title: 'DAT-001',
      description: 'Error: Weight must be a positive number.',
    };
  }

  if (error.message?.includes('ERR_PEN_DEACTIVATED')) {
    return {
      title: 'BUS-002',
      description: 'Error: This pen is deactivated. Choose another pen.',
    };
  }

  if (error.message?.includes('ERR_EMPTY_PEN')) {
    return {
      title: 'BUS-004',
      description: 'Error: This pen has no active animals. Add animals first.',
    };
  }

  if (error.message?.includes('ERR_ALL_BLANKS')) {
    return {
      title: 'DAT-002',
      description: 'Error: Enter at least one ingredient amount.',
    };
  }

  if (
    error.message?.includes('ERR_DB_UNAVAILABLE') ||
    error.message?.includes('ERR_DB_TIMEOUT')
  ) {
    return {
      title: 'SYS-001',
      description: 'Error: Database unavailable. Please try again.',
    };
  }

  // ── V2 error codes ────────────────────────────────────────────────────────

  if (error.message?.includes('ERR_PIN_LOCKED')) {
    return {
      title: 'SEC-001',
      description: 'Account locked. Contact the farm owner to reset your PIN.',
    };
  }

  if (error.message?.includes('ERR_INSUFFICIENT_ROLE')) {
    return {
      title: 'SEC-002',
      description: 'Your role does not permit this action.',
    };
  }

  if (
    error.message?.includes('ERR_INVALID_PIN') ||
    error.message?.includes('DAT-005')
  ) {
    return {
      title: 'DAT-005',
      description: 'PIN must be exactly 4 digits.',
    };
  }

  // ── V2 Block 2 error codes ─────────────────────────────────────────────────

  if (error.message?.includes('ERR_ANIMAL_ALREADY_TERMINAL')) {
    return {
      title: 'BUS-005',
      description: 'This animal is no longer active and cannot be modified.',
    };
  }

  // ── V2 Block 3 error codes ─────────────────────────────────────────────────

  // BUS-006: Ration references a deactivated/deleted ingredient.
  // Raised as 23503 FK violation from ration_ingredients.ingredient_id ON DELETE RESTRICT.
  if (
    error.message?.includes('ERR_DEACTIVATED_INGREDIENT') ||
    (error.code === '23503' && error.message?.includes('ration_ingredients'))
  ) {
    return {
      title: 'BUS-006',
      description: 'This ration references an ingredient that no longer exists. Update the ration first.',
    };
  }

  // DAT-007: Negative ingredient price (CHECK constraint: new_price >= 0).
  if (
    error.message?.includes('ERR_NEGATIVE_PRICE') ||
    (error.message?.includes('price_history') && error.message?.includes('new_price'))
  ) {
    return {
      title: 'DAT-007',
      description: 'Error: Ingredient price cannot be negative.',
    };
  }

  // ── V2.1 Remediation error codes ────────────────────────────────────────────

  // BUS-008: Pen at capacity — raised by frontend validation before insert.
  if (
    error.message?.includes('BUS-008') ||
    error.message?.includes('ERR_PEN_CAPACITY')
  ) {
    return {
      title: 'BUS-008',
      description: 'Pen is full. Choose a different pen or increase its capacity.',
    };
  }

  // SYS-009: Report data query timeout — raised by frontend Promise.race() timeout.
  if (
    error.message?.includes('SYS-009') ||
    error.message?.includes('ERR_REPORT_TIMEOUT')
  ) {
    return {
      title: 'SYS-009',
      description: 'Report generation timed out. Try a smaller date range.',
    };
  }

  return {
    title: 'Error',
    description: error.message ?? 'An unexpected error occurred.',
  };
}
