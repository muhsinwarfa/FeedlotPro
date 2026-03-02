'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { createClient } from '@/lib/supabase/client';
import { validatePin } from '@/lib/validators';
import { mapDbError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AddWorkerForm } from '@/components/team/add-worker-form';
import type { TenantMemberV2 } from '@/types/database';

// ── Types ─────────────────────────────────────────────────────────────────────

type Member = Pick<
  TenantMemberV2,
  'id' | 'display_name' | 'role' | 'avatar_color' | 'pin_attempts' | 'status'
>;

interface TeamManagerProps {
  members: Member[];
  organizationId: string;
  currentUserId: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  FARMHAND: 'Farmhand',
  VET: 'Vet',
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  LOCKED: 'bg-red-100 text-red-800',
  REMOVED: 'bg-slate-100 text-slate-500',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function TeamManager({ members: initialMembers, organizationId, currentUserId }: TeamManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [members, setMembers] = useState(initialMembers);
  const [showAddForm, setShowAddForm] = useState(false);

  // Dialog state
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [resetPinMember, setResetPinMember] = useState<Member | null>(null);
  const [removingMember, setRemovingMember] = useState<Member | null>(null);

  // Edit role state
  const [newRole, setNewRole] = useState('');

  // Reset PIN state
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinError, setPinError] = useState('');

  const supabase = createClient();

  function refreshMembers() {
    router.refresh();
  }

  // P11: Activity log helper — owner's member record is the performed_by actor
  const ownerMemberId = members.find((m) => m.role === 'OWNER')?.id ?? null;

  async function logActivity(
    action: string,
    targetId: string,
    metadata?: Record<string, unknown>
  ) {
    await supabase.from('activity_log').insert({
      organization_id: organizationId,
      action,
      target_entity: 'tenant_member',
      target_id: targetId,
      performed_by: ownerMemberId,
      metadata: metadata ?? null,
    } as never);
  }

  // ── Edit role ─────────────────────────────────────────────────────────────
  function handleEditRole(member: Member) {
    setNewRole(member.role);
    setEditingMember(member);
  }

  function handleSaveRole() {
    if (!editingMember || !newRole) return;

    startTransition(async () => {
      const { error } = await supabase
        .from('tenant_members')
        .update({ role: newRole })
        .eq('id', editingMember.id);

      if (error) {
        toast({ variant: 'destructive', ...mapDbError(error) });
        return;
      }

      await logActivity('ROLE_CHANGED', editingMember.id, {
        from_role: editingMember.role,
        to_role: newRole,
      });

      toast({ title: 'Role Updated', description: `${editingMember.display_name} is now ${ROLE_LABELS[newRole]}.` });
      setEditingMember(null);
      refreshMembers();
    });
  }

  // ── Reset PIN ─────────────────────────────────────────────────────────────
  function handleOpenResetPin(member: Member) {
    setNewPin('');
    setConfirmNewPin('');
    setPinError('');
    setResetPinMember(member);
  }

  function handleSaveResetPin() {
    if (!resetPinMember) return;

    const err = validatePin(newPin);
    if (err) { setPinError(err); return; }
    if (newPin !== confirmNewPin) { setPinError('PINs do not match.'); return; }
    setPinError('');

    startTransition(async () => {
      const pinHash = await bcrypt.hash(newPin, 10);

      const { error } = await supabase
        .from('tenant_members')
        .update({ pin_hash: pinHash, pin_attempts: 0, status: 'ACTIVE' })
        .eq('id', resetPinMember.id);

      if (error) {
        toast({ variant: 'destructive', ...mapDbError(error) });
        return;
      }

      await logActivity('PIN_RESET', resetPinMember.id);

      toast({ title: 'PIN Reset', description: `PIN updated for ${resetPinMember.display_name}.` });
      setResetPinMember(null);
      refreshMembers();
    });
  }

  // ── Remove member ─────────────────────────────────────────────────────────
  function handleConfirmRemove() {
    if (!removingMember) return;

    startTransition(async () => {
      // Soft-delete: set status = REMOVED (DB CHECK constraint now includes REMOVED — V2.1 migration)
      const { error } = await supabase
        .from('tenant_members')
        .update({ status: 'REMOVED' })
        .eq('id', removingMember.id);

      if (error) {
        toast({ variant: 'destructive', ...mapDbError(error) });
        return;
      }

      await logActivity('MEMBER_REMOVED', removingMember.id, { display_name: removingMember.display_name });

      toast({ title: 'Member Removed', description: `${removingMember.display_name} has been removed from the team.` });
      setRemovingMember(null);
      setMembers((prev) => prev.filter((m) => m.id !== removingMember.id));
    });
  }

