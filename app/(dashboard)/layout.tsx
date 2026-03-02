import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { WorkerSessionProvider } from '@/contexts/worker-session-context';
import { OfflineProvider } from '@/contexts/offline-context';
import { OfflineBar } from '@/components/layout/offline-bar';
import type { WorkerRole } from '@/lib/worker-session';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: rawMembership } = await supabase
    .from('tenant_members')
    .select('organization_id, role, display_name, avatar_color, status')
    .eq('user_id', user.id)
    .single();

  type MembershipRow = {
    organization_id: string;
    role: WorkerRole;
    display_name: string;
    avatar_color: string;
    status: string;
  };

  const membership = rawMembership as MembershipRow | null;
  if (!membership) redirect('/onboarding');

  // The WorkerSessionProvider handles the /session redirect client-side
  // (after checking localStorage TTL). The layout still renders to allow
  // the context to hydrate. Only the dashboard content is gated.

  return (
    <WorkerSessionProvider>
      <OfflineProvider>
        <div className="flex min-h-screen bg-slate-50">
          <Sidebar ownerRole={membership.role} />
          <div className="flex-1 min-w-0 flex flex-col">
            <OfflineBar />
            {/* Main content — add top padding on mobile for the fixed header */}
            <main className="flex-1 pt-14 lg:pt-0">
              {children}
            </main>
          </div>
        </div>
      </OfflineProvider>
    </WorkerSessionProvider>
  );
}
