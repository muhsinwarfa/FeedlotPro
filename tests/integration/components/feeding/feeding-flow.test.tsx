import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/feeding',
}));

// ─── Supabase mock ─────────────────────────────────────────────────────────────
//
// The FeedingFlow component chains calls like:
//   supabase.from('feeding_records').insert({...}).select('id').single()
// and also plain:
//   supabase.from('feeding_details').insert(details)  ← awaited directly
//
// To handle both patterns:
//  • insert() uses mockReturnThis() so the chain .select().single() resolves off
//    the same mock object (not off a raw Promise).
//  • single() is a separate mock (mockSingle) that returns the final Promise.
//  • When the details insert is awaited directly, the mock object resolves to
//    itself (non-thenable wrapped by Promise.resolve), giving error: undefined
//    which counts as "no error".

const mockSingle = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      insert: mockInsert,
      select: vi.fn().mockReturnThis(),
      single: mockSingle,
    })),
  }),
}));

import { FeedingFlow } from '@/components/feeding/feeding-flow';
import { mockPens, mockIngredients } from '../../mocks/fixtures';

describe('FeedingFlow — 4-step wizard', () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockSingle.mockClear();
    mockInsert.mockReset();
    // insert() must return `this` so the .select().single() chain works
    mockInsert.mockReturnThis();
    // single() returns success data by default
    mockSingle.mockResolvedValue({ data: { id: 'feed-record-uuid' }, error: null });
  });

  describe('Step 1: SELECT_PEN initial render', () => {
    it('renders "Select a Pen" heading on step 1', () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      expect(screen.getByText('Select a Pen')).toBeInTheDocument();
    });

    it('renders step indicator with 3 steps', () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      // Steps 1, 2, 3 circles
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders all pens from the PenSelector', () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      expect(screen.getByText('Pen A')).toBeInTheDocument();
      expect(screen.getByText('Pen B')).toBeInTheDocument();
      expect(screen.getByText('Old Pen')).toBeInTheDocument();
    });
  });

  describe('Step 1: BUS-003 gate (inactive pen)', () => {
    it('shows BUS-003 toast when inactive pen is clicked', () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      // Click "Old Pen" which has status: 'inactive'
      fireEvent.click(screen.getByText('Old Pen').closest('button')!);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'BUS-003', variant: 'destructive' })
      );
    });

    it('stays on SELECT_PEN step after BUS-003 toast', () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      fireEvent.click(screen.getByText('Old Pen').closest('button')!);
      expect(screen.getByText('Select a Pen')).toBeInTheDocument();
    });
  });

  describe('Step 1: BUS-004 gate (empty pen)', () => {
    it('shows BUS-004 toast when pen with 0 animals is selected', () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      // "Pen B" has active_animal_count: 0
      fireEvent.click(screen.getByText('Pen B').closest('button')!);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'BUS-004', variant: 'destructive' })
      );
    });
  });

  describe('Step 1 → Step 2 transition', () => {
    it('advances to ENTER_INGREDIENTS step when active pen with animals is selected', () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      // "Pen A" is active with 12 animals
      fireEvent.click(screen.getByText('Pen A').closest('button')!);
      expect(screen.getByText('Enter Feed Amounts')).toBeInTheDocument();
    });

    it('shows selected pen name in context pill after pen selection', () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      fireEvent.click(screen.getByText('Pen A').closest('button')!);
      expect(screen.getByText('Pen A', { selector: 'span' })).toBeInTheDocument();
    });
  });

  describe('Step 2: ENTER_INGREDIENTS', () => {
    it('renders ingredient inputs on step 2', () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      fireEvent.click(screen.getByText('Pen A').closest('button')!);
      expect(screen.getByText('Maize Silage')).toBeInTheDocument();
      expect(screen.getByText('Cottonseed Cake')).toBeInTheDocument();
    });

    it('shows DAT-002 error when Review clicked with all blank ingredients', () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      fireEvent.click(screen.getByText('Pen A').closest('button')!);
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
      expect(screen.getByText(/DAT-002/)).toBeInTheDocument();
    });

    it('clicking ← Change Pen returns to SELECT_PEN', () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      fireEvent.click(screen.getByText('Pen A').closest('button')!);
      fireEvent.click(screen.getByRole('button', { name: /Change Pen/i }));
      expect(screen.getByText('Select a Pen')).toBeInTheDocument();
    });
  });

  describe('Step 2 → Step 3: REVIEW', () => {
    it('advances to REVIEW step after valid ingredient entry', async () => {
      const user = userEvent.setup();
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      fireEvent.click(screen.getByText('Pen A').closest('button')!);

      const inputs = screen.getAllByRole('spinbutton');
      await user.type(inputs[0], '75.5');
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));

      expect(screen.getByText('Review Feeding Record')).toBeInTheDocument();
    });

    it('shows total feed amount on review step', async () => {
      const user = userEvent.setup();
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      fireEvent.click(screen.getByText('Pen A').closest('button')!);

      const inputs = screen.getAllByRole('spinbutton');
      await user.type(inputs[0], '75.5');
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));

      expect(screen.getByText(/75\.5 kg/)).toBeInTheDocument();
    });
  });

  describe('Step 4: SAVED', () => {
    it('shows "Feeding Recorded!" on SAVED step after confirm', async () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      fireEvent.click(screen.getByText('Pen A').closest('button')!);

      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '75' } });
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
      fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/i }));

      await waitFor(() => {
        expect(screen.getByText('Feeding Recorded!')).toBeInTheDocument();
      });
    });

    it('shows "Record Another Feeding" button on SAVED step', async () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      fireEvent.click(screen.getByText('Pen A').closest('button')!);
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '50' } });
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
      fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Record Another Feeding/i })).toBeInTheDocument();
      });
    });

    it('"Record Another Feeding" resets wizard back to SELECT_PEN', async () => {
      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      fireEvent.click(screen.getByText('Pen A').closest('button')!);
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '50' } });
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
      fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/i }));

      await waitFor(() => screen.getByRole('button', { name: /Record Another Feeding/i }));
      fireEvent.click(screen.getByRole('button', { name: /Record Another Feeding/i }));

      expect(screen.getByText('Select a Pen')).toBeInTheDocument();
    });
  });

  describe('error handling during save', () => {
    it('shows error toast when feeding_records INSERT fails', async () => {
      // Configure single() to return a DB error
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'ERR_DB_UNAVAILABLE' },
      });

      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      fireEvent.click(screen.getByText('Pen A').closest('button')!);
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '50' } });
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
      fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'destructive' })
        );
      });
    });

    it('does NOT advance to SAVED when insert fails', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'ERR_DB_UNAVAILABLE' } });

      render(<FeedingFlow pens={mockPens} ingredients={mockIngredients} orgId="org-1" />);
      fireEvent.click(screen.getByText('Pen A').closest('button')!);
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '50' } });
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
      fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/i }));

      await waitFor(() => expect(mockToast).toHaveBeenCalled());
      expect(screen.queryByText('Feeding Recorded!')).not.toBeInTheDocument();
    });
  });
});
