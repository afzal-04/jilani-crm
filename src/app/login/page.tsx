'use client';
// src/app/login/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await signInWithEmailAndPassword(getAuthInstance(), email, password);
      router.push('/dashboard');
    } catch {
      setError('Invalid email or password.');
    }
    setLoading(false);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <div className={styles.logo}>📚</div>
        <h2>Jilani CRM</h2>
        <p>Sign in to manage your tutoring business</p>
        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.group}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@jilanihometutor.com" required />
          </div>
          <div className={styles.group}>
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
          {error && <p className={styles.err}>{error}</p>}
        </form>
      </div>
    </div>
  );
}
