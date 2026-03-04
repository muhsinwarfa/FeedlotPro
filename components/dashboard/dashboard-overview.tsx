'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

type Props = {
  activeAnimals: number;
  sickAnimals: number;
  totalPens: number;
  fedToday: number;
  avgAdg: number | null;
  farmName: string;
};

export function DashboardOverview({ activeAnimals, sickAnimals, totalPens, fedToday, avgAdg, farmName }: Props) {
  const stats = [
    {
      label: 'Active Animals',
      value: String(activeAnimals),
      icon: (
        <svg className="w-6 h-6 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      bg: 'bg-emerald-50',
      accent: 'border-l-4 border-l-emerald-500',
      href: '/inventory',
      badge: null as string | null,
    },
    {
      label: 'Sick Animals',
      value: String(sickAnimals),
      icon: (
        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      bg: sickAnimals > 0 ? 'bg-red-50' : 'bg-slate-50',
      accent: sickAnimals > 0 ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-slate-200',
      href: '/health',
      badge: sickAnimals > 0 ? 'Needs attention' : null,
    },
    {
      label: 'Active Pens',
      value: String(totalPens),
      icon: (
        <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      bg: 'bg-amber-50',
      accent: 'border-l-4 border-l-amber-400',
      href: '/settings',
      badge: null,
    },
    {
      label: 'Fed Today',
      value: String(fedToday),
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      bg: 'bg-blue-50',
      accent: 'border-l-4 border-l-blue-400',
      href: '/feeding/history',
      badge: null,
    },
    {
      label: 'Avg ADG',
      value: avgAdg != null ? `+${avgAdg.toFixed(3)} kg/d` : 'N/A',
      icon: (
        <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      bg: 'bg-violet-50',
      accent: 'border-l-4 border-l-violet-400',
      href: '/performance',
      badge: null,
    },
  ];

  const quickActions = [
    {
      href: '/inventory/intake',
      label: 'Add Animal',
      description: 'Register a new animal into inventory',
      iconBg: 'bg-amber-500',
      hoverBorder: 'hover:border-amber-300',
      hoverText: 'group-hover:text-amber-700',
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      href: '/feeding',
      label: 'Record Feeding',
      description: 'Log daily feed for a pen',
      iconBg: 'bg-emerald-950',
      hoverBorder: 'hover:border-emerald-300',
      hoverText: 'group-hover:text-emerald-700',
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      href: '/inventory',
      label: 'Record Weight',
      description: 'Log weight for an animal',
      iconBg: 'bg-violet-600',
      hoverBorder: 'hover:border-violet-300',
      hoverText: 'group-hover:text-violet-700',
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
      ),
    },
    {
      href: '/health',
      label: 'View Health',
      description: 'Monitor sick animals and treatments',
      iconBg: 'bg-red-500',
      hoverBorder: 'hover:border-red-200',
      hoverText: 'group-hover:text-red-600',
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Health alert banner */}
      {sickAnimals > 0 && (
        <Link
          href="/health"
          className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm font-medium text-amber-800">
            {sickAnimals} animal{sickAnimals !== 1 ? 's' : ''} need{sickAnimals === 1 ? 's' : ''} attention — view Health page
          </p>
        </Link>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`group block rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow overflow-hidden ${stat.accent}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500 group-hover:text-slate-700 transition-colors">
                {stat.label}
              </p>
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                {stat.icon}
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 font-mono">
              {stat.value}
            </p>
            {stat.badge && (
              <span className="mt-1 inline-block text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                {stat.badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className={`flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md ${action.hoverBorder} transition-all group`}
            >
              <div className={`w-10 h-10 rounded-lg ${action.iconBg} flex items-center justify-center flex-shrink-0`}>
                {action.icon}
              </div>
              <div>
                <p className={`font-semibold text-slate-900 ${action.hoverText} transition-colors`}>{action.label}</p>
                <p className="text-xs text-slate-500">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-slate-400 text-right">Last updated: just now</p>
    </div>
  );
}
