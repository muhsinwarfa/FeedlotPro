import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { IntakeForm } from '@/components/animals/intake-form';
import type { Pen } from '@/types/database';

export const metadata = {
  title: 'Animal Intake — FeedlotPro',
};

export default async function AnimalIntakePage() {
  const supabase = createClient();

  // Resolve the authenticated user's organization (tenant isolation)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: rawMembership } = await supabase
    .from('tenant_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  // Explicit cast: hand-crafted types; replace with generated DB types when CLI is linked
  const membership = rawMembership as { organization_id: string } | null;

  if (!membership) redirect('/login');

  const orgId = membership.organization_id;

  // Fetch active pens for this organization — always scoped by organization_id
  const { data: rawPens } = await supabase
    .from('pens')
    .select('id, pen_name, capacity, active_animal_count')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('pen_name');

  const pens = (rawPens ?? []) as Pick<Pen, 'id' | 'pen_name' | 'capacity' | 'active_animal_count'>[];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <header className="bg-emerald-950 px-6 py-5 shadow-md">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-medium text-emerald-300 uppercase tracking-widest">
            Inventory
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white font-inter">
            Animal Intake
          </h1>
          <p className="mt-0.5 text-sm text-emerald-200">
            Register a new animal into your feedlot inventory.
          </p>
        </div>
      </header>

      {/* Form Card */}
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <IntakeForm organizationId={orgId} pens={pens} />
        </div>
      </main>
    </div>
  );
}
