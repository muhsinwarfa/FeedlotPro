'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface WeightFormProps {
  animalId: string;
  animalStatus: string;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function WeightForm({ animalId, animalStatus }: WeightFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [newWeight, setNewWeight] = useState('');
  const [weighDate, setWeighDate] = useState(today());
  const [weightError, setWeightError] = useState('');

  const supabase = createClient();

  // Only ACTIVE animals can have weight recorded
  if (animalStatus !== 'ACTIVE') {
    return (
      <p className="text-sm text-slate-500 bg-slate-50 rounded-md px-4 py-3 border border-slate-200">
        Weight can only be recorded for <span className="font-medium">ACTIVE</span> animals.
        {animalStatus === 'SICK' && ' Move this animal back to Active to record weight.'}
      </p>
    );
  }

  function validate(): boolean {
    const w = parseFloat(newWeight);
    if (!newWeight) {
      setWeightError('Weight is required.');
      return false;
    }
    if (isNaN(w) || w <= 0) {
      setWeightError('Weight must be a positive number.');
      return false;
    }
    if (!weighDate) {
      setWeightError('Date is required.');
      return false;
    }
    setWeightError('');
    return true;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    startTransition(async () => {
      const payload: Record<string, unknown> = {
        animal_id: animalId,
        new_weight: parseFloat(newWeight),
        weigh_date: new Date(weighDate).toISOString(),
      };

      const { error } = await supabase.from('weight_records').insert(payload as never);

      if (error) {
        const { title, description } = mapDbError(error);
        toast({ variant: 'destructive', title, description });
        return;
      }

      toast({
        title: 'Weight Recorded',
        description: `Current weight set to ${parseFloat(newWeight).toFixed(1)} kg.`,
      });

      setNewWeight('');
      setWeighDate(today());
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="flex gap-4 items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="newWeight" className="text-slate-700 font-medium">
            New Weight (kg) <span className="text-red-500">*</span>
          </Label>
          <Input
            id="newWeight"
            type="number"
            min="0.1"
            step="0.1"
            placeholder="0.0"
            value={newWeight}
            onChange={(e) => { setNewWeight(e.target.value); setWeightError(''); }}
            className={`min-h-[44px] font-mono ${weightError ? 'border-red-500' : ''}`}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weighDate" className="text-slate-700 font-medium">Date</Label>
          <Input
            id="weighDate"
            type="date"
            value={weighDate}
            onChange={(e) => setWeighDate(e.target.value)}
            className="min-h-[44px]"
            disabled={isPending}
          />
        </div>
      </div>

      {weightError && <p className="text-xs text-red-600">{weightError}</p>}

      <Button
        type="submit"
        disabled={isPending}
        className="min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
      >
        {isPending ? 'Saving…' : 'Record Weight'}
      </Button>
    </form>
  );
}
