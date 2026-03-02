'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkerSession } from '@/contexts/worker-session-context';
import { checkPermission, ACTION } from '@/lib/rbac';
import type { WorkerRole } from '@/lib/worker-session';

// ─── Icons (inline SVG to avoid lucide tree-shaking issues) ────────────────────

function IconDashboard() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconInventory() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 12h.01M7 17h.01M11 7h6M11 12h6M11 17h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  );
}

function IconFeeding() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function IconHealth() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function IconPerformance() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function IconReports() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────────

interface SidebarProps {
  /** Role from the Supabase owner membership — used as fallback before worker context hydrates */
  ownerRole?: WorkerRole;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function Sidebar({ ownerRole }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const supabase = createClient();
  const { activeSession, clearSession } = useWorkerSession();

  // Resolve the effective role: active worker session > Supabase owner membership
  const effectiveRole: WorkerRole = activeSession?.role ?? ownerRole ?? 'OWNER';

  async function handleSignOut() {
    clearSession();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function handleSwitchWorker() {
    clearSession();
    router.push('/session');
  }

  function isActive(href: string, matchPrefix?: string) {
    if (matchPrefix) return pathname.startsWith(matchPrefix);
    return pathname === href;
  }

  // ── Role-gated nav items ──────────────────────────────────────────────────
  const allNavItems = [
    { href: '/', label: 'Dashboard', icon: IconDashboard, alwaysShow: true },
    { href: '/inventory', label: 'Inventory', icon: IconInventory, matchPrefix: '/inventory', alwaysShow: true },
    { href: '/feeding', label: 'Feeding', icon: IconFeeding, matchPrefix: '/feeding', alwaysShow: true },
    { href: '/health', label: 'Health', icon: IconHealth, matchPrefix: '/health', alwaysShow: true }, // Block 2
    {
      href: '/performance',
      label: 'Performance',
      icon: IconPerformance,
      matchPrefix: '/performance',
      requiredAction: ACTION.VIEW_PERFORMANCE,
    },
    {
      href: '/reports',
      label: 'Reports',
      icon: IconReports,
      matchPrefix: '/reports',
      requiredAction: ACTION.MANAGE_REPORTS,
    },
    {
      href: '/settings',
      label: 'Settings',
      icon: IconSettings,
      matchPrefix: '/settings',
      requiredAction: ACTION.MANAGE_SETTINGS,
    },
    {
      href: '/team',
      label: 'Team',
      icon: IconTeam,
      matchPrefix: '/team',
      requiredAction: ACTION.MANAGE_TEAM,
    },
  ];

  const visibleNavItems = allNavItems.filter((item) => {
    if (item.alwaysShow) return true;
    if (!item.requiredAction) return true;
    return checkPermission(effectiveRole, item.requiredAction);
  });

  // ── Worker display ────────────────────────────────────────────────────────
  const workerName = activeSession?.displayName ?? 'Owner';
  const workerColor = activeSession?.avatarColor ?? '#064E3B';
  const workerInitials = workerName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const NavContent = () => (
    <nav className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-emerald-800">
        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">FeedlotPro</p>
        <p className="text-white font-bold text-lg leading-tight mt-0.5">Kenya</p>
      </div>

      {/* Nav links */}
      <div className="flex-1 px-3 py-4 space-y-1">
        {visibleNavItems.map((item) => {
          const active = isActive(item.href, item.matchPrefix);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                active
                  ? 'bg-white text-emerald-950'
                  : 'text-emerald-100 hover:bg-emerald-800 hover:text-white'
              }`}
            >
              <item.icon />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Worker identity + actions */}
      <div className="px-3 pb-3 border-t border-emerald-800 pt-3 space-y-1">
        {/* Current worker chip */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: workerColor }}
          >
            {workerInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{workerName}</p>
            <p className="text-xs text-emerald-400">{effectiveRole}</p>
          </div>
        </div>

        {/* Switch worker button */}
        <button
          onClick={handleSwitchWorker}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-medium text-emerald-300 hover:bg-emerald-800 hover:text-white transition-colors min-h-[44px]"
        >
          Switch Worker
        </button>

        {/* Sign out (full Supabase auth signout) */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-300 hover:bg-emerald-800 hover:text-white transition-colors min-h-[44px]"
        >
          <IconLogout />
          Sign Out
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 flex-shrink-0 bg-emerald-950 min-h-screen">
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-emerald-950 flex items-center justify-between px-4 py-3 shadow-md">
        <p className="text-white font-bold">FeedlotPro Kenya</p>
        <button
          onClick={() => setMobileOpen((prev) => !prev)}
          className="text-white p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <IconClose /> : <IconMenu />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-emerald-950 flex flex-col pt-14">
            <NavContent />
          </aside>
        </div>
      )}
    </>
  );
}
