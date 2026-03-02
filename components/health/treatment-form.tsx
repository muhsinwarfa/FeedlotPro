'use client';

// ─── Treatment Form — P6 Vet Workflow ─────────────────────────────────────────
// VET-only form (gated by ACTION.VET_TREATMENT) to record medication given to
// a sick animal. Inserts treatment_record + health_event TREATMENT_ADMINISTERED.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { validateTreatmentForm, type TreatmentFormState } from '@/lib/validators';
import { mapDbError } from '@/lib/errors';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Syringe } from 'lucide-react';
import type { WorkerRole } from '@/lib/worker-session';
import { checkPermission, ACTION } from '@/lib/rbac';

const ROUTES = [
  { value: 'ORAL', label: 'Oral' },
  { value: 'INJECTION_IM', label: 'Injection (IM)' },
  { value: 'INJECTION_IV', label: 'Injection (IV)' },
  { value: 'INJECTION_SC', label: 'Injection (SC)' },
  { value: 'TOPICAL', label: 'Topical' },
  { value: 'DRENCH', label: 'Drench' },
];

interface Props {
  animalId: string;
  organizationId: string;
  memberId: string | null;
  role: WorkerRole;
  onSuccess?: () => void;
}

export function TreatmentForm({ animalId, organizationId, memberId, role, onSuccess }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<TreatmentFormState>({
    medicationName: '',
    dosage: '',
    administrationRoute: '',
    treatmentCost: '',
    notes: '',
    followUpDate: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TreatmentFormState, string>>>({});

  const supabase = createClient();

  // RBAC: only VET can record treatments
  if (!checkPermission(role, ACTION.VET_TREATMENT)) {
    return null;
  }

  function handleChange(field: keyof TreatmentFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit() {
    const fieldErrors = validateTreatmentForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    startTransition(async () => {
      const now = new Date().toISOString();

      // 1. Insert treatment record
      const { error: treatError } = await supabase.from('treatment_records').insert({
        animal_id: animalId,
        organization_id: organizationId,
        medication_name: form.medicationName.trim(),
        dosage: form.dosage.trim(),
        administration_route: form.administrationRoute,
        treatment_cost: form.treatmentCost ? parseFloat(form.treatmentCost) : null,
        notes: form.notes || null,
        follow_up_date: form.followUpDate || null,
        treated_by: memberId,
        treated_at: now,
      });

      if (treatError) {
        toast({ variant: 'destructive', ...mapDbError(treatError) });
        return;
      }

      // 2. Insert health_event TREATMENT_ADMINISTERED
      await supabase.from('health_events').insert({
        animal_id: animalId,
        organization_id: organizationId,
        event_type: 'TREATMENT_ADMINISTERED',
        primary_symptom: null,
        secondary_symptoms: [],
        severity: null,
        notes: `${form.medicationName} ${form.dosage} via ${form.administrationRoute}`,
        photo_url: null,
        performed_by: memberId,
      });

      toast({ title: 'Treatment recorded', description: `${form.medicationName} administered.` });
      // Reset form
      setForm({ medicationName: '', dosage: '', administrationRoute: '', treatmentCost: '', notes: '', followUpDate: '' });
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-4">
      <div className="flex items-center gap-2 text-blue-700">
        <Syringe className="h-5 w-5" />
        <h3 className="font-semibold">Record Treatment</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Medication Name */}
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="medicationName">Medication Name *</Label>
          <Input
            id="medicationName"
            placeholder="e.g. Oxytetracycline"
            value={form.medicationName}
            onChange={(e) => handleChange('medicationName', e.target.value)}
            className={errors.medicationName ? 'border-red-500' : ''}
          />
          {errors.medicationName && <p className="text-xs text-red-600">{errors.medicationName}</p>}
        </div>

        {/* Dosage */}
        <div className="space-y-1">
          <Label htmlFor="dosage">Dosage *</Label>
          <Input
            id="dosage"
            placeholder="e.g. 10 ml"
            value={form.dosage}
            onChange={(e) => handleChange('dosage', e.target.value)}
            className={errors.dosage ? 'border-red-500' : ''}
          />
          {errors.dosage && <p className="text-xs text-red-600">{errors.dosage}</p>}
        </div>

        {/* Administration Route */}
        <div className="space-y-1">
          <Label htmlFor="adminRoute">Route *</Label>
          <Select onValueChange={(v) => handleChange('administrationRoute', v)} value={form.administrationRoute}>
            <SelectTrigger id="adminRoute" className={errors.administrationRoute ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select route…" />
            </SelectTrigger>
            <SelectContent>
              {ROUTES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.administrationRoute && <p className="text-xs text-red-600">{errors.administrationRoute}</p>}
        </div>

        {/* Treatment Cost */}
        <div className="space-y-1">
          <Label htmlFor="treatmentCost">Cost (KES, optional)</Label>
          <Input
            id="treatmentCost"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.treatmentCost}
            onChange={(e) => handleChange('treatmentCost', e.target.value)}
            className={errors.treatmentCost ? 'border-red-500' : ''}
          />
          {errors.treatmentCost && <p className="text-xs text-red-600">{errors.treatmentCost}</p>}
        </div>

        {/* Follow-up Date */}
        <div className="space-y-1">
          <Label htmlFor="followUpDate">Follow-up Date (optional)</Label>
          <Input
            id="followUpDate"
            type="date"
            value={form.followUpDate}
            onChange={(e) => handleChange('followUpDate', e.target.value)}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="treatNotes">Notes (optional)</Label>
          <Textarea
            id="treatNotes"
            placeholder="Observations, animal response…"
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full bg-blue-700 hover:bg-blue-800 text-white min-h-[44px]"
      >
        {isPending ? 'Saving…' : 'Record Treatment'}
      </Button>
    </div>
  );
}
