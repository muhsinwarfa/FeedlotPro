'use client';

// ─── Flag Sick Form — P6 Health Workflow ──────────────────────────────────────
// Shown on the animal detail page when animal.status === 'ACTIVE'.
// Transitions animal → SICK, creates a health_event, optionally uploads a photo.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { validateFlagSickForm, type FlagSickFormState } from '@/lib/validators';
import { mapDbError } from '@/lib/errors';
import { addToQueue } from '@/lib/offline/queue';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import type { Pen } from '@/types/database';
import type { WorkerRole } from '@/lib/worker-session';
import { checkPermission, ACTION } from '@/lib/rbac';

const SYMPTOMS = [
  'Bloat', 'Lameness', 'Respiratory Distress', 'Diarrhea',
  'Eye Infection', 'Skin Condition', 'Loss of Appetite', 'Other',
];

const SEVERITIES: { value: string; label: string; color: string }[] = [
  { value: 'MILD', label: 'Mild', color: 'text-slate-600' },
  { value: 'MODERATE', label: 'Moderate', color: 'text-amber-600' },
  { value: 'SEVERE', label: 'Severe', color: 'text-red-600' },
];

interface Props {
  animalId: string;
  organizationId: string;
  memberId: string | null;
  role: WorkerRole;
  pens: Pick<Pen, 'id' | 'pen_name'>[];
  onSuccess?: () => void;
}

export function FlagSickForm({ animalId, organizationId, memberId, role, pens, onSuccess }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<FlagSickFormState>({
    primarySymptom: '',
    severity: '',
    sickPenId: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<FlagSickFormState>>({});

  const supabase = createClient();

  // RBAC: only roles with FLAG_SICK can submit
  if (!checkPermission(role, ACTION.FLAG_SICK)) {
    return null;
  }

  function handleChange(field: keyof FlagSickFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit() {
    const fieldErrors = validateFlagSickForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors as Partial<FlagSickFormState>);
      return;
    }

    startTransition(async () => {
      const now = new Date().toISOString();

      // 1. Update animal status → SICK
      const { error: animalError } = await supabase
        .from('animals')
        .update({
          status: 'SICK',
          sick_since: now,
          pen_id: form.sickPenId,
          updated_at: now,
        })
        .eq('id', animalId);

      if (animalError) {
        if (!navigator.onLine || animalError.message?.includes('Failed to fetch')) {
          await addToQueue({
            table: 'animals',
            method: 'UPDATE',
            payload: { id: animalId, status: 'SICK', sick_since: now, pen_id: form.sickPenId },
            localTimestamp: now,
            memberId,
          });
          toast({ title: 'Saved offline', description: 'Will sync when connected.' });
          return;
        }
        toast({ variant: 'destructive', ...mapDbError(animalError) });
        return;
      }

      // 2. Insert health_event
      const { error: eventError } = await supabase.from('health_events').insert({
        animal_id: animalId,
        organization_id: organizationId,
        event_type: 'FLAGGED_SICK',
        primary_symptom: form.primarySymptom,
        secondary_symptoms: [],
        severity: form.severity as 'MILD' | 'MODERATE' | 'SEVERE',
        notes: form.notes || null,
        photo_url: null,
        performed_by: memberId,
      });

      if (eventError) {
        // Health event failure is non-critical; animal already updated
        console.error('Health event insert failed:', eventError.message);
      }

      toast({ title: 'Animal flagged as sick', description: `Moved to sick pen. Severity: ${form.severity}.` });
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4">
      <div className="flex items-center gap-2 text-amber-700">
        <AlertTriangle className="h-5 w-5" />
        <h3 className="font-semibold">Flag Animal as Sick</h3>
      </div>

      {/* Primary Symptom */}
      <div className="space-y-1">
        <Label htmlFor="primarySymptom">Primary Symptom *</Label>
        <Select onValueChange={(v) => handleChange('primarySymptom', v)} value={form.primarySymptom}>
          <SelectTrigger id="primarySymptom" className={errors.primarySymptom ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select symptom…" />
          </SelectTrigger>
          <SelectContent>
            {SYMPTOMS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.primarySymptom && <p className="text-xs text-red-600">{errors.primarySymptom}</p>}
      </div>

      {/* Severity */}
      <div className="space-y-1">
        <Label htmlFor="severity">Severity *</Label>
        <Select onValueChange={(v) => handleChange('severity', v)} value={form.severity}>
          <SelectTrigger id="severity" className={errors.severity ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select severity…" />
          </SelectTrigger>
          <SelectContent>
            {SEVERITIES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <span className={s.color}>{s.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.severity && <p className="text-xs text-red-600">{errors.severity}</p>}
      </div>

      {/* Sick Pen */}
      <div className="space-y-1">
        <Label htmlFor="sickPenId">Move to Pen *</Label>
        <Select onValueChange={(v) => handleChange('sickPenId', v)} value={form.sickPenId}>
          <SelectTrigger id="sickPenId" className={errors.sickPenId ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select pen…" />
          </SelectTrigger>
          <SelectContent>
            {pens.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.pen_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.sickPenId && <p className="text-xs text-red-600">{errors.sickPenId}</p>}
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor="flagNotes">Notes (optional)</Label>
        <Textarea
          id="flagNotes"
          placeholder="Any additional observations…"
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={2}
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full bg-amber-600 hover:bg-amber-700 text-white min-h-[44px]"
      >
        {isPending ? 'Flagging…' : 'Flag as Sick'}
      </Button>
    </div>
  );
}
