'use client';

import { useState, useTransition, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import { validatePurchaseForm, type PurchaseFormState } from '@/lib/validators';
import { addToQueue } from '@/lib/offline/queue';
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
import { useWorkerSession } from '@/contexts/worker-session-context';

type Ingredient = { id: string; ingredient_name: string };

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredients: Ingredient[];
  orgId: string;
  defaultIngredientId?: string;
  onSuccess: (ingredientId: string, qtyAdded: number) => void;
}

const EMPTY_FORM: PurchaseFormState = {
  ingredientId: '',
  quantityKg: '',
  totalCost: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  notes: '',
};

export function PurchaseDialog({
  open,
  onOpenChange,
  ingredients,
  orgId,
  defaultIngredientId,
  onSuccess,
}: PurchaseDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { activeSession } = useWorkerSession();

  const [form, setForm] = useState<PurchaseFormState>({ ...EMPTY_FORM });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  // Pre-select the ingredient when opened from a row "+ Stock" button
  useEffect(() => {
    if (open) {
      setForm({
        ...EMPTY_FORM,
        ingredientId: defaultIngredientId ?? '',
        purchaseDate: new Date().toISOString().split('T')[0],
      });
      setFieldErrors({});
    }
  }, [open, defaultIngredientId]);

  const supabase = createClient();

  function handleChange(field: keyof PurchaseFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit() {
    const errors = validatePurchaseForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors({ ...errors });
      return;
    }

    const qty = parseFloat(form.quantityKg);
    const cost = parseFloat(form.totalCost);
    const unitCost = parseFloat((cost / qty).toFixed(4));

    startTransition(async () => {
      const payload = {
        organization_id: orgId,
        ingredient_id: form.ingredientId,
        transaction_type: 'PURCHASE',
        quantity_kg: qty,
        unit_cost_per_kg: unitCost,
        total_cost: cost,
        notes: form.notes.trim() || null,
        performed_by: activeSession?.memberId ?? null,
        transacted_at: new Date(form.purchaseDate).toISOString(),
      };

      const { error } = await supabase
        .from('stock_transactions')
        .insert(payload as never);

      if (error) {
        // Offline fallback
        if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
          await addToQueue({
            table: 'stock_transactions',
            method: 'INSERT',
            payload,
            localTimestamp: new Date().toISOString(),
            memberId: activeSession?.memberId ?? null,
          });
          toast({ title: 'Purchase saved offline', description: 'Will sync when connected.' });
          onSuccess(form.ingredientId, qty);
          onOpenChange(false);
          return;
        }
        const { title, description } = mapDbError(error);
        toast({ variant: 'destructive', title, description });
        return;
      }

      // trg_stock_level_on_transaction updates current_stock in DB automatically
      toast({
        title: 'Purchase Recorded',
        description: `${qty.toFixed(1)} kg added. Total cost: KES ${cost.toFixed(2)}.`,
      });
      onSuccess(form.ingredientId, qty);
      onOpenChange(false);
    });
  }

  const ingredientName =
    ingredients.find((i) => i.id === form.ingredientId)?.ingredient_name ?? '';

  const derivedUnitCost =
    form.quantityKg && form.totalCost
      ? (parseFloat(form.totalCost) / parseFloat(form.quantityKg)).toFixed(2)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-emerald-950">Record Feed Purchase</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Ingredient */}
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium text-sm">Ingredient *</Label>
            <Select
              value={form.ingredientId}
              onValueChange={(v) => handleChange('ingredientId', v)}
            >
              <SelectTrigger
                className={`min-h-[44px] ${fieldErrors.ingredientId ? 'border-red-500' : ''}`}
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
            {fieldErrors.ingredientId && (
              <p className="text-xs text-red-600">{fieldErrors.ingredientId}</p>
            )}
          </div>

          {/* Quantity + Total Cost — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium text-sm">Quantity (kg) *</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 500"
                value={form.quantityKg}
                onChange={(e) => handleChange('quantityKg', e.target.value)}
                className={`min-h-[44px] font-mono ${fieldErrors.quantityKg ? 'border-red-500' : ''}`}
              />
              {fieldErrors.quantityKg && (
                <p className="text-xs text-red-600">{fieldErrors.quantityKg}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium text-sm">Total Cost (KES) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 4500"
                value={form.totalCost}
                onChange={(e) => handleChange('totalCost', e.target.value)}
                className={`min-h-[44px] font-mono ${fieldErrors.totalCost ? 'border-red-500' : ''}`}
              />
              {fieldErrors.totalCost && (
                <p className="text-xs text-red-600">{fieldErrors.totalCost}</p>
              )}
            </div>
          </div>

          {/* Derived unit cost preview */}
          {derivedUnitCost && !isNaN(parseFloat(derivedUnitCost)) && (
            <p className="text-xs text-slate-500 font-mono">
              → KES {derivedUnitCost}/kg for{' '}
              <span className="font-semibold">{ingredientName || 'selected ingredient'}</span>
            </p>
          )}

          {/* Purchase date */}
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium text-sm">Purchase Date *</Label>
            <Input
              type="date"
              value={form.purchaseDate}
              onChange={(e) => handleChange('purchaseDate', e.target.value)}
              className={`min-h-[44px] ${fieldErrors.purchaseDate ? 'border-red-500' : ''}`}
            />
            {fieldErrors.purchaseDate && (
              <p className="text-xs text-red-600">{fieldErrors.purchaseDate}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium text-sm">Notes (optional)</Label>
            <Input
              type="text"
              placeholder="e.g. Supplier name, batch number"
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="min-h-[44px]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
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
              {isPending ? 'Saving…' : 'Record Purchase'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
