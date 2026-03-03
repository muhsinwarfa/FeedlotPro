import Link from 'next/link';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center px-4 py-2 rounded-lg bg-emerald-950 text-white text-sm font-medium hover:bg-emerald-800 transition-colors min-h-[44px]"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
