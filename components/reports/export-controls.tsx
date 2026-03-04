'use client';

import { useState, useEffect, useRef } from 'react';
import { FileDown, ChevronDown } from 'lucide-react';

interface ExportControlsProps {
  reportTitle: string;
  dateRange: string;
  exportData: {
    sheetName: string;
    rows: Record<string, string | number | null>[];
  }[];
}

export function ExportControls({ reportTitle, dateRange, exportData }: ExportControlsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  async function handleExcelExport() {
    setShowDropdown(false);
    setIsExporting(true);
    try {
      const xlsxModule = await import('xlsx');
      const XLSX = xlsxModule.default ?? xlsxModule;
      const wb = XLSX.utils.book_new();
      for (const sheet of exportData) {
        if (sheet.rows.length === 0) continue;
        const ws = XLSX.utils.json_to_sheet(sheet.rows);
        XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName.slice(0, 31));
      }
      if (wb.SheetNames.length === 0) {
        console.warn('Excel export: no data in selected date range');
        return;
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
    setShowDropdown(false);
    window.print();
  }

  return (
    <div className="relative print:hidden" ref={ref}>
      <button
        onClick={() => setShowDropdown((v) => !v)}
        disabled={isExporting}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-colors min-h-[40px] disabled:opacity-60"
      >
        <FileDown className="h-4 w-4" />
        {isExporting ? 'Exporting…' : 'Export'}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
          <button
            onClick={handleExcelExport}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 min-h-[44px]"
          >
            Export Excel
          </button>
          <button
            onClick={handlePrint}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 min-h-[44px] border-t border-slate-100"
          >
            Print / PDF
          </button>
        </div>
      )}
    </div>
  );
}
