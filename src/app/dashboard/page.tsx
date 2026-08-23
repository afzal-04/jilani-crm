'use client';
// src/app/dashboard/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { currency } from '@/components/UI';
import {
  getParents, getTutors, getFees, getAssignments,
  getComms, getStaff, getTasks, getReminders,
  getExpenses, getIncomes,
  Parent, Tutor, FeeRecord, Assignment, CommunicationLog, StaffMember, Task, FeeReminder,
  Expense, Income,
} from '@/lib/firestore';
import {
  Users, GraduationCap, ClipboardList, TrendingUp, Bell, FileText, UsersRound,
  AlertTriangle, ChevronRight, ArrowUpRight, ArrowDownRight,
  type LucideIcon,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function displayName(r: { name?: string; studentName?: string; tutorName?: string; parentName?: string }): string {
  return r.name?.trim() || r.studentName?.trim() || 'Unnamed';
}
function displayLocation(r: { area?: string; address?: string }): string {
  return r.area?.trim() || r.address?.trim() || '—';
}
const today = () => new Date().toISOString().split('T')[0];
const in2Days = () => { const d = new Date(); d.setDate(d.getDate()+2); return d.toISOString().split('T')[0]; };

// Real daily-count sparkline — last 7 days, based on actual createdAt timestamps
function buildDailySparkline(items: { createdAt?: { seconds: number } }[], days = 7): number[] {
  const counts = new Array(days).fill(0);
  const now = Date.now();
  items.forEach(item => {
    if (!item.createdAt?.seconds) return;
    const ageMs = now - item.createdAt.seconds * 1000;
    const dayIndex = days - 1 - Math.floor(ageMs / 86400000);
    if (dayIndex >= 0 && dayIndex < days) counts[dayIndex]++;
  });
  return counts;
}
function weekDelta(items: { createdAt?: { seconds: number } }[]): { delta: string; trend: 'up'|'down'|'flat' } {
  const now = Date.now();
  const thisWeek = items.filter(i => i.createdAt?.seconds && (now - i.createdAt.seconds*1000) <= 7*86400000).length;
  const lastWeek = items.filter(i => i.createdAt?.seconds && (now - i.createdAt.seconds*1000) > 7*86400000 && (now - i.createdAt.seconds*1000) <= 14*86400000).length;
  if (lastWeek === 0 && thisWeek === 0) return { delta: '', trend: 'flat' };
  if (lastWeek === 0) return { delta: `+${thisWeek} new`, trend: 'up' };
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  return { delta: `${pct >= 0 ? '+' : ''}${pct}%`, trend: pct >= 0 ? 'up' : 'down' };
}

// ── Accent palette ────────────────────────────────────────────────────────────

type Accent = 'blue' | 'gold' | 'green' | 'red';
const accentStyles: Record<Accent, { stroke: string; fill: string; tile: string; iconColor: string; glow: string }> = {
  blue:  { stroke: 'oklch(0.68 0.17 245)', fill: 'oklch(0.68 0.17 245 / 0.18)', tile: 'linear-gradient(135deg, oklch(0.58 0.19 258 / 0.14) 0%, oklch(0.7 0.17 240 / 0.08) 100%)', iconColor: 'oklch(0.58 0.19 258)', glow: 'oklch(0.58 0.19 258 / 0.25)' },
  gold:  { stroke: 'oklch(0.78 0.17 75)',  fill: 'oklch(0.78 0.17 75 / 0.2)',   tile: 'linear-gradient(135deg, oklch(0.82 0.17 78 / 0.16) 0%, oklch(0.72 0.17 60 / 0.08) 100%)', iconColor: 'oklch(0.68 0.17 65)', glow: 'oklch(0.78 0.17 75 / 0.24)' },
  green: { stroke: 'oklch(0.7 0.16 155)',  fill: 'oklch(0.7 0.16 155 / 0.2)',   tile: 'linear-gradient(135deg, oklch(0.7 0.16 155 / 0.16) 0%, oklch(0.62 0.16 160 / 0.08) 100%)', iconColor: 'oklch(0.55 0.16 158)', glow: 'oklch(0.68 0.16 155 / 0.22)' },
  red:   { stroke: 'oklch(0.7 0.2 25)',    fill: 'oklch(0.7 0.2 25 / 0.2)',     tile: 'linear-gradient(135deg, oklch(0.62 0.22 25 / 0.14) 0%, oklch(0.55 0.22 20 / 0.08) 100%)', iconColor: 'oklch(0.62 0.22 25)', glow: 'oklch(0.62 0.22 25 / 0.22)' },
};

// ── Sparkline ──────────────────────────────────────────────────────────────────

function Sparkline({ data, stroke, fill }: { data: number[]; stroke: string; fill: string }) {
  const w = 96, h = 32;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1 || 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * (h - 4) - 2] as const);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  const gid = `spark-${stroke.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="0.9" />
          <stop offset="100%" stopColor={fill} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2" fill={stroke} />
    </svg>
  );
}

// ── Badges ─────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; dot: string }> = {
    new: { bg: 'oklch(0.58 0.19 258 / 0.1)', fg: 'oklch(0.45 0.14 258)', dot: 'oklch(0.58 0.19 258)' },
    contacted: { bg: 'oklch(0.78 0.17 75 / 0.14)', fg: 'oklch(0.5 0.12 70)', dot: 'oklch(0.72 0.15 70)' },
    demo_scheduled: { bg: 'oklch(0.65 0.2 300 / 0.12)', fg: 'oklch(0.5 0.15 300)', dot: 'oklch(0.6 0.2 300)' },
    converted: { bg: 'oklch(0.7 0.16 155 / 0.12)', fg: 'oklch(0.42 0.12 155)', dot: 'oklch(0.55 0.16 158)' },
    closed: { bg: 'oklch(0.9 0.005 260)', fg: 'oklch(0.4 0.02 260)', dot: 'oklch(0.6 0.02 260)' },
    pending: { bg: 'oklch(0.78 0.17 75 / 0.14)', fg: 'oklch(0.5 0.12 70)', dot: 'oklch(0.72 0.15 70)' },
    in_progress: { bg: 'oklch(0.58 0.19 258 / 0.1)', fg: 'oklch(0.45 0.14 258)', dot: 'oklch(0.58 0.19 258)' },
    done: { bg: 'oklch(0.7 0.16 155 / 0.12)', fg: 'oklch(0.42 0.12 155)', dot: 'oklch(0.55 0.16 158)' },
  };
  const s = map[status] ?? { bg: 'oklch(0.92 0.005 260)', fg: 'oklch(0.4 0.02 260)', dot: 'oklch(0.6 0.02 260)' };
  const label = status.replace(/_/g, ' ');
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize" style={{ background: s.bg, color: s.fg }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    high: { bg: 'oklch(0.62 0.22 25 / 0.1)', fg: 'oklch(0.5 0.18 25)' },
    medium: { bg: 'oklch(0.78 0.17 75 / 0.14)', fg: 'oklch(0.5 0.12 70)' },
    low: { bg: 'oklch(0.7 0.16 155 / 0.12)', fg: 'oklch(0.42 0.12 155)' },
  };
  const s = map[priority] ?? map.medium;
  return <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold capitalize" style={{ background: s.bg, color: s.fg }}>{priority}</span>;
}

// ── Panel + Avatar ───────────────────────────────────────────────────────────────

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.05] bg-white transition duration-300 hover:-translate-y-0.5" style={{ boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,.06))' }}>
      <div className="flex items-center justify-between border-b border-black/[0.05] px-5 py-4">
        <h2 className="text-[14px] font-semibold tracking-tight text-[#111827]">{title}</h2>
        {hint && <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6B7280]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Avatar({ name, accent }: { name: string; accent: Accent }) {
  const s = accentStyles[accent];
  const initials = name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
  return (
    <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10.5px] font-bold ring-1 ring-black/[0.04]" style={{ background: s.tile, color: s.iconColor }}>
      {initials}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [parents, setParents]   = useState<Parent[]>([]);
  const [tutors, setTutors]     = useState<Tutor[]>([]);
  const [fees, setFees]         = useState<FeeRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [comms, setComms]       = useState<CommunicationLog[]>([]);
  const [staff, setStaff]       = useState<StaffMember[]>([]);
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [reminders, setReminders] = useState<FeeReminder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes]   = useState<Income[]>([]);

  const loadAll = useCallback(async () => {
  const [p,t,f,a,co,s,tk,rm,ex,inc] = await Promise.all([
    getParents(), getTutors(), getFees(), getAssignments(),
    getComms(), getStaff(), getTasks(), getReminders(),
    getExpenses(), getIncomes(),
  ]);
  setParents(p); setTutors(t); setFees(f); setAssignments(a);
  setComms(co); setStaff(s); setTasks(tk); setReminders(rm);
  setExpenses(ex); setIncomes(inc);
  setLoading(false);
}, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const todayStr = today();
  const alertDate = in2Days();

  // ── Real computed values ──
  const newParents = parents.filter(p => p.status === 'new').length;
  const newTutors  = tutors.filter(t => t.status === 'new').length;
  const activeClasses = assignments.filter(a => a.status === 'active').length;

  const confirmed = fees.filter(f => f.paymentStatus !== 'pending');
  const totalFromParents  = confirmed.reduce((s,f) => s+(f.parentFee||0), 0);
  const totalToTutors     = confirmed.reduce((s,f) => s+(f.tutorFee||0), 0);
  const totalPaidToTutors = fees.filter(f=>f.paymentStatus==='paid').reduce((s,f)=>s+(f.tutorFee||0),0);
  const pendingFeesCount  = fees.filter(f => f.paymentStatus === 'pending').length;

  const totalExpenses = expenses.reduce((s,e) => s+(e.amount||0), 0);
  const totalIncome   = incomes.reduce((s,e) => s+(e.amount||0), 0);

// Net profit = (received from parents + extra income) - (tutor fees due + expenses)
const totalProfit = (totalFromParents + totalIncome) - (totalToTutors + totalExpenses);

  const pendingTasks = tasks.filter(t => t.status !== 'done').length;
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayStr).length;
  const activeStaff  = staff.filter(s => s.status === 'active').length;

  const pendingReminders = reminders.filter(r => r.status === 'pending');
  const overdueReminders = pendingReminders.filter(r => r.dueDate < todayStr);
  const dueSoonReminders = pendingReminders.filter(r => r.dueDate <= alertDate && r.dueDate >= todayStr);

  const conversionRate = parents.length ? Math.round((parents.filter(p=>p.status==='converted').length/parents.length)*100) : 0;

  // ── Real sparklines/deltas — only where we have genuine historical data ──
  const parentsSpark = buildDailySparkline(parents);
  const parentsDelta = weekDelta(parents);
  const tutorsSpark  = buildDailySparkline(tutors);
  const tutorsDelta  = weekDelta(tutors);

  // Net profit trend — real, grouped by fee.month field, chronological
  const monthlyRevenue = (() => {
    const map: Record<string, number> = {};
    fees.filter(f=>f.paymentStatus!=='pending').forEach(f => {
      if (!f.month) return;
      map[f.month] = (map[f.month]||0) + (f.profit||0);
    });
    const entries = Object.entries(map)
      .map(([month, val]) => ({ month, val, date: new Date(month) }))
      .filter(e => !isNaN(e.date.getTime()))
      .sort((a,b) => a.date.getTime() - b.date.getTime())
      .slice(-6);
    return entries.map(e => e.val);
  })();
  const profitDelta = (() => {
    if (monthlyRevenue.length < 2) return { delta: '', trend: 'flat' as const };
    const last = monthlyRevenue[monthlyRevenue.length-1];
    const prev = monthlyRevenue[monthlyRevenue.length-2];
    if (prev === 0) return { delta: '', trend: 'flat' as const };
    const pct = Math.round(((last-prev)/Math.abs(prev))*100);
    return { delta: `${pct>=0?'+':''}${pct}%`, trend: pct >= 0 ? ('up' as const) : ('down' as const) };
  })();

  type Stat = { label: string; value: string; sub: string; icon: LucideIcon; accent: Accent; delta?: string; trend?: 'up'|'down'|'flat'; spark?: number[] };

  const stats: Stat[] = [
    { label: 'Total Parents', value: String(parents.length), sub: `${newParents} new leads`, icon: Users, accent: 'blue',
      ...(parentsDelta.delta ? { delta: parentsDelta.delta, trend: parentsDelta.trend, spark: parentsSpark } : {}) },
    { label: 'Total Tutors', value: String(tutors.length), sub: `${newTutors} new leads`, icon: GraduationCap, accent: 'gold',
      ...(tutorsDelta.delta ? { delta: tutorsDelta.delta, trend: tutorsDelta.trend, spark: tutorsSpark } : {}) },
    { label: 'Active Classes', value: String(activeClasses), sub: 'running now', icon: ClipboardList, accent: 'green' },
    { label: 'Net Profit', value: currency(totalProfit), sub: 'all confirmed fees', icon: TrendingUp, accent: 'blue',
      ...(profitDelta.delta ? { delta: profitDelta.delta, trend: profitDelta.trend, spark: monthlyRevenue.length>=2 ? monthlyRevenue : undefined } : {}) },
    { label: 'Pending Fees', value: String(pendingFeesCount), sub: 'awaiting payment', icon: FileText, accent: 'gold' },
    { label: 'Fee Reminders', value: String(pendingReminders.length), sub: `${overdueReminders.length} overdue`, icon: Bell, accent: 'red' },
    
  ];

  const financeItems = [
  { label: 'Received', value: currency(totalFromParents), tone: 'green' as const, sub: 'from parents' },
  { label: 'Tutor Fee Due', value: currency(totalToTutors), tone: 'red' as const, sub: `Paid ${currency(totalPaidToTutors)}` },
  { label: 'Expenses', value: currency(totalExpenses), tone: 'red' as const, sub: `${expenses.length} entries` },
  { label: 'Income', value: currency(totalIncome), tone: 'green' as const, sub: `${incomes.length} entries` },
  { label: 'Net Profit', value: currency(totalProfit), tone: (totalProfit>=0?'green':'red') as 'green'|'red', sub: 'this cycle' },
];

  // Recent registrations — real, mixed parents+tutors sorted by date
  const recentActivity = [
    ...parents.map(p => ({ ...p, _type: 'Parent' as const })),
    ...tutors.map(t => ({ ...t, _type: 'Tutor' as const })),
  ].sort((a,b) => (b.createdAt?.seconds??0)-(a.createdAt?.seconds??0)).slice(0,6);

  const upcomingReminders = [...pendingReminders].sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,6);
  const upcomingTasks = [...tasks].sort((a,b) => (a.dueDate||'').localeCompare(b.dueDate||'')).slice(0,6);

  const badges: Record<string, number> = {
    '/parents': newParents,
    '/tutors': newTutors,
    '/communications': comms.filter(c=>c.followUpStatus==='pending').length,
    '/tasks': overdueTasks,
    '/reminders': overdueReminders.length + dueSoonReminders.length,
  };

  const warningBanners = [
    ...(overdueReminders.length > 0 ? [{ href: '/reminders', label: `${overdueReminders.length} fee reminder${overdueReminders.length>1?'s':''} overdue`, cta: 'View reminders' }] : []),
    ...(overdueTasks > 0 ? [{ href: '/tasks', label: `${overdueTasks} task${overdueTasks>1?'s':''} overdue`, cta: 'View tasks' }] : []),
  ];

  return (
    <AppShell title="Dashboard" onRefresh={loadAll} badges={badges}>

      {/* ================= Cinematic hero KPI band ================= */}
      <section
        className="relative overflow-hidden rounded-3xl p-6 md:p-8"
        style={{
          background: 'linear-gradient(135deg, oklch(0.15 0.03 265) 0%, oklch(0.11 0.03 265) 55%, oklch(0.14 0.04 260) 100%)',
          boxShadow: '0 30px 80px -30px oklch(0.14 0.03 265 / 0.45)',
        }}
      >
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl" style={{ background: 'oklch(0.58 0.19 258 / 0.35)' }} />
        <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-32 h-80 w-80 rounded-full blur-3xl" style={{ background: 'oklch(0.78 0.17 75 / 0.18)' }} />

        <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/60">
              This cycle
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <div className="text-[46px] font-bold leading-none tracking-tight text-white md:text-[58px]">
                {currency(totalProfit)}
              </div>
              {profitDelta.delta && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold" style={{
                  background: profitDelta.trend==='up' ? 'oklch(0.7 0.16 155 / 0.15)' : 'oklch(0.62 0.22 25 / 0.15)',
                  color: profitDelta.trend==='up' ? 'oklch(0.82 0.14 155)' : 'oklch(0.78 0.16 25)',
                  border: `1px solid ${profitDelta.trend==='up' ? 'oklch(0.7 0.16 155 / 0.35)' : 'oklch(0.62 0.22 25 / 0.35)'}`,
                }}>
                  {profitDelta.trend==='up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />} {profitDelta.delta}
                </span>
              )}
            </div>
            <p className="mt-2 text-[13px] text-white/55">Net Profit = (Received + Income) − (Tutor Fees Due + Expenses).</p>

            {totalFromParents + totalToTutors > 0 && (
              <div className="mt-6 max-w-md">
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/50">
                  <span>Collected {currency(totalFromParents)}</span>
                  <span className="text-white/70">Tutor fees due {currency(totalToTutors)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full" style={{
                    width: `${Math.min(100, Math.round((totalPaidToTutors/(totalToTutors||1))*100))}%`,
                    background: 'linear-gradient(90deg, oklch(0.58 0.19 258), oklch(0.78 0.17 75))',
                    boxShadow: '0 0 20px oklch(0.68 0.17 245 / 0.6)',
                  }} />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2">
            {financeItems.map(f => (
              <div key={f.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 backdrop-blur">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/40">{f.label}</div>
                <div className="mt-1 text-[16px] font-bold tracking-tight" style={{
                  color: f.tone==='green' ? 'oklch(0.82 0.14 155)' : f.tone==='red' ? 'oklch(0.78 0.16 25)' : 'oklch(0.97 0.01 260)',
                }}>{f.value}</div>
                <div className="mt-0.5 text-[10px] text-white/40">{f.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= Stat cards ================= */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(stat => {
          const s = accentStyles[stat.accent];
          const Icon = stat.icon;
          const TrendIcon = stat.trend === 'down' ? ArrowDownRight : ArrowUpRight;
          const trendColor = stat.trend==='down' ? 'oklch(0.55 0.2 25)' : 'oklch(0.5 0.14 155)';
          return (
            <div key={stat.label} className="group relative overflow-hidden rounded-2xl border border-black/[0.05] bg-white p-5 transition duration-300 hover:-translate-y-0.5" style={{ boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,.06))' }}>
              <div aria-hidden className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full blur-3xl opacity-60 transition-opacity duration-300 group-hover:opacity-100" style={{ background: s.glow }} />
              <div className="relative flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-black/[0.04]" style={{ background: s.tile }}>
                  <Icon className="h-5 w-5" style={{ color: s.iconColor }} />
                </div>
                {stat.delta && (
                  <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: 'oklch(0.97 0.005 260)', color: trendColor }}>
                    <TrendIcon className="h-2.5 w-2.5" />{stat.delta}
                  </span>
                )}
              </div>
              <div className="relative mt-5 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[28px] font-bold leading-none tracking-tight text-[#111827]">{stat.value}</div>
                  <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">{stat.label}</div>
                  <div className="mt-1 text-[11.5px] text-[#6B7280]/80">{stat.sub}</div>
                </div>
                {stat.spark && stat.spark.length > 1 && (
                  <div className="flex-none pb-1"><Sparkline data={stat.spark} stroke={s.stroke} fill={s.fill} /></div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= Warning banners ================= */}
      {warningBanners.length > 0 && (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {warningBanners.map(b => (
            <button key={b.href} onClick={() => router.push(b.href)}
              className="group relative flex items-center justify-between overflow-hidden rounded-xl border px-4 py-3.5 transition hover:-translate-y-0.5 text-left"
              style={{ background: 'linear-gradient(90deg, oklch(0.97 0.04 80) 0%, oklch(0.99 0.01 80) 100%)', borderColor: 'oklch(0.85 0.08 80)' }}>
              <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: 'linear-gradient(180deg, oklch(0.82 0.17 78), oklch(0.68 0.17 60))' }} />
              <div className="flex items-center gap-3 pl-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'oklch(0.9 0.1 80)' }}>
                  <AlertTriangle className="h-4 w-4" style={{ color: 'oklch(0.55 0.14 70)' }} />
                </div>
                <span className="text-[13px] font-semibold" style={{ color: 'oklch(0.32 0.06 70)' }}>{b.label}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold transition group-hover:gap-1.5" style={{ color: 'oklch(0.5 0.12 70)' }}>
                {b.cta} <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ================= Two-column tables ================= */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Recent Registrations" hint={`${recentActivity.length} shown`}>
          <div className="overflow-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[oklch(0.975_0.005_260)]">
                  {['Type','Name','Phone','Area','Status','Date'].map(h => (
                    <th key={h} className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentActivity.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-[#9CA3AF]">No registrations yet.</td></tr>
                )}
                {recentActivity.map((r, idx) => (
                  <tr key={idx} className="border-t border-black/[0.04] transition hover:bg-[oklch(0.98_0.01_260)]">
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{
                        background: r._type==='Parent' ? 'oklch(0.58 0.19 258 / 0.1)' : 'oklch(0.78 0.17 75 / 0.14)',
                        color: r._type==='Parent' ? 'oklch(0.45 0.14 258)' : 'oklch(0.5 0.12 70)',
                      }}>{r._type}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={displayName(r)} accent={r._type==='Parent' ? 'blue' : 'gold'} />
                        <span className="font-medium text-[#111827]">{displayName(r)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-[11.5px] text-[#6B7280]">{r.phone || '—'}</td>
                    <td className="px-5 py-3 text-[#6B7280]">{displayLocation(r)}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-3 text-[#6B7280]">{r.createdAt ? new Date(r.createdAt.seconds*1000).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Upcoming Fee Reminders" hint={`${overdueReminders.length} overdue`}>
          <div className="overflow-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[oklch(0.975_0.005_260)]">
                  {['Type','Contact','Amount','Due Date'].map(h => (
                    <th key={h} className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upcomingReminders.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-[#9CA3AF]">No pending reminders. 🎉</td></tr>
                )}
                {upcomingReminders.map(r => {
                  const isCollect = r.type === 'collect_from_parent';
                  const contact = isCollect ? r.parentName : r.tutorName;
                  const overdue = r.dueDate < todayStr;
                  return (
                    <tr key={r.id} className="border-t border-black/[0.04] transition hover:bg-[oklch(0.98_0.01_260)]">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{
                          background: isCollect ? 'oklch(0.7 0.16 155 / 0.12)' : 'oklch(0.62 0.22 25 / 0.1)',
                          color: isCollect ? 'oklch(0.42 0.12 155)' : 'oklch(0.5 0.18 25)',
                        }}>
                          {isCollect ? <ArrowDownRight className="h-2.5 w-2.5" /> : <ArrowUpRight className="h-2.5 w-2.5" />}
                          {isCollect ? 'Collect' : 'Pay'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={contact} accent={isCollect ? 'green' : 'red'} />
                          <span className="font-medium text-[#111827]">{contact}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-[13px] font-semibold text-[#111827]">{r.amount ? currency(r.amount) : '—'}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 font-medium" style={{ color: overdue ? 'oklch(0.55 0.2 25)' : 'oklch(0.5 0.03 260)' }}>
                          {overdue && <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'oklch(0.62 0.22 25)' }} />}
                          {r.dueDate}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* ================= Upcoming Tasks ================= */}
      <div className="mt-6">
        <Panel title="Upcoming Tasks" hint={`${pendingTasks} active`}>
          <div className="overflow-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[oklch(0.975_0.005_260)]">
                  {['Task','Due Date','Priority','Status'].map(h => (
                    <th key={h} className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upcomingTasks.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-[#9CA3AF]">No tasks yet. 🎉</td></tr>
                )}
                {upcomingTasks.map(t => (
                  <tr key={t.id} className="border-t border-black/[0.04] transition hover:bg-[oklch(0.98_0.01_260)]">
                    <td className="px-5 py-3.5 font-medium text-[#111827]">
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-[3px] rounded-full" style={{
                          background: t.priority==='high' ? 'oklch(0.62 0.22 25)' : t.priority==='medium' ? 'oklch(0.78 0.17 75)' : 'oklch(0.7 0.16 155)',
                        }} />
                        {t.title}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#6B7280]">{t.dueDate || '—'}</td>
                    <td className="px-5 py-3.5"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-5 py-3.5"><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {loading && <div className="mt-4 text-center text-sm text-[#9CA3AF]">Loading data…</div>}
    </AppShell>
  );
}