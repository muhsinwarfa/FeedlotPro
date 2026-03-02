'use client';

// ─── Health Outcome Form — P6 Resolve Sick Animal ────────────────────────────
// VET / MANAGER form to resolve a sick animal's health status.
// Outcomes: RECOVERED | STILL_SICK | DEAD | DISPATCHED_EARLY
// DEAD and DISPATCHED_EARLY show confirmation dialogs before proceeding (irreversible).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle } from 'lucide-react';
import type { WorkerRole } from '@/lib/worker-session';
import { checkPermission, ACTION } from '@/lib/rbac';

type Outcome = 'RECOVERED' | 'STILL_SICK' | 'DEAD' | 'DISPATCHED_EARLY';

const OUTCOMES: { value: Outcome; label: string; description: string }[] = [
  { value: 'RECOVERED', label: 'Recovered', description: 'Animal has fully recovered and is active again.' },
  { value: 'STILL_SICK', label: 'Still Sick (Follow-up)', description: 'Animal remains sick — log a follow-up note.' },
  { value: 'DEAD', label: 'Died', description: 'Animal did not recover. This is irreversible.' },
  { value: 'DISPATCHED_EARLY', label: 'Dispatched Early', description: 'Animal dispatched before reaching target weight. Irreversible.' },
];

interface Props {
  animalId: string;
  organizationId: string;
  memberId: string | null;
  role: WorkerRole;
  onSuccess?: () => void;
}

export function HealthOutcomeForm({ animalId, organizationId, memberId, role, onSuccess }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [outcome, setOutcome] = useState<Outcome | ''>('');
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const supabase = createClient();

  // RBAC gate
  if (!checkPermission(role, ACTION.HEALTH_OUTCOME)) {
    return null;
  }

  function handleResolveClick() {
    if (!outcome) {
      toast({ variant: 'destructive', title: 'Select an outcome', description: 'Please choose the health outcome first.' });
      return;
    }
    if (outcome === 'DEAD' || outcome === 'DISPATCHED_EARLY') {
      setConfirmOpen(true);
    } else {
      executeOutcome();
    }
  }

  function executeOutcome() {
    startTransition(async () => {
      const now = new Date().toISOString();
      let animalUpdate: Record<string, unknown> = { updated_at: now };
      let eventType: string;

      switch (outcome) {
        case 'RECOVERED':
          animalUpdate = { ...animalUpdate, status: 'ACTIVE', sick_since: null };
          eventType = 'RECOVERED';
          break;
        case 'STILL_SICK':
          eventType = 'FOLLOW_UP_SCHEDULED';
          break;
        case 'DEAD':
          animalUpdate = { ...animalUpdate, status: 'DEAD' };
          eventType = 'MORTALITY';
          break;
        case 'DISPATCHED_EARLY':
          animalUpdate = { ...animalUpdate, status: 'DISPATCHED' };
          eventType = 'DISPATCHED_EARLY';
          break;
        default:
          return;
      }

      // Update animal (only for outcomes that change status)
      if (Object.keys(animalUpdate).length > 1) {
        const { error } = await supabase
          .from('animals')
          .update(animalUpdate)
          .eq('id', animalId);

        if (error) {
          toast({ variant: 'destructive', ...mapDbError(error) });
          return;
        }
      }

      // Insert health event
      await supabase.from('health_events').insert({
        animal_id: animalId,
        organization_id: organizationId,
        event_type: eventType,
        primary_symptom: null,
        secondary_symptoms: [],
        severity: null,
        notes: notes || null,
        photo_url: null,
        performed_by: memberId,
      });

      const outcomeLabel = OUTCOMES.find((o) => o.value === outcome)?.label ?? outcome;
      toast({ title: 'Outcome recorded', description: `Status updated: ${outcomeLabel}.` });
      onSuccess?.();
      router.refresh();
    });
  }

  const selectedOutcome = OUTCOMES.find((o) => o.value === outcome);

  return (
    <>
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-4">
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle className="h-5 w-5" />
          <h3 className="font-semibold">Resolve Health Status</h3>
        </div>

        <div className="space-y-1">
          <Label htmlFor="outcome">Outcome *</Label>
          <Select onValueChange={(v) => setOutcome(v as Outcome)} value={outcome}>
            <SelectTrigger id="outcome">
              <SelectValue placeholder="Select outcome…" />
            </SelectTrigger>
            <SelectContent>
              {OUTCOMES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                  {(o.value === 'DEAD' || o.value === 'DISPATCHED_EARLY') && (
                    <span className="ml-1 text-xs text-red-500">(irreversible)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedOutcome && (
            <p className="text-xs text-slate-500">{selectedOutcome.description}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="outcomeNotes">Notes (optional)</Label>
          <Textarea
            id="outcomeNotes"
            placeholder="Veterinary observations…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <Button
          onClick={handleResolveClick}
          disabled={isPending || !outcome}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white min-h-[44px]"
        >
          {isPending ? 'Saving…' : 'Record Outcome'}
        </Button>
      </div>

      {/* Confirmation dialog for irreversible outcomes */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm — this action is irreversible</AlertDialogTitle>
            <AlertDialogDescription>
              {outcome === 'DEAD'
                ? 'This will mark the animal as DEAD. The record will be locked and cannot be modified.'
                : 'This will mark the animal as DISPATCHED. The record will be locked and cannot be modified.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setConfirmOpen(false);
                executeOutcome();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
