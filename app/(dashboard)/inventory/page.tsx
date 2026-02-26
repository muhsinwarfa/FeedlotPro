import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AnimalList } from '@/components/animals/animal-list';

export const metadata = {
  title: 'Inventory — FeedlotPro',
};

export default async function InventoryPage() {
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

  // Fetch animals with their pen names
  const { data: rawAnimals } = await supabase
    .from('animals')
    .select('id, tag_id, breed, status, intake_weight, current_weight, intake_date, pen_id, pens(pen_name)')
    .eq('organization_id', orgId)
    .order('status')
    .order('tag_id');

  type AnimalRow = {
    id: string;
    tag_id: string;
    breed: string;
    status: string;
    intake_weight: number;
    current_weight: number | null;
    intake_date: string;
    pen_id: string;
    pens: { pen_name: string } | { pen_name: string }[] | null;
  };

  const animals = (rawAnimals as unknown as AnimalRow[]) ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <header className="bg-emerald-950 px-6 py-5 shadow-md">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-300 uppercase tracking-widest">
              Inventory
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white">Animals</h1>
            <p className="mt-0.5 text-sm text-emerald-200">
              {animals.filter((a) => a.status === 'ACTIVE').length} active animals across all pens
            </p>
          </div>
          <Link
            href="/inventory/intake"
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Animal
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <AnimalList animals={animals} />
      </main>
    </div>
  );
}
