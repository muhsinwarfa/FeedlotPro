'use client';

export type FeedingHistoryRow = {
  date: string;        // ISO date string (YYYY-MM-DD)
  pen_name: string;
  total_kg_fed: number;
  total_cost: number;
};

interface FeedingHistoryReportProps {
  rows: FeedingHistoryRow[];
}

export function FeedingHistoryReport({ rows }: FeedingHistoryReportProps) {
  const totalKg = rows.reduce((s, r) => s + r.total_kg_fed, 0);
  const totalCost = rows.reduce((s, r) => s + r.total_cost, 0);

  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Feeding Sessions"
          value={rows.length.toString()}
        />
        <SummaryCard
          label="Total kg Fed"
          value={`${totalKg.toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`}
        />
        <SummaryCard
          label="Total Feed Cost"
          value={
            totalCost > 0
              ? `KES ${totalCost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'
          }
        />
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">
          No feeding records for this period.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Pen
                </th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  kg Fed
                </th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Cost (KES)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-xs font-mono text-slate-500">
                    {new Date(r.date + 'T00:00:00').toLocaleDateString('en-KE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{r.pen_name}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {r.total_kg_fed.toLocaleString('en-KE', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {r.total_cost > 0
                      ? r.total_cost.toLocaleString('en-KE', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-xl font-bold font-mono text-slate-900">{value}</p>
    </div>
  );
}
