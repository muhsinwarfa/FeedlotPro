import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';

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

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) redirect('/onboarding');

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      {/* Main content — add top padding on mobile for the fixed header */}
      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
