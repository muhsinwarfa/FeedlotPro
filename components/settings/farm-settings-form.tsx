'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface FarmSettingsFormProps {
  orgId: string;
  initialTargetWeight: number | null;
}

export function FarmSettingsForm({ orgId, initialTargetWeight }: FarmSettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(
    initialTargetWeight != null ? String(initialTargetWeight) : ''
  );

  function handleSave() {
    const trimmed = value.trim();
    const numeric = trimmed === '' ? null : parseFloat(trimmed);

    if (numeric !== null && (isNaN(numeric) || numeric <= 0)) {
      toast({
        variant: 'destructive',
        title: 'Invalid weight',
        description: 'Enter a positive number in kg, or leave blank to disable.',
      });
      return;
    }

    startTransition(async () => {
      const supabase = createClient();

      // 1 — Update the org-level target weight
      const { error } = await supabase
        .from('organizations')
        .update({ target_weight: numeric } as never)
        .eq('id', orgId);

      if (error) {
        toast({ variant: 'destructive', title: 'Save failed', description: error.message });
        return;
      }

      // 2 — Immediate backfill: recalculate dispatch_ready for all ACTIVE/SICK animals
      //     so the Performance page reflects the change without waiting for a new weight insert.
      if (numeric !== null) {
        // Animals now meeting the target → mark dispatch ready
        await supabase
          .from('animals')
          .update({
            dispatch_ready: true,
            dispatch_ready_date: new Date().toISOString(),
          } as never)
          .eq('organization_id', orgId)
          .in('status', ['ACTIVE', 'SICK'])
          .gte('current_weight', numeric)
          .eq('dispatch_ready', false);

        // Animals no longer meeting the target → unmark (preserve dispatch_ready_date for history)
        await supabase
          .from('animals')
          .update({ dispatch_ready: false } as never)
          .eq('organization_id', orgId)
          .in('status', ['ACTIVE', 'SICK'])
          .lt('current_weight', numeric)
          .eq('dispatch_ready', true);
      } else {
        // Target cleared — all animals are no longer dispatch ready
        await supabase
          .from('animals')
          .update({ dispatch_ready: false } as never)
          .eq('organization_id', orgId)
          .in('status', ['ACTIVE', 'SICK'])
          .eq('dispatch_ready', true);
      }

      toast({
        title: 'Saved',
        description:
          numeric != null
            ? `Dispatch target set to ${numeric} kg. Performance page updated.`
            : 'Dispatch target cleared.',
      });
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Farm Settings</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Farm-wide configuration that applies across all pens.
        </p>
      </div>

      <div className="mt-5 max-w-sm space-y-1.5">
        <Label htmlFor="targetWeight" className="text-slate-700 font-medium">
          Dispatch Target Weight (kg)
        </Label>
        <div className="flex items-center gap-3">
          <Input
            id="targetWeight"
            type="number"
            min="1"
            step="0.5"
            placeholder="e.g. 350"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-[44px] font-mono w-36"
            disabled={isPending}
          />
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
          >
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
        <p className="text-xs text-slate-400">
          Animals reaching this weight appear as Dispatch Ready on the Performance page.
          Leave blank to disable.
        </p>
      </div>
    </div>
  );
}
