'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────────

type AnimalStatus = 'ACTIVE' | 'SICK' | 'DEAD' | 'DISPATCHED';

type Animal = {
  id: string;
  status: string;
  tag_id: string;
  pen_id: string;
};

type Pen = {
  id: string;
  pen_name: string;
  capacity: number | null;
  active_animal_count: number;
};

interface StatusFormProps {
  animal: Animal;
  pens: Pen[];
}

// ─── Transition map ──────────────────────────────────────────────────────────────

const TRANSITIONS: Record<AnimalStatus, AnimalStatus[]> = {
  ACTIVE:     ['SICK', 'DEAD', 'DISPATCHED'],
  SICK:       ['ACTIVE', 'DEAD', 'DISPATCHED'],
  DEAD:       [],
  DISPATCHED: [],
};

const STATUS_BUTTON: Record<AnimalStatus, { label: string; classes: string }> = {
  ACTIVE:     { label: 'Mark Active (Recovered)',   classes: 'bg-emerald-950 hover:bg-emerald-800 text-white' },
  SICK:       { label: 'Mark Sick',                 classes: 'bg-amber-500 hover:bg-amber-600 text-white' },
  DEAD:       { label: 'Mark Dead',                 classes: 'bg-red-600 hover:bg-red-700 text-white' },
  DISPATCHED: { label: 'Mark Dispatched',           classes: 'bg-blue-600 hover:bg-blue-700 text-white' },
};

// ─── Component ──────────────────────────────────────────────────────────────────

export function StatusForm({ animal, pens }: StatusFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [confirmStatus, setConfirmStatus] = useState<AnimalStatus | null>(null);
  const [sickPenId, setSickPenId] = useState<string>('');

  const supabase = createClient();
  const currentStatus = animal.status as AnimalStatus;
  const validTransitions = TRANSITIONS[currentStatus] ?? [];

  // Sealed states
  if (validTransitions.length === 0) {
    return (
      <p className="text-sm text-slate-500 bg-slate-50 rounded-md px-4 py-3 border border-slate-200">
        No further status changes are possible for this animal.
      </p>
    );
  }

  function handleTransitionClick(targetStatus: AnimalStatus) {
    if (targetStatus === 'SICK') {
      // Need pen selection — show inline UI, not dialog
      setConfirmStatus(targetStatus);
    } else {
      setConfirmStatus(targetStatus);
    }
  }

  function handleConfirm() {
    if (!confirmStatus) return;

    if (confirmStatus === 'SICK' && !sickPenId) {
      toast({ variant: 'destructive', title: 'Select a Pen', description: 'Please select a pen for the sick animal.' });
      return;
    }

    startTransition(async () => {
      const updatePayload: Record<string, unknown> = {
        status: confirmStatus,
      };

      if (confirmStatus === 'SICK' && sickPenId) {
        updatePayload.pen_id = sickPenId;
      }

      const { error } = await supabase
        .from('animals')
        .update(updatePayload as never)
        .eq('id', animal.id);

      if (error) {
        const { title, description } = mapDbError(error);
        toast({ variant: 'destructive', title, description });
        setConfirmStatus(null);
        return;
      }

      toast({
        title: 'Status Updated',
        description: `Animal ${animal.tag_id} is now ${confirmStatus}.`,
      });

      setConfirmStatus(null);
      setSickPenId('');
      router.refresh();
    });
  }

  const isIrreversible = (s: AnimalStatus) => s === 'DEAD' || s === 'DISPATCHED';

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Current status: <span className="font-semibold text-slate-700">{currentStatus}</span>.
        Select a new status below.
      </p>

      {/* Transition buttons */}
      <div className="flex flex-wrap gap-3">
        {validTransitions.map((target) => (
          <Button
            key={target}
            onClick={() => handleTransitionClick(target)}
            disabled={isPending}
            className={`min-h-[44px] font-semibold ${STATUS_BUTTON[target]?.classes ?? ''}`}
          >
            {STATUS_BUTTON[target]?.label ?? target}
          </Button>
        ))}
      </div>

      {/* SICK confirmation inline — need pen selection */}
      {confirmStatus === 'SICK' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm font-medium text-amber-800">Moving to sick pen</p>
          <div className="space-y-1.5">
            <label className="text-sm text-slate-700 font-medium">Select Sick Pen</label>
            <Select value={sickPenId} onValueChange={setSickPenId}>
              <SelectTrigger className="min-h-[44px] bg-white">
                <SelectValue placeholder="Choose a pen…" />
              </SelectTrigger>
              <SelectContent>
                {pens
                  .filter((p) => p.id !== animal.pen_id)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.pen_name}
                      {p.capacity != null && (
                        <span className="ml-2 text-slate-400 text-xs">
                          ({p.active_animal_count}/{p.capacity})
                        </span>
                      )}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleConfirm}
              disabled={isPending || !sickPenId}
              className="min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
            >
              {isPending ? 'Updating…' : 'Confirm — Move to Sick Pen'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => { setConfirmStatus(null); setSickPenId(''); }}
              className="min-h-[44px] border-slate-300 text-slate-600"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* DEAD / DISPATCHED confirmation dialog */}
      <Dialog
        open={confirmStatus === 'DEAD' || confirmStatus === 'DISPATCHED'}
        onOpenChange={(open) => { if (!open) setConfirmStatus(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmStatus === 'DEAD' ? 'Record Mortality' : 'Dispatch Animal'}
            </DialogTitle>
            <DialogDescription>
              {confirmStatus === 'DEAD'
                ? `This will permanently mark animal ${animal.tag_id} as DEAD. This action cannot be undone.`
                : `This will permanently mark animal ${animal.tag_id} as DISPATCHED (sold/removed). This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              className={`flex-1 min-h-[44px] font-semibold text-white ${
                confirmStatus === 'DEAD'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isPending
                ? 'Processing…'
                : confirmStatus === 'DEAD'
                ? 'Yes, Record as Dead'
                : 'Yes, Dispatch Animal'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setConfirmStatus(null)}
              className="min-h-[44px] border-slate-300 text-slate-600"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
