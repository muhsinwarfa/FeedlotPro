import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WeightForm } from '@/components/animals/weight-form';
import { StatusForm } from '@/components/animals/status-form';
import { FlagSickForm } from '@/components/health/flag-sick-form';
import { HealthOutcomeForm } from '@/components/health/health-outcome-form';
import type { WorkerRole } from '@/lib/worker-session';

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
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: rawMembership } = await supabase
    .from('tenant_members')
    .select('id, organization_id, role')
    .eq('user_id', user.id)
    .single();

  const membership = rawMembership as { id: string; organization_id: string; role: WorkerRole } | null;
  if (!membership) redirect('/onboarding');

  const orgId = membership.organization_id;

  // Fetch animal (must belong to this org)
  const { data: rawAnimal } = await supabase
    .from('animals')
    .select('*, pens(pen_name)')
    .eq('id', (await params).id)
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
    current_adg: number | null;
    dispatch_ready: boolean;
    sick_since: string | null;
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

  // Fetch health event history
  const { data: rawHealthEvents } = await supabase
    .from('health_events')
    .select('id, event_type, primary_symptom, severity, notes, created_at')
    .eq('animal_id', animal.id)
    .order('created_at', { ascending: false });

  type HealthEventRow = { id: string; event_type: string; primary_symptom: string | null; severity: string | null; notes: string | null; created_at: string };
  const healthEvents = (rawHealthEvents ?? []) as HealthEventRow[];

  // Fetch treatment records
  const { data: rawTreatments } = await supabase
    .from('treatment_records')
    .select('id, medication_name, dosage, administration_route, treatment_cost, treated_at')
    .eq('animal_id', animal.id)
    .order('treated_at', { ascending: false });

  type TreatmentRow = { id: string; medication_name: string; dosage: string; administration_route: string; treatment_cost: number | null; treated_at: string };
  const treatments = (rawTreatments ?? []) as TreatmentRow[];

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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Intake Weight', value: `${animal.intake_weight.toFixed(1)} kg`, highlight: false },
            { label: 'Current Weight', value: `${currentWeight.toFixed(1)} kg`, highlight: false },
            { label: 'Total Gain', value: `${gain >= 0 ? '+' : ''}${gain.toFixed(1)} kg`, highlight: true },
            { label: 'Intake Date', value: formatDate(animal.intake_date), highlight: false },
            { label: 'Avg Daily Gain', value: animal.current_adg != null ? `+${animal.current_adg.toFixed(3)} kg/d` : 'N/A', highlight: false },
            { label: 'Dispatch Ready', value: animal.dispatch_ready ? 'Yes ✓' : 'Not yet', highlight: animal.dispatch_ready },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-medium">{item.label}</p>
              <p className={`mt-1 text-lg font-bold font-mono ${
                item.highlight
                  ? 'text-emerald-700'
                  : gain >= 0 && item.label === 'Total Gain' ? 'text-emerald-700' : 'text-slate-900'
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

        {/* Flag as Sick (ACTIVE animals only) */}
        {animal.status === 'ACTIVE' && (
          <FlagSickForm
            animalId={animal.id}
            organizationId={animal.organization_id}
            memberId={membership.id}
            role={membership.role}
            pens={pens.map((p) => ({ id: p.id, pen_name: p.pen_name }))}
          />
        )}

        {/* Health Outcome (SICK animals only) */}
        {animal.status === 'SICK' && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Resolve Health Status</h2>
            <HealthOutcomeForm
              animalId={animal.id}
              organizationId={animal.organization_id}
              memberId={membership.id}
              role={membership.role}
            />
          </div>
        )}

        {/* Status change (terminal transitions only — DEAD / DISPATCHED) */}
        {!isLocked && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Manage Status</h2>
            <StatusForm animal={animal} pens={pens} />
          </div>
        )}

        {/* Health event history */}
        {healthEvents.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Health History</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Event</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {healthEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{formatDate(ev.created_at)}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{ev.event_type.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 text-slate-600">{[ev.primary_symptom, ev.severity, ev.notes].filter(Boolean).join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Treatment records */}
        {treatments.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Treatment Records</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Medication</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Route</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Cost (KES)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {treatments.map((tr) => (
                  <tr key={tr.id}>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{formatDate(tr.treated_at)}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{tr.medication_name} <span className="text-slate-500 font-normal">{tr.dosage}</span></td>
                    <td className="px-5 py-3 text-slate-600">{tr.administration_route.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 text-right font-mono">{tr.treatment_cost != null ? tr.treatment_cost.toFixed(2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
