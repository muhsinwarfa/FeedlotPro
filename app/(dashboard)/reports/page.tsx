// ─── Reports & Export Page — P9 ──────────────────────────────────────────────
// OWNER + MANAGER only (ACTION.MANAGE_REPORTS).
// Tabs: Performance | Feed Cost | Batches | Health | Feeding History | Mortality
// SYS-009: 30-second query timeout with error UI fallback.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { checkPermission, ACTION } from '@/lib/rbac';
import type { WorkerRole } from '@/lib/worker-session';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DateRangeFilter } from '@/components/reports/date-range-filter';
import { ExportControls } from '@/components/reports/export-controls';
import { PerformanceReport, type AnimalPerformanceRow } from '@/components/reports/performance-report';
import { FeedCostReport, type FeedCostIngredientRow, type DailyCostRow } from '@/components/reports/feed-cost-report';
import { BatchReport, type BatchReportRow } from '@/components/reports/batch-report';
import { HealthReport, type HealthEventRow, type TreatmentCostRow } from '@/components/reports/health-report';
import { FeedingHistoryReport, type FeedingHistoryRow } from '@/components/reports/feeding-history-report';
import { MortalityReport, type MortalityRow } from '@/components/reports/mortality-report';

export const metadata = { title: 'Reports — FeedlotPro' };

const QUERY_TIMEOUT_MS = 30_000;

