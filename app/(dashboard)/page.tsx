import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardOverview } from '@/components/dashboard/dashboard-overview';

export const metadata = {
  title: 'Dashboard — FeedlotPro',
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) redirect('/onboarding');

  const orgId = (membership as { organization_id: string }).organization_id;

  // Fetch summary data in parallel
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { count: activeAnimals },
    { count: totalPens },
    { count: fedToday },
    { data: rawOrg },
  ] = await Promise.all([
    supabase
      .from('animals')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'ACTIVE'),
    supabase
      .from('pens')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active'),
    supabase
      .from('feeding_records')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('feeding_timestamp', today.toISOString()),
    supabase
      .from('organizations')
      .select('farm_name')
      .eq('id', orgId)
      .single(),
  ]);

  const farmName = (rawOrg as { farm_name: string } | null)?.farm_name ?? 'Your Farm';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <header className="bg-emerald-950 px-6 py-5 shadow-md">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-medium text-emerald-300 uppercase tracking-widest">
            FeedlotPro Kenya
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {farmName}
          </h1>
          <p className="mt-0.5 text-sm text-emerald-200">
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <DashboardOverview
          activeAnimals={activeAnimals ?? 0}
          totalPens={totalPens ?? 0}
          fedToday={fedToday ?? 0}
        />
      </div>
    </div>
  );
}
