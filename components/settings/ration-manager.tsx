'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { RationFormDialog, type RationWithIngredients } from './ration-form-dialog';

type Ingredient = { id: string; ingredient_name: string };

interface RationManagerProps {
  rations: RationWithIngredients[];
  ingredients: Ingredient[];
  orgId: string;
}

export function RationManager({
  rations: initialRations,
  ingredients,
  orgId,
}: RationManagerProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [rations, setRations] = useState<RationWithIngredients[]>(initialRations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRation, setEditingRation] = useState<RationWithIngredients | undefined>();

  const supabase = createClient();

  // ── Open create ────────────────────────────────────────────────────────────

  function handleCreate() {
    setEditingRation(undefined);
    setDialogOpen(true);
  }

  // ── Open edit ──────────────────────────────────────────────────────────────

  function handleEdit(ration: RationWithIngredients) {
    setEditingRation(ration);
    setDialogOpen(true);
  }

  // ── Deactivate ─────────────────────────────────────────────────────────────

  function handleDeactivate(ration: RationWithIngredients) {
    startTransition(async () => {
      const { error } = await supabase
        .from('ration_templates')
        .update({ is_active: false, updated_at: new Date().toISOString() } as never)
        .eq('id', ration.id);

      if (error) {
        const { title, description } = mapDbError(error);
        toast({ variant: 'destructive', title, description });
        return;
      }

      setRations((prev) => prev.filter((r) => r.id !== ration.id));
      toast({ title: 'Ration Deactivated', description: `"${ration.ration_name}" removed from active rations.` });
    });
  }

  // ── On form success (create or edit) ──────────────────────────────────────

  function handleFormSuccess(ration: RationWithIngredients) {
    setRations((prev) => {
      const existing = prev.findIndex((r) => r.id === ration.id);
      if (existing >= 0) {
        return prev.map((r) => (r.id === ration.id ? ration : r));
      }
      return [...prev, ration];
    });
  }

  // ── Derived per-ration totals ──────────────────────────────────────────────

  function totalKgPerAnimal(ration: RationWithIngredients): number {
    return ration.ration_ingredients.reduce(
      (sum, ri) => sum + ri.kg_per_animal_per_day,
      0
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Ration Templates</h2>
          <p className="text-sm text-slate-500">
            {rations.length} active ration{rations.length !== 1 ? 's' : ''} — pre-fill feeding
            sessions from a saved formula.
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
        >
          + New Ration
        </Button>
      </div>

      {rations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-600">No ration templates yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Create one to quickly pre-fill ingredient amounts during daily feeding.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rations.map((ration) => {
            const total = totalKgPerAnimal(ration);
            return (
              <div
                key={ration.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {ration.ration_name}
                      </h3>
                      <Badge className="bg-emerald-100 text-emerald-800 text-xs border-0">
                        Active
                      </Badge>
                    </div>
                    {ration.notes && (
                      <p className="text-xs text-slate-500 mt-0.5">{ration.notes}</p>
                    )}

                    {/* Ingredient list */}
                    <ul className="mt-2 space-y-0.5">
                      {ration.ration_ingredients.map((ri) => (
                        <li key={ri.id} className="text-xs text-slate-600 flex gap-2">
                          <span className="font-mono text-emerald-700 w-12 text-right flex-shrink-0">
                            {ri.kg_per_animal_per_day.toFixed(1)} kg
                          </span>
                          <span>
                            {ri.pantry_ingredients?.ingredient_name ?? ri.ingredient_id}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-1.5 text-xs font-mono font-semibold text-slate-700">
                      Total: {total.toFixed(1)} kg/animal/day ·{' '}
                      {ration.ration_ingredients.length} ingredient
                      {ration.ration_ingredients.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(ration)}
                      disabled={isPending}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-medium disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeactivate(ration)}
                      disabled={isPending}
                      className="text-xs text-slate-400 hover:text-red-600 font-medium disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <RationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={editingRation ? 'edit' : 'create'}
        initialRation={editingRation}
        ingredients={ingredients}
        orgId={orgId}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
