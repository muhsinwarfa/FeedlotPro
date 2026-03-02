'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import { validatePriceForm } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
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

      {/* Ingredient list */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {ingredients.length === 0 ? (
          <p className="py-8 text-center text-slate-400 text-sm">No ingredients yet. Add one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Ingredient
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Price (KES/kg)
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Stock (kg)
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ingredients.map((ing) => {
                const isEditingPrice = editingPriceId === ing.id;
                return (
                  <tr key={ing.id}>
                    {/* Name */}
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {ing.ingredient_name}
                    </td>

                    {/* Unit */}
                    <td className="px-4 py-3 text-center font-mono text-slate-500">
                      {ing.unit}
                    </td>

                    {/* Price — inline editable for OWNER/MANAGER */}
                    <td className="px-4 py-3 text-right">
                      {isEditingPrice ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={priceInput}
                            onChange={(e) => {
                              setPriceInput(e.target.value);
                              setPriceError('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitPriceEdit(ing.id);
                              if (e.key === 'Escape') cancelEditingPrice();
                            }}
                            className={`w-24 min-h-[36px] text-right font-mono text-sm ${
                              priceError ? 'border-red-500' : ''
                            }`}
                            autoFocus
                          />
                          <button
                            onClick={() => commitPriceEdit(ing.id)}
                            disabled={isPending}
                            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditingPrice}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => (canManagePricing ? startEditingPrice(ing) : undefined)}
                          className={`font-mono text-sm ${
                            canManagePricing
                              ? 'hover:text-emerald-700 cursor-pointer underline decoration-dashed underline-offset-2'
                              : 'cursor-default'
                          } ${
                            ing.current_price_per_kg == null ? 'text-slate-400' : 'text-slate-900'
                          }`}
                          title={canManagePricing ? 'Click to edit price' : undefined}
                        >
                          {ing.current_price_per_kg != null
                            ? ing.current_price_per_kg.toFixed(2)
                            : '— KES/kg'}
                        </button>
                      )}
                      {isEditingPrice && priceError && (
                        <p className="text-xs text-red-600 mt-0.5 text-right">{priceError}</p>
                      )}
                    </td>

                    {/* Stock level with colour coding */}
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-mono text-sm font-semibold ${
                          ing.current_stock <= 0
                            ? 'text-red-600'
                            : ing.current_stock < 50
                            ? 'text-amber-600'
                            : 'text-emerald-700'
                        }`}
                      >
                        {ing.current_stock.toFixed(1)}
                      </span>
                    </td>

                    {/* Row actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {canManagePricing && (
                          <button
                            onClick={() => openPurchaseForIngredient(ing.id)}
                            disabled={isPending}
                            className="text-xs text-emerald-700 hover:text-emerald-900 font-medium disabled:opacity-50"
                          >
                            + Stock
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(ing)}
                          disabled={isPending}
                          className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
