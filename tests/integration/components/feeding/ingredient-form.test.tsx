import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IngredientForm } from '@/components/feeding/ingredient-form';
import { mockIngredients } from '../../mocks/fixtures';

describe('IngredientForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnBack.mockClear();
  });

  describe('rendering', () => {
    it('renders one input per ingredient', () => {
      render(
        <IngredientForm
          ingredients={mockIngredients}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );
      // 2 ingredients = 2 inputs
      const inputs = screen.getAllByRole('spinbutton'); // number inputs
      expect(inputs).toHaveLength(2);
    });

    it('labels each input with ingredient_name', () => {
      render(
        <IngredientForm
          ingredients={mockIngredients}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );
      expect(screen.getByText('Maize Silage')).toBeInTheDocument();
      expect(screen.getByText('Cottonseed Cake')).toBeInTheDocument();
    });

    it('renders "Review Summary →" and "← Change Pen" buttons', () => {
      render(
        <IngredientForm
          ingredients={mockIngredients}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );
      expect(screen.getByRole('button', { name: /Review Summary/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Change Pen/i })).toBeInTheDocument();
    });

    it('inputs have font-mono class for numeric data (design system)', () => {
      render(
        <IngredientForm
          ingredients={mockIngredients}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );
      const inputs = screen.getAllByRole('spinbutton');
      inputs.forEach((input) => {
        expect(input.className).toContain('font-mono');
      });
    });
  });

  describe('field validation', () => {
    it('shows DAT-001 field error for a negative number', async () => {
      // <input type="number"> in jsdom sanitises non-numeric strings to '',
      // so the reachable field-error path is a negative value.
      const user = userEvent.setup();
      render(
        <IngredientForm
          ingredients={mockIngredients}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );
      const inputs = screen.getAllByRole('spinbutton');
      await user.type(inputs[0], '-5');
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
      await screen.findByText(/DAT-001/i);
    });

    it('shows DAT-002 global error when all fields are blank on submit', () => {
      render(
        <IngredientForm
          ingredients={mockIngredients}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );
      // Don't fill any fields
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
      expect(screen.getByText(/DAT-002/)).toBeInTheDocument();
    });

    it('does NOT show DAT-002 when at least one ingredient has a value', async () => {
      const user = userEvent.setup();
      render(
        <IngredientForm
          ingredients={mockIngredients}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );
      const inputs = screen.getAllByRole('spinbutton');
      await user.type(inputs[0], '50');
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
      expect(screen.queryByText(/DAT-002/)).not.toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('calls onSubmit with IngredientInput array when valid', async () => {
      const user = userEvent.setup();
      render(
        <IngredientForm
          ingredients={mockIngredients}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );
      const inputs = screen.getAllByRole('spinbutton');
      await user.type(inputs[0], '75.5');
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      const [submittedInputs] = mockOnSubmit.mock.calls[0];
      expect(submittedInputs[0].kgAmount).toBe(75.5);
      expect(submittedInputs[0].ingredientId).toBe('ing-1');
    });

    it('kgAmount is null for blank fields', async () => {
      const user = userEvent.setup();
      render(
        <IngredientForm
          ingredients={mockIngredients}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );
      const inputs = screen.getAllByRole('spinbutton');
      await user.type(inputs[0], '50');
      // inputs[1] left blank
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
      const [submittedInputs] = mockOnSubmit.mock.calls[0];
      expect(submittedInputs[1].kgAmount).toBeNull();
    });

    it('does NOT submit when only DAT-002 validation fails', () => {
      render(
        <IngredientForm
          ingredients={mockIngredients}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('initialValues', () => {
    it('pre-fills input fields when initialValues prop is provided', () => {
      render(
        <IngredientForm
          ingredients={mockIngredients}
          initialValues={[
            { ingredientId: 'ing-1', ingredientName: 'Maize Silage', kgAmount: 75 },
            { ingredientId: 'ing-2', ingredientName: 'Cottonseed Cake', kgAmount: null },
          ]}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      expect(inputs[0].value).toBe('75');
      expect(inputs[1].value).toBe('');
    });
  });

  describe('back navigation', () => {
    it('calls onBack when ← Change Pen is clicked', () => {
      render(
        <IngredientForm
          ingredients={mockIngredients}
          onSubmit={mockOnSubmit}
          onBack={mockOnBack}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /Change Pen/i }));
      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });
  });
});
