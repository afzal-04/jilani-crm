'use client';
// src/app/login/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);

  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(getAuthInstance(), email, password);
      router.push('/dashboard');
    } catch {
      setError('Invalid credentials. Please try again.');
    }
    setLoading(false);
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: 'var(--gradient-navy)' }}
    >
      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'var(--radial-glow-blue)' }}
      />
      {/* Faint grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      <div className="relative w-full max-w-[420px]">
        {/* Logo + heading */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_10px_40px_-10px_oklch(0.58_0.19_258/0.6)] ring-1 ring-white/10"
            style={{ background: 'var(--gradient-blue)' }}
          >
            <span className="text-lg font-bold tracking-tight">JC</span>
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-white">Jilani CRM</h1>
          <p className="mt-1.5 text-sm text-white/55">Home Tutor Management</p>
        </div>

        {/* Card */}
        <div
          className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 backdrop-blur-xl"
          style={{ boxShadow: 'var(--shadow-elegant)' }}
        >
          {/* Gold top accent bar */}
          <div
            aria-hidden
            className="absolute inset-x-6 top-0 h-[2px] rounded-full"
            style={{ background: 'var(--gradient-gold)' }}
          />

          <div className="mb-6">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Sign in to your workspace
            </h2>
            <p className="mt-1 text-[13px] text-white/50">
              Enter your credentials to access the admin console.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[12px] font-medium uppercase tracking-wider text-white/60">
                Email
              </label>
              <div className="group relative">
                <Mail
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-[color:var(--brand-blue-glow)]"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@jilanitutor.com"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[color:var(--brand-blue-glow)] focus:bg-white/[0.06] focus:ring-4 focus:ring-[color:var(--brand-blue)]/20"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-[12px] font-medium uppercase tracking-wider text-white/60">
                  Password
                </label>
              </div>
              <div className="group relative">
                <Lock
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-[color:var(--brand-blue-glow)]"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-11 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[color:var(--brand-blue-glow)] focus:bg-white/[0.06] focus:ring-4 focus:ring-[color:var(--brand-blue)]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Sign In button */}
            <button
              type="submit"
              disabled={loading}
              className="relative mt-2 flex h-11 w-full items-center justify-center overflow-hidden rounded-xl text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
              style={{ background: 'var(--gradient-blue)', boxShadow: 'var(--shadow-glow-blue)' }}
            >
              <span className="relative">{loading ? 'Signing in…' : 'Sign In'}</span>
            </button>

            {/* Error slot */}
            <div className="min-h-[40px] pt-1" aria-live="polite">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-[oklch(0.6_0.22_25/0.35)] bg-[oklch(0.6_0.22_25/0.08)] px-3 py-2 text-[13px] text-[oklch(0.85_0.12_25)]"
                >
                  <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-[oklch(0.7_0.22_25)]" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </form>

          {/* Divider + secure notice */}
          <div className="mt-2 flex items-center justify-center gap-2 border-t border-white/[0.06] pt-4 text-[11px] text-white/40">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Secured with end-to-end encryption</span>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[12px] text-white/35">
          Jilani Home Tutor · Internal CRM
        </p>
      </div>
    </main>
  );
}