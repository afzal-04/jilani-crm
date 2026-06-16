'use client';
// src/components/Sidebar.tsx
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, canAccess, UserRole } from '@/context/AuthContext';
import styles from './Sidebar.module.css';

interface NavItem    { href: string; icon: string; label: string; }
interface NavSection { label: string; items: NavItem[]; }

const ALL_SECTIONS: NavSection[] = [
  { label: 'Overview', items: [
    { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { href: '/reports',   icon: '📊', label: 'Reports'   },
  ]},
  { label: 'CRM', items: [
    { href: '/leads',       icon: '🎯', label: 'Lead Pipeline' },
    { href: '/parents',     icon: '👨‍👩‍👧', label: 'Parents'       },
    { href: '/tutors',      icon: '👩‍🏫', label: 'Tutors'         },
    { href: '/assignments', icon: '📋', label: 'Assignments'    },
  ]},
  { label: 'Operations', items: [
    { href: '/attendance',     icon: '📅', label: 'Attendance'   },
    { href: '/fees',           icon: '💰', label: 'Fees'         },
    { href: '/communications', icon: '💬', label: 'Comms Log'    },
    { href: '/tasks',          icon: '✅', label: 'Tasks'        },
  ]},
  { label: 'Admin', items: [
    { href: '/staff',    icon: '👥', label: 'Staff'    },
    { href: '/settings', icon: '⚙️', label: 'Settings' },
  ]},
];

// Role badge colors
const ROLE_STYLE: Record<UserRole, { bg: string; color: string; label: string }> = {
  owner:   { bg: '#fef3c7', color: '#92400e', label: '👑 Owner'   },
  admin:   { bg: '#e0ecff', color: '#1a52bf', label: '🔐 Admin'   },
  manager: { bg: '#e8f7ee', color: '#157a44', label: '🎯 Manager' },
  staff:   { bg: '#f0f0f0', color: '#555',    label: '👤 Staff'   },
};

interface Props {
  open:     boolean;
  onClose:  () => void;
  badges?:  Record<string, number>;
}

export default function Sidebar({ open, onClose, badges = {} }: Props) {
  const pathname       = usePathname();
  const router         = useRouter();
  const { user, role, signOut } = useAuth();

  function go(href: string) { router.push(href); onClose(); }

  async function handleLogout() {
    await signOut();
    router.push('/login');
  }

  // Filter nav sections — only show items the current role can access
  const visibleSections = ALL_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => canAccess(role, item.href)),
  })).filter(section => section.items.length > 0);

  const roleStyle = ROLE_STYLE[role];

  return (
    <>
      {open && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>

        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoText}>📚 Jilani CRM</div>
          <div className={styles.logoSub}>Home Tutor Management</div>
        </div>

        {/* Role badge */}
        <div style={{padding:'8px 16px 4px'}}>
          <span style={{
            display:'inline-block', padding:'4px 10px', borderRadius:100,
            fontSize:11, fontWeight:700,
            background: roleStyle.bg, color: roleStyle.color,
          }}>
            {roleStyle.label}
          </span>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          {visibleSections.map(section => (
            <div key={section.label}>
              <div className={styles.sectionLabel}>{section.label}</div>
              {section.items.map(item => {
                const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                const badge  = badges[item.href];
                return (
                  <button
                    key={item.href}
                    className={`${styles.navItem} ${active ? styles.navActive : ''}`}
                    onClick={() => go(item.href)}
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    <span>{item.label}</span>
                    {badge ? (
                      <span className={item.href === '/communications' ? styles.navBadgeRed : styles.navBadge}>
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
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {user?.email?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className={styles.userDetails}>
              <div className={styles.userEmail}>{user?.email}</div>
              <button className={styles.changePwdBtn} onClick={() => go('/change-password')}>
                🔐 Change Password
              </button>
            </div>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            🚪 Logout
          </button>
        </div>
      </aside>
    </>
  );
}