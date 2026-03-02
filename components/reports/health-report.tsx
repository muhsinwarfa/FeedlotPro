'use client';

export type HealthEventRow = {
  id: string;
  animal_tag: string;
  event_type: string;
  notes: string | null;
  created_at: string;
};

export type TreatmentCostRow = {
  animal_tag: string;
  treatment_cost: number | null;
  treated_at: string;
  medication_name: string | null;
};

interface HealthReportProps {
  events: HealthEventRow[];
  treatments: TreatmentCostRow[];
}

export function HealthReport({ events, treatments }: HealthReportProps) {
  const flaggedCount = events.filter((e) => e.event_type === 'FLAGGED_SICK').length;
  const recoveredCount = events.filter((e) => e.event_type === 'RECOVERED').length;
  const mortalityCount = events.filter((e) => e.event_type === 'MORTALITY').length;
  const totalTreatmentCost = treatments.reduce((s, t) => s + (t.treatment_cost ?? 0), 0);

  // Sort events newest-first
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  function eventBadge(type: string) {
    switch (type) {
      case 'FLAGGED_SICK':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Sick
          </span>
        );
      case 'TREATMENT_ADMINISTERED':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
            Treated
          </span>
        );
      case 'RECOVERED':
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            Recovered
          </span>
        );
      case 'MORTALITY':
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
            Died
          </span>
        );
      case 'DISPATCHED_EARLY':
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            Dispatched Early
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {type}
          </span>
        );
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Flagged Sick" value={flaggedCount.toString()} warn={flaggedCount > 0} />
        <SummaryCard label="Recovered" value={recoveredCount.toString()} positive={recoveredCount > 0} />
        <SummaryCard label="Mortalities" value={mortalityCount.toString()} danger={mortalityCount > 0} />
        <SummaryCard
          label="Treatment Cost"
          value={totalTreatmentCost > 0 ? `KES ${totalTreatmentCost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
        />
      </div>

      {/* Event timeline */}
      {sortedEvents.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No health events for this period.</p>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Event Timeline</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tag ID</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Event</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedEvents.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-xs font-mono text-slate-500">
                      {new Date(e.created_at).toLocaleDateString('en-KE', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-medium text-slate-900">{e.animal_tag}</td>
                    <td className="px-3 py-2.5">{eventBadge(e.event_type)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 max-w-xs truncate">{e.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Treatment costs */}
      {treatments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Treatment Records</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tag ID</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Drug</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost (KES)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...treatments]
                  .sort((a, b) => new Date(b.treated_at).getTime() - new Date(a.treated_at).getTime())
                  .map((t, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-xs font-mono text-slate-500">
                        {new Date(t.treated_at).toLocaleDateString('en-KE', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-medium text-slate-900">{t.animal_tag}</td>
                      <td className="px-3 py-2.5 text-slate-600">{t.medication_name ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                        {t.treatment_cost != null
                          ? t.treatment_cost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '—'}
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

function SummaryCard({
  label,
  value,
  positive = false,
  warn = false,
  danger = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
  warn?: boolean;
  danger?: boolean;
}) {
  const borderCls = danger
    ? 'border-red-200 bg-red-50'
    : warn
    ? 'border-amber-200 bg-amber-50'
    : positive
    ? 'border-emerald-200 bg-emerald-50'
    : 'border-slate-200 bg-white';

  const textCls = danger
    ? 'text-red-700'
    : warn
    ? 'text-amber-700'
    : positive
    ? 'text-emerald-700'
    : 'text-slate-900';

  return (
    <div className={`rounded-lg border p-4 ${borderCls}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-xl font-bold font-mono ${textCls}`}>{value}</p>
    </div>
  );
}
