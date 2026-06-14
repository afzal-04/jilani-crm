'use client';
// src/components/Sidebar.tsx
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './Sidebar.module.css';

interface NavItem { href: string; icon: string; label: string; badge?: number; badgeColor?: 'blue'|'red'; }
interface NavSection { label: string; items: NavItem[]; }

export const NAV_SECTIONS: NavSection[] = [
  { label: 'Overview', items: [
    { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { href: '/reports',   icon: '📊', label: 'Reports' },
  ]},
  { label: 'CRM', items: [
    { href: '/leads',       icon: '🎯', label: 'Lead Pipeline' },
    { href: '/parents',     icon: '👨‍👩‍👧', label: 'Parents' },
    { href: '/tutors',      icon: '👩‍🏫', label: 'Tutors' },
    { href: '/assignments', icon: '📋', label: 'Assignments' },
  ]},
  { label: 'Operations', items: [
    { href: '/attendance',     icon: '📅', label: 'Attendance' },
    { href: '/fees',           icon: '💰', label: 'Fees' },
    { href: '/communications', icon: '💬', label: 'Comms Log' },
    { href: '/tasks',          icon: '✅', label: 'Tasks' },
  ]},
  { label: 'Admin', items: [
    { href: '/staff',    icon: '👥', label: 'Staff' },
    { href: '/settings', icon: '⚙️', label: 'Settings' },
  ]},
];

interface Props {
  open: boolean;
  onClose: () => void;
  badges?: Record<string, number>;
}

export default function Sidebar({ open, onClose, badges = {} }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  function go(href: string) {
    router.push(href);
    onClose();
  }

  async function handleLogout() {
    await signOut();
    router.push('/login');
  }

  return (
    <>
      {open && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
        <div className={styles.logo}>
          <div className={styles.logoText}>📚 Jilani CRM</div>
          <div className={styles.logoSub}>Home Tutor Management</div>
        </div>
        <nav className={styles.nav}>
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <div className={styles.sectionLabel}>{section.label}</div>
              {section.items.map(item => {
                const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                const badgeCount = badges[item.href];
                return (
                  <button
                    key={item.href}
                    className={`${styles.navItem} ${active ? styles.navActive : ''}`}
                    onClick={() => go(item.href)}
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    <span>{item.label}</span>
                    {badgeCount ? (
                      <span className={item.href === '/communications' ? styles.navBadgeRed : styles.navBadge}>
                        {badgeCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className={styles.footer}>
          <div className={styles.userEmail}>{user?.email}</div>
          <button className={styles.logoutBtn} onClick={handleLogout}>🚪 Logout</button>
        </div>
      </aside>
    </>
  );
}
