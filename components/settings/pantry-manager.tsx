'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type Ingredient = {
  id: string;
  ingredient_name: string;
  unit: string;
};

interface PantryManagerProps {
  ingredients: Ingredient[];
  orgId: string;
}

export function PantryManager({ ingredients: initialIngredients, orgId }: PantryManagerProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [ingredientName, setIngredientName] = useState('');
  const [ingredientError, setIngredientError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const supabase = createClient();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();

    const name = ingredientName.trim();
    if (!name) {
      setIngredientError('Ingredient name is required.');
      return;
    }
    if (ingredients.some((i) => i.ingredient_name.toLowerCase() === name.toLowerCase())) {
      setIngredientError('This ingredient is already in your pantry.');
      return;
    }

    setIngredientError('');

    startTransition(async () => {
      const { data, error } = await supabase
        .from('pantry_ingredients')
        .insert({ organization_id: orgId, ingredient_name: name, unit: 'kg' } as never)
        .select('id, ingredient_name, unit')
        .single();

      if (error) {
        const { title, description } = mapDbError(error);
        toast({ variant: 'destructive', title, description });
        return;
      }

      setIngredients((prev) => [...prev, data as Ingredient]);
      setIngredientName('');
      setShowForm(false);
      toast({ title: 'Ingredient Added', description: `${name} added to your pantry.` });
    });
  }

  function handleDelete(ingredient: Ingredient) {
    startTransition(async () => {
      // Check if ingredient has any feeding detail records
      const { count } = await supabase
        .from('feeding_details')
        .select('id', { count: 'exact', head: true })
        .eq('ingredient_id', ingredient.id);

      if (count && count > 0) {
        toast({
          variant: 'destructive',
          title: 'Cannot Delete',
          description: `${ingredient.ingredient_name} has ${count} feeding record(s). It cannot be deleted.`,
        });
        return;
      }

      const { error } = await supabase
        .from('pantry_ingredients')
        .delete()
        .eq('id', ingredient.id);

      if (error) {
        const { title, description } = mapDbError(error);
        toast({ variant: 'destructive', title, description });
        return;
      }

      setIngredients((prev) => prev.filter((i) => i.id !== ingredient.id));
      toast({ title: 'Ingredient Removed', description: `${ingredient.ingredient_name} removed from pantry.` });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Feed Pantry</h2>
          <p className="text-sm text-slate-500">{ingredients.length} ingredient(s) — all quantities in kg</p>
        </div>
        <Button
          onClick={() => setShowForm((v) => !v)}
          className="min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
        >
          {showForm ? 'Cancel' : '+ Add Ingredient'}
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ingredName" className="text-slate-700 font-medium text-sm">Ingredient Name</Label>
              <Input
                id="ingredName"
                type="text"
                placeholder="e.g. Napier Grass, Molasses"
                value={ingredientName}
                onChange={(e) => { setIngredientName(e.target.value); setIngredientError(''); }}
                className={`min-h-[44px] ${ingredientError ? 'border-red-500' : ''}`}
                disabled={isPending}
                autoFocus
              />
            </div>
            <div className="flex-shrink-0 flex items-end pb-0.5">
              <span className="text-sm text-slate-400 px-2 font-mono">kg</span>
            </div>
            <Button
              type="submit"
              disabled={isPending}
              className="min-h-[44px] bg-emerald-950 hover:bg-emerald-800 text-white"
            >
              {isPending ? 'Adding…' : 'Add'}
            </Button>
          </div>
          {ingredientError && <p className="text-xs text-red-600">{ingredientError}</p>}
        </form>
      )}

      {/* Ingredient list */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {ingredients.length === 0 ? (
          <p className="py-8 text-center text-slate-400 text-sm">No ingredients yet. Add one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ingredient</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unit</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ingredients.map((ing) => (
                <tr key={ing.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{ing.ingredient_name}</td>
                  <td className="px-4 py-3 text-center font-mono text-slate-500">{ing.unit}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(ing)}
                      disabled={isPending}
                      className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
