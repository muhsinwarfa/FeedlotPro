import { Button } from '@/components/ui/button';
import type { IngredientInput } from './ingredient-form';
import { formatDateTime } from '@/lib/formatters';

type Pen = {
  id: string;
  pen_name: string;
};

interface FeedingSummaryProps {
  pen: Pen;
  inputs: IngredientInput[];
  totalKg: number;
  timestamp: Date;
  onConfirm: () => void;
  onEdit: () => void;
  isPending: boolean;
}

export function FeedingSummary({
  pen,
  inputs,
  totalKg,
  timestamp,
  onConfirm,
  onEdit,
  isPending,
}: FeedingSummaryProps) {
  const usedInputs = inputs.filter((i) => i.kgAmount != null && i.kgAmount > 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Review Feeding Record</h2>
        <p className="text-sm text-slate-500 mt-0.5">Confirm the details below before saving.</p>
      </div>

      {/* Summary card — receipt style */}
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pen</p>
            <p className="mt-0.5 font-semibold text-slate-900">{pen.pen_name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date / Time</p>
            <p className="mt-0.5 text-sm text-slate-700">{formatDateTime(timestamp)}</p>
          </div>
        </div>

        {/* Ingredient breakdown */}
        <div className="border-t border-slate-200 pt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left pb-2 text-xs font-semibold uppercase tracking-wider">Ingredient</th>
                <th className="text-right pb-2 text-xs font-semibold uppercase tracking-wider">Amount (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usedInputs.map((input) => (
                <tr key={input.ingredientId}>
                  <td className="py-2 text-slate-700">{input.ingredientName}</td>
                  <td className="py-2 text-right font-mono text-slate-900">{(input.kgAmount!).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="border-t border-slate-300 pt-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Total Feed</span>
          <span className="text-2xl font-bold font-mono text-emerald-700">{totalKg.toFixed(1)} kg</span>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onEdit}
          disabled={isPending}
          className="min-h-[44px] border-slate-300 text-slate-600"
        >
          ← Edit
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isPending}
          className="flex-1 min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
        >
          {isPending ? 'Saving Record…' : 'Confirm & Save'}
        </Button>
      </div>
    </div>
  );
}
