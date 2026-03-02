'use client';

export type MortalityRow = {
  id: string;
  animal_tag: string;
  notes: string | null;
  created_at: string;
};

interface MortalityReportProps {
  rows: MortalityRow[];
}

export function MortalityReport({ rows }: MortalityReportProps) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Mortalities"
          value={rows.length.toString()}
          danger={rows.length > 0}
        />
        <SummaryCard
          label="Status"
          value={rows.length === 0 ? 'None recorded' : 'Review required'}
          danger={rows.length > 0}
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-sm font-medium text-emerald-700">
            No mortalities recorded in this period.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-red-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-red-50 border-b border-red-100">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-red-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-red-700 uppercase tracking-wider">
                  Tag ID
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-red-700 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-50">
              {[...rows]
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
                .map((r) => (
                  <tr key={r.id} className="hover:bg-red-50/50">
                    <td className="px-3 py-2.5 text-xs font-mono text-slate-500">
                      {new Date(r.created_at).toLocaleDateString('en-KE', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-red-700">
                      {r.animal_tag}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 max-w-xs">
                      {r.notes ?? '—'}
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

function SummaryCard({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        danger ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p
        className={`mt-1 text-xl font-bold font-mono ${
          danger ? 'text-red-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
