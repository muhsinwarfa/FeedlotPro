type Pen = {
  id: string;
  pen_name: string;
  status: string;
  active_animal_count: number;
  capacity: number | null;
};

interface PenSelectorProps {
  pens: Pen[];
  onSelect: (pen: Pen) => void;
}

export function PenSelector({ pens, onSelect }: PenSelectorProps) {
  if (pens.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400">
        <p className="font-medium">No pens found.</p>
        <p className="text-sm mt-1">Add pens in Settings before recording a feeding.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {pens.map((pen) => {
        const inactive = pen.status !== 'active';
        const empty = pen.active_animal_count === 0;

        return (
          <button
            key={pen.id}
            onClick={() => onSelect(pen)}
            className={`text-left rounded-lg border p-4 transition-all min-h-[80px] ${
              inactive || empty
                ? 'border-slate-200 bg-slate-50 cursor-pointer opacity-60'
                : 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md cursor-pointer'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-slate-900 text-sm">{pen.pen_name}</span>
              {inactive && (
                <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full flex-shrink-0">Inactive</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className={`text-xs font-mono font-semibold ${empty ? 'text-slate-400' : 'text-emerald-700'}`}>
                {pen.active_animal_count} animals
              </span>
              {pen.capacity != null && (
                <span className="text-xs text-slate-400">/ {pen.capacity} cap</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
