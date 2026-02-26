import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Feeding History — FeedlotPro',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function FeedingHistoryPage() {
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

  // Fetch feeding records with pen name
  const { data: rawRecords } = await supabase
    .from('feeding_records')
    .select('id, feeding_timestamp, total_kg_fed, pen_id, pens(pen_name)')
    .eq('organization_id', orgId)
    .order('feeding_timestamp', { ascending: false })
    .limit(100);

  type FeedingRecord = {
    id: string;
    feeding_timestamp: string;
    total_kg_fed: number;
    pen_id: string;
    // Supabase returns joined rows as an array
    pens: { pen_name: string }[] | { pen_name: string } | null;
  };

  const records = (rawRecords as unknown as FeedingRecord[]) ?? [];

  // Fetch details for each record (last 20 for performance)
  const recentIds = records.slice(0, 20).map((r) => r.id);

  const { data: rawDetails } = recentIds.length > 0
    ? await supabase
        .from('feeding_details')
        .select('feeding_record_id, kg_amount, pantry_ingredients(ingredient_name)')
        .in('feeding_record_id', recentIds)
    : { data: [] };

  type FeedingDetail = {
    feeding_record_id: string;
    kg_amount: number;
    pantry_ingredients: { ingredient_name: string }[] | { ingredient_name: string } | null;
  };

  const details = (rawDetails as unknown as FeedingDetail[]) ?? [];

  // Group details by record id
  const detailsByRecord: Record<string, FeedingDetail[]> = {};
  details.forEach((d) => {
    if (!detailsByRecord[d.feeding_record_id]) {
      detailsByRecord[d.feeding_record_id] = [];
    }
    detailsByRecord[d.feeding_record_id].push(d);
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-emerald-950 px-6 py-5 shadow-md">
        <div className="max-w-4xl mx-auto flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/feeding" className="text-emerald-300 hover:text-white text-sm transition-colors">
                ← Feeding
              </Link>
            </div>
            <p className="text-sm font-medium text-emerald-300 uppercase tracking-widest">Feeding</p>
            <h1 className="mt-1 text-2xl font-bold text-white">History</h1>
            <p className="mt-0.5 text-sm text-emerald-200">{records.length} records</p>
          </div>
          <Link
            href="/feeding"
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors min-h-[44px]"
          >
            + Record Feeding
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {records.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-slate-700">No feeding records yet.</p>
            <p className="text-sm text-slate-500 mt-1">Use the Daily Feeding Checklist to start recording.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => {
              const recordDetails = detailsByRecord[record.id] ?? [];
              return (
                <div
                  key={record.id}
                  className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  {/* Record header */}
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {Array.isArray(record.pens) ? record.pens[0]?.pen_name : (record.pens as { pen_name: string } | null)?.pen_name ?? 'Unknown Pen'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDateTime(record.feeding_timestamp)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold font-mono text-emerald-700">
                        {record.total_kg_fed.toFixed(1)}
                      </p>
                      <p className="text-xs text-slate-400">kg total</p>
                    </div>
                  </div>

                  {/* Ingredient breakdown (for recent records) */}
                  {recordDetails.length > 0 && (
                    <div className="border-t border-slate-100 px-5 py-3">
                      <div className="flex flex-wrap gap-2">
                        {recordDetails.map((d, i) => (
                          <span key={i} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-1 font-mono">
                            {(Array.isArray(d.pantry_ingredients) ? d.pantry_ingredients[0]?.ingredient_name : (d.pantry_ingredients as { ingredient_name: string } | null)?.ingredient_name) ?? 'Unknown'}: {d.kg_amount.toFixed(1)} kg
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
