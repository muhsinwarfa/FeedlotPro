import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

import { WeightForm } from '@/components/animals/weight-form';

describe('WeightForm', () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockRouterRefresh.mockClear();
    mockInsert.mockReset();
    mockInsert.mockResolvedValue({ error: null });
  });

  describe('non-ACTIVE animal guard', () => {
    it('shows locked message for SICK animal', () => {
      render(<WeightForm animalId="animal-1" animalStatus="SICK" />);
      expect(screen.getByText(/Weight can only be recorded for/)).toBeInTheDocument();
    });

    it('shows "Move this animal back to Active" hint for SICK', () => {
      render(<WeightForm animalId="animal-1" animalStatus="SICK" />);
      expect(screen.getByText(/Move this animal back to Active/)).toBeInTheDocument();
    });

    it('does NOT render the weight form for SICK animal', () => {
      render(<WeightForm animalId="animal-1" animalStatus="SICK" />);
      expect(screen.queryByLabelText(/New Weight/i)).not.toBeInTheDocument();
    });

    it('shows locked message for DEAD animal', () => {
      render(<WeightForm animalId="animal-1" animalStatus="DEAD" />);
      expect(screen.getByText(/Weight can only be recorded for/)).toBeInTheDocument();
    });

    it('shows locked message for DISPATCHED animal', () => {
      render(<WeightForm animalId="animal-1" animalStatus="DISPATCHED" />);
      expect(screen.getByText(/Weight can only be recorded for/)).toBeInTheDocument();
    });
  });

  describe('ACTIVE animal (normal path)', () => {
    it('renders the weight input for ACTIVE animal', () => {
      render(<WeightForm animalId="animal-1" animalStatus="ACTIVE" />);
      expect(screen.getByLabelText(/New Weight/i)).toBeInTheDocument();
    });

    it('renders "Record Weight" button', () => {
      render(<WeightForm animalId="animal-1" animalStatus="ACTIVE" />);
      expect(screen.getByRole('button', { name: /Record Weight/i })).toBeInTheDocument();
    });

    it('weight input has font-mono class (Roboto Mono for data)', () => {
      render(<WeightForm animalId="animal-1" animalStatus="ACTIVE" />);
      const input = screen.getByLabelText(/New Weight/i);
      expect(input.className).toContain('font-mono');
    });
  });

  describe('validation', () => {
    it('shows "Weight is required." when field is blank on submit', () => {
      render(<WeightForm animalId="animal-1" animalStatus="ACTIVE" />);
      fireEvent.click(screen.getByRole('button', { name: /Record Weight/i }));
      expect(screen.getByText('Weight is required.')).toBeInTheDocument();
    });

    it('shows "Weight must be a positive number." for 0', async () => {
      const user = userEvent.setup();
      render(<WeightForm animalId="animal-1" animalStatus="ACTIVE" />);
      await user.type(screen.getByLabelText(/New Weight/i), '0');
      fireEvent.click(screen.getByRole('button', { name: /Record Weight/i }));
      await screen.findByText(/Weight must be a positive number/i);
    });

    it('clears error when user types a valid value', async () => {
      const user = userEvent.setup();
      render(<WeightForm animalId="animal-1" animalStatus="ACTIVE" />);
      // Trigger error first
      fireEvent.click(screen.getByRole('button', { name: /Record Weight/i }));
      expect(screen.getByText('Weight is required.')).toBeInTheDocument();
      // Clear by typing
      const input = screen.getByLabelText(/New Weight/i);
      await user.clear(input);
      await user.type(input, '350');
      expect(screen.queryByText('Weight is required.')).not.toBeInTheDocument();
    });
  });

  describe('successful submission', () => {
    it('shows "Weight Recorded" toast on success', async () => {
      const user = userEvent.setup();
      render(<WeightForm animalId="animal-1" animalStatus="ACTIVE" />);
      await user.type(screen.getByLabelText(/New Weight/i), '310.5');
      fireEvent.click(screen.getByRole('button', { name: /Record Weight/i }));
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Weight Recorded' })
        );
      });
    });

    it('calls router.refresh() after successful submit', async () => {
      const user = userEvent.setup();
      render(<WeightForm animalId="animal-1" animalStatus="ACTIVE" />);
      await user.type(screen.getByLabelText(/New Weight/i), '310');
      fireEvent.click(screen.getByRole('button', { name: /Record Weight/i }));
      await waitFor(() => {
        expect(mockRouterRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('DB error handling', () => {
    it('shows error toast when insert fails with BUS-001', async () => {
      const user = userEvent.setup();
      mockInsert.mockResolvedValue({
        error: { message: 'ERR_INVALID_TRANSITION: Cannot modify a DEAD animal' },
      });
      render(<WeightForm animalId="animal-1" animalStatus="ACTIVE" />);
      await user.type(screen.getByLabelText(/New Weight/i), '310');
      fireEvent.click(screen.getByRole('button', { name: /Record Weight/i }));
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'BUS-001', variant: 'destructive' })
        );
      });
    });

    it('shows BUS-001 toast for V2.2 trigger format "BUS-001: ..."', async () => {
      const user = userEvent.setup();
      mockInsert.mockResolvedValue({
        error: {
          message: 'BUS-001: Animal KE-2024-001 is DEAD — modifications are locked.',
          code: 'P0001',
        },
      });
      render(<WeightForm animalId="animal-1" animalStatus="ACTIVE" />);
      await user.type(screen.getByLabelText(/New Weight/i), '310');
      fireEvent.click(screen.getByRole('button', { name: /Record Weight/i }));
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'BUS-001', variant: 'destructive' })
        );
      });
    });
  });

  describe('pending state', () => {
    it.skip('shows "Saving…" label while submitting', async () => {
      // React 18 does not officially support startTransition(async fn).
      // isPending is set synchronously then immediately reset before the first
      // await resolves, so the "Saving…" label appears for <1 frame and
      // findByText cannot reliably catch it.
      // This transient loading state is validated in Layer 5 E2E tests instead.
    });
  });
});
