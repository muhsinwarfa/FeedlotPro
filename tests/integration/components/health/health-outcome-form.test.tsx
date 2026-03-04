import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Radix UI Select mock ──────────────────────────────────────────────────────
// jsdom lacks pointer capture APIs required by @radix-ui/react-select.
// Render a native <select> so tests can use fireEvent.change without Radix internals.
vi.mock('@/components/ui/select', () => ({
  Select: ({ onValueChange, value, children }: { onValueChange: (v: string) => void; value: string; children: React.ReactNode }) =>
    React.createElement('select', {
      role: 'combobox',
      value: value ?? '',
      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange(e.target.value),
    }, children),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  SelectValue: ({ placeholder }: { placeholder: string }) => React.createElement(React.Fragment, null, placeholder),
  SelectContent: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) =>
    React.createElement('option', { value }, children),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockRouterRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: mockRouterRefresh }),
  usePathname: () => '/',
}));

const mockInsert = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  }),
}));

import { HealthOutcomeForm } from '@/components/health/health-outcome-form';

const defaultProps = {
  animalId: 'animal-sick',
  organizationId: 'org-1',
  memberId: 'member-vet',
  role: 'VET' as const,
};

describe('HealthOutcomeForm', () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockRouterRefresh.mockClear();
    mockInsert.mockReset();
    mockInsert.mockResolvedValue({ error: null });
  });

  // ── RBAC gate ────────────────────────────────────────────────────────────────

  describe('RBAC gate', () => {
    it('renders nothing for FARMHAND role', () => {
      const { container } = render(<HealthOutcomeForm {...defaultProps} role="FARMHAND" />);
      expect(container.firstChild).toBeNull();
    });

    it('renders the form for VET role', () => {
      render(<HealthOutcomeForm {...defaultProps} role="VET" />);
      expect(screen.getByRole('button', { name: /Record Outcome/i })).toBeInTheDocument();
    });

    it('renders the form for MANAGER role', () => {
      render(<HealthOutcomeForm {...defaultProps} role="MANAGER" />);
      expect(screen.getByRole('button', { name: /Record Outcome/i })).toBeInTheDocument();
    });
  });

  // ── Outcome validation ────────────────────────────────────────────────────────

  describe('outcome selection validation', () => {
    it('Record Outcome button is disabled when no outcome is selected', () => {
      render(<HealthOutcomeForm {...defaultProps} />);
      // Button has disabled={isPending || !outcome} — must be disabled with no selection
      expect(screen.getByRole('button', { name: /Record Outcome/i })).toBeDisabled();
    });

    it('Record Outcome button becomes enabled after selecting an outcome', () => {
      render(<HealthOutcomeForm {...defaultProps} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'RECOVERED' } });
      expect(screen.getByRole('button', { name: /Record Outcome/i })).not.toBeDisabled();
    });
  });

  // ── RECOVERED outcome (non-destructive — no confirm dialog) ──────────────────

  describe('RECOVERED outcome', () => {
    function selectAndSubmitRecovered() {
      render(<HealthOutcomeForm {...defaultProps} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'RECOVERED' } });
      fireEvent.click(screen.getByRole('button', { name: /Record Outcome/i }));
    }

    it('inserts health_event with event_type RECOVERED', async () => {
      selectAndSubmitRecovered();
      await waitFor(() => expect(mockInsert).toHaveBeenCalled());
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: 'RECOVERED' })
      );
    });

    it('shows "Outcome recorded" success toast', async () => {
      selectAndSubmitRecovered();
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Outcome recorded' })
        );
      });
    });

    it('calls router.refresh() after RECOVERED', async () => {
      selectAndSubmitRecovered();
      await waitFor(() => expect(mockRouterRefresh).toHaveBeenCalled());
    });

    it('does NOT open an AlertDialog for RECOVERED (non-destructive)', () => {
      render(<HealthOutcomeForm {...defaultProps} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'RECOVERED' } });
      fireEvent.click(screen.getByRole('button', { name: /Record Outcome/i }));
      // No alertdialog should appear — insert happens immediately
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  // ── STILL_SICK outcome ────────────────────────────────────────────────────────

  describe('STILL_SICK outcome', () => {
    it('inserts health_event with event_type FOLLOW_UP_SCHEDULED', async () => {
      render(<HealthOutcomeForm {...defaultProps} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'STILL_SICK' } });
      fireEvent.click(screen.getByRole('button', { name: /Record Outcome/i }));
      await waitFor(() => expect(mockInsert).toHaveBeenCalled());
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: 'FOLLOW_UP_SCHEDULED' })
      );
    });
  });

  // ── DEAD outcome (confirm dialog required) ────────────────────────────────────

  describe('DEAD outcome', () => {
    function selectDead() {
      render(<HealthOutcomeForm {...defaultProps} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'DEAD' } });
    }

    it('clicking Record Outcome shows AlertDialog before inserting', () => {
      selectDead();
      fireEvent.click(screen.getByRole('button', { name: /Record Outcome/i }));
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('clicking Confirm in AlertDialog executes insert with event_type MORTALITY', async () => {
      selectDead();
      fireEvent.click(screen.getByRole('button', { name: /Record Outcome/i }));
      fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));
      await waitFor(() => expect(mockInsert).toHaveBeenCalled());
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: 'MORTALITY' })
      );
    });

    it('clicking Cancel in AlertDialog does NOT insert', async () => {
      selectDead();
      fireEvent.click(screen.getByRole('button', { name: /Record Outcome/i }));
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  // ── DISPATCHED_EARLY outcome ──────────────────────────────────────────────────

  describe('DISPATCHED_EARLY outcome', () => {
    it('clicking Confirm executes insert with event_type DISPATCHED_EARLY', async () => {
      render(<HealthOutcomeForm {...defaultProps} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'DISPATCHED_EARLY' } });
      fireEvent.click(screen.getByRole('button', { name: /Record Outcome/i }));
      fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));
      await waitFor(() => expect(mockInsert).toHaveBeenCalled());
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: 'DISPATCHED_EARLY' })
      );
    });
  });

  // ── Error path ────────────────────────────────────────────────────────────────

  describe('DB error handling', () => {
    it('shows destructive BUS-001 toast when insert returns BUS-001 error', async () => {
      mockInsert.mockResolvedValue({
        error: {
          message: 'BUS-001: Animal KE-2024-001 (animal-uuid) is DEAD — modifications are locked.',
          code: 'P0001',
        },
      });
      render(<HealthOutcomeForm {...defaultProps} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'RECOVERED' } });
      fireEvent.click(screen.getByRole('button', { name: /Record Outcome/i }));
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'destructive', title: 'BUS-001' })
        );
      });
    });

    it('does NOT call router.refresh() on insert error', async () => {
      mockInsert.mockResolvedValue({
        error: { message: 'BUS-001: locked', code: 'P0001' },
      });
      render(<HealthOutcomeForm {...defaultProps} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'RECOVERED' } });
      fireEvent.click(screen.getByRole('button', { name: /Record Outcome/i }));
      await waitFor(() => expect(mockToast).toHaveBeenCalled());
      expect(mockRouterRefresh).not.toHaveBeenCalled();
    });
  });

  // ── Notes field ───────────────────────────────────────────────────────────────

  describe('notes field', () => {
    it('passes notes value in insert payload when provided', async () => {
      const user = userEvent.setup();
      render(<HealthOutcomeForm {...defaultProps} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'RECOVERED' } });
      await user.type(screen.getByPlaceholderText(/Veterinary observations/i), 'Animal eating well');
      fireEvent.click(screen.getByRole('button', { name: /Record Outcome/i }));
      await waitFor(() => expect(mockInsert).toHaveBeenCalled());
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ notes: 'Animal eating well' })
      );
    });

    it('passes null for notes when field is empty', async () => {
      render(<HealthOutcomeForm {...defaultProps} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'RECOVERED' } });
      fireEvent.click(screen.getByRole('button', { name: /Record Outcome/i }));
      await waitFor(() => expect(mockInsert).toHaveBeenCalled());
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ notes: null })
      );
    });
  });

  // ── Insert payload shape ──────────────────────────────────────────────────────

  describe('insert payload shape', () => {
    it('includes animalId, organizationId, and memberId in payload', async () => {
      render(<HealthOutcomeForm {...defaultProps} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'RECOVERED' } });
      fireEvent.click(screen.getByRole('button', { name: /Record Outcome/i }));
      await waitFor(() => expect(mockInsert).toHaveBeenCalled());
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          animal_id: 'animal-sick',
          organization_id: 'org-1',
          performed_by: 'member-vet',
        })
      );
    });
  });
});
