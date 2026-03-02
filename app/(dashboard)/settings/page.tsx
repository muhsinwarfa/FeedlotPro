import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { checkPermission, ACTION } from '@/lib/rbac';
import { PenManager } from '@/components/settings/pen-manager';
import { PantryManager } from '@/components/settings/pantry-manager';
import { RationManager } from '@/components/settings/ration-manager';
import { type RationWithIngredients } from '@/components/settings/ration-form-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata = {
  title: 'Settings — FeedlotPro',
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: rawMembership } = await supabase
    .from('tenant_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single();

  type Membership = { organization_id: string; role: string };
  const membership = rawMembership as Membership | null;
  if (!membership) redirect('/onboarding');

  const orgId = membership.organization_id;
  const role = membership.role as string;
  const isOwner = role === 'OWNER';
  const canManagePricing = checkPermission(
    role as Parameters<typeof checkPermission>[0],
    ACTION.MANAGE_PRICING
  );

  // Fetch org name, pens, pantry ingredients, and ration templates in parallel
  const [{ data: rawOrg }, { data: rawPens }, { data: rawIngredients }, { data: rawRations }] =
    await Promise.all([
      supabase.from('organizations').select('farm_name').eq('id', orgId).single(),
      supabase
        .from('pens')
        .select('id, pen_name, status, capacity, active_animal_count')
        .eq('organization_id', orgId)
        .order('pen_name'),
      supabase
        .from('pantry_ingredients')
        .select('id, ingredient_name, unit, current_price_per_kg, current_stock')
        .eq('organization_id', orgId)
        .order('ingredient_name'),
      canManagePricing
        ? supabase
            .from('ration_templates')
            .select(
              'id, ration_name, notes, is_active, created_at, updated_at, ration_ingredients(id, ingredient_id, kg_per_animal_per_day, pantry_ingredients(ingredient_name))'
            )
            .eq('organization_id', orgId)
            .eq('is_active', true)
            .order('ration_name')
        : Promise.resolve({ data: [] }),
    ]);

  type Pen = {
    id: string;
    pen_name: string;
    status: string;
    capacity: number | null;
    active_animal_count: number;
  };
  type Ingredient = {
    id: string;
    ingredient_name: string;
    unit: string;
    current_price_per_kg: number | null;
    current_stock: number;
  };

  const farmName = (rawOrg as { farm_name: string } | null)?.farm_name ?? 'Your Farm';
  const pens = (rawPens ?? []) as Pen[];
  const ingredients = (rawIngredients ?? []) as Ingredient[];
  const rations = (rawRations ?? []) as unknown as RationWithIngredients[];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-emerald-950 px-6 py-5 shadow-md">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm font-medium text-emerald-300 uppercase tracking-widest">Settings</p>
          <h1 className="mt-1 text-2xl font-bold text-white">{farmName}</h1>
          <p className="mt-0.5 text-sm text-emerald-200">
            Manage your pens, feed pantry, ration templates, and team.
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Tabs defaultValue="pens">
          <TabsList className="mb-6">
            <TabsTrigger value="pens">Pens</TabsTrigger>
            <TabsTrigger value="pantry">Pantry</TabsTrigger>
            {canManagePricing && <TabsTrigger value="rations">Rations</TabsTrigger>}
            {isOwner && <TabsTrigger value="team">Team</TabsTrigger>}
          </TabsList>

          <TabsContent value="pens">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <PenManager pens={pens} orgId={orgId} />
            </div>
          </TabsContent>

          <TabsContent value="pantry">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <PantryManager
                ingredients={ingredients}
                orgId={orgId}
                canManagePricing={canManagePricing}
              />
            </div>
          </TabsContent>

          {canManagePricing && (
            <TabsContent value="rations">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <RationManager
                  rations={rations}
                  ingredients={ingredients.map((i) => ({
                    id: i.id,
                    ingredient_name: i.ingredient_name,
                  }))}
                  orgId={orgId}
                />
              </div>
            </TabsContent>
          )}

          {isOwner && (
            <TabsContent value="team">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Team Management</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Add farm workers, assign roles, and manage access PINs.
                    </p>
                  </div>
                  <Link
                    href="/team"
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors min-h-[44px]"
                  >
                    Manage Team →
                  </Link>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
