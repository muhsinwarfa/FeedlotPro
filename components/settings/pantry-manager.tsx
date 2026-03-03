'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import { validatePriceForm } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PurchaseDialog } from './purchase-dialog';

type Ingredient = {
  id: string;
  ingredient_name: string;
  unit: string;
  current_price_per_kg: number | null;
  current_stock: number;
};

interface PantryManagerProps {
  ingredients: Ingredient[];
  orgId: string;
  canManagePricing?: boolean;
}

export function PantryManager({
  ingredients: initialIngredients,
  orgId,
  canManagePricing = false,
}: PantryManagerProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [ingredientName, setIngredientName] = useState('');
  const [ingredientError, setIngredientError] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Expandable row state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Inline price editing state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [priceError, setPriceError] = useState('');

  // Purchase dialog state
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseDefaultId, setPurchaseDefaultId] = useState<string | undefined>();

  const supabase = createClient();

  // ── Add ingredient ─────────────────────────────────────────────────────────

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
        .select('id, ingredient_name, unit, current_price_per_kg, current_stock')
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

  // ── Delete ingredient ──────────────────────────────────────────────────────

  function handleDelete(ingredient: Ingredient) {
    startTransition(async () => {
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
      toast({
        title: 'Ingredient Removed',
        description: `${ingredient.ingredient_name} removed from pantry.`,
      });
    });
  }

  // ── Inline price editing ───────────────────────────────────────────────────

  function startEditingPrice(ingredient: Ingredient) {
    setEditingPriceId(ingredient.id);
    setPriceInput(ingredient.current_price_per_kg?.toString() ?? '');
    setPriceError('');
  }

  function cancelEditingPrice() {
    setEditingPriceId(null);
    setPriceInput('');
    setPriceError('');
  }

  function commitPriceEdit(ingredientId: string) {
    const errors = validatePriceForm({ pricePerKg: priceInput });
    if (errors.pricePerKg) {
      setPriceError(errors.pricePerKg);
      return;
    }
    const newPrice = parseFloat(priceInput);
    startTransition(async () => {
      const { error } = await supabase
        .from('pantry_ingredients')
        .update({ current_price_per_kg: newPrice } as never)
        .eq('id', ingredientId);

      if (error) {
        const { title, description } = mapDbError(error);
        toast({ variant: 'destructive', title, description });
        return;
      }

      // trg_price_history_on_update fires automatically in the DB
      setIngredients((prev) =>
        prev.map((i) =>
          i.id === ingredientId ? { ...i, current_price_per_kg: newPrice } : i
        )
      );
      setEditingPriceId(null);
      toast({ title: 'Price Updated', description: `Price saved as KES ${newPrice.toFixed(2)}/kg.` });
    });
  }

  // ── Purchase dialog ────────────────────────────────────────────────────────

  function openPurchaseForIngredient(id: string) {
    setPurchaseDefaultId(id);
    setPurchaseOpen(true);
  }

  function openGlobalPurchase() {
    setPurchaseDefaultId(undefined);
    setPurchaseOpen(true);
  }

  function handlePurchaseSuccess(ingredientId: string, qtyAdded: number) {
    setIngredients((prev) =>
      prev.map((i) =>
        i.id === ingredientId ? { ...i, current_stock: i.current_stock + qtyAdded } : i
      )
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Feed Pantry</h2>
          <p className="text-sm text-slate-500">{ingredients.length} ingredient(s) — all quantities in kg</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canManagePricing && (
            <Button
              onClick={openGlobalPurchase}
              className="min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
            >
              + Record Purchase
            </Button>
          )}
          <Button
            onClick={() => setShowForm((v) => !v)}
            className="min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
          >
            {showForm ? 'Cancel' : '+ Add Ingredient'}
          </Button>
        </div>
      </div>

      {/* Add ingredient form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
        >
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ingredName" className="text-slate-700 font-medium text-sm">
                Ingredient Name
              </Label>
              <Input
                id="ingredName"
                type="text"
                placeholder="e.g. Napier Grass, Molasses"
                value={ingredientName}
                onChange={(e) => {
                  setIngredientName(e.target.value);
                  setIngredientError('');
                }}
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

      {/* Ingredient list — expandable accordion rows */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
        {ingredients.length === 0 ? (
          <p className="py-8 text-center text-slate-400 text-sm">No ingredients yet. Add one above.</p>
        ) : (
          ingredients.map((ing) => {
            const isExpanded = expandedId === ing.id;
            const isEditingPrice = editingPriceId === ing.id;
            const stockColor =
              ing.current_stock > 100
                ? 'bg-emerald-100 text-emerald-700'
                : ing.current_stock >= 20
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700';

            return (
              <div key={ing.id}>
                {/* Collapsed header row */}
                <button
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  onClick={() => setExpandedId(isExpanded ? null : ing.id)}
                >
                  <span className="font-medium text-slate-900 text-sm">{ing.ingredient_name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold font-mono ${stockColor}`}>
                      {ing.current_stock.toFixed(1)} kg
                    </span>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />
                    }
                  </div>
                </button>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 bg-slate-50 border-t border-slate-100">
                    {/* Price edit */}
                    {canManagePricing && (
                      <div className="pt-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                          Price (KES/kg)
                        </p>
                        {isEditingPrice ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={priceInput}
                              onChange={(e) => { setPriceInput(e.target.value); setPriceError(''); }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitPriceEdit(ing.id);
                                if (e.key === 'Escape') cancelEditingPrice();
                              }}
                              className={`w-28 min-h-[40px] text-right font-mono text-sm ${priceError ? 'border-red-500' : ''}`}
                              autoFocus
                            />
                            <button
                              onClick={() => commitPriceEdit(ing.id)}
                              disabled={isPending}
                              className="text-sm text-emerald-700 hover:text-emerald-900 font-semibold disabled:opacity-50 min-h-[44px] px-2"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditingPrice}
                              className="text-sm text-slate-400 hover:text-slate-600 min-h-[44px] px-2"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditingPrice(ing)}
                            className="font-mono text-sm text-slate-900 hover:text-emerald-700 underline decoration-dashed underline-offset-2 min-h-[44px]"
                          >
                            {ing.current_price_per_kg != null
                              ? `KES ${ing.current_price_per_kg.toFixed(2)}/kg`
                              : 'Set price…'}
                          </button>
                        )}
                        {isEditingPrice && priceError && (
                          <p className="text-xs text-red-600 mt-0.5">{priceError}</p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-1">
                      {canManagePricing && (
                        <button
                          onClick={() => openPurchaseForIngredient(ing.id)}
                          disabled={isPending}
                          className="text-sm text-emerald-700 hover:text-emerald-900 font-medium disabled:opacity-50 min-h-[44px] px-2"
                        >
                          + Record Purchase
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(ing)}
                        disabled={isPending}
                        className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50 min-h-[44px] px-2"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Purchase dialog */}
      <PurchaseDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        ingredients={ingredients}
        orgId={orgId}
        defaultIngredientId={purchaseDefaultId}
        onSuccess={handlePurchaseSuccess}
      />
    </div>
  );
}
