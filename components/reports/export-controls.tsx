'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ExportControlsProps {
  reportTitle: string;
  dateRange: string;
  // Data passed as JSON-serialisable rows for XLSX export
  exportData: {
    sheetName: string;
    rows: Record<string, string | number | null>[];
  }[];
}

export function ExportControls({ reportTitle, dateRange, exportData }: ExportControlsProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExcelExport() {
    setIsExporting(true);
    try {
      // Dynamic import keeps xlsx out of the SSR bundle
      const XLSX = (await import('xlsx')).default;
      const wb = XLSX.utils.book_new();

      for (const sheet of exportData) {
        if (sheet.rows.length === 0) continue;
        const ws = XLSX.utils.json_to_sheet(sheet.rows);
        XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName.slice(0, 31)); // Excel max 31 chars
      }

      const fileName = `${reportTitle.replace(/\s+/g, '-')}-${dateRange}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Excel export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex gap-2 print:hidden">
      <Button
        variant="outline"
        onClick={handlePrint}
        className="min-h-[40px] text-sm border-slate-300 text-slate-700 hover:bg-slate-50"
      >
        Print / PDF
      </Button>
      <Button
        onClick={handleExcelExport}
        disabled={isExporting}
        className="min-h-[40px] text-sm bg-emerald-950 hover:bg-emerald-800 text-white"
      >
        {isExporting ? 'Exporting…' : 'Export Excel'}
      </Button>
    </div>
  );
}
