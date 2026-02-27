'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import { validateIntakeForm } from '@/lib/validators';
import type { Pen } from '@/types/database';

// ─── shadcn/ui components (installed via: npx shadcn-ui@latest add button input label select form toast) ───
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
}

interface FormState {
  tagId: string;
  breed: string;
  penId: string;
  intakeWeight: string;
  intakeDate: string;
}

interface FieldErrors {
  tagId?: string;
  breed?: string;
  penId?: string;
  intakeWeight?: string;
  intakeDate?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function IntakeForm({ organizationId, pens }: IntakeFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<FormState>({
    tagId: '',
    breed: '',
    penId: '',
    intakeWeight: '',
    intakeDate: today(),
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const supabase = createClient();

  // ── Field change handler ──────────────────────────────────────────────────
  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

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

  // ── Client-side validation ────────────────────────────────────────────────
  function validate(): boolean {
    const errors = validateIntakeForm(form, fieldErrors.tagId);
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    startTransition(async () => {
      // Explicit cast: hand-crafted types; replace with generated DB types when CLI is linked
      const insertPayload: Record<string, unknown> = {
        organization_id: organizationId,
        pen_id: form.penId,
        tag_id: form.tagId.trim(),
        breed: form.breed.trim(),
        intake_weight: parseFloat(form.intakeWeight),
        status: 'ACTIVE',
        intake_date: new Date(form.intakeDate).toISOString(),
      };
      const { error } = await supabase.from('animals').insert(insertPayload as never);

      if (error) {
        const { title, description } = mapDbError(error);
        toast({ variant: 'destructive', title, description });
        return;
      }

      toast({
        title: 'Animal Registered',
        description: `Tag ${form.tagId.trim()} has been added to your inventory.`,
      });
      router.push('/inventory');
      router.refresh();
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">

      {/* Tag ID */}
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
        {fieldErrors.tagId && (
          <p className="text-xs text-red-600">{fieldErrors.tagId}</p>
        )}
      </div>

      {/* Breed */}
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
        {fieldErrors.breed && (
          <p className="text-xs text-red-600">{fieldErrors.breed}</p>
        )}
      </div>

      {/* Pen */}
      <div className="space-y-1.5">
        <Label htmlFor="penId" className="text-slate-700 font-medium">
          Pen <span className="text-red-500">*</span>
        </Label>
        <Select
          value={form.penId}
          onValueChange={(value) => handleChange('penId', value)}
          disabled={isPending}
        >
          <SelectTrigger
            id="penId"
            className={`min-h-[44px] ${fieldErrors.penId ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
          >
            <SelectValue placeholder="Select a pen…" />
          </SelectTrigger>
          <SelectContent>
            {pens.length === 0 ? (
              <SelectItem value="_none" disabled>
                No active pens found
              </SelectItem>
            ) : (
              pens.map((pen) => (
                <SelectItem key={pen.id} value={pen.id}>
                  {pen.pen_name}
                  {pen.capacity != null && (
                    <span className="ml-2 text-slate-400 text-xs">
                      ({pen.active_animal_count}/{pen.capacity})
                    </span>
                  )}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {fieldErrors.penId && (
          <p className="text-xs text-red-600">{fieldErrors.penId}</p>
        )}
      </div>

      {/* Intake Weight */}
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
          // Roboto Mono for numeric data fields per design system
          className={`min-h-[44px] font-mono ${fieldErrors.intakeWeight ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
          disabled={isPending}
        />
        {fieldErrors.intakeWeight && (
          <p className="text-xs text-red-600">{fieldErrors.intakeWeight}</p>
        )}
      </div>

      {/* Intake Date */}
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
        {fieldErrors.intakeDate && (
          <p className="text-xs text-red-600">{fieldErrors.intakeDate}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
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
