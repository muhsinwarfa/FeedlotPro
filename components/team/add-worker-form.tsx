'use client';

import { useState, useTransition } from 'react';
import bcrypt from 'bcryptjs';
import { createClient } from '@/lib/supabase/client';
import { validateWorkerForm } from '@/lib/validators';
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

// ── Avatar colour palette ─────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#064E3B', '#065F46', '#047857', '#0F766E',
  '#0369A1', '#1D4ED8', '#7C3AED', '#B45309',
  '#B91C1C', '#0F172A',
];

interface AddWorkerFormProps {
  organizationId: string;
  onSuccess: () => void;
}

export function AddWorkerForm({ organizationId, onSuccess }: AddWorkerFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    displayName: '',
    role: '',
    pin: '',
    confirmPin: '',
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const supabase = createClient();

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): boolean {
    const workerErrors = validateWorkerForm({
      displayName: form.displayName,
      role: form.role,
      pin: form.pin,
    });
    const errors: Record<string, string | undefined> = { ...workerErrors };

    if (form.pin && form.confirmPin && form.pin !== form.confirmPin) {
      errors.confirmPin = 'PINs do not match.';
    }
    if (!form.confirmPin) {
      errors.confirmPin = 'Please confirm the PIN.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    startTransition(async () => {
      const pinHash = await bcrypt.hash(form.pin, 10);

      const { error } = await supabase.from('tenant_members').insert({
        organization_id: organizationId,
        // user_id is not applicable for non-Supabase-auth workers — use a placeholder UUID
        // that won't conflict with Supabase auth users. The device's owner Supabase session
        // provides the tenancy context.
        user_id: '00000000-0000-0000-0000-000000000000',
        role: form.role,
        display_name: form.displayName.trim(),
        avatar_color: form.avatarColor,
        pin_hash: pinHash,
        pin_attempts: 0,
        status: 'ACTIVE',
      } as never);

      if (error) {
        toast({ variant: 'destructive', ...mapDbError(error) });
        return;
      }

      toast({
        title: 'Worker Added',
        description: `${form.displayName.trim()} has been added to your team.`,
      });
      onSuccess();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Display Name */}
      <div className="space-y-1.5">
        <Label htmlFor="displayName" className="text-slate-700 font-medium">
          Display Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="displayName"
          type="text"
          placeholder="e.g. Kamau, Jane W."
          value={form.displayName}
          onChange={(e) => handleChange('displayName', e.target.value)}
          className={`min-h-[44px] ${fieldErrors.displayName ? 'border-red-500' : ''}`}
          disabled={isPending}
          autoComplete="off"
        />
        {fieldErrors.displayName && (
          <p className="text-xs text-red-600">{fieldErrors.displayName}</p>
        )}
      </div>

      {/* Role */}
      <div className="space-y-1.5">
        <Label htmlFor="role" className="text-slate-700 font-medium">
          Role <span className="text-red-500">*</span>
        </Label>
        <Select
          value={form.role}
          onValueChange={(v) => handleChange('role', v)}
          disabled={isPending}
        >
          <SelectTrigger
            id="role"
            className={`min-h-[44px] ${fieldErrors.role ? 'border-red-500' : ''}`}
          >
            <SelectValue placeholder="Select role…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MANAGER">Manager</SelectItem>
            <SelectItem value="FARMHAND">Farmhand</SelectItem>
            <SelectItem value="VET">Vet</SelectItem>
          </SelectContent>
        </Select>
        {fieldErrors.role && <p className="text-xs text-red-600">{fieldErrors.role}</p>}
      </div>

      {/* Initial PIN */}
      <div className="space-y-1.5">
        <Label htmlFor="pin" className="text-slate-700 font-medium">
          Initial PIN <span className="text-red-500">*</span>
        </Label>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="4 digits"
          value={form.pin}
          onChange={(e) => handleChange('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
          className={`min-h-[44px] font-mono tracking-widest ${fieldErrors.pin ? 'border-red-500' : ''}`}
          disabled={isPending}
        />
        {fieldErrors.pin && <p className="text-xs text-red-600">{fieldErrors.pin}</p>}
      </div>

      {/* Confirm PIN */}
      <div className="space-y-1.5">
        <Label htmlFor="confirmPin" className="text-slate-700 font-medium">
          Confirm PIN <span className="text-red-500">*</span>
        </Label>
        <Input
          id="confirmPin"
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="Repeat 4-digit PIN"
          value={form.confirmPin}
          onChange={(e) => handleChange('confirmPin', e.target.value.replace(/\D/g, '').slice(0, 4))}
          className={`min-h-[44px] font-mono tracking-widest ${fieldErrors.confirmPin ? 'border-red-500' : ''}`}
          disabled={isPending}
        />
        {fieldErrors.confirmPin && (
          <p className="text-xs text-red-600">{fieldErrors.confirmPin}</p>
        )}
      </div>

      {/* Avatar colour */}
      <div className="space-y-1.5">
        <Label className="text-slate-700 font-medium">Avatar Colour</Label>
        <div className="flex gap-2 flex-wrap">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleChange('avatarColor', color)}
              className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                form.avatarColor === color ? 'border-slate-700 scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
              aria-label={color}
            />
          ))}
        </div>
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
      >
        {isPending ? 'Adding…' : 'Add Team Member'}
      </Button>
    </form>
  );
}
