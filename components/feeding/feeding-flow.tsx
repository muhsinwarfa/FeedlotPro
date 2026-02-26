'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { mapDbError } from '@/lib/errors';
import { useToast } from '@/hooks/use-toast';
import { PenSelector } from './pen-selector';
import { IngredientForm, type IngredientInput } from './ingredient-form';
import { FeedingSummary } from './feeding-summary';

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

interface FeedingFlowProps {
  pens: Pen[];
  ingredients: Ingredient[];
  orgId: string;
}

type Step = 'SELECT_PEN' | 'ENTER_INGREDIENTS' | 'REVIEW' | 'SAVED';

// ─── Component ──────────────────────────────────────────────────────────────────

export function FeedingFlow({ pens, ingredients, orgId }: FeedingFlowProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>('SELECT_PEN');
  const [selectedPen, setSelectedPen] = useState<Pen | null>(null);
  const [ingredientInputs, setIngredientInputs] = useState<IngredientInput[]>([]);
  const [totalKg, setTotalKg] = useState(0);
  const [timestamp, setTimestamp] = useState<Date>(new Date());

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
    setStep('ENTER_INGREDIENTS');
  }

  // ── Step 2: Ingredients submitted ───────────────────────────────────────

  function handleIngredientsSubmit(inputs: IngredientInput[]) {
    const total = inputs.reduce((sum, i) => sum + (i.kgAmount ?? 0), 0);
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
        const { title, description } = mapDbError(recordError ?? { message: 'Unknown error' });
        toast({ variant: 'destructive', title, description });
        return;
      }

      // Insert feeding details (only non-zero ingredients)
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
        <IngredientForm
          ingredients={ingredients}
          initialValues={ingredientInputs}
          onSubmit={handleIngredientsSubmit}
          onBack={() => setStep('SELECT_PEN')}
        />
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
