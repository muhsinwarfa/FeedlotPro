import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TeamManager } from '@/components/team/team-manager';

export const metadata = {
  title: 'Team — FeedlotPro',
};

export default async function TeamPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: rawMembership } = await supabase
    .from('tenant_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single();

  type Membership = { organization_id: string; role: string };
  const membership = rawMembership as Membership | null;

  if (!membership) redirect('/onboarding');

  // RBAC: only OWNER can access team management
  if (membership.role !== 'OWNER') redirect('/');

  const orgId = membership.organization_id;

  const { data: rawMembers } = await supabase
    .from('tenant_members')
    .select('id, display_name, role, avatar_color, pin_attempts, status')
    .eq('organization_id', orgId)
    .neq('status', 'REMOVED' as never)
    .order('display_name');

  type MemberRow = {
    id: string;
    display_name: string;
    role: string;
    avatar_color: string;
    pin_attempts: number;
    status: string;
  };

  const members = (rawMembers ?? []) as MemberRow[];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-emerald-950 px-6 py-5 shadow-md">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-medium text-emerald-300 uppercase tracking-widest">Settings</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Team Management</h1>
          <p className="mt-0.5 text-sm text-emerald-200">
            Manage your farm workers, roles, and access PINs.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <TeamManager
            members={members as Parameters<typeof TeamManager>[0]['members']}
            organizationId={orgId}
            currentUserId={user.id}
          />
        </div>
      </div>
    </div>
  );
}
