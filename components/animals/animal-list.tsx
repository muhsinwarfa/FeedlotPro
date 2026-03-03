'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Heart, X, ArrowRight, Plus } from 'lucide-react';
import { weightGain, formatDate } from '@/lib/formatters';
import { EmptyState } from '@/components/ui/empty-state';

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

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  ACTIVE:     {
    label: 'Active',
    badge: 'bg-emerald-100 text-emerald-800',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  SICK:       {
    label: 'Sick',
    badge: 'bg-amber-100 text-amber-800',
    icon: <Heart className="w-3.5 h-3.5" />,
  },
  DEAD:       {
    label: 'Dead',
    badge: 'bg-slate-200 text-slate-600',
    icon: <X className="w-3.5 h-3.5" />,
  },
  DISPATCHED: {
    label: 'Dispatched',
    badge: 'bg-blue-100 text-blue-800',
    icon: <ArrowRight className="w-3.5 h-3.5" />,
  },
};

function getPenName(pens: AnimalRow['pens']): string {
  if (!pens) return '—';
  return Array.isArray(pens) ? (pens[0]?.pen_name ?? '—') : (pens as { pen_name: string }).pen_name ?? '—';
}

export function AnimalList({ animals }: { animals: AnimalRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');

  const filterOptions: StatusFilter[] = ['ALL', 'ACTIVE', 'SICK', 'DEAD', 'DISPATCHED'];

  const filtered = animals
    .filter((a) => filter === 'ALL' || a.status === filter)
    .filter((a) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return a.tag_id.toLowerCase().includes(q) || a.breed.toLowerCase().includes(q);
    });

  return (
    <div className="space-y-4">
      {/* Search + Add Animal header row */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <input
          type="search"
          placeholder="Search by tag ID or breed…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
        />
        <Link
          href="/inventory/intake"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Animal
        </Link>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((f) => {
          const count = f === 'ALL' ? animals.length : animals.filter((a) => a.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px] ${
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

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
          title={search ? 'No matches found' : 'No animals found'}
          description={
            search
              ? `No animals matching "${search}". Try a different tag or breed.`
              : filter === 'ALL'
              ? 'Add your first animal to get started.'
              : `No ${STATUS_CONFIG[filter]?.label.toLowerCase() ?? filter} animals.`
          }
          action={filter === 'ALL' && !search ? { label: '+ Add Animal', href: '/inventory/intake' } : undefined}
        />
      ) : (
        <>
          {/* Mobile card list (below md) */}
          <div className="md:hidden space-y-3">
            {filtered.map((animal) => {
              const cfg = STATUS_CONFIG[animal.status];
              const gain = (animal.current_weight ?? animal.intake_weight) - animal.intake_weight;
              return (
                <button
                  key={animal.id}
                  onClick={() => router.push(`/inventory/${animal.id}`)}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-emerald-200 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono font-bold text-slate-900">{animal.tag_id}</p>
                      <p className="text-sm text-slate-500">{animal.breed} · {getPenName(animal.pens)}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${cfg?.badge ?? 'bg-slate-100 text-slate-600'}`}>
                      {cfg?.icon}
                      {cfg?.label ?? animal.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                    <span>Intake: <span className="font-mono text-slate-700">{animal.intake_weight.toFixed(1)} kg</span></span>
                    <span>Current: <span className="font-mono text-slate-700">{(animal.current_weight ?? animal.intake_weight).toFixed(1)} kg</span></span>
                    <span className={`font-mono font-semibold ${gain >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {gain >= 0 ? '+' : ''}{gain.toFixed(1)} kg
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desktop table (md and above) */}
          <div className="hidden md:block rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
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
                  {filtered.map((animal) => {
                    const cfg = STATUS_CONFIG[animal.status];
                    return (
                      <tr
                        key={animal.id}
                        onClick={() => router.push(`/inventory/${animal.id}`)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900">{animal.tag_id}</td>
                        <td className="px-4 py-3 text-slate-700">{animal.breed}</td>
                        <td className="px-4 py-3 text-slate-600">{getPenName(animal.pens)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.badge ?? 'bg-slate-100 text-slate-600'}`}>
                            {cfg?.icon}
                            {cfg?.label ?? animal.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">{animal.intake_weight.toFixed(1)}</td>
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
                        <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(animal.intake_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
