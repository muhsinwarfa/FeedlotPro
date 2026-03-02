import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FeedingFlow } from '@/components/feeding/feeding-flow';

export const metadata = {
  title: 'Daily Feeding — FeedlotPro',
};

export default async function FeedingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: rawMembership } = await supabase
    .from('tenant_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  const membership = rawMembership as { organization_id: string } | null;
  if (!membership) redirect('/onboarding');

  const orgId = membership.organization_id;

  // Fetch pens, pantry ingredients, and active ration templates in parallel
  const [{ data: rawPens }, { data: rawIngredients }, { data: rawRations }] =
    await Promise.all([
      supabase
        .from('pens')
        .select('id, pen_name, status, active_animal_count, capacity')
        .eq('organization_id', orgId)
        .order('pen_name'),
      supabase
        .from('pantry_ingredients')
        .select('id, ingredient_name')
        .eq('organization_id', orgId)
        .order('ingredient_name'),
      supabase
        .from('ration_templates')
        .select('id, ration_name, ration_ingredients(ingredient_id, kg_per_animal_per_day)')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('ration_name'),
    ]);

  type Pen = {
    id: string;
    pen_name: string;
    status: string;
    active_animal_count: number;
    capacity: number | null;
  };
  type Ingredient = { id: string; ingredient_name: string };
  type RationSummary = {
    id: string;
    ration_name: string;
    ration_ingredients: Array<{ ingredient_id: string; kg_per_animal_per_day: number }>;
  };

  const pens = (rawPens ?? []) as Pen[];
  const ingredients = (rawIngredients ?? []) as Ingredient[];
  const rations = (rawRations ?? []) as unknown as RationSummary[];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <header className="bg-emerald-950 px-6 py-5 shadow-md">
        <div className="max-w-3xl mx-auto flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-300 uppercase tracking-widest">
              Feeding
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white">Daily Feeding Checklist</h1>
            <p className="mt-0.5 text-sm text-emerald-200">
              Record feed delivered to each pen today.
            </p>
          </div>
          <a
            href="/feeding/history"
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-lg border border-emerald-700 hover:bg-emerald-800 px-3 py-2 text-sm font-medium text-emerald-200 transition-colors min-h-[44px]"
          >
            View History
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {ingredients.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="font-semibold text-slate-700">No pantry ingredients found.</p>
            <p className="text-sm text-slate-500 mt-1">
              Add feed ingredients in{' '}
              <a href="/settings" className="text-emerald-700 underline hover:text-emerald-900">
                Settings → Pantry
              </a>{' '}
              before recording a feeding.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <FeedingFlow
              pens={pens}
              ingredients={ingredients}
              orgId={orgId}
              rations={rations}
            />
          </div>
        )}
      </main>
    </div>
  );
}
