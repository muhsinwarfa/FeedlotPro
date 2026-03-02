'use client';

import { useState } from 'react';

export type AnimalPerformanceRow = {
  tag_id: string;
  breed: string;
  pen_name: string;
  batch_code: string | null;
  days_on_feed: number;
  intake_weight: number;
  current_weight: number | null;
  current_adg: number | null;
  dispatch_ready: boolean;
};

interface PerformanceReportProps {
  animals: AnimalPerformanceRow[];
  targetWeight: number | null;
}

type SortKey = keyof AnimalPerformanceRow;

export function PerformanceReport({ animals, targetWeight }: PerformanceReportProps) {
  const [sortKey, setSortKey] = useState<SortKey>('current_adg');
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sorted = [...animals].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const avgAdg =
    animals.filter((a) => a.current_adg != null).length > 0
      ? animals.reduce((s, a) => s + (a.current_adg ?? 0), 0) /
        animals.filter((a) => a.current_adg != null).length
      : null;

  const readyCount = animals.filter((a) => a.dispatch_ready).length;

  function SortHeader({ label, field }: { label: string; field: SortKey }) {
    const active = sortKey === field;
    return (
      <th
        onClick={() => toggleSort(field)}
        className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 select-none text-right whitespace-nowrap"
      >
        {label} {active ? (sortAsc ? '↑' : '↓') : ''}
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total Animals" value={animals.length.toString()} />
        <SummaryCard
          label="Avg ADG"
          value={avgAdg != null ? `${avgAdg.toFixed(3)} kg/day` : '—'}
        />
        <SummaryCard label="Dispatch Ready" value={readyCount.toString()} highlight={readyCount > 0} />
        {targetWeight != null && (
          <SummaryCard label="Target Weight" value={`${targetWeight} kg`} />
        )}
      </div>

      {/* Table */}
      {animals.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No animal data for this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tag ID</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Breed</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pen</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Batch</th>
                <SortHeader label="Days" field="days_on_feed" />
                <SortHeader label="Intake (kg)" field="intake_weight" />
                <SortHeader label="Current (kg)" field="current_weight" />
                <SortHeader label="ADG" field="current_adg" />
                <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Ready</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((a) => (
                <tr key={a.tag_id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-900 font-mono">{a.tag_id}</td>
                  <td className="px-3 py-2.5 text-slate-600">{a.breed}</td>
                  <td className="px-3 py-2.5 text-slate-600">{a.pen_name}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{a.batch_code ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">{a.days_on_feed}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">{a.intake_weight.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {a.current_weight?.toFixed(1) ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold">
                    <span className={
                      a.current_adg == null ? 'text-slate-400' :
                      a.current_adg >= 1.0 ? 'text-emerald-700' :
                      a.current_adg >= 0.5 ? 'text-amber-600' : 'text-red-600'
                    }>
                      {a.current_adg?.toFixed(3) ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {a.dispatch_ready ? (
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" title="Dispatch ready" />
                    ) : (
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-200" />
                    )}
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
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-xl font-bold font-mono ${highlight ? 'text-emerald-700' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}
