'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PenDraft {
  name: string;
  capacity: string; // empty string = no capacity
}

interface IngredientDraft {
  name: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [farmName, setFarmName] = useState('');
  const [farmNameError, setFarmNameError] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerNameError, setOwnerNameError] = useState('');

  // Step 2 state
  const [penInput, setPenInput] = useState('');
  const [penCapacity, setPenCapacity] = useState('');
  const [penError, setPenError] = useState('');
  const [pens, setPens] = useState<PenDraft[]>([]);

  // Step 3 state
  const [ingredientInput, setIngredientInput] = useState('');
  const [ingredientError, setIngredientError] = useState('');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);

  const supabase = createClient();

  // ── Step 1 — Farm Name ────────────────────────────────────────────────────

  function handleStep1Next() {
    let hasError = false;
    if (!farmName.trim() || farmName.trim().length < 2) {
      setFarmNameError('Farm name must be at least 2 characters.');
      hasError = true;
    } else {
      setFarmNameError('');
    }
    if (!ownerName.trim() || ownerName.trim().length < 2) {
      setOwnerNameError('Your name must be at least 2 characters.');
      hasError = true;
    } else {
      setOwnerNameError('');
    }
    if (hasError) return;
    setStep(2);
  }

  // ── Step 2 — Pens ─────────────────────────────────────────────────────────

  function addPen() {
    const name = penInput.trim();
    if (!name) {
      setPenError('Pen name is required.');
      return;
    }
    if (pens.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setPenError('A pen with this name already exists.');
      return;
    }
    setPens((prev) => [...prev, { name, capacity: penCapacity.trim() }]);
    setPenInput('');
    setPenCapacity('');
    setPenError('');
  }

  function removePen(index: number) {
    setPens((prev) => prev.filter((_, i) => i !== index));
  }

  function handleStep2Next() {
    if (pens.length === 0) {
      setPenError('Add at least one pen to continue.');
      return;
    }
    setPenError('');
    setStep(3);
  }

  // ── Step 3 — Pantry ───────────────────────────────────────────────────────

  function addIngredient() {
    const name = ingredientInput.trim();
    if (!name) {
      setIngredientError('Ingredient name is required.');
      return;
    }
    if (ingredients.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      setIngredientError('This ingredient is already in your pantry.');
      return;
    }
    setIngredients((prev) => [...prev, { name }]);
    setIngredientInput('');
    setIngredientError('');
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Save configuration ────────────────────────────────────────────────────

  function handleFinish() {
    if (ingredients.length === 0) {
      setIngredientError('Add at least one pantry ingredient to continue.');
      return;
    }
    setIngredientError('');

    startTransition(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Single atomic RPC call — creates org, membership, pens, and pantry
      // in one transaction with SECURITY DEFINER (bypasses RLS chicken-and-egg).
      const { error } = await supabase.rpc('complete_onboarding', {
        p_farm_name: farmName.trim(),
        p_pens: pens.map((p) => ({ name: p.name, capacity: p.capacity || '' })),
        p_ingredients: ingredients.map((i) => ({ name: i.name })),
        p_display_name: ownerName.trim(),
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Setup Failed',
          description: 'Could not create your farm. Please try again.',
        });
        return;
      }

      router.push('/inventory');
      router.refresh();
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const stepLabels = ['Farm Details', 'Pens', 'Feed Pantry'];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-emerald-950 px-6 py-5 shadow-md">
        <div className="mx-auto max-w-lg">
          <p className="text-sm font-medium text-emerald-400 uppercase tracking-widest">
            FeedlotPro Kenya
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">Set Up Your Farm</h1>
          <p className="mt-0.5 text-sm text-emerald-200">
            Complete these steps to get started. You can change everything later in Settings.
          </p>

          {/* Step progress */}
          <div className="mt-5 flex items-center gap-2">
            {stepLabels.map((label, i) => {
              const stepNum = (i + 1) as 1 | 2 | 3;
              const isActive = step === stepNum;
              const isDone = step > stepNum;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isDone
                        ? 'bg-amber-500 text-white'
                        : isActive
                        ? 'bg-white text-emerald-950'
                        : 'bg-emerald-800 text-emerald-300'
                    }`}
                  >
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span
                    className={`text-xs hidden sm:inline ${
                      isActive ? 'text-white font-medium' : 'text-emerald-400'
                    }`}
                  >
                    {label}
                  </span>
                  {i < 2 && <div className="w-6 h-px bg-emerald-700 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Card */}
      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">What is your farm called?</h2>
                <p className="text-sm text-slate-500 mt-0.5">This name appears on all your records.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="farmName" className="text-slate-700 font-medium">
                  Farm Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="farmName"
                  type="text"
                  placeholder="e.g. Karibu Feedlot"
                  value={farmName}
                  onChange={(e) => { setFarmName(e.target.value); setFarmNameError(''); }}
                  className={`min-h-[44px] ${farmNameError ? 'border-red-500' : ''}`}
                  autoFocus
                />
                {farmNameError && (
                  <p className="text-xs text-red-600">{farmNameError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ownerName" className="text-slate-700 font-medium">
                  Your Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ownerName"
                  type="text"
                  placeholder="e.g. John Kamau"
                  value={ownerName}
                  onChange={(e) => { setOwnerName(e.target.value); setOwnerNameError(''); }}
                  className={`min-h-[44px] ${ownerNameError ? 'border-red-500' : ''}`}
                />
                {ownerNameError && (
                  <p className="text-xs text-red-600">{ownerNameError}</p>
                )}
                <p className="text-xs text-slate-400">Shown on the worker kiosk screen.</p>
              </div>

              <Button
                onClick={handleStep1Next}
                className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              >
                Next: Define Pens →
              </Button>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Define your pens</h2>
                <p className="text-sm text-slate-500 mt-0.5">Add the physical enclosures where animals are kept. Minimum 1 pen required.</p>
              </div>

              {/* Add pen inline form */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="penName" className="text-slate-700 font-medium text-sm">Pen Name</Label>
                  <Input
                    id="penName"
                    type="text"
                    placeholder="e.g. Pen A, North Boma"
                    value={penInput}
                    onChange={(e) => { setPenInput(e.target.value); setPenError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPen())}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="w-24 space-y-1.5">
                  <Label htmlFor="penCap" className="text-slate-700 font-medium text-sm">Capacity</Label>
                  <Input
                    id="penCap"
                    type="number"
                    placeholder="Optional"
                    value={penCapacity}
                    onChange={(e) => setPenCapacity(e.target.value)}
                    className="min-h-[44px] font-mono"
                    min="1"
                  />
                </div>
                <Button
                  type="button"
                  onClick={addPen}
                  className="min-h-[44px] bg-emerald-950 hover:bg-emerald-800 text-white px-4"
                >
                  Add
                </Button>
              </div>

              {penError && <p className="text-xs text-red-600">{penError}</p>}

              {/* Pen list */}
              {pens.length > 0 && (
                <ul className="space-y-2">
                  {pens.map((pen, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="text-sm font-medium text-slate-800">{pen.name}</span>
                      <div className="flex items-center gap-3">
                        {pen.capacity && (
                          <span className="text-xs text-slate-400 font-mono">Cap: {pen.capacity}</span>
                        )}
                        <button
                          onClick={() => removePen(i)}
                          className="text-slate-400 hover:text-red-500 text-lg leading-none"
                          aria-label="Remove pen"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="min-h-[44px] border-slate-300 text-slate-600"
                >
                  ← Back
                </Button>
                <Button
                  onClick={handleStep2Next}
                  className="flex-1 min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                >
                  Next: Feed Pantry →
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Set up your feed pantry</h2>
                <p className="text-sm text-slate-500 mt-0.5">Add the raw feed ingredients you use. All quantities are tracked in kg. Minimum 1 ingredient required.</p>
              </div>

              {/* Add ingredient */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="ingredientName" className="text-slate-700 font-medium text-sm">Ingredient Name</Label>
                  <Input
                    id="ingredientName"
                    type="text"
                    placeholder="e.g. Napier Grass, Dairy Meal"
                    value={ingredientInput}
                    onChange={(e) => { setIngredientInput(e.target.value); setIngredientError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIngredient())}
                    className="min-h-[44px]"
                  />
                </div>
                <Button
                  type="button"
                  onClick={addIngredient}
                  className="min-h-[44px] bg-emerald-950 hover:bg-emerald-800 text-white px-4"
                >
                  Add
                </Button>
              </div>

              {ingredientError && <p className="text-xs text-red-600">{ingredientError}</p>}

              {/* Ingredient list */}
              {ingredients.length > 0 && (
                <ul className="space-y-2">
                  {ingredients.map((ing, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="text-sm font-medium text-slate-800">{ing.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">kg</span>
                        <button
                          onClick={() => removeIngredient(i)}
                          className="text-slate-400 hover:text-red-500 text-lg leading-none"
                          aria-label="Remove ingredient"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={isPending}
                  className="min-h-[44px] border-slate-300 text-slate-600"
                >
                  ← Back
                </Button>
                <Button
                  onClick={handleFinish}
                  disabled={isPending}
                  className="flex-1 min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                >
                  {isPending ? 'Setting up your farm…' : 'Finish Setup'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
