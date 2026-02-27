'use client';

import Link from 'next/link';

type Props = {
  activeAnimals: number;
  totalPens: number;
  fedToday: number;
};

export function DashboardOverview({ activeAnimals, totalPens, fedToday }: Props) {
  const stats = [
    {
      label: 'Active Animals',
      value: activeAnimals,
      icon: (
        <svg className="w-6 h-6 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      bg: 'bg-emerald-50',
      href: '/inventory',
    },
    {
      label: 'Active Pens',
      value: totalPens,
      icon: (
        <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      bg: 'bg-amber-50',
      href: '/settings',
    },
    {
      label: 'Fed Today',
      value: fedToday,
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      bg: 'bg-blue-50',
      href: '/feeding/history',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group block rounded-lg border border-slate-200 bg-white/80 backdrop-blur-sm p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500 group-hover:text-slate-700 transition-colors">
                {stat.label}
              </p>
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                {stat.icon}
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900 font-mono">
              {stat.value}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/inventory/intake"
            className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-amber-300 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 group-hover:text-amber-700 transition-colors">Add Animal</p>
              <p className="text-xs text-slate-500">Register a new animal into inventory</p>
            </div>
          </Link>

          <Link
            href="/feeding"
            className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-950 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">Record Feeding</p>
              <p className="text-xs text-slate-500">Log daily feed for a pen</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
