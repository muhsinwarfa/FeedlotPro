'use client';

export type BatchReportRow = {
  batch_id: string;
  batch_code: string;
  arrival_date: string | null;
  supplier: string | null;
  total_head: number;
  active_count: number;
  sick_count: number;
  dead_count: number;
  dispatched_count: number;
  avg_adg: number | null;
};

interface BatchReportProps {
  batches: BatchReportRow[];
}

export function BatchReport({ batches }: BatchReportProps) {
  const totalHead = batches.reduce((s, b) => s + b.total_head, 0);
  const totalActive = batches.reduce((s, b) => s + b.active_count, 0);
  const totalDead = batches.reduce((s, b) => s + b.dead_count, 0);
  const totalDispatched = batches.reduce((s, b) => s + b.dispatched_count, 0);

  const adgBatches = batches.filter((b) => b.avg_adg != null);
  const overallAvgAdg =
    adgBatches.length > 0
      ? adgBatches.reduce((s, b) => s + (b.avg_adg ?? 0), 0) / adgBatches.length
      : null;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total Head" value={totalHead.toString()} />
        <SummaryCard label="Active" value={totalActive.toString()} highlight={totalActive > 0} />
        <SummaryCard label="Dead" value={totalDead.toString()} danger={totalDead > 0} />
        <SummaryCard
          label="Avg ADG"
          value={overallAvgAdg != null ? `${overallAvgAdg.toFixed(3)} kg/day` : '—'}
        />
      </div>

      {/* Batch table */}
      {batches.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No batch data for this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Batch Code</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Arrival</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Head</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Active</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sick</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dead</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dispatched</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg ADG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {batches.map((b) => (
                <tr key={b.batch_id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium font-mono text-slate-900">{b.batch_code}</td>
                  <td className="px-3 py-2.5 text-slate-600 text-xs font-mono">{b.arrival_date ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600 text-xs">{b.supplier ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">{b.total_head}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-700 font-semibold">{b.active_count}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-600">{b.sick_count}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${b.dead_count > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {b.dead_count}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-500">{b.dispatched_count}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold">
                    <span className={
                      b.avg_adg == null ? 'text-slate-400' :
                      b.avg_adg >= 1.0 ? 'text-emerald-700' :
                      b.avg_adg >= 0.5 ? 'text-amber-600' : 'text-red-600'
                    }>
                      {b.avg_adg?.toFixed(3) ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={3} className="px-3 py-2.5 font-semibold text-slate-700">Total</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-700">{totalHead}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-700">{totalActive}</td>
                <td className="px-3 py-2.5 text-right font-mono text-amber-600">
                  {batches.reduce((s, b) => s + b.sick_count, 0)}
                </td>
                <td className={`px-3 py-2.5 text-right font-mono font-semibold ${totalDead > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  {totalDead}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-500">{totalDispatched}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold">
                  <span className={
                    overallAvgAdg == null ? 'text-slate-400' :
                    overallAvgAdg >= 1.0 ? 'text-emerald-700' :
                    overallAvgAdg >= 0.5 ? 'text-amber-600' : 'text-red-600'
                  }>
                    {overallAvgAdg?.toFixed(3) ?? '—'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight = false,
  danger = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        danger
          ? 'border-red-200 bg-red-50'
          : highlight
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p
        className={`mt-1 text-xl font-bold font-mono ${
          danger ? 'text-red-700' : highlight ? 'text-emerald-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