function getJoin<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rawMembership } = await supabase
    .from('tenant_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1);

  if (!rawMembership?.[0]) redirect('/onboarding');
  const membership = (rawMembership[0]) as { organization_id: string; role: string };
  const role = membership.role as WorkerRole;

  if (!checkPermission(role, ACTION.MANAGE_REPORTS)) redirect('/');

  const orgId = membership.organization_id;

  const params = await searchParams;
  const toDateObj = new Date();
  const fromDateObj = new Date();
  fromDateObj.setDate(fromDateObj.getDate() - 30);

  const from = params.from ?? fromDateObj.toISOString().split('T')[0];
  const to = params.to ?? toDateObj.toISOString().split('T')[0];
  const fromISO = `${from}T00:00:00.000Z`;
  const toISO = `${to}T23:59:59.999Z`;

  // ── Parallel queries with SYS-009 timeout ─────────────────────────────────
  const fetchAllData = Promise.all([
    supabase
      .from('stock_transactions')
      .select('ingredient_id, quantity_kg, total_cost, pantry_ingredients(ingredient_name)')
      .eq('organization_id', orgId)
      .eq('transaction_type', 'CONSUMPTION')
      .gte('transacted_at', fromISO)
      .lte('transacted_at', toISO),

    supabase
      .from('feeding_records')
      .select('feeding_timestamp, total_cost, total_kg_fed, pen_id, pens(pen_name)')
      .eq('organization_id', orgId)
      .gte('feeding_timestamp', fromISO)
      .lte('feeding_timestamp', toISO)
      .order('feeding_timestamp', { ascending: true }),

    supabase
      .from('animals')
      .select('id, tag_id, breed, status, intake_weight, intake_date, current_weight, current_adg, dispatch_ready, batch_id, pens(pen_name), batches(batch_code, arrival_date, source_supplier)')
      .eq('organization_id', orgId),

    supabase
      .from('batches')
      .select('id, batch_code, arrival_date, source_supplier')
      .eq('organization_id', orgId)
      .order('arrival_date', { ascending: false }),

    supabase
      .from('health_events')
      .select('id, event_type, notes, created_at, animals(tag_id)')
      .eq('organization_id', orgId)
      .gte('created_at', fromISO)
      .lte('created_at', toISO)
      .order('created_at', { ascending: false }),

    supabase
      .from('treatment_records')
      .select('treatment_cost, treated_at, medication_name, animals(tag_id)')
      .eq('organization_id', orgId)
      .gte('treated_at', fromISO)
      .lte('treated_at', toISO),

    supabase.from('organizations').select('target_weight').eq('id', orgId).single(),
  ]);

  let queryResults: Awaited<typeof fetchAllData>;
  try {
    queryResults = await Promise.race([
      fetchAllData,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('ERR_REPORT_TIMEOUT')), QUERY_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    if (err instanceof Error && err.message === 'ERR_REPORT_TIMEOUT') {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 max-w-md text-center space-y-2">
            <p className="text-sm font-bold text-red-700 uppercase tracking-wider">SYS-009 — Report Timeout</p>
            <p className="text-sm text-red-600">
              Report generation timed out. Try selecting a smaller date range.
            </p>
          </div>
        </div>
      );
    }
    throw err;
  }

  const [
    stockTxResult,
    feedingRecordsResult,
    animalsResult,
    batchesResult,
    healthEventsResult,
    treatmentsResult,
    orgResult,
  ] = queryResults;

  // ── Raw types ──────────────────────────────────────────────────────────────
  type RawStockTx = {
    ingredient_id: string;
    quantity_kg: number;
    total_cost: number | null;
    pantry_ingredients: { ingredient_name: string } | { ingredient_name: string }[] | null;
  };

  type RawFeedingRecord = {
    feeding_timestamp: string;
    total_cost: number;
    total_kg_fed: number;
    pen_id: string;
    pens: { pen_name: string } | { pen_name: string }[] | null;
  };

  type RawAnimal = {
    id: string;
    tag_id: string;
    breed: string;
    status: string;
    intake_weight: number;
    intake_date: string | null;
    current_weight: number | null;
    current_adg: number | null;
    dispatch_ready: boolean;
    batch_id: string | null;
    pens: { pen_name: string } | { pen_name: string }[] | null;
    batches: { batch_code: string; arrival_date: string | null; source_supplier: string | null } | { batch_code: string; arrival_date: string | null; source_supplier: string | null }[] | null;
  };

  type RawBatch = { id: string; batch_code: string; arrival_date: string | null; source_supplier: string | null };

  type RawHealthEvent = {
    id: string;
    event_type: string;
    notes: string | null;
    created_at: string;
    animals: { tag_id: string } | { tag_id: string }[] | null;
  };

  type RawTreatment = {
    treatment_cost: number | null;
    treated_at: string;
    medication_name: string | null;
    animals: { tag_id: string } | { tag_id: string }[] | null;
  };

  const rawStockTxs = (stockTxResult.data ?? []) as unknown as RawStockTx[];
  const rawFeedings = (feedingRecordsResult.data ?? []) as unknown as RawFeedingRecord[];
  const rawAnimals = (animalsResult.data ?? []) as unknown as RawAnimal[];
  const rawBatches = (batchesResult.data ?? []) as RawBatch[];
  const rawEvents = (healthEventsResult.data ?? []) as unknown as RawHealthEvent[];
  const rawTreatments = (treatmentsResult.data ?? []) as unknown as RawTreatment[];
  const targetWeight = orgResult.data
    ? (orgResult.data as { target_weight: number | null }).target_weight
    : null;

  // ── Feed Cost aggregation ─────────────────────────────────────────────────
  const ingredientMap = new Map<string, { name: string; kgConsumed: number; totalCost: number }>();
  for (const tx of rawStockTxs) {
    const ing = getJoin(tx.pantry_ingredients);
    const name = ing?.ingredient_name ?? tx.ingredient_id;
    const existing = ingredientMap.get(tx.ingredient_id);
    if (existing) {
      existing.kgConsumed += tx.quantity_kg;
      existing.totalCost += tx.total_cost ?? 0;
    } else {
      ingredientMap.set(tx.ingredient_id, { name, kgConsumed: tx.quantity_kg, totalCost: tx.total_cost ?? 0 });
    }
  }
  const ingredientRows: FeedCostIngredientRow[] = Array.from(ingredientMap.entries()).map(
    ([ingredient_id, v]) => ({ ingredient_id, ingredient_name: v.name, kg_consumed: v.kgConsumed, total_cost: v.totalCost })
  );

  const dailyMap = new Map<string, { total_cost: number; total_kg: number }>();
  for (const rec of rawFeedings) {
    const date = rec.feeding_timestamp.split('T')[0];
    const existing = dailyMap.get(date);
    if (existing) {
      existing.total_cost += rec.total_cost;
      existing.total_kg += rec.total_kg_fed;
    } else {
      dailyMap.set(date, { total_cost: rec.total_cost, total_kg: rec.total_kg_fed });
    }
  }
  const dailyRows: DailyCostRow[] = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, total_cost: v.total_cost, total_kg: v.total_kg }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Performance data ──────────────────────────────────────────────────────
  const today = new Date();
  const performanceRows: AnimalPerformanceRow[] = rawAnimals
    .filter((a) => a.status === 'ACTIVE' || a.status === 'SICK')
    .map((a) => {
      const pen = getJoin(a.pens);
      const batch = getJoin(a.batches);
      const intakeDate = a.intake_date ? new Date(a.intake_date) : null;
      const daysOnFeed = intakeDate
        ? Math.max(0, Math.floor((today.getTime() - intakeDate.getTime()) / 86_400_000))
        : 0;
      return {
        tag_id: a.tag_id,
        breed: a.breed,
        pen_name: pen?.pen_name ?? '—',
        batch_code: batch?.batch_code ?? null,
        days_on_feed: daysOnFeed,
        intake_weight: a.intake_weight,
        current_weight: a.current_weight,
        current_adg: a.current_adg,
        dispatch_ready: a.dispatch_ready,
      };
    });

  // ── Batch data ────────────────────────────────────────────────────────────
  const batchStatsMap = new Map<string, { active: number; sick: number; dead: number; dispatched: number; adgSum: number; adgCount: number }>();
  for (const animal of rawAnimals) {
    if (!animal.batch_id) continue;
    const s = batchStatsMap.get(animal.batch_id) ?? { active: 0, sick: 0, dead: 0, dispatched: 0, adgSum: 0, adgCount: 0 };
    if (animal.status === 'ACTIVE') s.active++;
    else if (animal.status === 'SICK') s.sick++;
    else if (animal.status === 'DEAD') s.dead++;
    else if (animal.status === 'DISPATCHED') s.dispatched++;
    if (animal.current_adg != null && (animal.status === 'ACTIVE' || animal.status === 'SICK')) {
      s.adgSum += animal.current_adg;
      s.adgCount++;
    }
    batchStatsMap.set(animal.batch_id, s);
  }
  const batchRows: BatchReportRow[] = rawBatches.map((b) => {
    const stats = batchStatsMap.get(b.id);
    const totalHead = (stats?.active ?? 0) + (stats?.sick ?? 0) + (stats?.dead ?? 0) + (stats?.dispatched ?? 0);
    return {
      batch_id: b.id,
      batch_code: b.batch_code,
      arrival_date: b.arrival_date,
      supplier: b.source_supplier,
      total_head: totalHead,
      active_count: stats?.active ?? 0,
      sick_count: stats?.sick ?? 0,
      dead_count: stats?.dead ?? 0,
      dispatched_count: stats?.dispatched ?? 0,
      avg_adg: stats && stats.adgCount > 0 ? stats.adgSum / stats.adgCount : null,
    };
  });

  // ── Health data ───────────────────────────────────────────────────────────
  const healthEvents: HealthEventRow[] = rawEvents.map((e) => ({
    id: e.id,
    animal_tag: getJoin(e.animals)?.tag_id ?? '—',
    event_type: e.event_type,
    notes: e.notes,
    created_at: e.created_at,
  }));
  const treatmentRows: TreatmentCostRow[] = rawTreatments.map((t) => ({
    animal_tag: getJoin(t.animals)?.tag_id ?? '—',
    treatment_cost: t.treatment_cost,
    treated_at: t.treated_at,
    medication_name: t.medication_name,
  }));

  // ── Feeding History data ──────────────────────────────────────────────────
  const feedingHistoryRows: FeedingHistoryRow[] = rawFeedings.map((r) => ({
    date: r.feeding_timestamp.split('T')[0],
    pen_name: getJoin(r.pens)?.pen_name ?? '—',
    total_kg_fed: r.total_kg_fed,
    total_cost: r.total_cost ?? 0,
  }));

  // ── Mortality data ────────────────────────────────────────────────────────
  const mortalityRows: MortalityRow[] = rawEvents
    .filter((e) => e.event_type === 'MORTALITY')
    .map((e) => ({
      id: e.id,
      animal_tag: getJoin(e.animals)?.tag_id ?? '—',
      notes: e.notes,
      created_at: e.created_at,
    }));

  // ── Export data ───────────────────────────────────────────────────────────
  const exportData = [
    {
      sheetName: 'Performance',
      rows: performanceRows.map((r) => ({
        'Tag ID': r.tag_id, Breed: r.breed, Pen: r.pen_name, Batch: r.batch_code ?? '',
        'Days on Feed': r.days_on_feed, 'Intake Weight (kg)': r.intake_weight,
        'Current Weight (kg)': r.current_weight, 'ADG (kg/day)': r.current_adg,
        'Dispatch Ready': r.dispatch_ready ? 'Yes' : 'No',
      })),
    },
    {
      sheetName: 'Feed Cost',
      rows: ingredientRows.map((r) => ({
        Ingredient: r.ingredient_name, 'Kg Consumed': r.kg_consumed, 'Total Cost (KES)': r.total_cost,
      })),
    },
    {
      sheetName: 'Daily Cost',
      rows: dailyRows.map((r) => ({ Date: r.date, 'Kg Fed': r.total_kg, 'Total Cost (KES)': r.total_cost })),
    },
    {
      sheetName: 'Batches',
      rows: batchRows.map((r) => ({
        'Batch Code': r.batch_code, Arrival: r.arrival_date ?? '', Supplier: r.supplier ?? '',
        'Total Head': r.total_head, Active: r.active_count, Sick: r.sick_count,
        Dead: r.dead_count, Dispatched: r.dispatched_count, 'Avg ADG': r.avg_adg,
      })),
    },
    {
      sheetName: 'Health Events',
      rows: healthEvents.map((e) => ({
        Date: new Date(e.created_at).toISOString().split('T')[0],
        'Tag ID': e.animal_tag, Event: e.event_type, Notes: e.notes ?? '',
      })),
    },
    {
      sheetName: 'Treatments',
      rows: treatmentRows.map((t) => ({
        Date: new Date(t.treated_at).toISOString().split('T')[0],
        'Tag ID': t.animal_tag, Medication: t.medication_name ?? '', 'Cost (KES)': t.treatment_cost,
      })),
    },
    {
      sheetName: 'Feeding History',
      rows: feedingHistoryRows.map((r) => ({
        Date: r.date, Pen: r.pen_name, 'kg Fed': r.total_kg_fed, 'Total Cost (KES)': r.total_cost,
      })),
    },
    {
      sheetName: 'Mortality',
      rows: mortalityRows.map((r) => ({
        Date: new Date(r.created_at).toISOString().split('T')[0],
        'Tag ID': r.animal_tag, Notes: r.notes ?? '',
      })),
    },
  ];

  const dateRangeLabel = `${from}_to_${to}`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-emerald-950 px-6 py-5 shadow-md print:hidden">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm font-medium text-emerald-300 uppercase tracking-widest">Reports</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Analytics & Export</h1>
          <p className="mt-0.5 text-sm text-emerald-200">
            Performance, feed cost, batch, health, feeding history, and mortality summaries.
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-end justify-between gap-4 flex-wrap print:hidden">
          <DateRangeFilter from={from} to={to} />
          <ExportControls reportTitle="FeedlotPro-Report" dateRange={dateRangeLabel} exportData={exportData} />
        </div>

        <div className="hidden print:block mb-4">
          <h2 className="text-xl font-bold text-slate-900">FeedlotPro — Farm Report</h2>
          <p className="text-sm text-slate-500">Period: {from} → {to}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Tabs defaultValue="performance">
            <TabsList className="mb-6 print:hidden flex-wrap h-auto gap-1">
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="feed-cost">Feed Cost</TabsTrigger>
              <TabsTrigger value="batches">Batches</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
              <TabsTrigger value="feeding-history">Feeding History</TabsTrigger>
              <TabsTrigger value="mortality">
                Mortality
                {mortalityRows.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold w-4 h-4">
                    {mortalityRows.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="performance">
              <PerformanceReport animals={performanceRows} targetWeight={targetWeight} />
            </TabsContent>
            <TabsContent value="feed-cost">
              <FeedCostReport ingredientRows={ingredientRows} dailyRows={dailyRows} />
            </TabsContent>
            <TabsContent value="batches">
              <BatchReport batches={batchRows} />
            </TabsContent>
            <TabsContent value="health">
              <HealthReport events={healthEvents} treatments={treatmentRows} />
            </TabsContent>
            <TabsContent value="feeding-history">
              <FeedingHistoryReport rows={feedingHistoryRows} />
            </TabsContent>
            <TabsContent value="mortality">
              <MortalityReport rows={mortalityRows} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
