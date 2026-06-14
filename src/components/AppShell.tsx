'use client';
// src/components/AppShell.tsx
import { useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from './Sidebar';
import styles from './AppShell.module.css';

interface Props {
  title: string;
  children: ReactNode;
  onRefresh?: () => void;
  badges?: Record<string, number>;
}

export default function AppShell({ title, children, onRefresh, badges }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return <div className={styles.loadingScreen}>Loading…</div>;

  if (!user) {
    if (typeof window !== 'undefined') router.push('/login');
    return <div className={styles.loadingScreen}>Redirecting to login…</div>;
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
          {onRefresh && <button className={styles.refreshBtn} onClick={onRefresh}>🔄 Refresh</button>}
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