  // ── Unlock account ────────────────────────────────────────────────────────
  function handleUnlock(member: Member) {
    startTransition(async () => {
      const { error } = await supabase
        .from('tenant_members')
        .update({ pin_attempts: 0, status: 'ACTIVE' })
        .eq('id', member.id);

      if (error) {
        toast({ variant: 'destructive', ...mapDbError(error) });
        return;
      }

      await logActivity('MEMBER_UNLOCKED', member.id);

      toast({ title: 'Account Unlocked', description: `${member.display_name} can now log in.` });
      refreshMembers();
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Team Members</h2>
          <p className="text-sm text-slate-500 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
        >
          + Add Member
        </Button>
      </div>

      {/* Add worker form */}
      {showAddForm && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-base font-semibold text-slate-800 mb-4">New Team Member</h3>
          <AddWorkerForm
            organizationId={organizationId}
            onSuccess={() => {
              setShowAddForm(false);
              refreshMembers();
            }}
          />
        </div>
      )}

      {/* Members table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {members.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            No team members yet. Add your first worker above.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-4 px-5 py-4">
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: member.avatar_color }}
                >
                  {member.display_name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{member.display_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">{ROLE_LABELS[member.role] ?? member.role}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${STATUS_STYLES[member.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {member.status}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {member.status === 'LOCKED' ? (
                    <button
                      onClick={() => handleUnlock(member)}
                      disabled={isPending}
                      className="text-xs font-medium text-emerald-700 hover:text-emerald-900 min-h-[44px] px-2"
                    >
                      Unlock
                    </button>
                  ) : null}

                  {/* Don't allow editing or removing the owner (identified by checking if it's the current Supabase user's record) */}
                  {member.role !== 'OWNER' && (
                    <>
                      <button
                        onClick={() => handleEditRole(member)}
                        disabled={isPending}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 min-h-[44px] px-2"
                      >
                        Edit Role
                      </button>
                      <button
                        onClick={() => handleOpenResetPin(member)}
                        disabled={isPending}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 min-h-[44px] px-2"
                      >
                        Reset PIN
                      </button>
                      <button
                        onClick={() => setRemovingMember(member)}
                        disabled={isPending}
                        className="text-xs font-medium text-red-500 hover:text-red-700 min-h-[44px] px-2"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Edit Role Dialog ── */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role — {editingMember?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-medium">New Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Select role…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="FARMHAND">Farmhand</SelectItem>
                  <SelectItem value="VET">Vet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleSaveRole}
                disabled={isPending || !newRole}
                className="flex-1 min-h-[44px] bg-emerald-950 hover:bg-emerald-800 text-white"
              >
                {isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingMember(null)}
                className="flex-1 min-h-[44px]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reset PIN Dialog ── */}
      <Dialog open={!!resetPinMember} onOpenChange={(open) => !open && setResetPinMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset PIN — {resetPinMember?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="newPin" className="text-slate-700 font-medium">New PIN</Label>
              <Input
                id="newPin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="4 digits"
                value={newPin}
                onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
                className={`min-h-[44px] font-mono tracking-widest ${pinError ? 'border-red-500' : ''}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmNewPin" className="text-slate-700 font-medium">Confirm PIN</Label>
              <Input
                id="confirmNewPin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="Repeat PIN"
                value={confirmNewPin}
                onChange={(e) => { setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
                className={`min-h-[44px] font-mono tracking-widest ${pinError ? 'border-red-500' : ''}`}
              />
            </div>
            {pinError && <p className="text-xs text-red-600">{pinError}</p>}
            <div className="flex gap-3">
              <Button
                onClick={handleSaveResetPin}
                disabled={isPending}
                className="flex-1 min-h-[44px] bg-emerald-950 hover:bg-emerald-800 text-white"
              >
                {isPending ? 'Saving…' : 'Reset PIN'}
              </Button>
              <Button variant="outline" onClick={() => setResetPinMember(null)} className="flex-1 min-h-[44px]">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Remove Confirmation Dialog ── */}
      <Dialog open={!!removingMember} onOpenChange={(open) => !open && setRemovingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removingMember?.display_name}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-600">
              This will remove them from the team and the &quot;Who&apos;s Working?&quot; screen.
              Their historical records are preserved.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleConfirmRemove}
                disabled={isPending}
                variant="destructive"
                className="flex-1 min-h-[44px]"
              >
                {isPending ? 'Removing…' : 'Remove'}
              </Button>
              <Button variant="outline" onClick={() => setRemovingMember(null)} className="flex-1 min-h-[44px]">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
