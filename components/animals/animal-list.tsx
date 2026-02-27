'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { weightGain, formatDate } from '@/lib/formatters';

type AnimalRow = {
  id: string;
  tag_id: string;
  breed: string;
  status: string;
  intake_weight: number;
  current_weight: number | null;
  intake_date: string;
  pen_id: string;
  pens: { pen_name: string } | { pen_name: string }[] | null;
};

type StatusFilter = 'ALL' | 'ACTIVE' | 'SICK' | 'DEAD' | 'DISPATCHED';

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  ACTIVE:     { label: 'Active',     badge: 'bg-emerald-100 text-emerald-800' },
  SICK:       { label: 'Sick',       badge: 'bg-amber-100 text-amber-800' },
  DEAD:       { label: 'Dead',       badge: 'bg-slate-200 text-slate-600' },
  DISPATCHED: { label: 'Dispatched', badge: 'bg-blue-100 text-blue-800' },
};

export function AnimalList({ animals }: { animals: AnimalRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  const filterOptions: StatusFilter[] = ['ALL', 'ACTIVE', 'SICK', 'DEAD', 'DISPATCHED'];

  const filtered = filter === 'ALL' ? animals : animals.filter((a) => a.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((f) => {
          const count = f === 'ALL' ? animals.length : animals.filter((a) => a.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors min-h-[36px] ${
                filter === f
                  ? 'bg-emerald-950 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {f === 'ALL' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                filter === f ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-slate-500 font-medium">No animals found</p>
            <p className="text-slate-400 text-sm mt-1">
              {filter === 'ALL' ? 'Add your first animal to get started.' : `No ${STATUS_CONFIG[filter]?.label.toLowerCase() ?? filter} animals.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tag ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Breed</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pen</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Intake (kg)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Current (kg)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Gain (kg)</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Intake Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((animal) => (
                  <tr
                    key={animal.id}
                    onClick={() => router.push(`/inventory/${animal.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                      {animal.tag_id}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{animal.breed}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {Array.isArray(animal.pens) ? animal.pens[0]?.pen_name : (animal.pens as { pen_name: string } | null)?.pen_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_CONFIG[animal.status]?.badge ?? 'bg-slate-100 text-slate-600'
                      }`}>
                        {STATUS_CONFIG[animal.status]?.label ?? animal.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {animal.intake_weight.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {(animal.current_weight ?? animal.intake_weight).toFixed(1)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${
                      (animal.current_weight ?? animal.intake_weight) >= animal.intake_weight
                        ? 'text-emerald-700'
                        : 'text-red-600'
                    }`}>
                      {weightGain(animal)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {formatDate(animal.intake_date)}
                    </td>
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
