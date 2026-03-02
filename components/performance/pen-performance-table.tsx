'use client';

// ─── Pen Performance Table — P7 Performance Intelligence ─────────────────────
// Sortable table of pen-level ADG and FCR metrics.
// FCR color coding: ≤6 green, 6–8 amber, >8 red.

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface PenRow {
  id: string;
  pen_name: string;
  active_animal_count: number;
  avg_adg: number | null;
  current_fcr: number | null;
}

interface BatchRow {
  batch_code: string;
  animal_count: number;
  source_supplier: string | null;
  avg_adg: number | null;
  avg_days_on_feed: number | null;
}

interface Props {
  pens: PenRow[];
  batches: BatchRow[];
}

type SortKey = 'pen_name' | 'active_animal_count' | 'avg_adg' | 'current_fcr';
type SortDir = 'asc' | 'desc';

function fcrColor(fcr: number | null): string {
  if (fcr === null) return 'text-slate-400';
  if (fcr <= 6) return 'text-emerald-600 font-semibold';
  if (fcr <= 8) return 'text-amber-600 font-semibold';
  return 'text-red-600 font-semibold';
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 text-slate-400 inline ml-1" />;
  return dir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-emerald-700 inline ml-1" />
    : <ChevronDown className="h-3 w-3 text-emerald-700 inline ml-1" />;
}

export function PenPerformanceTable({ pens, batches }: Props) {
  const [tab, setTab] = useState<'pens' | 'batches'>('pens');
  const [sortKey, setSortKey] = useState<SortKey>('pen_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sortedPens = [...pens].sort((a, b) => {
    const aVal = a[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity);
    const bVal = b[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity);
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  function ColHeader({ label, sortable, sk }: { label: string; sortable?: SortKey; sk?: SortKey }) {
    const active = sortable === sortKey;
    return (
      <TableHead
        className={sortable ? 'cursor-pointer select-none hover:text-emerald-700' : ''}
        onClick={sortable ? () => handleSort(sortable) : undefined}
      >
        {label}
        {sortable && <SortIcon active={active} dir={sortDir} />}
      </TableHead>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-slate-200">
        {(['pens', 'batches'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-emerald-600 text-emerald-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Pens tab */}
      {tab === 'pens' && (
        <Table>
          <TableHeader>
            <TableRow>
              <ColHeader label="Pen" sortable="pen_name" />
              <ColHeader label="Animals" sortable="active_animal_count" />
              <ColHeader label="Avg ADG (kg/d)" sortable="avg_adg" />
              <ColHeader label="FCR (30d)" sortable="current_fcr" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-400 py-8">
                  No pens with data yet.
                </TableCell>
              </TableRow>
            ) : (
              sortedPens.map((pen) => (
                <TableRow key={pen.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{pen.pen_name}</TableCell>
                  <TableCell>{pen.active_animal_count}</TableCell>
                  <TableCell className="font-mono">
                    {pen.avg_adg != null ? pen.avg_adg.toFixed(3) : <span className="text-slate-400">—</span>}
                  </TableCell>
                  <TableCell className={`font-mono ${fcrColor(pen.current_fcr)}`}>
                    {pen.current_fcr != null ? pen.current_fcr.toFixed(2) : <span className="text-slate-400">—</span>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Batches tab */}
      {tab === 'batches' && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch Code</TableHead>
              <TableHead>Animals</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Avg ADG (kg/d)</TableHead>
              <TableHead>Avg Days on Feed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                  No batches with data yet.
                </TableCell>
              </TableRow>
            ) : (
              batches.map((b) => (
                <TableRow key={b.batch_code} className="hover:bg-slate-50">
                  <TableCell className="font-mono font-medium">{b.batch_code}</TableCell>
                  <TableCell>{b.animal_count}</TableCell>
                  <TableCell>{b.source_supplier ?? <span className="text-slate-400">—</span>}</TableCell>
                  <TableCell className="font-mono">
                    {b.avg_adg != null ? b.avg_adg.toFixed(3) : <span className="text-slate-400">—</span>}
                  </TableCell>
                  <TableCell className="font-mono">
                    {b.avg_days_on_feed != null ? Math.round(b.avg_days_on_feed) : <span className="text-slate-400">—</span>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
