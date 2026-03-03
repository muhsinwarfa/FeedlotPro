'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { validateBatchForm } from '@/lib/validators';
import { mapDbError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Batch } from '@/types/database';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BatchSelectorProps {
  organizationId: string;
  batches: Pick<Batch, 'id' | 'batch_code' | 'arrival_date' | 'source_supplier'>[];
  value: string; // selected batchId or ''
  onChange: (batchId: string) => void;
  disabled?: boolean;
}

const CREATE_NEW_VALUE = '__create_new__';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BatchSelector({ organizationId, batches, value, onChange, disabled }: BatchSelectorProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newBatch, setNewBatch] = useState({
    batchCode: `BATCH-${today()}`,
    arrivalDate: today(),
    sourceSupplier: '',
  });
  const [formErrors, setFormErrors] = useState<{ batchCode?: string; arrivalDate?: string }>({});

  const supabase = createClient();

  function handleSelectChange(val: string) {
    if (val === CREATE_NEW_VALUE) {
      setShowCreateForm(true);
    } else {
      setShowCreateForm(false);
      onChange(val);
    }
  }

  function handleCreateBatch() {
    const errors = validateBatchForm(newBatch);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    startTransition(async () => {
      const { data, error } = await supabase
        .from('batches')
        .insert({
          organization_id: organizationId,
          batch_code: newBatch.batchCode.trim(),
          arrival_date: newBatch.arrivalDate,
          source_supplier: newBatch.sourceSupplier.trim() || null,
        })
        .select('id, batch_code, arrival_date, source_supplier')
        .single();

      if (error) {
        toast({ variant: 'destructive', ...mapDbError(error) });
        return;
      }

      toast({ title: 'Batch Created', description: `Batch "${data.batch_code}" is ready.` });
      setShowCreateForm(false);
      onChange(data.id);
    });
  }

  const selectedBatch = batches.find((b) => b.id === value);

  return (
    <div className="space-y-3">
      <Select
        value={value || ''}
        onValueChange={handleSelectChange}
        disabled={disabled || isPending}
      >
        <SelectTrigger className="min-h-[44px]">
          <SelectValue placeholder="Select or create a batch…">
            {selectedBatch
              ? `${selectedBatch.batch_code} (${selectedBatch.arrival_date})`
              : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {batches.map((batch) => (
            <SelectItem key={batch.id} value={batch.id}>
              {batch.batch_code}
              <span className="ml-2 text-slate-400 text-xs">{batch.arrival_date}</span>
              {batch.source_supplier && (
                <span className="ml-1 text-slate-400 text-xs">· {batch.source_supplier}</span>
              )}
            </SelectItem>
          ))}
          <SelectItem value={CREATE_NEW_VALUE} className="text-amber-600 font-medium">
            + Create new batch…
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Inline batch creation — rendered as <div> to avoid nesting inside the outer IntakeForm <form> */}
      {showCreateForm && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">New Batch</p>

          <div className="space-y-1">
            <Label htmlFor="batchCode" className="text-slate-700 text-xs font-medium">
              Batch Code <span className="text-red-500">*</span>
            </Label>
            <Input
              id="batchCode"
              type="text"
              value={newBatch.batchCode}
              onChange={(e) => {
                setNewBatch((prev) => ({ ...prev, batchCode: e.target.value }));
                setFormErrors((prev) => ({ ...prev, batchCode: undefined }));
              }}
              className={`min-h-[44px] text-sm ${formErrors.batchCode ? 'border-red-500' : ''}`}
              disabled={isPending}
            />
            {formErrors.batchCode && <p className="text-xs text-red-600">{formErrors.batchCode}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="arrivalDate" className="text-slate-700 text-xs font-medium">
              Arrival Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="arrivalDate"
              type="date"
              value={newBatch.arrivalDate}
              onChange={(e) => {
                setNewBatch((prev) => ({ ...prev, arrivalDate: e.target.value }));
                setFormErrors((prev) => ({ ...prev, arrivalDate: undefined }));
              }}
              className={`min-h-[44px] text-sm ${formErrors.arrivalDate ? 'border-red-500' : ''}`}
              disabled={isPending}
            />
            {formErrors.arrivalDate && <p className="text-xs text-red-600">{formErrors.arrivalDate}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="sourceSupplier" className="text-slate-700 text-xs font-medium">
              Source / Supplier <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              id="sourceSupplier"
              type="text"
              placeholder="e.g. Narok Market, Kariuki Farm"
              value={newBatch.sourceSupplier}
              onChange={(e) => setNewBatch((prev) => ({ ...prev, sourceSupplier: e.target.value }))}
              className="min-h-[44px] text-sm"
              disabled={isPending}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleCreateBatch}
              disabled={isPending}
              className="flex-1 min-h-[44px] text-sm bg-amber-500 hover:bg-amber-600 text-white font-semibold"
            >
              {isPending ? 'Creating…' : 'Create Batch'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateForm(false)}
              className="min-h-[44px] text-sm border-slate-300"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
