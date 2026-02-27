'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AuthMode = 'signin' | 'signup' | 'magic_link';

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const supabase = createClient();

  function clearError() {
    if (error) setError(null);
  }

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message ?? 'Authentication failed. Check your credentials.');
        return;
      }

      router.push('/');
      router.refresh();
    });
  }

  function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    startTransition(async () => {
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      if (authError) {
        setError(authError.message ?? 'Sign up failed. Please try again.');
        return;
      }

      setSignupSuccess(true);
    });
  }

  function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    startTransition(async () => {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      if (authError) {
        setError(authError.message ?? 'Could not send magic link. Please try again.');
        return;
      }

      setMagicSent(true);
    });
  }

  // ── Success states ──────────────────────────────────────────────────────────

  if (magicSent) {
    return (
      <AuthShell>
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Check your email</h2>
          <p className="text-sm text-slate-500">
            We sent a magic link to <span className="font-medium text-slate-700">{email}</span>.
            Click the link to sign in.
          </p>
          <button
            onClick={() => { setMagicSent(false); setMode('signin'); }}
            className="text-sm text-emerald-700 hover:underline mt-2"
          >
            Back to sign in
          </button>
        </div>
      </AuthShell>
    );
  }

  if (signupSuccess) {
    return (
      <AuthShell>
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Account created!</h2>
          <p className="text-sm text-slate-500">
            Check your email to confirm your account, then sign in below.
          </p>
          <button
            onClick={() => { setSignupSuccess(false); setMode('signin'); }}
            className="text-sm text-emerald-700 hover:underline"
          >
            Go to sign in
          </button>
        </div>
      </AuthShell>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex">
      {/* Left — Brand panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-emerald-950 flex-col justify-center px-12">
        <p className="text-emerald-400 text-sm font-medium uppercase tracking-widest mb-3">
          FeedlotPro Kenya
        </p>
        <h1 className="text-4xl font-bold text-white leading-tight">
          Livestock management built for Kenyan feedlots.
        </h1>
        <p className="mt-4 text-emerald-200 text-base leading-relaxed">
          Track inventory, record daily feeding, and monitor weight gain performance — all in one place.
        </p>
        <div className="mt-10 flex flex-col gap-3">
          {[
            'Multi-pen inventory management',
            'Daily feeding checklist per pen',
            'Weight gain & ADG tracking',
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-emerald-100 text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Form panel */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div className="lg:hidden mb-8 text-center">
            <p className="text-emerald-700 text-sm font-semibold uppercase tracking-widest">FeedlotPro Kenya</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Welcome back</h1>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            {/* Mode tabs */}
            <div className="flex rounded-lg overflow-hidden border border-slate-200 mb-6">
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    mode === m
                      ? 'bg-emerald-950 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-slate-700 font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError(); }}
                    className="min-h-[44px]"
                    disabled={isPending}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError(); }}
                    className="min-h-[44px]"
                    disabled={isPending}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                >
                  {isPending ? 'Signing in…' : 'Sign In'}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-xs text-slate-400 uppercase tracking-wider">or</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={(e) => { e.preventDefault(); setMode('magic_link'); }}
                  className="w-full min-h-[44px] border-slate-300 text-slate-600"
                >
                  Sign in with Magic Link
                </Button>
              </form>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email-signup" className="text-slate-700 font-medium">Email</Label>
                  <Input
                    id="email-signup"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError(); }}
                    className="min-h-[44px]"
                    disabled={isPending}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password-signup" className="text-slate-700 font-medium">Password</Label>
                  <Input
                    id="password-signup"
                    type="password"
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError(); }}
                    className="min-h-[44px]"
                    disabled={isPending}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                >
                  {isPending ? 'Creating account…' : 'Create Account'}
                </Button>
              </form>
            )}

            {mode === 'magic_link' && (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <p className="text-sm text-slate-500">
                  Enter your email and we&apos;ll send you a one-click sign-in link.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="email-magic" className="text-slate-700 font-medium">Email</Label>
                  <Input
                    id="email-magic"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError(); }}
                    className="min-h-[44px]"
                    disabled={isPending}
                    autoComplete="email"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                >
                  {isPending ? 'Sending…' : 'Send Magic Link'}
                </Button>
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(null); }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 py-1"
                >
                  ← Back to sign in
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
