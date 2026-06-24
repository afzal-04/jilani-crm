'use client';
// src/components/AppShell.tsx
import { useState, ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, canAccess } from '@/context/AuthContext';
import Sidebar from './Sidebar';
import styles from './AppShell.module.css';

interface Props {
  title: string; children: ReactNode;
  onRefresh?: () => void; badges?: Record<string, number>;
}

export default function AppShell({ title, children, onRefresh, badges }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, role, passwordChanged, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    if (!passwordChanged && pathname !== '/change-password') { router.push('/change-password'); return; }
    if (!canAccess(role, pathname || '')) router.push('/dashboard');
  }, [user, role, passwordChanged, loading, pathname, router]);

  if (loading) return (
    <div className={styles.loadingScreen}>
      <div className={styles.loadingDot} />
      <div className={styles.loadingDot} />
      <div className={styles.loadingDot} />
    </div>
  );

  if (!user) return <div className={styles.loadingScreen}><div className={styles.loadingDot} /></div>;

  if (!passwordChanged && pathname !== '/change-password') return (
    <div className={styles.accessDenied}>
      <div className={styles.accessDeniedCard}>
        <div style={{ fontSize: 40 }}>🔐</div>
        <h2>Password Change Required</h2>
        <p>Please set a new password before using the CRM.</p>
        <button onClick={() => router.push('/change-password')} className={styles.backBtn}>Set Password →</button>
      </div>
    </div>
  );

  if (!canAccess(role, pathname || '')) return (
    <div className={styles.accessDenied}>
      <div className={styles.accessDeniedCard}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <h2>Access Denied</h2>
        <p>You don&apos;t have permission to view this page.</p>
        <button onClick={() => router.push('/dashboard')} className={styles.backBtn}>← Dashboard</button>
      </div>
    </div>
  );

  return (
    <div className={styles.app}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} badges={badges} />
      <div className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.hamburger} onClick={() => setSidebarOpen(true)}>☰</button>
            <h1>{title}</h1>
          </div>
          <div className={styles.topbarRight}>
            {onRefresh && (
              <button className={styles.refreshBtn} onClick={onRefresh}>
                ↻ Refresh
              </button>
            )}
          </div>
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}