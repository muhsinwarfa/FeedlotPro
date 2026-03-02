'use client';

// ─── Flag Sick Form — P6A Health Workflow ─────────────────────────────────────
// Shown on the animal detail page when animal.status === 'ACTIVE'.
// Transitions animal → SICK, creates a health_event with photo + secondary symptoms.
// V2.1: Added sick photo capture (dropzone) + secondary symptoms multi-select.

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
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

  // V2.1: Secondary symptoms multi-select
  const [secondarySymptoms, setSecondarySymptoms] = useState<string[]>([]);

  // V2.1: Sick photo capture
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const supabase = createClient();

  // RBAC: only roles with FLAG_SICK can submit
  if (!checkPermission(role, ACTION.FLAG_SICK)) {
    return null;
  }

  function handleChange(field: keyof FlagSickFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function toggleSecondarySymptom(symptom: string) {
    setSecondarySymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxFiles: 1,
    maxSize: 2 * 1024 * 1024,
  });

  function handleSubmit() {
    const fieldErrors = validateFlagSickForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors as Partial<FlagSickFormState>);
      return;
    }

    startTransition(async () => {
      const now = new Date().toISOString();

      // 1. Upload sick photo if provided (SYS-007: graceful failure)
      let photoUrl: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() ?? 'jpg';
        const path = `${organizationId}/sick/${animalId}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('animal-photos')
          .upload(path, photoFile, { contentType: photoFile.type, upsert: false });
        if (uploadError) {
          toast({
            variant: 'destructive',
            title: 'SYS-007',
            description: 'Photo upload failed. Sick flag saved without photo.',
          });
        } else {
          const { data: urlData } = supabase.storage.from('animal-photos').getPublicUrl(path);
          photoUrl = urlData?.publicUrl ?? null;
        }
      }

      // 2. Update animal status → SICK
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

      // 3. Insert health_event with photo_url + secondary_symptoms
      const { error: eventError } = await supabase.from('health_events').insert({
        animal_id: animalId,
        organization_id: organizationId,
        event_type: 'FLAGGED_SICK',
        primary_symptom: form.primarySymptom,
        secondary_symptoms: secondarySymptoms,
        severity: form.severity as 'MILD' | 'MODERATE' | 'SEVERE',
        notes: form.notes || null,
        photo_url: photoUrl,
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

      {/* Secondary Symptoms (multi-select checkboxes) */}
      <div className="space-y-1.5">
        <Label>Secondary Symptoms <span className="text-slate-400 font-normal">(optional)</span></Label>
        <div className="grid grid-cols-2 gap-2">
          {SYMPTOMS.map((s) => (
            <label
              key={s}
              className={`flex items-center gap-2 cursor-pointer ${s === form.primarySymptom ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                checked={secondarySymptoms.includes(s)}
                onChange={() => toggleSecondarySymptom(s)}
                disabled={s === form.primarySymptom}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-slate-700">{s}</span>
            </label>
          ))}
        </div>
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

      {/* Sick Photo */}
      <div className="space-y-1.5">
        <Label>Condition Photo <span className="text-slate-400 font-normal">(optional, max 2 MB)</span></Label>
        {photoPreview ? (
          <div className="relative rounded-lg overflow-hidden border border-amber-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="Sick animal condition" className="w-full h-36 object-cover" />
            <button
              type="button"
              onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
              className="absolute top-2 right-2 bg-white/80 hover:bg-white text-slate-600 rounded-full px-2 py-0.5 text-xs font-medium shadow"
            >
              Remove
            </button>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-amber-400 bg-amber-100' : 'border-amber-200 hover:border-amber-300 bg-amber-50/50'
            }`}
          >
            <input {...getInputProps()} />
            <p className="text-xs text-slate-500">
              {isDragActive ? 'Drop photo here…' : 'Tap or drag to upload condition photo (JPEG/PNG)'}
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor="flagNotes">Notes <span className="text-slate-400 font-normal">(optional)</span></Label>
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
