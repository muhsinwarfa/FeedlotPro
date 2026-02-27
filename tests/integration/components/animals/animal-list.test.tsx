import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnimalList } from '@/components/animals/animal-list';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));

const mockAnimals = [
  {
    id: '1', tag_id: 'KE-001', breed: 'Boran', status: 'ACTIVE',
    intake_weight: 250, current_weight: 275, intake_date: '2024-01-15T00:00:00Z',
    pen_id: 'pen-1', pens: { pen_name: 'Pen A' },
  },
  {
    id: '2', tag_id: 'KE-002', breed: 'Sahiwal', status: 'SICK',
    intake_weight: 200, current_weight: 195, intake_date: '2024-02-01T00:00:00Z',
    pen_id: 'pen-2', pens: [{ pen_name: 'Pen B' }], // array form
  },
  {
    id: '3', tag_id: 'KE-003', breed: 'Fresian', status: 'DEAD',
    intake_weight: 300, current_weight: null, intake_date: '2024-03-01T00:00:00Z',
    pen_id: 'pen-1', pens: null,
  },
];

describe('AnimalList', () => {
  describe('filter tabs', () => {
    it('renders 5 filter tabs: ALL, ACTIVE, SICK, DEAD, DISPATCHED', () => {
      render(<AnimalList animals={mockAnimals} />);
      expect(screen.getByRole('button', { name: /All/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Active/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sick/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dead/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dispatched/ })).toBeInTheDocument();
    });

    it('ALL tab shows total animal count badge', () => {
      render(<AnimalList animals={mockAnimals} />);
      // The ALL button should contain "3" for 3 animals
      const allBtn = screen.getByRole('button', { name: /All/ });
      expect(allBtn).toHaveTextContent('3');
    });

    it('ACTIVE tab shows count of 1', () => {
      render(<AnimalList animals={mockAnimals} />);
      const activeBtn = screen.getByRole('button', { name: /Active/ });
      expect(activeBtn).toHaveTextContent('1');
    });

    it('clicking SICK tab shows only SICK animals', () => {
      render(<AnimalList animals={mockAnimals} />);
      fireEvent.click(screen.getByRole('button', { name: /Sick/ }));
      expect(screen.getByText('KE-002')).toBeInTheDocument();
      expect(screen.queryByText('KE-001')).not.toBeInTheDocument();
    });

    it('clicking ACTIVE tab shows only ACTIVE animals', () => {
      render(<AnimalList animals={mockAnimals} />);
      fireEvent.click(screen.getByRole('button', { name: /Active/ }));
      expect(screen.getByText('KE-001')).toBeInTheDocument();
      expect(screen.queryByText('KE-002')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows "No animals found" when animal list is empty', () => {
      render(<AnimalList animals={[]} />);
      expect(screen.getByText('No animals found')).toBeInTheDocument();
    });

    it('shows "Add your first animal" message for empty ALL filter', () => {
      render(<AnimalList animals={[]} />);
      expect(screen.getByText(/Add your first animal/)).toBeInTheDocument();
    });

    it('shows filter-specific empty message when filter selected but no matches', () => {
      render(<AnimalList animals={mockAnimals} />);
      fireEvent.click(screen.getByRole('button', { name: /Dispatched/ }));
      expect(screen.getByText(/No dispatched animals/i)).toBeInTheDocument();
    });
  });

  describe('table rendering', () => {
    it('renders table headers with key columns', () => {
      render(<AnimalList animals={mockAnimals} />);
      expect(screen.getByText('Tag ID')).toBeInTheDocument();
      expect(screen.getByText('Breed')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('renders one row per animal in ALL filter', () => {
      render(<AnimalList animals={mockAnimals} />);
      expect(screen.getByText('KE-001')).toBeInTheDocument();
      expect(screen.getByText('KE-002')).toBeInTheDocument();
      expect(screen.getByText('KE-003')).toBeInTheDocument();
    });

    it('handles pen as object (single record)', () => {
      render(<AnimalList animals={mockAnimals} />);
      expect(screen.getByText('Pen A')).toBeInTheDocument();
    });

    it('handles pen as array (Supabase join format)', () => {
      render(<AnimalList animals={mockAnimals} />);
      expect(screen.getByText('Pen B')).toBeInTheDocument();
    });

    it('shows "—" when pens is null', () => {
      render(<AnimalList animals={mockAnimals} />);
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('displays ACTIVE status badge', () => {
      render(<AnimalList animals={mockAnimals} />);
      // "Active" appears in both the filter tab (button) and the table badge (span)
      const matches = screen.getAllByText('Active');
      const badge = matches.find((el) => el.tagName === 'SPAN');
      expect(badge).toBeInTheDocument();
    });

    it('displays SICK status badge', () => {
      render(<AnimalList animals={mockAnimals} />);
      const matches = screen.getAllByText('Sick');
      const badge = matches.find((el) => el.tagName === 'SPAN');
      expect(badge).toBeInTheDocument();
    });

    it('displays DEAD status badge', () => {
      render(<AnimalList animals={mockAnimals} />);
      const matches = screen.getAllByText('Dead');
      const badge = matches.find((el) => el.tagName === 'SPAN');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('weight gain column', () => {
    it('shows "+25.0" for gained weight (275 - 250)', () => {
      render(<AnimalList animals={mockAnimals} />);
      expect(screen.getByText('+25.0')).toBeInTheDocument();
    });

    it('shows "-5.0" for lost weight (195 - 200)', () => {
      render(<AnimalList animals={mockAnimals} />);
      expect(screen.getByText('-5.0')).toBeInTheDocument();
    });

    it('shows "+0.0" when current_weight is null (no recorded weight)', () => {
      render(<AnimalList animals={mockAnimals} />);
      expect(screen.getByText('+0.0')).toBeInTheDocument();
    });
  });

  describe('date formatting', () => {
    it('renders intake_date in readable locale format', () => {
      render(<AnimalList animals={mockAnimals} />);
      // "15 Jan 2024" format
      expect(screen.getByText(/Jan.*2024|2024.*Jan/)).toBeInTheDocument();
    });
  });
});
