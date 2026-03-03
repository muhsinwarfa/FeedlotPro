'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import { validateIntakeFormV2 } from '@/lib/validators';
import { addToQueue } from '@/lib/offline/queue';
import type { Pen, Batch } from '@/types/database';
import { BatchSelector } from '@/components/animals/batch-selector';

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

// ─── Types ─────────────────────────────────────────────────────────────────────

interface IntakeFormProps {
  organizationId: string;
  pens: Pick<Pen, 'id' | 'pen_name' | 'capacity' | 'active_animal_count'>[];
  batches: Pick<Batch, 'id' | 'batch_code' | 'arrival_date' | 'source_supplier'>[];
}

interface FormState {
  tagId: string;
  breed: string;
  penId: string;
  intakeWeight: string;
  intakeDate: string;
  // V2 fields
  gender: string;
  ageCategory: string;
  batchId: string;
  sourceSupplier: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function initialForm(preservedBatchId = ''): FormState {
  return {
    tagId: '',
    breed: '',
    penId: '',
    intakeWeight: '',
    intakeDate: today(),
    gender: '',
    ageCategory: '',
    batchId: preservedBatchId,
    sourceSupplier: '',
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function IntakeForm({ organizationId, pens, batches }: IntakeFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<FormState>(initialForm());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [registeredTag, setRegisteredTag] = useState<string | null>(null);

  const supabase = createClient();

  // ── Field change handler ──────────────────────────────────────────────────
  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  // ── Photo upload ──────────────────────────────────────────────────────────
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

  // ── Duplicate tag check (on blur) ─────────────────────────────────────────
  async function checkTagUniqueness(tagId: string) {
    if (!tagId.trim()) return;

    const { count } = await supabase
      .from('animals')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('tag_id', tagId.trim());

    if (count && count > 0) {
      setFieldErrors((prev) => ({
        ...prev,
        tagId: 'DAT-003: Tag ID already exists in your inventory.',
      }));
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errors = validateIntakeFormV2(
      {
        tagId: form.tagId,
        breed: form.breed,
        penId: form.penId,
        intakeWeight: form.intakeWeight,
        intakeDate: form.intakeDate,
        gender: form.gender,
        ageCategory: form.ageCategory,
        batchId: form.batchId,
        sourceSupplier: form.sourceSupplier,
      },
      fieldErrors.tagId
    );

    // BUS-008: Pen at capacity — validate before insert
    if (form.penId) {
      const selectedPen = pens.find((p) => p.id === form.penId);
      if (
        selectedPen &&
        selectedPen.capacity != null &&
        selectedPen.active_animal_count >= selectedPen.capacity
      ) {
        errors.penId = `BUS-008: ${selectedPen.pen_name} is full (${selectedPen.active_animal_count}/${selectedPen.capacity}). Choose another pen.`;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    startTransition(async () => {
      let photoUrl: string | null = null;

      if (photoFile) {
        const ext = photoFile.name.split('.').pop() ?? 'jpg';
        const path = `${organizationId}/${form.tagId.trim()}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('animal-photos')
          .upload(path, photoFile, { contentType: photoFile.type, upsert: false });

        if (uploadError) {
          toast({
            variant: 'destructive',
            title: 'SYS-007',
            description: 'Photo upload failed. Animal saved without photo.',
          });
        } else {
          const { data: urlData } = supabase.storage
            .from('animal-photos')
            .getPublicUrl(path);
          photoUrl = urlData?.publicUrl ?? null;
        }
      }

      const insertPayload: Record<string, unknown> = {
        organization_id: organizationId,
        pen_id: form.penId,
        tag_id: form.tagId.trim(),
        breed: form.breed.trim(),
        intake_weight: parseFloat(form.intakeWeight),
        status: 'ACTIVE',
        intake_date: new Date(form.intakeDate).toISOString(),
        gender: form.gender || null,
        age_category: form.ageCategory || null,
        batch_id: form.batchId || null,
        source_supplier: form.sourceSupplier.trim() || null,
        photo_url: photoUrl,
      };

      const { error } = await supabase.from('animals').insert(insertPayload as never);

      if (error) {
        // P10 offline queue: queue the intake for later sync
        if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
          await addToQueue({
            table: 'animals',
            method: 'INSERT',
            payload: insertPayload,
            localTimestamp: new Date().toISOString(),
            memberId: null,
          });
          toast({ title: 'Saved offline', description: 'Animal intake queued and will sync when connected.' });
          const savedTag = form.tagId.trim();
          const savedBatchId = form.batchId;
          setRegisteredTag(savedTag);
          setForm(initialForm(savedBatchId));
          setFieldErrors({});
          setPhotoFile(null);
          setPhotoPreview(null);
          return;
        }
        const { title, description } = mapDbError(error);
        toast({ variant: 'destructive', title, description });
        return;
      }

      const savedTag = form.tagId.trim();
      const savedBatchId = form.batchId;

      setRegisteredTag(savedTag);
      setForm(initialForm(savedBatchId));
      setFieldErrors({});
      setPhotoFile(null);
      setPhotoPreview(null);
    });
  }

  // ── Register Another? ─────────────────────────────────────────────────────
  function handleRegisterAnother() {
    setRegisteredTag(null);
  }

  function handleDone() {
    router.push('/inventory');
    router.refresh();
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (registeredTag) {
    return (
      <div className="space-y-6 text-center py-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Animal Registered</h2>
          <p className="text-sm text-slate-500 mt-1">
            Tag <span className="font-mono font-semibold">{registeredTag}</span> has been added to inventory.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleRegisterAnother}
            className="flex-1 min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
          >
            Register Another
          </Button>
          <Button
            onClick={handleDone}
            variant="outline"
            className="flex-1 min-h-[44px] border-slate-300 text-slate-700"
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 pb-24">

      {/* ── Section 1: Animal Identity ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Animal Identity</h3>

        <div className="space-y-1.5">
          <Label htmlFor="tagId" className="text-slate-700 font-medium">
            Tag ID <span className="text-red-500">*</span>
          </Label>
          <Input
            id="tagId"
            type="text"
            placeholder="e.g. KE-2024-001"
            value={form.tagId}
            onChange={(e) => handleChange('tagId', e.target.value)}
            onBlur={(e) => checkTagUniqueness(e.target.value)}
            className={`min-h-[44px] ${fieldErrors.tagId ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            disabled={isPending}
            autoComplete="off"
          />
          {fieldErrors.tagId && <p className="text-xs text-red-600">{fieldErrors.tagId}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="breed" className="text-slate-700 font-medium">
            Breed <span className="text-red-500">*</span>
          </Label>
          <Input
            id="breed"
            type="text"
            placeholder="e.g. Boran, Sahiwal, Fresian Cross"
            value={form.breed}
            onChange={(e) => handleChange('breed', e.target.value)}
            className={`min-h-[44px] ${fieldErrors.breed ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            disabled={isPending}
          />
          {fieldErrors.breed && <p className="text-xs text-red-600">{fieldErrors.breed}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="gender" className="text-slate-700 font-medium">Gender</Label>
            <Select value={form.gender} onValueChange={(v) => handleChange('gender', v)} disabled={isPending}>
              <SelectTrigger id="gender" className="min-h-[44px]">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BULL">Bull</SelectItem>
                <SelectItem value="HEIFER">Heifer</SelectItem>
                <SelectItem value="STEER">Steer</SelectItem>
                <SelectItem value="COW">Cow</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ageCategory" className="text-slate-700 font-medium">Age Category</Label>
            <Select value={form.ageCategory} onValueChange={(v) => handleChange('ageCategory', v)} disabled={isPending}>
              <SelectTrigger id="ageCategory" className="min-h-[44px]">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CALF">Calf (0–6 mo)</SelectItem>
                <SelectItem value="WEANER">Weaner (6–12 mo)</SelectItem>
                <SelectItem value="GROWER">Grower (12–24 mo)</SelectItem>
                <SelectItem value="FINISHER">Finisher (24 mo+)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Section 2: Photo ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Photo <span className="font-normal normal-case text-slate-400">(optional, max 2 MB)</span>
        </h3>
        {photoPreview ? (
          <div className="relative rounded-lg overflow-hidden border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="Animal photo preview" className="w-full h-48 object-cover" />
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
            className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50'
            }`}
          >
            <input {...getInputProps()} />
            <p className="text-sm text-slate-500">
              {isDragActive ? 'Drop photo here…' : 'Tap or drag to upload photo (JPEG/PNG)'}
            </p>
          </div>
        )}
      </div>

      {/* ── Section 3: Location & Batch ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Location &amp; Batch</h3>

        <div className="space-y-1.5">
          <Label htmlFor="penId" className="text-slate-700 font-medium">
            Pen <span className="text-red-500">*</span>
          </Label>
          <Select value={form.penId} onValueChange={(value) => handleChange('penId', value)} disabled={isPending}>
            <SelectTrigger
              id="penId"
              className={`min-h-[44px] ${fieldErrors.penId ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            >
              <SelectValue placeholder="Select a pen…" />
            </SelectTrigger>
            <SelectContent>
              {pens.length === 0 ? (
                <SelectItem value="_none" disabled>No active pens found</SelectItem>
              ) : (
                pens.map((pen) => (
                  <SelectItem key={pen.id} value={pen.id}>
                    {pen.pen_name}
                    {pen.capacity != null && (
                      <span className="ml-2 text-slate-400 text-xs">({pen.active_animal_count}/{pen.capacity})</span>
                    )}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {fieldErrors.penId && <p className="text-xs text-red-600">{fieldErrors.penId}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-slate-700 font-medium">
            Batch <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <BatchSelector
            organizationId={organizationId}
            batches={batches}
            value={form.batchId}
            onChange={(batchId) => handleChange('batchId', batchId)}
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sourceSupplier" className="text-slate-700 font-medium">
            Source / Supplier <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <Input
            id="sourceSupplier"
            type="text"
            placeholder="e.g. Narok Market"
            value={form.sourceSupplier}
            onChange={(e) => handleChange('sourceSupplier', e.target.value)}
            className="min-h-[44px]"
            disabled={isPending}
          />
        </div>
      </div>

      {/* ── Section 4: Measurements ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Measurements</h3>

        <div className="space-y-1.5">
          <Label htmlFor="intakeWeight" className="text-slate-700 font-medium">
            Intake Weight (kg) <span className="text-red-500">*</span>
          </Label>
          <Input
            id="intakeWeight"
            type="number"
            min="0.1"
            step="0.1"
            placeholder="0.0"
            value={form.intakeWeight}
            onChange={(e) => handleChange('intakeWeight', e.target.value)}
            className={`min-h-[44px] font-mono ${fieldErrors.intakeWeight ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            disabled={isPending}
          />
          {fieldErrors.intakeWeight && <p className="text-xs text-red-600">{fieldErrors.intakeWeight}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="intakeDate" className="text-slate-700 font-medium">
            Intake Date <span className="text-red-500">*</span>
          </Label>
          <Input
            id="intakeDate"
            type="date"
            value={form.intakeDate}
            onChange={(e) => handleChange('intakeDate', e.target.value)}
            className={`min-h-[44px] ${fieldErrors.intakeDate ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            disabled={isPending}
          />
          {fieldErrors.intakeDate && <p className="text-xs text-red-600">{fieldErrors.intakeDate}</p>}
        </div>
      </div>

      {/* ── Sticky Submit ────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white border-t border-slate-100 px-4 py-4 flex items-center gap-3 z-20">
        <Button
          type="submit"
          disabled={isPending}
          className="min-h-[44px] flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-60"
        >
          {isPending ? 'Registering…' : 'Register Animal'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => router.back()}
          className="min-h-[44px] border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
