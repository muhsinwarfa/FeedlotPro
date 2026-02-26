import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WeightForm } from '@/components/animals/weight-form';
import { StatusForm } from '@/components/animals/status-form';

export const metadata = {
  title: 'Animal Detail — FeedlotPro',
};

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  ACTIVE:     { label: 'Active',     badge: 'bg-emerald-100 text-emerald-800' },
  SICK:       { label: 'Sick',       badge: 'bg-amber-100 text-amber-800' },
  DEAD:       { label: 'Dead',       badge: 'bg-slate-200 text-slate-600' },
  DISPATCHED: { label: 'Dispatched', badge: 'bg-blue-100 text-blue-800' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AnimalDetailPage({
  params,
}: {
  params: { id: string };
}) {
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

  // Fetch animal (must belong to this org)
  const { data: rawAnimal } = await supabase
    .from('animals')
    .select('*, pens(pen_name)')
    .eq('id', params.id)
    .eq('organization_id', orgId)
    .single();

  if (!rawAnimal) notFound();

  type Animal = {
    id: string;
    tag_id: string;
    breed: string;
    status: string;
    intake_weight: number;
    current_weight: number | null;
    intake_date: string;
    mortality_date: string | null;
    dispatch_date: string | null;
    pen_id: string;
    organization_id: string;
    pens: { pen_name: string } | { pen_name: string }[] | null;
  };

  const animal = rawAnimal as unknown as Animal;

  // Fetch weight history
  const { data: rawWeights } = await supabase
    .from('weight_records')
    .select('id, new_weight, weigh_date')
    .eq('animal_id', animal.id)
    .order('weigh_date', { ascending: false });

  type WeightRecord = { id: string; new_weight: number; weigh_date: string };
  const weights = (rawWeights ?? []) as WeightRecord[];

  // Fetch active pens for status form (sick pen selection)
  const { data: rawPens } = await supabase
    .from('pens')
    .select('id, pen_name, capacity, active_animal_count')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('pen_name');

  type PenOption = { id: string; pen_name: string; capacity: number | null; active_animal_count: number };
  const pens = (rawPens ?? []) as PenOption[];

  const isLocked = animal.status === 'DEAD' || animal.status === 'DISPATCHED';
  const currentWeight = animal.current_weight ?? animal.intake_weight;
  const gain = currentWeight - animal.intake_weight;
  const statusCfg = STATUS_CONFIG[animal.status] ?? { label: animal.status, badge: 'bg-slate-100 text-slate-600' };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-emerald-950 px-6 py-5 shadow-md">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Link href="/inventory" className="text-emerald-300 hover:text-white text-sm transition-colors">
              ← Inventory
            </Link>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-300 uppercase tracking-widest">Animal</p>
              <h1 className="mt-1 text-2xl font-bold text-white font-mono">{animal.tag_id}</h1>
              <p className="mt-0.5 text-sm text-emerald-200">{animal.breed} — {Array.isArray(animal.pens) ? animal.pens[0]?.pen_name : (animal.pens as { pen_name: string } | null)?.pen_name ?? 'Unknown Pen'}</p>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${statusCfg.badge}`}>
              {statusCfg.label}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Locked banner */}
        {isLocked && (
          <div className="rounded-lg bg-slate-100 border border-slate-300 px-5 py-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-sm text-slate-600">
              <span className="font-semibold">BUS-001: Record Sealed.</span>{' '}
              This animal is {animal.status === 'DEAD' ? 'deceased' : 'dispatched'} and cannot be modified.
              {animal.mortality_date && ` Mortality: ${formatDate(animal.mortality_date)}.`}
              {animal.dispatch_date && ` Dispatched: ${formatDate(animal.dispatch_date)}.`}
            </p>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Intake Weight', value: `${animal.intake_weight.toFixed(1)} kg` },
            { label: 'Current Weight', value: `${currentWeight.toFixed(1)} kg` },
            { label: 'Total Gain', value: `${gain >= 0 ? '+' : ''}${gain.toFixed(1)} kg`, highlight: true },
            { label: 'Intake Date', value: formatDate(animal.intake_date) },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-medium">{item.label}</p>
              <p className={`mt-1 text-lg font-bold font-mono ${
                item.highlight
                  ? gain >= 0 ? 'text-emerald-700' : 'text-red-600'
                  : 'text-slate-900'
              }`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Weight history */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Weight History</h2>
          </div>
          {weights.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              No weight records yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Weight (kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {weights.map((w) => (
                  <tr key={w.id}>
                    <td className="px-5 py-3 text-slate-600">{formatDateTime(w.weigh_date)}</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-slate-900">{w.new_weight.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Record weight */}
        {!isLocked && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Record Weight</h2>
            <WeightForm animalId={animal.id} animalStatus={animal.status} />
          </div>
        )}

        {/* Status change */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Manage Status</h2>
          <StatusForm animal={animal} pens={pens} />
        </div>
      </div>
    </div>
  );
}
