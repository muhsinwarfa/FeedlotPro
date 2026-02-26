'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type Pen = {
  id: string;
  pen_name: string;
  status: string;
  capacity: number | null;
  active_animal_count: number;
};

interface PenManagerProps {
  pens: Pen[];
  orgId: string;
}

export function PenManager({ pens: initialPens, orgId }: PenManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [pens, setPens] = useState<Pen[]>(initialPens);
  const [penName, setPenName] = useState('');
  const [penCapacity, setPenCapacity] = useState('');
  const [penError, setPenError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const supabase = createClient();

  function handleAddPen(e: React.FormEvent) {
    e.preventDefault();

    if (!penName.trim()) {
      setPenError('Pen name is required.');
      return;
    }
    if (pens.some((p) => p.pen_name.toLowerCase() === penName.trim().toLowerCase())) {
      setPenError('A pen with this name already exists.');
      return;
    }

    setPenError('');

    startTransition(async () => {
      const payload: Record<string, unknown> = {
        organization_id: orgId,
        pen_name: penName.trim(),
      };
      if (penCapacity.trim()) {
        payload.capacity = parseInt(penCapacity.trim(), 10);
      }

      const { data, error } = await supabase
        .from('pens')
        .insert(payload as never)
        .select('id, pen_name, status, capacity, active_animal_count')
        .single();

      if (error) {
        const { title, description } = mapDbError(error);
        toast({ variant: 'destructive', title, description });
        return;
      }

      setPens((prev) => [...prev, data as Pen]);
      setPenName('');
      setPenCapacity('');
      setShowForm(false);
      toast({ title: 'Pen Added', description: `${penName.trim()} has been added.` });
    });
  }

  function handleDeactivate(pen: Pen) {
    if (pen.active_animal_count > 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot Deactivate',
        description: `${pen.pen_name} has ${pen.active_animal_count} active animal(s). Move them out first.`,
      });
      return;
    }

    startTransition(async () => {
      const { error } = await supabase
        .from('pens')
        .update({ status: 'inactive' } as never)
        .eq('id', pen.id);

      if (error) {
        const { title, description } = mapDbError(error);
        toast({ variant: 'destructive', title, description });
        return;
      }

      setPens((prev) => prev.map((p) => p.id === pen.id ? { ...p, status: 'inactive' } : p));
      toast({ title: 'Pen Deactivated', description: `${pen.pen_name} is now inactive.` });
    });
  }

  function handleReactivate(pen: Pen) {
    startTransition(async () => {
      const { error } = await supabase
        .from('pens')
        .update({ status: 'active' } as never)
        .eq('id', pen.id);

      if (error) {
        const { title, description } = mapDbError(error);
        toast({ variant: 'destructive', title, description });
        return;
      }

      setPens((prev) => prev.map((p) => p.id === pen.id ? { ...p, status: 'active' } : p));
      toast({ title: 'Pen Reactivated', description: `${pen.pen_name} is now active.` });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Pens</h2>
          <p className="text-sm text-slate-500">{pens.filter((p) => p.status === 'active').length} active pens</p>
        </div>
        <Button
          onClick={() => setShowForm((v) => !v)}
          className="min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
        >
          {showForm ? 'Cancel' : '+ Add Pen'}
        </Button>
      </div>

      {/* Add pen form */}
      {showForm && (
        <form onSubmit={handleAddPen} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="newPenName" className="text-slate-700 font-medium text-sm">Pen Name</Label>
              <Input
                id="newPenName"
                type="text"
                placeholder="e.g. Pen C, East Boma"
                value={penName}
                onChange={(e) => { setPenName(e.target.value); setPenError(''); }}
                className={`min-h-[44px] ${penError ? 'border-red-500' : ''}`}
                disabled={isPending}
                autoFocus
              />
            </div>
            <div className="w-28 space-y-1.5">
              <Label htmlFor="newPenCap" className="text-slate-700 font-medium text-sm">Capacity</Label>
              <Input
                id="newPenCap"
                type="number"
                placeholder="Optional"
                value={penCapacity}
                onChange={(e) => setPenCapacity(e.target.value)}
                className="min-h-[44px] font-mono"
                min="1"
                disabled={isPending}
              />
            </div>
            <Button
              type="submit"
              disabled={isPending}
              className="min-h-[44px] bg-emerald-950 hover:bg-emerald-800 text-white"
            >
              {isPending ? 'Adding…' : 'Add'}
            </Button>
          </div>
          {penError && <p className="text-xs text-red-600">{penError}</p>}
        </form>
      )}

      {/* Pen list */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {pens.length === 0 ? (
          <p className="py-8 text-center text-slate-400 text-sm">No pens yet. Add one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Animals</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Capacity</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pens.map((pen) => (
                <tr key={pen.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{pen.pen_name}</td>
                  <td className="px-4 py-3 text-center font-mono text-slate-700">{pen.active_animal_count}</td>
                  <td className="px-4 py-3 text-center font-mono text-slate-500">{pen.capacity ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      pen.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {pen.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {pen.status === 'active' ? (
                      <button
                        onClick={() => handleDeactivate(pen)}
                        disabled={isPending}
                        className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(pen)}
                        disabled={isPending}
                        className="text-xs text-emerald-700 hover:text-emerald-900 font-medium disabled:opacity-50"
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
