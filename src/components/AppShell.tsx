
'use client';
// src/components/AppShell.tsx
import { useState, ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, canAccess } from '@/context/AuthContext';
import Sidebar from './Sidebar';
import styles from './AppShell.module.css';

interface Props {
  title:      string;
  children:   ReactNode;
  onRefresh?: () => void;
  badges?:    Record<string, number>;
}

export default function AppShell({ title, children, onRefresh, badges }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, role, passwordChanged, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // Not logged in → go to login
    if (!user) { router.push('/login'); return; }

    // ── First login check ──────────────────────────────────────────────────
    // If staff hasn't changed temp password yet → force them to /change-password
    // Allow /change-password itself so they're not stuck in a redirect loop
    if (!passwordChanged && pathname !== '/change-password') {
      router.push('/change-password');
      return;
    }

    // ── Role-based page access ─────────────────────────────────────────────
    if (!canAccess(role, pathname || '')) {
      router.push('/dashboard');
    }

  }, [user, role, passwordChanged, loading, pathname, router]);

  if (loading) return <div className={styles.loadingScreen}>Loading…</div>;
  if (!user)   return <div className={styles.loadingScreen}>Redirecting…</div>;

  // Show "must change password" overlay if they somehow got here
  if (!passwordChanged && pathname !== '/change-password') {
    return (
      <div className={styles.accessDenied}>
        <div className={styles.accessDeniedCard}>
          <div style={{fontSize:48,marginBottom:12}}>🔐</div>
          <h2>Password Change Required</h2>
          <p>You must change your temporary password before using the CRM.</p>
          <button onClick={() => router.push('/change-password')} className={styles.backBtn}>
            Change Password Now →
          </button>
        </div>
      </div>
    );
  }

  if (!canAccess(role, pathname || '')) {
    return (
      <div className={styles.accessDenied}>
        <div className={styles.accessDeniedCard}>
          <div style={{fontSize:48,marginBottom:12}}>🔒</div>
          <h2>Access Denied</h2>
          <p>You don&apos;t have permission to view this page.</p>
          <button onClick={() => router.push('/dashboard')} className={styles.backBtn}>
            ← Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} badges={badges} />
      <div className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.hamburger} onClick={() => setSidebarOpen(true)}>☰</button>
            <h1>{title}</h1>
          </div>
          {onRefresh && (
            <button className={styles.refreshBtn} onClick={onRefresh}>🔄 Refresh</button>
          )}
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
