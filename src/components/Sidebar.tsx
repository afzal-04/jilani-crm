'use client';
// src/components/Sidebar.tsx
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, canAccess, UserRole } from '@/context/AuthContext';
import styles from './Sidebar.module.css';

interface NavItem    { href: string; icon: string; label: string; }
interface NavSection { label: string; items: NavItem[]; }

const ALL_SECTIONS: NavSection[] = [
  { label: 'Overview', items: [
    { href: '/dashboard', icon: '⬛', label: 'Dashboard'     },
    { href: '/reports',   icon: '⬛', label: 'Analytics'     },
  ]},
  { label: 'Pipeline', items: [
    { href: '/leads',       icon: '⬛', label: 'Lead Pipeline' },
    { href: '/parents',     icon: '⬛', label: 'Parents'        },
    { href: '/tutors',      icon: '⬛', label: 'Tutors'         },
    { href: '/assignments', icon: '⬛', label: 'Assignments'    },
  ]},
  { label: 'Operations', items: [
    { href: '/attendance',     icon: '⬛', label: 'Attendance'    },
    { href: '/fees',           icon: '⬛', label: 'Fees'          },
    { href: '/reminders',      icon: '⬛', label: 'Reminders'     },
    { href: '/communications', icon: '⬛', label: 'Comms Log'     },
    { href: '/tasks',          icon: '⬛', label: 'Tasks'         },
  ]},
  { label: 'Finance', items: [
    { href: '/expenses', icon: '⬛', label: 'Expenses' },
  ]},
  { label: 'Admin', items: [
    { href: '/staff',    icon: '⬛', label: 'Staff'    },
    { href: '/settings', icon: '⬛', label: 'Settings' },
  ]},
];

// Clean icons using text/emoji
const NAV_ICONS: Record<string, string> = {
  '/dashboard':      '🏠',
  '/reports':        '📊',
  '/leads':          '🎯',
  '/parents':        '👨‍👩‍👧',
  '/tutors':         '👩‍🏫',
  '/assignments':    '📋',
  '/attendance':     '📅',
  '/fees':           '💰',
  '/reminders':      '🔔',
  '/communications': '💬',
  '/tasks':          '✅',
  '/expenses':       '💸',
  '/staff':          '👥',
  '/settings':       '⚙️',
};

const ROLE_BADGE: Record<UserRole, { label: string; bg: string; color: string }> = {
  owner:   { label: 'Owner',   bg: 'rgba(245,158,11,.15)', color: '#FCD34D'  },
  admin:   { label: 'Admin',   bg: 'rgba(59,130,246,.15)', color: '#93C5FD'  },
  manager: { label: 'Manager', bg: 'rgba(16,185,129,.15)', color: '#6EE7B7'  },
  staff:   { label: 'Staff',   bg: 'rgba(156,163,175,.15)', color: '#D1D5DB' },
};

interface Props { open: boolean; onClose: () => void; badges?: Record<string, number>; }

export default function Sidebar({ open, onClose, badges = {} }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, role, signOut } = useAuth();

  function go(href: string) { router.push(href); onClose(); }
  async function handleLogout() { await signOut(); router.push('/login'); }

  const visibleSections = ALL_SECTIONS.map(s => ({
    ...s,
    items: s.items
      .map(item => ({ ...item, icon: NAV_ICONS[item.href] || '●' }))
      .filter(item => canAccess(role, item.href)),
  })).filter(s => s.items.length > 0);

  const rb = ROLE_BADGE[role];

  return (
    <>
      {open && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>

        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoMark}>JC</div>
          <div>
            <div className={styles.logoText}>Jilani CRM</div>
            <div className={styles.logoSub}>Tutor Management</div>
          </div>
        </div>

        {/* Role badge */}
        <div style={{ padding: '8px 14px 2px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 100,
            fontSize: 10.5, fontWeight: 700, letterSpacing: .3,
            background: rb.bg, color: rb.color,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: rb.color, display: 'inline-block',
            }} />
            {rb.label}
          </span>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          {visibleSections.map(section => (
            <div key={section.label}>
              <div className={styles.sectionLabel}>{section.label}</div>
              {section.items.map(item => {
                const active  = pathname === item.href || pathname?.startsWith(item.href + '/');
                const badge   = badges[item.href];
                const isRed   = item.href === '/communications' || item.href === '/reminders';
                return (
                  <button
                    key={item.href}
                    className={`${styles.navItem} ${active ? styles.navActive : ''}`}
                    onClick={() => go(item.href)}
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {badge ? (
                      <span className={isRed ? styles.navBadgeRed : styles.navBadge}>
                        {badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.userCard}>
            <div className={styles.userAvatar}>
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userDetails}>
              <div className={styles.userEmail}>{user?.email}</div>
              <button className={styles.changePwdBtn} onClick={() => go('/change-password')}>
                Change password
              </button>
            </div>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}