'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DateRangeFilterProps {
  from: string;
  to: string;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function DateRangeFilter({ from, to }: DateRangeFilterProps) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);

  function applyRange(f: string, t: string) {
    const params = new URLSearchParams({ from: f, to: t });
    router.push(`/reports?${params.toString()}`);
  }

  function handleApply() {
    applyRange(fromDate, toDate);
  }

  function applyPreset(preset: 'last7' | 'last30' | 'thisMonth') {
    const today = new Date();
    let f: Date;
    let t: Date = today;
    if (preset === 'last7') {
      f = new Date(today);
      f.setDate(today.getDate() - 6);
    } else if (preset === 'last30') {
      f = new Date(today);
      f.setDate(today.getDate() - 29);
    } else {
      f = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    const fStr = toDateStr(f);
    const tStr = toDateStr(t);
    setFromDate(fStr);
    setToDate(tStr);
    applyRange(fStr, tStr);
  }

  const presets = [
    { label: 'Last 7 Days', value: 'last7' as const },
    { label: 'Last 30 Days', value: 'last30' as const },
    { label: 'This Month', value: 'thisMonth' as const },
  ];

  return (
    <div className="space-y-3">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => applyPreset(p.value)}
            className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">From</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="min-h-[40px] text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">To</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="min-h-[40px] text-sm"
          />
        </div>
        <Button
          onClick={handleApply}
          className="min-h-[40px] bg-emerald-950 hover:bg-emerald-800 text-white text-sm"
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
