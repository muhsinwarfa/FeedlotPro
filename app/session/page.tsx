import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SessionKiosk } from '@/components/session/session-kiosk';
import { WorkerSessionProvider } from '@/contexts/worker-session-context';

export const metadata = {
  title: 'Who\'s Working? — FeedlotPro',
};

export default async function SessionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Get the org and session TTL
  const { data: rawMembership } = await supabase
    .from('tenant_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  const membership = rawMembership as { organization_id: string } | null;
  if (!membership) redirect('/onboarding');

  const orgId = membership.organization_id;

  const [{ data: rawOrg }, { data: rawMembers }] = await Promise.all([
    supabase
      .from('organizations')
      .select('farm_name, session_ttl_hours')
      .eq('id', orgId)
      .single(),
    supabase
      .from('tenant_members')
      .select('id, display_name, role, avatar_color, pin_hash, pin_attempts, status')
      .eq('organization_id', orgId)
      .neq('status', 'REMOVED')
      .order('display_name'),
  ]);

  type OrgRow = { farm_name: string; session_ttl_hours: number };
  type MemberRow = {
    id: string;
    display_name: string;
    role: string;
    avatar_color: string;
    pin_hash: string | null;
    pin_attempts: number;
    status: string;
  };

  const org = rawOrg as OrgRow | null;
  const members = (rawMembers ?? []) as MemberRow[];
  const ttlHours = org?.session_ttl_hours ?? 12;

  return (
    // WorkerSessionProvider wraps this page so SessionKiosk can call setSession()
    <WorkerSessionProvider>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-emerald-950 px-6 py-5 shadow-md">
          <div className="mx-auto max-w-lg text-center">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
              FeedlotPro Kenya
            </p>
            <p className="mt-0.5 text-white font-bold text-lg">{org?.farm_name ?? 'Farm'}</p>
          </div>
        </header>

        <main className="mx-auto max-w-lg px-4 py-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SessionKiosk
              members={members as Parameters<typeof SessionKiosk>[0]['members']}
              organizationId={orgId}
              sessionTtlHours={ttlHours}
            />
          </div>
        </main>
      </div>
    </WorkerSessionProvider>
  );
}
