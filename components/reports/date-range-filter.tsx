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

export function DateRangeFilter({ from, to }: DateRangeFilterProps) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);

  function handleApply() {
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    router.push(`/reports?${params.toString()}`);
  }

  return (
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
  );
}
