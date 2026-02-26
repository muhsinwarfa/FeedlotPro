import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PenManager } from '@/components/settings/pen-manager';
import { PantryManager } from '@/components/settings/pantry-manager';

export const metadata = {
  title: 'Settings — FeedlotPro',
};

export default async function SettingsPage() {
  const supabase = createClient();

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

  // Fetch org name, pens, and pantry in parallel
  const [{ data: rawOrg }, { data: rawPens }, { data: rawIngredients }] = await Promise.all([
    supabase
      .from('organizations')
      .select('farm_name')
      .eq('id', orgId)
      .single(),
    supabase
      .from('pens')
      .select('id, pen_name, status, capacity, active_animal_count')
      .eq('organization_id', orgId)
      .order('pen_name'),
    supabase
      .from('pantry_ingredients')
      .select('id, ingredient_name, unit')
      .eq('organization_id', orgId)
      .order('ingredient_name'),
  ]);

  type Pen = { id: string; pen_name: string; status: string; capacity: number | null; active_animal_count: number };
  type Ingredient = { id: string; ingredient_name: string; unit: string };

  const farmName = (rawOrg as { farm_name: string } | null)?.farm_name ?? 'Your Farm';
  const pens = (rawPens ?? []) as Pen[];
  const ingredients = (rawIngredients ?? []) as Ingredient[];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-emerald-950 px-6 py-5 shadow-md">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm font-medium text-emerald-300 uppercase tracking-widest">Settings</p>
          <h1 className="mt-1 text-2xl font-bold text-white">{farmName}</h1>
          <p className="mt-0.5 text-sm text-emerald-200">Manage your pens and feed pantry.</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Pen management */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <PenManager pens={pens} orgId={orgId} />
        </div>

        {/* Pantry management */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <PantryManager ingredients={ingredients} orgId={orgId} />
        </div>
      </div>
    </div>
  );
}
