import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockRouterRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: mockRouterRefresh }),
  usePathname: () => '/',
}));

const mockUpdate = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      update: mockUpdate,
      eq: vi.fn().mockReturnThis(),
    })),
  }),
}));

import { StatusForm } from '@/components/animals/status-form';
import { mockPens, mockActiveAnimal, mockDeadAnimal, mockDispatchedAnimal, mockSickAnimal } from '../../mocks/fixtures';

const activeAnimal = { id: mockActiveAnimal.id, status: 'ACTIVE', tag_id: mockActiveAnimal.tag_id, pen_id: mockActiveAnimal.pen_id };
const sickAnimal = { id: mockSickAnimal.id, status: 'SICK', tag_id: mockSickAnimal.tag_id, pen_id: mockSickAnimal.pen_id };
const deadAnimal = { id: mockDeadAnimal.id, status: 'DEAD', tag_id: mockDeadAnimal.tag_id, pen_id: mockDeadAnimal.pen_id };
const dispatchedAnimal = { id: mockDispatchedAnimal.id, status: 'DISPATCHED', tag_id: mockDispatchedAnimal.tag_id, pen_id: mockDispatchedAnimal.pen_id };

describe('StatusForm', () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockRouterRefresh.mockClear();
    mockUpdate.mockReset();
    mockUpdate.mockReturnValue({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    });
  });

  describe('sealed states', () => {
    it('renders locked message for DEAD animal with no buttons', () => {
      render(<StatusForm animal={deadAnimal} pens={mockPens} />);
      expect(screen.getByText(/No further status changes are possible/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Mark/i })).not.toBeInTheDocument();
    });

    it('renders locked message for DISPATCHED animal with no buttons', () => {
      render(<StatusForm animal={dispatchedAnimal} pens={mockPens} />);
      expect(screen.getByText(/No further status changes are possible/)).toBeInTheDocument();
    });
  });

  describe('ACTIVE animal transitions', () => {
    // V2: ACTIVE→SICK is handled by FlagSickForm. StatusForm only covers terminal transitions.
    it('renders "Mark Dead" and "Mark Dispatched" buttons (no Mark Sick — handled by FlagSickForm)', () => {
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      expect(screen.getByRole('button', { name: /Mark Dead/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mark Dispatched/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Mark Sick/i })).not.toBeInTheDocument();
    });

    it('does NOT render "Mark Active" button (no self-loop from ACTIVE)', () => {
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      expect(screen.queryByRole('button', { name: /Mark Active/i })).not.toBeInTheDocument();
    });

    it('shows current status in description', () => {
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      // "Current status: " and "ACTIVE" are in separate DOM nodes (text + span).
      // Match the paragraph by its aggregated textContent instead.
      const descParagraph = screen.getByText((_, el) =>
        el?.tagName === 'P' && (el.textContent ?? '').includes('Current status')
      );
      expect(descParagraph).toHaveTextContent('ACTIVE');
    });
  });

  describe('SICK animal transitions', () => {
    // V2: SICK→ACTIVE (recovery) is handled by HealthOutcomeForm.
    // StatusForm for SICK animals only offers terminal transitions: DEAD or DISPATCHED.
    it('renders "Mark Dead" and "Mark Dispatched" buttons for SICK animal', () => {
      render(<StatusForm animal={sickAnimal} pens={mockPens} />);
      expect(screen.getByRole('button', { name: /Mark Dead/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mark Dispatched/i })).toBeInTheDocument();
    });

    it('does NOT render "Mark Active" button for SICK animal (HealthOutcomeForm handles recovery)', () => {
      render(<StatusForm animal={sickAnimal} pens={mockPens} />);
      expect(screen.queryByRole('button', { name: /Mark Active/i })).not.toBeInTheDocument();
    });

    it('clicking "Mark Dead" on SICK animal opens Dialog', () => {
      render(<StatusForm animal={sickAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Dead/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('DEAD transition flow (dialog)', () => {
    it('clicking "Mark Dead" opens a Dialog', () => {
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Dead/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('Dialog title is "Record Mortality"', () => {
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Dead/i }));
      expect(screen.getByText('Record Mortality')).toBeInTheDocument();
    });

    it('Dialog warns action cannot be undone', () => {
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Dead/i }));
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    });

    it('Dialog mentions the animal tag_id', () => {
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Dead/i }));
      expect(screen.getByText(new RegExp(activeAnimal.tag_id))).toBeInTheDocument();
    });

    it('clicking Cancel in dialog closes it without submitting', () => {
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Dead/i }));
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('DISPATCHED transition flow (dialog)', () => {
    it('clicking "Mark Dispatched" opens dialog with "Dispatch Animal" title', () => {
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Dispatched/i }));
      expect(screen.getByText('Dispatch Animal')).toBeInTheDocument();
    });
  });

  describe('DB error handling', () => {
    it('shows BUS-001 toast when status update returns ERR_INVALID_TRANSITION', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn(() => Promise.resolve({ error: { message: 'ERR_INVALID_TRANSITION' } })),
      });
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Dead/i }));
      fireEvent.click(screen.getByRole('button', { name: /Yes, Record as Dead/i }));
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'BUS-001', variant: 'destructive' })
        );
      });
    });

    it('shows BUS-001 toast for V2.2 trigger format "BUS-001: ..."', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn(() => Promise.resolve({
          error: { message: 'BUS-001: Animal is DEAD — modifications are locked.', code: 'P0001' },
        })),
      });
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Dead/i }));
      fireEvent.click(screen.getByRole('button', { name: /Yes, Record as Dead/i }));
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'BUS-001', variant: 'destructive' })
        );
      });
    });
  });

  describe('DB update payload — terminal dates', () => {
    it('includes mortality_date (YYYY-MM-DD) in update payload when marking DEAD', async () => {
      let capturedPayload: unknown;
      mockUpdate.mockImplementation((payload: unknown) => {
        capturedPayload = payload;
        return { eq: vi.fn(() => Promise.resolve({ error: null })) };
      });
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Dead/i }));
      fireEvent.click(screen.getByRole('button', { name: /Yes, Record as Dead/i }));
      await waitFor(() => expect(mockRouterRefresh).toHaveBeenCalled());
      expect(capturedPayload).toMatchObject({
        status: 'DEAD',
        mortality_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
    });

    it('includes dispatch_date (YYYY-MM-DD) in update payload when marking DISPATCHED', async () => {
      let capturedPayload: unknown;
      mockUpdate.mockImplementation((payload: unknown) => {
        capturedPayload = payload;
        return { eq: vi.fn(() => Promise.resolve({ error: null })) };
      });
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Dispatched/i }));
      fireEvent.click(screen.getByRole('button', { name: /Yes, Dispatch Animal/i }));
      await waitFor(() => expect(mockRouterRefresh).toHaveBeenCalled());
      expect(capturedPayload).toMatchObject({
        status: 'DISPATCHED',
        dispatch_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
    });
  });
});
