'use client';
// src/components/Sidebar.tsx
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, canAccess, UserRole } from '@/context/AuthContext';
import {
  Home, BarChart3, Target, Users, GraduationCap, ClipboardList, ClipboardCheck,
  Wallet, Bell, MessageCircle, CheckSquare, TrendingDown, TrendingUp, UsersRound,
  Settings, KeyRound, LogOut, Wand2, type LucideIcon,
} from 'lucide-react';

type NavItem  = { label: string; href: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

// ── Nav structure — routes match your actual src/app/* folder names ──────────
const GROUPS: NavGroup[] = [
  { label: 'Overview', items: [
    { label: 'Dashboard', href: '/dashboard', icon: Home },
    { label: 'Analytics', href: '/reports',   icon: BarChart3 },
  ]},
  { label: 'Pipeline', items: [
    { label: 'Lead Pipeline',   href: '/leads',       icon: Target },
    { label: 'Parents',         href: '/parents',     icon: Users },
    { label: 'Tutors',          href: '/tutors',      icon: GraduationCap },
    { label: 'Assignments',     href: '/assignments', icon: ClipboardList },
    { label: 'Tutor Matching',  href: '/matching',    icon: Wand2 },
  ]},
  { label: 'Operations', items: [
    { label: 'Fees',       href: '/fees',           icon: Wallet },
    { label: 'Attendance', href: '/attendance',      icon: ClipboardCheck },
    { label: 'Reminders',  href: '/reminders',       icon: Bell },
    { label: 'Comms Log',  href: '/communications',  icon: MessageCircle },
    { label: 'Tasks',      href: '/tasks',           icon: CheckSquare },
  ]},
  { label: 'Finance', items: [
    { label: 'Expenses', href: '/expenses', icon: TrendingDown },
    { label: 'Incomes', href: '/income', icon: TrendingUp },
    { label: 'Revenue', href: '/revenue', icon: TrendingUp },
  ]},
  { label: 'Admin', items: [
    { label: 'Staff',    href: '/staff',    icon: UsersRound },
    { label: 'Settings', href: '/settings', icon: Settings },
  ]},
];

const ROLE_BADGE: Record<UserRole, { label: string }> = {
  owner:   { label: 'Owner'   },
  admin:   { label: 'Admin'   },
  manager: { label: 'Manager' },
  staff:   { label: 'Staff'   },
};

interface Props { open: boolean; onClose: () => void; badges?: Record<string, number>; }

export default function Sidebar({ open, onClose, badges = {} }: Props) {
  const pathname = usePathname();
  const router    = useRouter();
  const { user, role, signOut } = useAuth();

  function go(href: string) { router.push(href); onClose(); }
  async function handleLogout() { await signOut(); router.push('/login'); }

  const visibleGroups = GROUPS.map(g => ({
    ...g,
    items: g.items.filter(item => canAccess(role, item.href)),
  })).filter(g => g.items.length > 0);

  const roleLabel = ROLE_BADGE[role].label;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-white/[0.06] text-white/80',
          'transition-transform duration-300 bg-[#0A0F1E]', // ← fallback solid color, always applies
          open ? 'translate-x-0' : '-translate-x-full',
          'md:static md:z-30 md:h-screen md:translate-x-0 md:sticky md:top-0',
        ].join(' ')}
        style={{ backgroundImage: 'var(--gradient-navy, none)' }}
        /* backgroundImage layers ON TOP of the bg-[#0A0F1E] fallback —      *
         * so even if the CSS variable is missing, you still get solid navy */
      >
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="appearance-none absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-white/60 md:hidden cursor-pointer outline-none"
        >
          ✕
        </button>

        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(60% 40% at 10% 0%, oklch(0.6 0.2 258 / 0.18) 0%, transparent 70%)' }}
        />

        {/* Brand */}
        <div className="relative flex items-center gap-3 px-5 pt-6 pb-4">
          <div
            className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-white ring-1 ring-white/10"
            style={{ background: 'var(--gradient-blue)', boxShadow: '0 8px 24px -10px oklch(0.58 0.19 258 / 0.7)' }}
          >
            <span className="text-sm font-bold tracking-tight">JC</span>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold tracking-tight text-white">Jilani CRM</div>
            <div className="truncate text-[11px] text-white/50">Home Tutor Management</div>
          </div>
        </div>

        {/* Role badge — now dynamic from real auth role */}
        <div className="relative px-5 pb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/80">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--gold)', boxShadow: '0 0 8px oklch(0.78 0.17 75 / 0.8)' }}
            />
            {roleLabel}
          </span>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 overflow-y-auto px-3 pb-4">
          {visibleGroups.map(group => (
            <div key={group.label} className="mb-5">
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {group.label}
              </div>
              <ul className="space-y-0.5">
                {group.items.map(item => {
                  const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                  const Icon   = item.icon;
                  const badge  = badges[item.href];
                  return (
                    <li key={item.href} className="relative">
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full"
                          style={{ background: 'var(--gradient-blue)', boxShadow: '0 0 14px oklch(0.68 0.17 245 / 0.9)' }}
                        />
                      )}
                      <button
                        onClick={() => go(item.href)}
                        className={[
                          'appearance-none border-0 outline-none', // strip native button chrome (light gray box)
                          'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition text-left cursor-pointer',
                          active
                            ? 'text-white'
                            : 'bg-transparent text-white/65 hover:bg-white/[0.04] hover:text-white',
                        ].join(' ')}
                        style={active ? {
                          background: 'linear-gradient(90deg, oklch(0.58 0.19 258 / 0.22) 0%, oklch(0.58 0.19 258 / 0.05) 100%)',
                          boxShadow: 'inset 0 0 0 1px oklch(0.68 0.17 245 / 0.25)',
                        } : undefined}
                      >
                        <Icon className={['h-4 w-4 flex-none transition-colors', active ? 'text-[color:var(--brand-blue-glow)]' : 'text-white/50 group-hover:text-white/80'].join(' ')} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {!!badge && (
                          <span
                            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold text-white"
                            style={{
                              background: 'linear-gradient(135deg, oklch(0.62 0.22 25) 0%, oklch(0.55 0.22 20) 100%)',
                              boxShadow: '0 4px 12px -4px oklch(0.6 0.22 25 / 0.7)',
                            }}
                          >
                            {badge}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User card — dynamic email/avatar from real auth */}
        <div className="relative border-t border-white/[0.06] p-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[13px] font-semibold text-white ring-1 ring-white/10"
                style={{ background: 'var(--gradient-blue)' }}
              >
                {user?.email?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-white">{user?.email}</div>
                <button
                  type="button"
                  onClick={() => go('/change-password')}
                  className="appearance-none border-0 bg-transparent p-0 mt-0.5 inline-flex items-center gap-1 text-[11px] text-white/50 transition hover:text-[color:var(--gold)] cursor-pointer outline-none"
                >
                  <KeyRound className="h-3 w-3" />
                  Change password
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="appearance-none outline-none cursor-pointer mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] font-medium text-white/70 transition hover:border-[oklch(0.6_0.22_25/0.4)] hover:bg-[oklch(0.6_0.22_25/0.1)] hover:text-[oklch(0.85_0.15_25)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}