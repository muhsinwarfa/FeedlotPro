'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useWorkerSession } from '@/contexts/worker-session-context';
import { mapDbError } from '@/lib/errors';
import { useToast } from '@/hooks/use-toast';
import { PinPad } from '@/components/session/pin-pad';
import type { TenantMemberV2 } from '@/types/database';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionKioskProps {
  members: Pick<TenantMemberV2, 'id' | 'display_name' | 'role' | 'avatar_color' | 'pin_hash' | 'pin_attempts' | 'status'>[];
  organizationId: string;
  sessionTtlHours: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  FARMHAND: 'Farmhand',
  VET: 'Vet',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SessionKiosk({ members, organizationId, sessionTtlHours }: SessionKioskProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { setSession } = useWorkerSession();
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: member selection; Step 2: PIN entry; Step 3: PIN setup (first-time)
  const [step, setStep] = useState<'select' | 'pin' | 'pin-setup'>('select');
  const [selectedMember, setSelectedMember] = useState<SessionKioskProps['members'][number] | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [setupPin, setSetupPin] = useState('');

  const supabase = createClient();

  // ── Avatar selection ──────────────────────────────────────────────────────
  function handleSelectMember(member: SessionKioskProps['members'][number]) {
    if (member.status === 'LOCKED') {
      toast({
        variant: 'destructive',
        title: 'SEC-001',
        description: 'Account locked. Contact the farm owner to reset your PIN.',
      });
      return;
    }
    setSelectedMember(member);
    setAttemptCount(member.pin_attempts);
    setStep(member.pin_hash ? 'pin' : 'pin-setup');
  }

  // ── PIN verification ──────────────────────────────────────────────────────
  async function handlePinComplete(enteredPin: string) {
    if (!selectedMember) return;
    setIsLoading(true);
    try {
      const isMatch = await bcrypt.compare(enteredPin, selectedMember.pin_hash ?? '');

      if (!isMatch) {
        const newAttempts = attemptCount + 1;
        setAttemptCount(newAttempts);

        // Increment pin_attempts in DB; trg_pin_lockout fires if >= 3
        const { error } = await supabase
          .from('tenant_members')
          .update({ pin_attempts: newAttempts })
          .eq('id', selectedMember.id);

        if (error) {
          toast({ variant: 'destructive', ...mapDbError(error) });
          return;
        }

        if (newAttempts >= 3) {
          toast({
            variant: 'destructive',
            title: 'SEC-001',
            description: 'Account locked after 3 failed attempts. Contact the farm owner.',
          });
          setStep('select');
          setSelectedMember(null);
          setAttemptCount(0);
        }
        return;
      }

      // PIN correct — reset attempts and create session
      await supabase
        .from('tenant_members')
        .update({ pin_attempts: 0 })
        .eq('id', selectedMember.id);

      await createAndStartSession();
    } finally {
      setIsLoading(false);
    }
  }

  // ── PIN setup (first-time) ────────────────────────────────────────────────
  function handlePinSetupStep1(pin: string) {
    setSetupPin(pin);
  }

  async function handlePinSetupStep2(confirmedPin: string) {
    if (!selectedMember) return;

    if (confirmedPin !== setupPin) {
      toast({
        variant: 'destructive',
        title: 'DAT-005',
        description: 'PINs do not match. Please try again.',
      });
      setSetupPin('');
      return;
    }

    setIsLoading(true);
    try {
      const hash = await bcrypt.hash(confirmedPin, 10);

      const { error } = await supabase
        .from('tenant_members')
        .update({ pin_hash: hash, pin_attempts: 0 })
        .eq('id', selectedMember.id);

      if (error) {
        toast({ variant: 'destructive', ...mapDbError(error) });
        return;
      }

      await createAndStartSession();
    } finally {
      setIsLoading(false);
    }
  }

  // ── Device fingerprint — stable per browser/tablet (P4 deviceId) ─────────
  function getOrCreateDeviceId(): string {
    const stored = localStorage.getItem('feedlotpro_device_id');
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem('feedlotpro_device_id', id);
    return id;
  }

  // ── Session creation ──────────────────────────────────────────────────────
  async function createAndStartSession() {
    if (!selectedMember) return;

    const expiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000).toISOString();
    const deviceId = getOrCreateDeviceId();

    const { data: sessionData, error } = await supabase
      .from('sessions')
      .insert({
        organization_id: organizationId,
        member_id: selectedMember.id,
        expires_at: expiresAt,
        device_id: deviceId,
      })
      .select('id')
      .single();

    if (error || !sessionData) {
      toast({ variant: 'destructive', ...mapDbError(error ?? { message: 'Session creation failed.' }) });
      return;
    }

    setSession({
      sessionId: sessionData.id,
      memberId: selectedMember.id,
      displayName: selectedMember.display_name,
      role: selectedMember.role,
      avatarColor: selectedMember.avatar_color,
      expiresAt,
      deviceId,
    });

    router.push('/');
    router.refresh();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === 'select') {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase mb-3">FeedlotPro Kenya</p>
          <h1 className="text-2xl font-bold text-slate-900">Who&apos;s Working?</h1>
          <p className="mt-1 text-sm text-slate-500">Tap your name to start your session.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {members.map((member) => {
            const isLocked = member.status === 'LOCKED';
            return (
              <button
                key={member.id}
                onClick={() => handleSelectMember(member)}
                disabled={isLocked}
                className={`flex flex-col items-center gap-3 p-5 rounded-2xl border shadow-sm active:scale-95 transition-all min-h-[120px] disabled:cursor-not-allowed ${
                  isLocked
                    ? 'border-red-200 bg-red-50'
                    : 'border-slate-200 bg-white hover:shadow-md hover:ring-2 hover:ring-emerald-400 hover:ring-offset-2'
                }`}
              >
                {/* Avatar circle */}
                {isLocked ? (
                  <div className="w-14 h-14 rounded-full flex items-center justify-center bg-red-100 border-2 border-red-200 flex-shrink-0">
                    <Lock className="w-6 h-6 text-red-500" />
                  </div>
                ) : (
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                    style={{ backgroundColor: member.avatar_color }}
                  >
                    {getInitials(member.display_name)}
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-800 leading-tight">
                    {member.display_name}
                  </p>
                  <p className={`text-xs mt-0.5 ${isLocked ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                    {isLocked ? 'Locked' : ROLE_LABELS[member.role] ?? member.role}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (step === 'pin' && selectedMember) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => { setStep('select'); setSelectedMember(null); setAttemptCount(0); }}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back
        </button>

        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto"
            style={{ backgroundColor: selectedMember.avatar_color }}
          >
            {getInitials(selectedMember.display_name)}
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900">{selectedMember.display_name}</h2>
          <p className="text-sm text-slate-500">Enter your 4-digit PIN</p>
        </div>

        <PinPad
          onComplete={handlePinComplete}
          isLocked={selectedMember.status === 'LOCKED' || attemptCount >= 3}
          attemptCount={attemptCount}
          isPending={isLoading}
        />
      </div>
    );
  }

  if (step === 'pin-setup' && selectedMember) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => { setStep('select'); setSelectedMember(null); setSetupPin(''); }}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back
        </button>

        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto"
            style={{ backgroundColor: selectedMember.avatar_color }}
          >
            {getInitials(selectedMember.display_name)}
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900">{selectedMember.display_name}</h2>
          {!setupPin ? (
            <p className="text-sm text-slate-500">Set your 4-digit PIN (first-time setup)</p>
          ) : (
            <p className="text-sm text-amber-600 font-medium">Confirm your PIN</p>
          )}
        </div>

        <PinPad
          onComplete={setupPin ? handlePinSetupStep2 : handlePinSetupStep1}
          isPending={isLoading}
        />
      </div>
    );
  }

  return null;
}
