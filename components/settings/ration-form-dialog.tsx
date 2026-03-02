'use client';

import { useState, useTransition, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import {
  validateRationForm,
  validateRationIngredientRow,
  type RationFormState,
  type RationIngredientRowState,
} from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type Ingredient = { id: string; ingredient_name: string };

export type RationWithIngredients = {
  id: string;
  ration_name: string;
  notes: string | null;
  is_active: boolean;
  ration_ingredients: Array<{
    id: string;
    ingredient_id: string;
    kg_per_animal_per_day: number;
    pantry_ingredients: { ingredient_name: string } | null;
  }>;
};

interface RationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialRation?: RationWithIngredients;
  ingredients: Ingredient[];
  orgId: string;
  onSuccess: (ration: RationWithIngredients) => void;
}

const EMPTY_HEADER: RationFormState = { rationName: '', notes: '' };
const EMPTY_ROW: RationIngredientRowState = { ingredientId: '', kgPerAnimalPerDay: '' };

export function RationFormDialog({
  open,
  onOpenChange,
  mode,
  initialRation,
  ingredients,
  orgId,
  onSuccess,
}: RationFormDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [header, setHeader] = useState<RationFormState>({ ...EMPTY_HEADER });
  const [headerErrors, setHeaderErrors] = useState<Record<string, string | undefined>>({});

  const [rows, setRows] = useState<RationIngredientRowState[]>([{ ...EMPTY_ROW }]);
  const [rowErrors, setRowErrors] = useState<Array<Record<string, string | undefined>>>([{}]);
  const [noRowsError, setNoRowsError] = useState('');

  const supabase = createClient();

  // Seed form when dialog opens
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initialRation) {
      setHeader({ rationName: initialRation.ration_name, notes: initialRation.notes ?? '' });
      const seedRows = initialRation.ration_ingredients.map((ri) => ({
        ingredientId: ri.ingredient_id,
        kgPerAnimalPerDay: ri.kg_per_animal_per_day.toString(),
      }));
      setRows(seedRows.length > 0 ? seedRows : [{ ...EMPTY_ROW }]);
      setRowErrors(seedRows.map(() => ({})));
    } else {
      setHeader({ ...EMPTY_HEADER });
      setRows([{ ...EMPTY_ROW }]);
      setRowErrors([{}]);
    }
    setHeaderErrors({});
    setNoRowsError('');
  }, [open, mode, initialRation]);

  // ── Header changes ─────────────────────────────────────────────────────────

  function handleHeaderChange(field: keyof RationFormState, value: string) {
    setHeader((prev) => ({ ...prev, [field]: value }));
    setHeaderErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  // ── Ingredient row management ──────────────────────────────────────────────

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
    setRowErrors((prev) => [...prev, {}]);
    setNoRowsError('');
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setRowErrors((prev) => prev.filter((_, i) => i !== index));
  }

  function handleRowChange(
    index: number,
    field: keyof RationIngredientRowState,
    value: string
  ) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    setRowErrors((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: undefined } : e))
    );
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  function handleSubmit() {
    // Validate header
    const hErrors = validateRationForm(header);
    if (Object.keys(hErrors).length > 0) {
      setHeaderErrors({ ...hErrors });
      return;
    }

    // Require at least one ingredient row
    const nonEmptyRows = rows.filter(
      (r) => r.ingredientId || r.kgPerAnimalPerDay
    );
    if (nonEmptyRows.length === 0) {
      setNoRowsError('At least one ingredient is required.');
      return;
    }

    // Validate all rows
    const allRowErrors = rows.map((r) => ({ ...validateRationIngredientRow(r) }));
    const hasRowErrors = allRowErrors.some((e) => Object.keys(e).length > 0);
    if (hasRowErrors) {
      setRowErrors(allRowErrors);
      return;
    }

    // Check for duplicate ingredient selection across rows
    const ids = rows.map((r) => r.ingredientId).filter(Boolean);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      setNoRowsError('Each ingredient can only appear once in a ration.');
      return;
    }

    startTransition(async () => {
      if (mode === 'create') {
        // 1. Insert ration template header
        const { data: templateData, error: templateError } = await supabase
          .from('ration_templates')
          .insert({
            organization_id: orgId,
            ration_name: header.rationName.trim(),
            notes: header.notes.trim() || null,
            is_active: true,
          } as never)
          .select('id, ration_name, notes, is_active, created_at, updated_at')
          .single();

        if (templateError) {
          const { title, description } = mapDbError(templateError);
          toast({ variant: 'destructive', title, description });
          return;
        }

        const template = templateData as { id: string; ration_name: string; notes: string | null; is_active: boolean; created_at: string; updated_at: string };

        // 2. Bulk insert ingredient rows
        const ingredientRows = rows.map((r) => ({
          ration_template_id: template.id,
          ingredient_id: r.ingredientId,
          kg_per_animal_per_day: parseFloat(r.kgPerAnimalPerDay),
        }));

        const { error: rowsError } = await supabase
          .from('ration_ingredients')
          .insert(ingredientRows as never);

        if (rowsError) {
          const { title, description } = mapDbError(rowsError);
          toast({ variant: 'destructive', title, description });
          return;
        }

        // Build full ration object for optimistic UI update
        const fullRation: RationWithIngredients = {
          id: template.id,
          ration_name: template.ration_name,
          notes: template.notes,
          is_active: template.is_active,
          ration_ingredients: rows.map((r, i) => ({
            id: `temp-${i}`,
            ingredient_id: r.ingredientId,
            kg_per_animal_per_day: parseFloat(r.kgPerAnimalPerDay),
            pantry_ingredients:
              ingredients.find((ing) => ing.id === r.ingredientId)
                ? { ingredient_name: ingredients.find((ing) => ing.id === r.ingredientId)!.ingredient_name }
                : null,
          })),
        };

        toast({ title: 'Ration Created', description: `"${template.ration_name}" saved.` });
        onSuccess(fullRation);
        onOpenChange(false);
      } else if (mode === 'edit' && initialRation) {
        // Edit mode: update header + delete old rows + insert new rows
        const { error: headerError } = await supabase
          .from('ration_templates')
          .update({
            ration_name: header.rationName.trim(),
            notes: header.notes.trim() || null,
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', initialRation.id);

        if (headerError) {
          const { title, description } = mapDbError(headerError);
          toast({ variant: 'destructive', title, description });
          return;
        }

        // Delete all existing ingredient rows
        const { error: deleteError } = await supabase
          .from('ration_ingredients')
          .delete()
          .eq('ration_template_id', initialRation.id);

        if (deleteError) {
          const { title, description } = mapDbError(deleteError);
          toast({ variant: 'destructive', title, description });
          return;
        }

        // Re-insert updated rows
        const ingredientRows = rows.map((r) => ({
          ration_template_id: initialRation.id,
          ingredient_id: r.ingredientId,
          kg_per_animal_per_day: parseFloat(r.kgPerAnimalPerDay),
        }));

        const { error: insertError } = await supabase
          .from('ration_ingredients')
          .insert(ingredientRows as never);

        if (insertError) {
          const { title, description } = mapDbError(insertError);
          toast({ variant: 'destructive', title, description });
          return;
        }

        const updatedRation: RationWithIngredients = {
          id: initialRation.id,
          ration_name: header.rationName.trim(),
          notes: header.notes.trim() || null,
          is_active: initialRation.is_active,
          ration_ingredients: rows.map((r, i) => ({
            id: `temp-edit-${i}`,
            ingredient_id: r.ingredientId,
            kg_per_animal_per_day: parseFloat(r.kgPerAnimalPerDay),
            pantry_ingredients:
              ingredients.find((ing) => ing.id === r.ingredientId)
                ? { ingredient_name: ingredients.find((ing) => ing.id === r.ingredientId)!.ingredient_name }
                : null,
          })),
        };

        toast({ title: 'Ration Updated', description: `"${header.rationName.trim()}" saved.` });
        onSuccess(updatedRation);
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-emerald-950">
            {mode === 'create' ? 'New Ration Template' : 'Edit Ration Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Ration name */}
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium text-sm">Ration Name *</Label>
            <Input
              type="text"
              placeholder="e.g. Grower Phase 1, Pre-Dispatch Ration"
              value={header.rationName}
              onChange={(e) => handleHeaderChange('rationName', e.target.value)}
              className={`min-h-[44px] ${headerErrors.rationName ? 'border-red-500' : ''}`}
              autoFocus
            />
            {headerErrors.rationName && (
              <p className="text-xs text-red-600">{headerErrors.rationName}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium text-sm">Notes (optional)</Label>
            <Input
              type="text"
              placeholder="e.g. For animals 200–350 kg"
              value={header.notes}
              onChange={(e) => handleHeaderChange('notes', e.target.value)}
              className="min-h-[44px]"
            />
          </div>

          {/* Ingredient rows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-slate-700 font-medium text-sm">
                Ingredients (kg / animal / day) *
              </Label>
              <button
                type="button"
                onClick={addRow}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold"
              >
                + Add Row
              </button>
            </div>

            {noRowsError && (
              <p className="text-xs text-red-600">{noRowsError}</p>
            )}

            <div className="space-y-2">
              {rows.map((row, index) => (
                <div key={index} className="flex items-start gap-2">
                  {/* Ingredient selector */}
                  <div className="flex-1">
                    <Select
                      value={row.ingredientId}
                      onValueChange={(v) => handleRowChange(index, 'ingredientId', v)}
                    >
                      <SelectTrigger
                        className={`min-h-[44px] ${
                          rowErrors[index]?.ingredientId ? 'border-red-500' : ''
                        }`}
                      >
                        <SelectValue placeholder="Select ingredient…" />
                      </SelectTrigger>
                      <SelectContent>
                        {ingredients.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.ingredient_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {rowErrors[index]?.ingredientId && (
                      <p className="text-xs text-red-600 mt-0.5">
                        {rowErrors[index].ingredientId}
                      </p>
                    )}
                  </div>

                  {/* kg/animal/day */}
                  <div className="w-28">
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="kg"
                      value={row.kgPerAnimalPerDay}
                      onChange={(e) =>
                        handleRowChange(index, 'kgPerAnimalPerDay', e.target.value)
                      }
                      className={`min-h-[44px] font-mono text-right ${
                        rowErrors[index]?.kgPerAnimalPerDay ? 'border-red-500' : ''
                      }`}
                    />
                    {rowErrors[index]?.kgPerAnimalPerDay && (
                      <p className="text-xs text-red-600 mt-0.5">
                        {rowErrors[index].kgPerAnimalPerDay}
                      </p>
                    )}
                  </div>

                  {/* Remove row */}
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="mt-2.5 text-slate-400 hover:text-red-600 text-lg leading-none flex-shrink-0"
                      aria-label="Remove row"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="flex-1 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 min-h-[44px] bg-emerald-950 hover:bg-emerald-800 text-white"
            >
              {isPending ? 'Saving…' : mode === 'create' ? 'Create Ration' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
