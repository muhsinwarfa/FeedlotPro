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
    it('renders "Mark Sick", "Mark Dead", "Mark Dispatched" buttons', () => {
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      expect(screen.getByRole('button', { name: /Mark Sick/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mark Dead/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mark Dispatched/i })).toBeInTheDocument();
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
    it('renders "Mark Active (Recovered)" button for SICK animal', () => {
      render(<StatusForm animal={sickAnimal} pens={mockPens} />);
      expect(screen.getByRole('button', { name: /Mark Active/i })).toBeInTheDocument();
    });
  });

  describe('SICK transition flow (inline panel, not dialog)', () => {
    it('clicking "Mark Sick" shows inline amber-50 panel', () => {
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Sick/i }));
      expect(screen.getByText(/Moving to sick pen/i)).toBeInTheDocument();
    });

    it('shows "Select Sick Pen" label in inline panel', () => {
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Sick/i }));
      expect(screen.getByText('Select Sick Pen')).toBeInTheDocument();
    });

    it('clicking Cancel clears the inline confirmation panel', () => {
      render(<StatusForm animal={activeAnimal} pens={mockPens} />);
      fireEvent.click(screen.getByRole('button', { name: /Mark Sick/i }));
      expect(screen.getByText(/Moving to sick pen/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(screen.queryByText(/Moving to sick pen/i)).not.toBeInTheDocument();
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
  });
});
