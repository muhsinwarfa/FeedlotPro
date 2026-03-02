'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import { addToQueue } from '@/lib/offline/queue';
import { useToast } from '@/hooks/use-toast';
import { PenSelector } from './pen-selector';
import { IngredientForm, type IngredientInput } from './ingredient-form';
import { FeedingSummary } from './feeding-summary';
import { totalFeedKg } from '@/lib/formatters';

// ─── Types ──────────────────────────────────────────────────────────────────────

type Pen = {
  id: string;
  pen_name: string;
  status: string;
  active_animal_count: number;
  capacity: number | null;
};

type Ingredient = {
  id: string;
  ingredient_name: string;
};

type RationSummary = {
  id: string;
  ration_name: string;
  ration_ingredients: Array<{
    ingredient_id: string;
    kg_per_animal_per_day: number;
  }>;
};

interface FeedingFlowProps {
  pens: Pen[];
  ingredients: Ingredient[];
  orgId: string;
  rations?: RationSummary[];
}

type Step = 'SELECT_PEN' | 'ENTER_INGREDIENTS' | 'REVIEW' | 'SAVED';

// ─── Component ──────────────────────────────────────────────────────────────────

export function FeedingFlow({ pens, ingredients, orgId, rations = [] }: FeedingFlowProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>('SELECT_PEN');
  const [selectedPen, setSelectedPen] = useState<Pen | null>(null);
  const [ingredientInputs, setIngredientInputs] = useState<IngredientInput[]>([]);
  const [totalKg, setTotalKg] = useState(0);
  const [timestamp, setTimestamp] = useState<Date>(new Date());

  // Ration selector state — incrementing rationKey forces IngredientForm remount
  const [selectedRationId, setSelectedRationId] = useState('');
  const [rationKey, setRationKey] = useState(0);

  const supabase = createClient();

  // ── Step 1: Pen selected ─────────────────────────────────────────────────

  function handlePenSelected(pen: Pen) {
    // Gate: inactive pen (BUS-003)
    if (pen.status !== 'active') {
      toast({
        variant: 'destructive',
        title: 'BUS-003',
        description: 'This pen is deactivated. Please select an active pen.',
      });
      return;
    }

    // Gate: empty pen (BUS-004)
    if (pen.active_animal_count === 0) {
      toast({
        variant: 'destructive',
        title: 'BUS-004',
        description: 'This pen has no active animals. Add animals before recording feed.',
      });
      return;
    }

    setSelectedPen(pen);
    setSelectedRationId('');
    setStep('ENTER_INGREDIENTS');
  }

  // ── Ration template applied ───────────────────────────────────────────────

  function applyRation(rationId: string) {
    if (!rationId || !selectedPen) return;
    const ration = rations.find((r) => r.id === rationId);
    if (!ration) return;

    // Scale kg per ingredient by the pen's head count
    const headCount = selectedPen.active_animal_count;
    const prefilledInputs: IngredientInput[] = ration.ration_ingredients.flatMap((ri) => {
      const ing = ingredients.find((i) => i.id === ri.ingredient_id);
      if (!ing) return [];
      return [{
        ingredientId: ri.ingredient_id,
        ingredientName: ing.ingredient_name,
        kgAmount: parseFloat((ri.kg_per_animal_per_day * headCount).toFixed(1)),
      }];
    });

    setSelectedRationId(rationId);
    setIngredientInputs(prefilledInputs);
    // Incrementing rationKey remounts IngredientForm so it re-reads initialValues
    setRationKey((k) => k + 1);
  }

  // ── Step 2: Ingredients submitted ───────────────────────────────────────

  function handleIngredientsSubmit(inputs: IngredientInput[]) {
    const total = totalFeedKg(inputs);
    setIngredientInputs(inputs);
    setTotalKg(total);
    setTimestamp(new Date());
    setStep('REVIEW');
  }

  // ── Step 3: Confirmed — save to DB ───────────────────────────────────────

  function handleConfirm() {
    if (!selectedPen) return;

    startTransition(async () => {
      // Insert feeding record
      const { data: record, error: recordError } = await supabase
        .from('feeding_records')
        .insert({
          organization_id: orgId,
          pen_id: selectedPen.id,
          feeding_timestamp: timestamp.toISOString(),
          total_kg_fed: totalKg,
        })
        .select('id')
        .single();

      if (recordError || !record) {
        // Offline fallback: queue feeding record + details when network is unavailable
        if (!navigator.onLine || recordError?.message?.includes('Failed to fetch')) {
          const localId = crypto.randomUUID();
          await addToQueue({
            table: 'feeding_records',
            method: 'INSERT',
            payload: {
              id: localId,
              organization_id: orgId,
              pen_id: selectedPen.id,
              feeding_timestamp: timestamp.toISOString(),
              total_kg_fed: totalKg,
            },
            localTimestamp: new Date().toISOString(),
            memberId: null,
          });
          // Queue details
          const details = ingredientInputs
            .filter((i) => i.kgAmount != null && i.kgAmount > 0)
            .map((i) => ({
              feeding_record_id: localId,
              ingredient_id: i.ingredientId,
              kg_amount: i.kgAmount!,
            }));
          for (const detail of details) {
            await addToQueue({
              table: 'feeding_details',
              method: 'INSERT',
              payload: detail,
              localTimestamp: new Date().toISOString(),
              memberId: null,
            });
          }
          toast({ title: 'Feeding saved offline', description: 'Will sync when connected.' });
          setStep('SAVED');
          return;
        }
        const { title, description } = mapDbError(recordError ?? { message: 'Unknown error' });
        toast({ variant: 'destructive', title, description });
        return;
      }

      // Insert feeding details (only non-zero ingredients)
      // trg_feeding_cost_on_detail_insert fires per row: snapshots price, creates CONSUMPTION, rolls up total_cost
      const details = ingredientInputs
        .filter((i) => i.kgAmount != null && i.kgAmount > 0)
        .map((i) => ({
          feeding_record_id: (record as { id: string }).id,
          ingredient_id: i.ingredientId,
          kg_amount: i.kgAmount!,
        }));

      if (details.length > 0) {
        const { error: detailsError } = await supabase
          .from('feeding_details')
          .insert(details);

        if (detailsError) {
          const { title, description } = mapDbError(detailsError);
          toast({ variant: 'destructive', title, description });
          return;
        }
      }

      setStep('SAVED');
    });
  }

  // ── Step 4: Saved — reset for new feeding ────────────────────────────────

  function handleReset() {
    setStep('SELECT_PEN');
    setSelectedPen(null);
    setIngredientInputs([]);
    setTotalKg(0);
    setSelectedRationId('');
  }

  // ── Step indicator ───────────────────────────────────────────────────────

  const STEPS: { key: Step; label: string }[] = [
    { key: 'SELECT_PEN', label: 'Select Pen' },
    { key: 'ENTER_INGREDIENTS', label: 'Enter Feed' },
    { key: 'REVIEW', label: 'Review' },
  ];

  const stepIndex = { SELECT_PEN: 0, ENTER_INGREDIENTS: 1, REVIEW: 2, SAVED: 3 };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Step indicator (not shown on SAVED) */}
      {step !== 'SAVED' && (
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const current = stepIndex[step];
            const isDone = i < current;
            const isActive = i === current;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isDone
                      ? 'bg-amber-500 text-white'
                      : isActive
                      ? 'bg-emerald-950 text-white'
                      : 'bg-slate-200 text-slate-400'
                  }`}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs hidden sm:inline font-medium ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className="w-6 h-px bg-slate-200 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Selected pen context pill */}
      {selectedPen && step !== 'SELECT_PEN' && step !== 'SAVED' && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Pen:</span>
          <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-0.5">
            {selectedPen.pen_name}
          </span>
          <span className="text-slate-400 text-xs">({selectedPen.active_animal_count} animals)</span>
        </div>
      )}

      {/* Step content */}
      {step === 'SELECT_PEN' && (
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Select a Pen</h2>
            <p className="text-sm text-slate-500 mt-0.5">Choose the pen you are feeding today.</p>
          </div>
          <PenSelector pens={pens} onSelect={handlePenSelected} />
        </div>
      )}

      {step === 'ENTER_INGREDIENTS' && (
        <div className="space-y-4">
          {/* Ration template selector (only shown when rations exist) */}
          {rations.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-sm font-medium text-emerald-800 flex-shrink-0">
                Use ration:
              </span>
              <select
                value={selectedRationId}
                onChange={(e) => applyRation(e.target.value)}
                className="flex-1 min-h-[36px] rounded-md border border-emerald-300 bg-white text-sm text-slate-900 px-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">— Select a ration template —</option>
                {rations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.ration_name}
                  </option>
                ))}
              </select>
              {selectedRationId && (
                <span className="text-xs text-emerald-700 font-medium flex-shrink-0">
                  Pre-filled ✓
                </span>
              )}
            </div>
          )}

          {/* Ingredient form — key changes on ration apply to force remount with new initialValues */}
          <IngredientForm
            key={rationKey}
            ingredients={ingredients}
            initialValues={ingredientInputs}
            onSubmit={handleIngredientsSubmit}
            onBack={() => setStep('SELECT_PEN')}
          />
        </div>
      )}

      {step === 'REVIEW' && selectedPen && (
        <FeedingSummary
          pen={selectedPen}
          inputs={ingredientInputs}
          totalKg={totalKg}
          timestamp={timestamp}
          onConfirm={handleConfirm}
          onEdit={() => setStep('SELECT_PEN')}
          isPending={isPending}
        />
      )}

      {step === 'SAVED' && (
        <div className="text-center space-y-4 py-8">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Feeding Recorded!</h2>
            <p className="text-sm text-slate-500 mt-1">
              {totalKg.toFixed(1)} kg fed to <span className="font-medium">{selectedPen?.pen_name}</span>.
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors min-h-[44px]"
            >
              Record Another Feeding
            </button>
            <Link
              href="/feeding/history"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors min-h-[44px]"
            >
              View History
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
