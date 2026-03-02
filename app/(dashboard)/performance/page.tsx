// ─── Performance Intelligence Page — P7 ──────────────────────────────────────
// OWNER + MANAGER only (ACTION.VIEW_PERFORMANCE).
// Shows pen-level ADG/FCR table and dispatch-ready animal list.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Database } from '@/types/database';
import { checkPermission, ACTION } from '@/lib/rbac';
import { PenPerformanceTable } from '@/components/performance/pen-performance-table';
import { DispatchReadyList } from '@/components/performance/dispatch-ready-list';
import { BarChart3 } from 'lucide-react';

export const metadata = { title: 'Performance — FeedlotPro' };

export default async function PerformancePage() {
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rawMembership } = await supabase
    .from('tenant_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single();
  if (!rawMembership) redirect('/onboarding');
  const membership = rawMembership as { organization_id: string; role: string };

  const role = membership.role as import('@/lib/worker-session').WorkerRole;

  // RBAC: OWNER + MANAGER only
  if (!checkPermission(role, ACTION.VIEW_PERFORMANCE)) {
    redirect('/');
  }

  const orgId = membership.organization_id;

  // Parallel fetches
  const [pensResult, activeAnimalsResult, dispatchResult, batchResult, orgResult] = await Promise.all([
    // Pens with FCR
    supabase
      .from('pens')
      .select('id, pen_name, active_animal_count, current_fcr')
      .eq('organization_id', orgId)
      .eq('status', 'active'),

    // Active animals with ADG for per-pen avg
    supabase
      .from('animals')
      .select('pen_id, current_adg')
      .eq('organization_id', orgId)
      .in('status', ['ACTIVE', 'SICK'])
      .not('current_adg', 'is', null),

    // Dispatch-ready animals
    supabase
      .from('animals')
      .select('id, tag_id, breed, pen_id, current_weight, current_adg, dispatch_ready_date')
      .eq('organization_id', orgId)
      .eq('dispatch_ready', true)
      .in('status', ['ACTIVE', 'SICK'])
      .order('dispatch_ready_date', { ascending: true }),

    // Batches for batch tab
    supabase
      .from('batches')
      .select('id, batch_code, source_supplier, arrival_date')
      .eq('organization_id', orgId)
      .order('arrival_date', { ascending: false }),

    // Organization target_weight
    supabase
      .from('organizations')
      .select('target_weight')
      .eq('id', orgId)
      .single(),
  ]);

  const pens = (pensResult.data ?? []) as Array<{ id: string; pen_name: string; active_animal_count: number; current_fcr: number | null }>;
  const activeAnimals = (activeAnimalsResult.data ?? []) as Array<{ pen_id: string; current_adg: number | null }>;
  const dispatchAnimals = (dispatchResult.data ?? []) as Array<{ id: string; tag_id: string; breed: string; pen_id: string | null; current_weight: number | null; current_adg: number | null; dispatch_ready_date: string | null }>;
  const batches = (batchResult.data ?? []) as Array<{ id: string; batch_code: string; source_supplier: string | null; arrival_date: string }>;
  const targetWeight = (orgResult.data as { target_weight: number | null } | null)?.target_weight ?? null;

  // Build per-pen avg ADG map
  const adgByPen: Record<string, number[]> = {};
  for (const a of activeAnimals) {
    if (!adgByPen[a.pen_id]) adgByPen[a.pen_id] = [];
    if (a.current_adg != null) adgByPen[a.pen_id].push(a.current_adg);
  }

  const penRows = pens.map((pen) => {
    const adgs = adgByPen[pen.id] ?? [];
    const avg_adg = adgs.length > 0 ? adgs.reduce((s, v) => s + v, 0) / adgs.length : null;
    return {
      id: pen.id,
      pen_name: pen.pen_name,
      active_animal_count: pen.active_animal_count,
      avg_adg,
      current_fcr: pen.current_fcr,
    };
  });

  // Fetch pen names for dispatch animals
  const penNamesMap: Record<string, string> = {};
  for (const pen of pens) penNamesMap[pen.id] = pen.pen_name;

  const dispatchRows = dispatchAnimals.map((a) => ({
    id: a.id,
    tag_id: a.tag_id,
    breed: a.breed,
    pen_name: penNamesMap[a.pen_id ?? ''] ?? '—',
    current_weight: a.current_weight,
    target_weight: targetWeight,
    current_adg: a.current_adg,
    dispatch_ready_date: a.dispatch_ready_date,
  }));

  // Build batch rows (simple - no per-batch ADG query yet)
  const batchRows = batches.map((b) => ({
    batch_code: b.batch_code,
    animal_count: 0, // TODO: join with animals count in Block 3
    source_supplier: b.source_supplier,
    avg_adg: null,
    avg_days_on_feed: null,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100">
          <BarChart3 className="h-5 w-5 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-emerald-950">Performance Intelligence</h1>
          <p className="text-sm text-slate-500">ADG and FCR metrics across pens and batches</p>
        </div>
      </div>

      {/* Pen / Batch performance table */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Pen & Batch Metrics</h2>
        <PenPerformanceTable pens={penRows} batches={batchRows} />
      </section>

      {/* Dispatch-ready animals */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800">
            Dispatch Ready
            {dispatchRows.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({dispatchRows.length} animal{dispatchRows.length !== 1 ? 's' : ''})
              </span>
            )}
          </h2>
          {targetWeight && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
              Target: {targetWeight} kg
            </span>
          )}
        </div>
        <DispatchReadyList animals={dispatchRows} />
      </section>
    </div>
  );
}
