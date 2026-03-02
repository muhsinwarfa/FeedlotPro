// ─── Dispatch Ready List — P7 Performance Intelligence ────────────────────────
// Server-rendered list of animals where dispatch_ready = true.
// Each row links to the animal's detail page.

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

interface DispatchAnimal {
  id: string;
  tag_id: string;
  breed: string;
  pen_name: string;
  current_weight: number | null;
  target_weight: number | null;
  current_adg: number | null;
  dispatch_ready_date: string | null;
}

interface Props {
  animals: DispatchAnimal[];
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function DispatchReadyList({ animals }: Props) {
  if (animals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
        <TrendingUp className="mx-auto h-8 w-8 text-slate-300 mb-2" />
        <p className="text-slate-500 font-medium">No animals at target weight yet</p>
        <p className="text-sm text-slate-400">Animals meeting the dispatch weight will appear here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-emerald-50">
            <TableHead>Tag ID</TableHead>
            <TableHead>Breed</TableHead>
            <TableHead>Pen</TableHead>
            <TableHead>Current (kg)</TableHead>
            <TableHead>Target (kg)</TableHead>
            <TableHead>ADG (kg/d)</TableHead>
            <TableHead>Days Ready</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {animals.map((a) => {
            const daysReady = daysSince(a.dispatch_ready_date);
            return (
              <TableRow key={a.id} className="hover:bg-emerald-50/40">
                <TableCell>
                  <Link
                    href={`/inventory/${a.id}`}
                    className="font-mono text-emerald-700 hover:underline font-semibold"
                  >
                    {a.tag_id}
                  </Link>
                </TableCell>
                <TableCell>{a.breed}</TableCell>
                <TableCell>{a.pen_name}</TableCell>
                <TableCell className="font-mono">{a.current_weight?.toFixed(1) ?? '—'}</TableCell>
                <TableCell className="font-mono">{a.target_weight?.toFixed(1) ?? '—'}</TableCell>
                <TableCell className="font-mono text-emerald-700">
                  {a.current_adg != null ? `+${a.current_adg.toFixed(3)}` : '—'}
                </TableCell>
                <TableCell>
                  {daysReady !== null ? (
                    <Badge
                      variant="outline"
                      className={
                        daysReady >= 3
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      }
                    >
                      {daysReady}d
                    </Badge>
                  ) : '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
