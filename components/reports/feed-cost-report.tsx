'use client';

export type FeedCostIngredientRow = {
  ingredient_id: string;
  ingredient_name: string;
  kg_consumed: number;
  total_cost: number;
};

export type DailyCostRow = {
  date: string; // ISO date string YYYY-MM-DD
  total_cost: number;
  total_kg: number;
};

interface FeedCostReportProps {
  ingredientRows: FeedCostIngredientRow[];
  dailyRows: DailyCostRow[];
}

export function FeedCostReport({ ingredientRows, dailyRows }: FeedCostReportProps) {
  const totalSpend = ingredientRows.reduce((s, r) => s + r.total_cost, 0);
  const totalKg = ingredientRows.reduce((s, r) => s + r.kg_consumed, 0);
  const avgCostPerKg = totalKg > 0 ? totalSpend / totalKg : null;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SummaryCard label="Total Spend" value={totalSpend > 0 ? `KES ${totalSpend.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'} />
        <SummaryCard label="Total Kg Fed" value={totalKg > 0 ? `${totalKg.toLocaleString()} kg` : '—'} />
        <SummaryCard label="Avg Cost / kg" value={avgCostPerKg != null ? `KES ${avgCostPerKg.toFixed(2)}` : '—'} />
      </div>

      {/* Ingredient breakdown */}
      {ingredientRows.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No feed cost data for this period.</p>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Ingredient Breakdown</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ingredient</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kg Consumed</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Cost (KES)</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ingredientRows
                  .slice()
                  .sort((a, b) => b.total_cost - a.total_cost)
                  .map((row) => {
                    const pct = totalSpend > 0 ? (row.total_cost / totalSpend) * 100 : 0;
                    return (
                      <tr key={row.ingredient_id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-slate-800 font-medium">{row.ingredient_name}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-700">{row.kg_consumed.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                          {row.total_cost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-500">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td className="px-3 py-2.5 font-semibold text-slate-700">Total</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-700">{totalKg.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-700">
                    {totalSpend.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-500">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Daily cost list */}
      {dailyRows.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Daily Cost</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kg Fed</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Cost (KES)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dailyRows.map((row) => (
                  <tr key={row.date} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-slate-700 font-mono text-xs">{row.date}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{row.total_kg.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                      {row.total_cost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-xl font-bold font-mono text-slate-900">{value}</p>
    </div>
  );
}
