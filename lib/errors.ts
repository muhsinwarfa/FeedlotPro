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
 * Sources:
 *  - ERR_INVALID_TRANSITION: raised by trg_animal_status_safeguard (triggers.sql:57)
 *    → BUS-001: Record Locked (animal is DEAD or DISPATCHED)
 *  - 23505 unique_violation: raised by animals_tag_id_org_unique index
 *    → DAT-003: Tag ID already exists in this organization's inventory
 *  - ERR_NEGATIVE_WEIGHT → DAT-001
 *  - ERR_PEN_DEACTIVATED → BUS-002 / BUS-003
 *  - ERR_EMPTY_PEN → BUS-004
 *  - ERR_ALL_BLANKS → DAT-002
 *  - ERR_DB_UNAVAILABLE / ERR_DB_TIMEOUT → SYS-001
 */
export function mapDbError(error: DbError): ToastPayload {
  if (error.message?.includes('ERR_INVALID_TRANSITION')) {
    return {
      title: 'BUS-001',
      description: 'Error: Record Locked (Animal Dead/Dispatched)',
    };
  }

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

  return {
    title: 'Error',
    description: error.message ?? 'An unexpected error occurred.',
  };
}
