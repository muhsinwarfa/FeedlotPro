import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { IntakeForm } from '@/components/animals/intake-form';
import type { Pen, Batch } from '@/types/database';

export const metadata = {
  title: 'Animal Intake — FeedlotPro',
};

export default async function AnimalIntakePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: membershipRows } = await supabase
    .from('tenant_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const membership = (membershipRows?.[0] ?? null) as { organization_id: string } | null;
  if (!membership) redirect('/login');

  const orgId = membership.organization_id;

  // Fetch active pens and today's batches in parallel
  const [{ data: rawPens }, { data: rawBatches }] = await Promise.all([
    supabase
      .from('pens')
      .select('id, pen_name, capacity, active_animal_count')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .order('pen_name'),
    supabase
      .from('batches')
      .select('id, batch_code, arrival_date, source_supplier')
      .eq('organization_id', orgId)
      .order('arrival_date', { ascending: false })
      .limit(20),
  ]);

  const pens = (rawPens ?? []) as Pick<Pen, 'id' | 'pen_name' | 'capacity' | 'active_animal_count'>[];
  const batches = (rawBatches ?? []) as Pick<Batch, 'id' | 'batch_code' | 'arrival_date' | 'source_supplier'>[];

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

      {/* Form — sectioned cards inside */}
      <main className="mx-auto max-w-2xl px-4 py-6">
        <IntakeForm organizationId={orgId} pens={pens} batches={batches} />
      </main>
    </div>
  );
}
