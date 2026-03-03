// ─── Health Management Page — P6 ─────────────────────────────────────────────
// Lists all SICK animals for the organisation, grouped by severity.
// RBAC: all authenticated roles can VIEW; ACTION.VET_TREATMENT gated per card.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Database } from '@/types/database';
import { SickAnimalCard } from '@/components/health/sick-animal-card';
import { EmptyState } from '@/components/ui/empty-state';
import { HeartPulse } from 'lucide-react';

export const metadata = { title: 'Animal Health — FeedlotPro' };

export default async function HealthPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get membership
  const { data: rawMembership } = await supabase
    .from('tenant_members')
    .select('id, organization_id, role')
    .eq('user_id', user.id)
    .single();
  if (!rawMembership) redirect('/onboarding');
  const membership = rawMembership as { id: string; organization_id: string; role: string };

  // Fetch SICK animals with pen info and latest health event
  const { data: rawAnimals } = await supabase
    .from('animals')
    .select(`
      id, tag_id, breed, status, sick_since,
      pens ( pen_name )
    `)
    .eq('organization_id', membership.organization_id)
    .eq('status', 'SICK')
    .order('sick_since', { ascending: true });

  const animals = (rawAnimals ?? []) as unknown as Array<{
    id: string;
    tag_id: string;
    breed: string;
    status: string;
    sick_since: string | null;
    pens: { pen_name: string } | { pen_name: string }[] | null;
  }>;

  // Fetch latest health events for sick animals
  const animalIds = animals.map((a) => a.id);
  const healthEventsByAnimal: Record<string, { primary_symptom: string | null; severity: string | null }> = {};
  const latestTreatmentByAnimal: Record<string, string | null> = {};

  if (animalIds.length > 0) {
    type HealthEventRow = { animal_id: string; primary_symptom: string | null; severity: string | null; event_type: string; created_at: string };
    const { data: rawHealthEvents } = await supabase
      .from('health_events')
      .select('animal_id, primary_symptom, severity, event_type, created_at')
      .in('animal_id', animalIds)
      .eq('event_type', 'FLAGGED_SICK')
      .order('created_at', { ascending: false });

    const healthEvents = (rawHealthEvents ?? []) as unknown as HealthEventRow[];
    healthEvents.forEach((ev) => {
      if (!healthEventsByAnimal[ev.animal_id]) {
        healthEventsByAnimal[ev.animal_id] = {
          primary_symptom: ev.primary_symptom,
          severity: ev.severity,
        };
      }
    });

    type TreatmentRow = { animal_id: string; medication_name: string; treated_at: string };
    const { data: rawTreatments } = await supabase
      .from('treatment_records')
      .select('animal_id, medication_name, treated_at')
      .in('animal_id', animalIds)
      .order('treated_at', { ascending: false });

    const treatments = (rawTreatments ?? []) as unknown as TreatmentRow[];
    treatments.forEach((tr) => {
      if (!latestTreatmentByAnimal[tr.animal_id]) {
        latestTreatmentByAnimal[tr.animal_id] = tr.medication_name;
      }
    });
  }

  // Sort: SEVERE first → longest sick duration first
  const severityOrder: Record<string, number> = { SEVERE: 0, MODERATE: 1, MILD: 2 };
  const sorted = [...animals].sort((a, b) => {
    const sa = severityOrder[healthEventsByAnimal[a.id]?.severity ?? ''] ?? 3;
    const sb = severityOrder[healthEventsByAnimal[b.id]?.severity ?? ''] ?? 3;
    if (sa !== sb) return sa - sb;
    // Longer sick duration first (earlier date = smaller timestamp)
    return (a.sick_since ?? '').localeCompare(b.sick_since ?? '');
  });

  const role = (membership.role ?? 'FARMHAND') as import('@/lib/worker-session').WorkerRole;

  // Severity counts for stats bar
  const severeCnt = sorted.filter((a) => healthEventsByAnimal[a.id]?.severity === 'SEVERE').length;
  const moderateCnt = sorted.filter((a) => healthEventsByAnimal[a.id]?.severity === 'MODERATE').length;
  const mildCnt = sorted.filter((a) => healthEventsByAnimal[a.id]?.severity === 'MILD').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100">
            <HeartPulse className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-emerald-950">Animal Health</h1>
            <p className="text-sm text-slate-500">
              {animals.length > 0
                ? `${animals.length} sick animal${animals.length !== 1 ? 's' : ''} under observation`
                : 'No sick animals — all clear!'}
            </p>
          </div>
        </div>
        {animals.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {animals.length} Sick
          </div>
        )}
      </div>

      {/* Severity stats bar */}
      {sorted.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white border border-slate-200 px-4 py-3 shadow-sm">
          {severeCnt > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
              <span className="font-semibold text-red-700">{severeCnt}</span>
              <span className="text-slate-500">Severe</span>
            </div>
          )}
          {moderateCnt > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
              <span className="font-semibold text-amber-700">{moderateCnt}</span>
              <span className="text-slate-500">Moderate</span>
            </div>
          )}
          {mildCnt > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0" />
              <span className="font-semibold text-slate-600">{mildCnt}</span>
              <span className="text-slate-500">Mild</span>
            </div>
          )}
          {severeCnt === 0 && moderateCnt === 0 && mildCnt === 0 && (
            <span className="text-sm text-slate-400">No severity data recorded</span>
          )}
        </div>
      )}

      {/* Sick animal list */}
      {sorted.length === 0 ? (
        <EmptyState
          icon={<HeartPulse className="w-8 h-8 text-slate-400" />}
          title="All animals are healthy!"
          description="Animals flagged as sick will appear here."
        />
      ) : (
        <div className="grid gap-4">
          {sorted.map((animal) => {
            const penName = Array.isArray(animal.pens)
              ? (animal.pens[0]?.pen_name ?? '—')
              : ((animal.pens as { pen_name: string } | null)?.pen_name ?? '—');

            const healthInfo = healthEventsByAnimal[animal.id];

            return (
              <SickAnimalCard
                key={animal.id}
                animalId={animal.id}
                organizationId={membership.organization_id}
                memberId={membership.id}
                role={role}
                tagId={animal.tag_id}
                breed={animal.breed}
                penName={penName}
                primarySymptom={healthInfo?.primary_symptom ?? null}
                severity={(healthInfo?.severity ?? null) as 'MILD' | 'MODERATE' | 'SEVERE' | null}
                sickSince={animal.sick_since}
                latestMedication={latestTreatmentByAnimal[animal.id] ?? null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
