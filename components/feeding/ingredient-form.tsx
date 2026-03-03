import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Ingredient = {
  id: string;
  ingredient_name: string;
};

export type IngredientInput = {
  ingredientId: string;
  ingredientName: string;
  kgAmount: number | null;
};

interface IngredientFormProps {
  ingredients: Ingredient[];
  initialValues?: IngredientInput[];
  onSubmit: (inputs: IngredientInput[]) => void;
  onBack: () => void;
}

export function IngredientForm({
  ingredients,
  initialValues,
  onSubmit,
  onBack,
}: IngredientFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    ingredients.forEach((ing) => {
      const existing = initialValues?.find((v) => v.ingredientId === ing.id);
      init[ing.id] = existing?.kgAmount != null ? String(existing.kgAmount) : '';
    });
    return init;
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');

  function handleChange(id: string, raw: string) {
    setValues((prev) => ({ ...prev, [id]: raw }));
    if (fieldErrors[id]) {
      setFieldErrors((prev) => ({ ...prev, [id]: '' }));
    }
    if (globalError) setGlobalError('');
  }

  function handleNext() {
    const errors: Record<string, string> = {};
    let hasPositive = false;

    const inputs: IngredientInput[] = ingredients.map((ing) => {
      const raw = values[ing.id];
      if (!raw || raw.trim() === '') {
        return { ingredientId: ing.id, ingredientName: ing.ingredient_name, kgAmount: null };
      }

      const parsed = parseFloat(raw);
      if (isNaN(parsed)) {
        errors[ing.id] = 'Enter a valid number.';
        return { ingredientId: ing.id, ingredientName: ing.ingredient_name, kgAmount: null };
      }
      if (parsed < 0) {
        errors[ing.id] = 'DAT-001: Cannot be negative.';
        return { ingredientId: ing.id, ingredientName: ing.ingredient_name, kgAmount: null };
      }
      if (parsed > 0) hasPositive = true;

      return { ingredientId: ing.id, ingredientName: ing.ingredient_name, kgAmount: parsed };
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (!hasPositive) {
      setGlobalError('DAT-002: Enter at least one ingredient amount greater than 0.');
      return;
    }

    onSubmit(inputs);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Enter Feed Amounts</h2>
        <p className="text-sm text-slate-500 mt-0.5">Enter kg for each ingredient used. Leave blank for unused items.</p>
      </div>

      <div className="space-y-3">
        {ingredients.map((ing) => (
          <div key={ing.id} className="flex items-center gap-4">
            <label
              htmlFor={`ing-${ing.id}`}
              className="flex-1 text-sm font-medium text-slate-700 min-w-0"
            >
              {ing.ingredient_name}
            </label>
            <div className="flex-shrink-0 w-36 space-y-1">
              <div className="flex items-center gap-1.5">
                <Input
                  id={`ing-${ing.id}`}
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="—"
                  value={values[ing.id] ?? ''}
                  onChange={(e) => handleChange(ing.id, e.target.value)}
                  className={`min-h-[52px] text-lg font-mono text-right ${fieldErrors[ing.id] ? 'border-red-500' : ''}`}
                />
                <span className="text-xs text-slate-400 flex-shrink-0">kg</span>
              </div>
              {fieldErrors[ing.id] && (
                <p className="text-xs text-red-600">{fieldErrors[ing.id]}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {globalError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{globalError}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="min-h-[44px] border-slate-300 text-slate-600"
        >
          ← Change Pen
        </Button>
        <Button
          onClick={handleNext}
          className="flex-1 min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
        >
          Review Summary →
        </Button>
      </div>
    </div>
  );
}
