'use client';
// src/app/revenue/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AppShell from '@/components/AppShell';
import {
  Card, CardHeader, FilterRow, FilterBtn, TableWrap, Empty,
  BtnSecondary, currency,
} from '@/components/UI';
import { useAuth, canAccess } from '@/context/AuthContext';
import {
  getFees, getExpenses, getIncomes,
  FeeRecord, Expense, Income,
} from '@/lib/firestore';
import {
  Wallet, TrendingUp, TrendingDown, AlertCircle, GraduationCap,
  Download, ArrowUpRight, ArrowDownRight, Info, Calendar, CalendarDays, Search, ChevronDown, ChevronRight,
} from 'lucide-react';

const inr = currency;

// ── Helpers ──────────────────────────────────────────────────────────────────

function yearOfLabel(label: string): string {
  const m = (label || '').match(/\d{4}/);
  return m ? m[0] : '';
}
function dateToYear(dateStr: string): string {
  return (dateStr || '').slice(0, 4);
}
function dateToMonthLabel(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m] = dateStr.split('-');
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const idx = Number(m) - 1;
  return names[idx] ? `${names[idx]} ${y}` : '';
}
const currentMonthLabel = () => {
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  return `${names[now.getMonth()]} ${now.getFullYear()}`;
};
const currentYear = () => String(new Date().getFullYear());

function monthsOfYear(year: string): string[] {
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return names.map(n => `${n} ${year}`);
}

// ── Generic sort helpers ─────────────────────────────────────────────────────

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

function sortRows<T extends Record<string, any>>(rows: T[], sort: SortState): T[] {
  if (!sort) return rows;
  const { key, dir } = sort;
  return [...rows].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (typeof av === 'number' && typeof bv === 'number') return dir === 'asc' ? av - bv : bv - av;
    return dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });
}

function SortTh({ label, sortKey, sort, setSort }: { label: string; sortKey: string; sort: SortState; setSort: (s: SortState | ((prev: SortState) => SortState)) => void }) {
  const active = sort?.key === sortKey;
  return (
    <th
      onClick={() => setSort(prev => (prev?.key === sortKey ? { key: sortKey, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: sortKey, dir: 'asc' }))}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {label} <span style={{ opacity: active ? 1 : 0.25, fontSize: 10 }}>{active ? (sort!.dir === 'asc' ? '▲' : '▼') : '▲'}</span>
    </th>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: 'relative', maxWidth: 260 }}>
      <Search className="h-3.5 w-3.5" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '7px 10px 7px 30px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 12.5 }}
      />
    </div>
  );
}

// ── Shimmer keyframes (injected once) ───────────────────────────────────────

function ShimmerStyle() {
  return <style>{`@keyframes revShimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }`}</style>;
}
function Skeleton({ height = 16, width = '100%', radius = 6 }: { height?: number | string; width?: string; radius?: number }) {
  return (
    <div style={{
      height, width, borderRadius: radius,
      background: 'linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%)',
      backgroundSize: '400% 100%', animation: 'revShimmer 1.4s ease infinite',
    }} />
  );
}
function KpiCardSkeleton() {
  return (
    <div className="rounded-2xl border border-black/[0.05] bg-white p-5 shadow-sm">
      <Skeleton height={40} width="40px" radius={12} />
      <div style={{ marginTop: 14 }}><Skeleton height={22} width="70%" /></div>
      <div style={{ marginTop: 8 }}><Skeleton height={10} width="50%" /></div>
    </div>
  );
}
function TableSkeleton({ rows = 4, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ padding: '14px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: 14 }}>
          {Array.from({ length: cols }).map((__, c) => <Skeleton key={c} height={14} width={c === 0 ? '18%' : '12%'} />)}
        </div>
      ))}
    </div>
  );
}

// ── CSS bar chart — clickable bars (drill into month/year), hover tooltip ──

function BarChart({ labels, series, selectedLabel, onBarClick }: {
  labels: string[]; series: { name: string; color: string; values: number[] }[];
  selectedLabel?: string; onBarClick?: (label: string) => void;
}) {
  const [hover, setHover] = useState<{ label: string; name: string; value: number; x: number; y: number } | null>(null);
  const maxV = Math.max(1, ...series.flatMap(s => s.values));

  return (
    <div style={{ position: 'relative' }}>
      {hover && (
        <div style={{
          position: 'absolute', left: hover.x, top: hover.y, transform: 'translate(-50%, -110%)',
          background: '#111827', color: '#fff', padding: '6px 10px', borderRadius: 8,
          fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 20,
          boxShadow: '0 8px 20px rgba(0,0,0,.25)',
        }}>
          <div style={{ opacity: .7, fontSize: 10, fontWeight: 500 }}>{hover.label}</div>
          <div>{hover.name}: {inr(hover.value)}</div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 180, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
        {labels.map((label, i) => {
          const isSelected = selectedLabel === label;
          return (
            <div
              key={label}
              onClick={() => onBarClick?.(label)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                cursor: onBarClick ? 'pointer' : 'default',
                background: isSelected ? 'oklch(0.68 0.17 245 / 0.08)' : 'transparent',
                borderRadius: 8, padding: '4px 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, width: '100%', justifyContent: 'center' }}>
                {series.map(s => {
                  const v = s.values[i] || 0;
                  const pct = Math.max(v > 0 ? 2 : 0, (v / maxV) * 100);
                  return (
                    <div
                      key={s.name}
                      onMouseEnter={(e) => {
                        const rect = (e.target as HTMLDivElement).getBoundingClientRect();
                        const parentRect = (e.currentTarget.closest('[data-chart-root]') as HTMLDivElement)?.getBoundingClientRect();
                        setHover({
                          label, name: s.name, value: v,
                          x: rect.left - (parentRect?.left || 0) + rect.width / 2,
                          y: rect.top - (parentRect?.top || 0),
                        });
                      }}
                      onMouseLeave={() => setHover(null)}
                      style={{ width: 8, height: `${pct}%`, background: s.color, borderRadius: '3px 3px 0 0', transition: 'height .3s' }}
                    />
                  );
                })}
              </div>
              <span style={{ fontSize: 9.5, fontWeight: isSelected ? 700 : 400, color: isSelected ? 'oklch(0.5 0.18 258)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label.split(' ')[0].slice(0,3)}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11.5 }}>
        {series.map(s => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />{s.name}
          </div>
        ))}
      </div>
      {onBarClick && <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-muted)' }}>💡 Click a bar to jump to that period</div>}
    </div>
  );
}

function BarChartRoot(props: React.ComponentProps<typeof BarChart>) {
  return <div data-chart-root style={{ position: 'relative' }}><BarChart {...props} /></div>;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, accent, sub, delta, onClick }: { label: string; value: string; icon: any; accent: string; sub?: string; delta?: { pct: number }; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl border border-black/[0.05] bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
      style={{ cursor: onClick ? 'pointer' : 'default', boxShadow: onClick ? undefined : undefined }}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: accent + '20', color: accent }}>
          <Icon className="h-5 w-5" />
        </div>
        {delta && (
          <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ color: delta.pct >= 0 ? '#166534' : '#9f1239', background: delta.pct >= 0 ? '#f0fdf4' : '#fff1f2' }}>
            {delta.pct >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
            {Math.abs(delta.pct)}%
          </span>
        )}
      </div>
      <div className="mt-3 text-[22px] font-bold tracking-tight text-[#111827]">{value}</div>
      <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[#6B7280]/80">{sub}</div>}
      {onClick && <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 9.5, color: 'var(--text-muted)' }}>view →</div>}
    </div>
  );
}

// ── CSV export ───────────────────────────────────────────────────────────────

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type OutstandingFilter = 'all' | 'pending' | 'received' | 'paid';
type ViewMode = 'month' | 'year';

export default function RevenuePage() {
  const { role, loading: authLoading } = useAuth();

  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState<string>(currentMonthLabel());
  const [outstandingFilter, setOutstandingFilter] = useState<OutstandingFilter>('all');

  const [monthlySort, setMonthlySort] = useState<SortState>(null);
  const [yearlySort, setYearlySort] = useState<SortState>(null);
  const [studentSort, setStudentSort] = useState<SortState>(null);
  const [tutorSort, setTutorSort] = useState<SortState>(null);
  const [outstandingSort, setOutstandingSort] = useState<SortState>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [tutorSearch, setTutorSearch] = useState('');
  const [outstandingSearch, setOutstandingSearch] = useState('');

  // Expandable row state
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [expandedTutor, setExpandedTutor] = useState<string | null>(null);

  const outstandingRef = useRef<HTMLDivElement>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [f, ex, inc] = await Promise.all([getFees(), getExpenses(), getIncomes()]);
    setFees(f); setExpenses(ex); setIncomes(inc);
    setLoading(false);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  if (!authLoading && !canAccess(role, '/revenue')) {
    return (
      <AppShell title="Revenue & Profit Dashboard">
        <div className="rounded-2xl border border-black/[0.05] bg-white p-10 text-center">
          <p className="text-[14px] font-semibold text-[#111827]">Not authorized</p>
          <p className="mt-1 text-[12.5px] text-[#6B7280]">This section is restricted to Owner/Admin accounts.</p>
        </div>
      </AppShell>
    );
  }

  const allYears = useMemo(() => {
    const ys = new Set<string>();
    fees.forEach(f => { const y = yearOfLabel(f.month); if (y) ys.add(y); });
    expenses.forEach(e => { const y = dateToYear(e.date); if (y) ys.add(y); });
    incomes.forEach(i => { const y = dateToYear(i.date); if (y) ys.add(y); });
    ys.add(currentYear());
    return Array.from(ys).sort((a, b) => Number(b) - Number(a));
  }, [fees, expenses, incomes]);

  const scopedFees = useMemo(() => {
    if (viewMode === 'year') return fees.filter(f => yearOfLabel(f.month) === year);
    return fees.filter(f => f.month === month);
  }, [fees, viewMode, year, month]);

  const scopedExpenseTotal = useMemo(() => expenses.filter(e => {
    if (viewMode === 'year') return dateToYear(e.date) === year;
    return dateToMonthLabel(e.date) === month;
  }).reduce((s, e) => s + (e.amount || 0), 0), [expenses, viewMode, year, month]);

  const scopedIncomeTotal = useMemo(() => incomes.filter(i => {
    if (viewMode === 'year') return dateToYear(i.date) === year;
    return dateToMonthLabel(i.date) === month;
  }).reduce((s, i) => s + (i.amount || 0), 0), [incomes, viewMode, year, month]);

  const revenue = scopedFees.reduce((s, f) => s + (f.parentFee || 0), 0);
  const collected = scopedFees.filter(f => f.paymentStatus !== 'pending').reduce((s, f) => s + (f.parentFee || 0), 0);
  const outstanding = revenue - collected;
  const tutorCost = scopedFees.reduce((s, f) => s + (f.tutorFee || 0), 0);
  const tutorPaid = scopedFees.filter(f => f.paymentStatus === 'paid').reduce((s, f) => s + (f.tutorFee || 0), 0);
  const grossProfit = collected - tutorCost;
  const netProfit = (grossProfit + scopedIncomeTotal) - scopedExpenseTotal;
  const margin = collected > 0 ? Math.round((netProfit / collected) * 1000) / 10 : 0;

  const prevRevenue = useMemo(() => {
    if (viewMode === 'year') {
      const prevYear = String(Number(year) - 1);
      return fees.filter(f => yearOfLabel(f.month) === prevYear).reduce((s, f) => s + (f.parentFee || 0), 0);
    }
    const idx = monthsOfYear(year).indexOf(month);
    if (idx <= 0) return 0;
    const prevLabel = monthsOfYear(year)[idx - 1];
    return fees.filter(f => f.month === prevLabel).reduce((s, f) => s + (f.parentFee || 0), 0);
  }, [fees, viewMode, year, month]);
  const revenueDelta = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : undefined;

  const yearMonths = useMemo(() => monthsOfYear(year), [year]);
  const monthlyChartSeries = useMemo(() => {
    const rev: number[] = [], coll: number[] = [], profit: number[] = [];
    yearMonths.forEach(m => {
      const mf = fees.filter(f => f.month === m);
      const mExp = expenses.filter(e => dateToMonthLabel(e.date) === m).reduce((s, e) => s + (e.amount || 0), 0);
      const mInc = incomes.filter(i => dateToMonthLabel(i.date) === m).reduce((s, i) => s + (i.amount || 0), 0);
      const r = mf.reduce((s, f) => s + (f.parentFee || 0), 0);
      const c = mf.filter(f => f.paymentStatus !== 'pending').reduce((s, f) => s + (f.parentFee || 0), 0);
      const t = mf.reduce((s, f) => s + (f.tutorFee || 0), 0);
      rev.push(r); coll.push(c); profit.push((c - t) + mInc - mExp);
    });
    return [
      { name: 'Revenue', color: 'oklch(0.68 0.17 245)', values: rev },
      { name: 'Collected', color: 'oklch(0.7 0.16 155)', values: coll },
      { name: 'Net Profit', color: 'oklch(0.78 0.17 75)', values: profit },
    ];
  }, [fees, expenses, incomes, yearMonths]);

  const yearlyChartSeries = useMemo(() => {
    const years = allYears.slice().sort((a, b) => Number(a) - Number(b));
    const rev: number[] = [], coll: number[] = [], profit: number[] = [];
    years.forEach(y => {
      const yf = fees.filter(f => yearOfLabel(f.month) === y);
      const yExp = expenses.filter(e => dateToYear(e.date) === y).reduce((s, e) => s + (e.amount || 0), 0);
      const yInc = incomes.filter(i => dateToYear(i.date) === y).reduce((s, i) => s + (i.amount || 0), 0);
      const r = yf.reduce((s, f) => s + (f.parentFee || 0), 0);
      const c = yf.filter(f => f.paymentStatus !== 'pending').reduce((s, f) => s + (f.parentFee || 0), 0);
      const t = yf.reduce((s, f) => s + (f.tutorFee || 0), 0);
      rev.push(r); coll.push(c); profit.push((c - t) + yInc - yExp);
    });
    return { labels: years, series: [
      { name: 'Revenue', color: 'oklch(0.68 0.17 245)', values: rev },
      { name: 'Collected', color: 'oklch(0.7 0.16 155)', values: coll },
      { name: 'Net Profit', color: 'oklch(0.78 0.17 75)', values: profit },
    ]};
  }, [fees, expenses, incomes, allYears]);

  const monthlyTableRaw = useMemo(() => yearMonths.map(m => {
    const mf = fees.filter(f => f.month === m);
    const mExp = expenses.filter(e => dateToMonthLabel(e.date) === m).reduce((s, e) => s + (e.amount || 0), 0);
    const mInc = incomes.filter(i => dateToMonthLabel(i.date) === m).reduce((s, i) => s + (i.amount || 0), 0);
    const r = mf.reduce((s, f) => s + (f.parentFee || 0), 0);
    const c = mf.filter(f => f.paymentStatus !== 'pending').reduce((s, f) => s + (f.parentFee || 0), 0);
    const t = mf.reduce((s, f) => s + (f.tutorFee || 0), 0);
    const gp = c - t;
    const np = gp + mInc - mExp;
    return { month: m, revenue: r, collected: c, outstanding: r - c, tutorCost: t, expenses: mExp, grossProfit: gp, netProfit: np, margin: c > 0 ? Math.round((np / c) * 1000) / 10 : 0, hasData: mf.length > 0 || mExp > 0 || mInc > 0 };
  }).filter(row => row.hasData), [fees, expenses, incomes, yearMonths]);
  const monthlyTable = useMemo(() => sortRows(monthlyTableRaw, monthlySort), [monthlyTableRaw, monthlySort]);

  const yearlyTableRaw = useMemo(() => {
    return allYears.slice().sort((a, b) => Number(b) - Number(a)).map(y => {
      const yf = fees.filter(f => yearOfLabel(f.month) === y);
      const yExp = expenses.filter(e => dateToYear(e.date) === y).reduce((s, e) => s + (e.amount || 0), 0);
      const yInc = incomes.filter(i => dateToYear(i.date) === y).reduce((s, i) => s + (i.amount || 0), 0);
      const r = yf.reduce((s, f) => s + (f.parentFee || 0), 0);
      const c = yf.filter(f => f.paymentStatus !== 'pending').reduce((s, f) => s + (f.parentFee || 0), 0);
      const t = yf.reduce((s, f) => s + (f.tutorFee || 0), 0);
      const gp = c - t;
      const np = gp + yInc - yExp;
      return { year: y, revenue: r, collected: c, outstanding: r - c, tutorCost: t, expenses: yExp, grossProfit: gp, netProfit: np, margin: c > 0 ? Math.round((np / c) * 1000) / 10 : 0, hasData: yf.length > 0 || yExp > 0 || yInc > 0 };
    }).filter(row => row.hasData);
  }, [fees, expenses, incomes, allYears]);
  const yearlyTable = useMemo(() => sortRows(yearlyTableRaw, yearlySort), [yearlyTableRaw, yearlySort]);

  const studentProfitabilityRaw = useMemo(() => {
    const map: Record<string, { parent: string; subject: string; parentFee: number; tutorFee: number; status: string }> = {};
    scopedFees.forEach(f => {
      const key = f.parentName;
      if (!map[key]) map[key] = { parent: f.parentName, subject: f.subject, parentFee: 0, tutorFee: 0, status: f.paymentStatus };
      map[key].parentFee += f.parentFee || 0;
      map[key].tutorFee += f.tutorFee || 0;
      map[key].status = f.paymentStatus;
    });
    return Object.values(map).map(s => ({ ...s, profit: s.parentFee - s.tutorFee, margin: s.parentFee > 0 ? Math.round(((s.parentFee - s.tutorFee) / s.parentFee) * 1000) / 10 : 0 }));
  }, [scopedFees]);
  const studentProfitability = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const filtered = q ? studentProfitabilityRaw.filter(s => s.parent.toLowerCase().includes(q) || s.subject.toLowerCase().includes(q)) : studentProfitabilityRaw;
    return sortRows(filtered, studentSort ?? { key: 'profit', dir: 'desc' });
  }, [studentProfitabilityRaw, studentSearch, studentSort]);

  const tutorProfitabilityRaw = useMemo(() => {
    const map: Record<string, { tutor: string; students: Set<string>; revenue: number; payout: number }> = {};
    scopedFees.forEach(f => {
      const key = f.tutorName;
      if (!map[key]) map[key] = { tutor: f.tutorName, students: new Set(), revenue: 0, payout: 0 };
      map[key].students.add(f.parentName);
      map[key].revenue += f.parentFee || 0;
      map[key].payout += f.tutorFee || 0;
    });
    return Object.values(map).map(t => ({ tutor: t.tutor, students: t.students.size, revenue: t.revenue, payout: t.payout, profit: t.revenue - t.payout, margin: t.revenue > 0 ? Math.round(((t.revenue - t.payout) / t.revenue) * 1000) / 10 : 0 }));
  }, [scopedFees]);
  const tutorProfitability = useMemo(() => {
    const q = tutorSearch.trim().toLowerCase();
    const filtered = q ? tutorProfitabilityRaw.filter(t => t.tutor.toLowerCase().includes(q)) : tutorProfitabilityRaw;
    return sortRows(filtered, tutorSort ?? { key: 'profit', dir: 'desc' });
  }, [tutorProfitabilityRaw, tutorSearch, tutorSort]);

  const outstandingRowsRaw = useMemo(() => scopedFees.filter(f => outstandingFilter === 'all' || f.paymentStatus === outstandingFilter), [scopedFees, outstandingFilter]);
  const outstandingRows = useMemo(() => {
    const q = outstandingSearch.trim().toLowerCase();
    const filtered = q ? outstandingRowsRaw.filter(f => f.parentName.toLowerCase().includes(q) || f.tutorName.toLowerCase().includes(q) || f.subject.toLowerCase().includes(q)) : outstandingRowsRaw;
    return sortRows(filtered as any, outstandingSort) as FeeRecord[];
  }, [outstandingRowsRaw, outstandingSearch, outstandingSort]);

  function exportTable() {
    if (viewMode === 'year') {
      downloadCsv(`revenue-yearly.csv`, [
        ['Year', 'Revenue', 'Collected', 'Outstanding', 'Tutor Cost', 'Expenses', 'Gross Profit', 'Net Profit', 'Margin %'],
        ...yearlyTable.map(r => [r.year, r.revenue, r.collected, r.outstanding, r.tutorCost, r.expenses, r.grossProfit, r.netProfit, r.margin]),
      ]);
    } else {
      downloadCsv(`revenue-${year}.csv`, [
        ['Month', 'Revenue', 'Collected', 'Outstanding', 'Tutor Cost', 'Expenses', 'Gross Profit', 'Net Profit', 'Margin %'],
        ...monthlyTable.map(r => [r.month, r.revenue, r.collected, r.outstanding, r.tutorCost, r.expenses, r.grossProfit, r.netProfit, r.margin]),
      ]);
    }
  }
  function exportOutstanding() {
    downloadCsv(`outstanding-${viewMode === 'year' ? year : month}.csv`, [
      ['Parent', 'Tutor', 'Subject', 'Tuition Month', 'Amount Due', 'Status'],
      ...outstandingRows.map(f => [f.parentName, f.tutorName, f.subject, f.month, f.parentFee, f.paymentStatus]),
    ]);
  }

  // Interactive handlers
  function handleBarClick(label: string) {
    if (viewMode === 'year') { setYear(label); setViewMode('month'); }
    else setMonth(label);
  }
  function jumpToOutstanding() {
    setOutstandingFilter('pending');
    outstandingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const scopeLabel = viewMode === 'year' ? year : month;

  return (
    <AppShell title="Revenue & Profit Dashboard" onRefresh={loadAll}>
      <ShimmerStyle />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.05] bg-white p-3 shadow-sm">
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>View:</span>
        <div className="inline-flex items-center gap-1 rounded-xl border border-black/[0.06] bg-white p-1">
          <FilterBtn active={viewMode==='month'} onClick={() => setViewMode('month')}>
            <Calendar className="h-3 w-3" style={{ display: 'inline', marginRight: 5, verticalAlign: -2 }} />Monthly
          </FilterBtn>
          <FilterBtn active={viewMode==='year'} onClick={() => setViewMode('year')}>
            <CalendarDays className="h-3 w-3" style={{ display: 'inline', marginRight: 5, verticalAlign: -2 }} />Yearly
          </FilterBtn>
        </div>
        <select value={year} onChange={e => setYear(e.target.value)} className="rounded-lg border border-black/[0.08] px-3 py-2 text-[13px]">
          {allYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {viewMode === 'month' && (
          <select value={month} onChange={e => setMonth(e.target.value)} className="rounded-lg border border-black/[0.08] px-3 py-2 text-[13px]">
            {monthsOfYear(year).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-[oklch(0.97_0.01_260)] px-3 py-1.5 text-[11px] text-[#6B7280]">
          <Info className="h-3 w-3" />
          Accrual-based (tuition month), not payment-date based.
        </div>
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <KpiCard label="Total Revenue" value={inr(revenue)} icon={Wallet} accent="oklch(0.58 0.19 258)" sub={`${scopedFees.length} fee records — ${scopeLabel}`} delta={revenueDelta !== undefined ? { pct: revenueDelta } : undefined} />
          <KpiCard label="Collected" value={inr(collected)} icon={ArrowDownRight} accent="oklch(0.7 0.16 155)" sub="from parents" />
          <KpiCard label="Outstanding" value={inr(outstanding)} icon={AlertCircle} accent="oklch(0.62 0.22 25)" sub="click to view details" onClick={jumpToOutstanding} />
          <KpiCard label="Tutor Cost" value={inr(tutorCost)} icon={GraduationCap} accent="oklch(0.78 0.17 75)" sub={`${inr(tutorPaid)} already paid`} />
          <KpiCard label="Other Expenses" value={inr(scopedExpenseTotal)} icon={TrendingDown} accent="oklch(0.6 0.18 25)" sub={scopeLabel} />
          <KpiCard label="Gross Profit" value={inr(grossProfit)} icon={TrendingUp} accent="oklch(0.5 0.16 155)" sub="collected − tutor cost" />
          <KpiCard label="Net Profit" value={inr(netProfit)} icon={TrendingUp} accent={netProfit >= 0 ? 'oklch(0.5 0.16 155)' : 'oklch(0.62 0.22 25)'} sub="gross profit + income − expenses" />
          <KpiCard label="Profit Margin" value={`${margin}%`} icon={TrendingUp} accent="oklch(0.58 0.19 258)" sub="net profit / collected" />
        </div>
      )}

      {/* Chart */}
      <Card pad>
        <CardHeader title={viewMode==='year' ? '📊 Year-over-Year Performance' : `📈 Monthly Revenue & Profit — ${year}`}>
          <BtnSecondary onClick={exportTable}><Download className="h-3.5 w-3.5" style={{ display: 'inline', marginRight: 4 }} />Export</BtnSecondary>
        </CardHeader>
        {loading ? <TableSkeleton rows={1} cols={12} /> : viewMode === 'year' ? (
          yearlyChartSeries.labels.length === 0 ? <Empty colSpan={1} text="No financial data available yet." /> :
          <div style={{ paddingTop: 12 }}><BarChartRoot labels={yearlyChartSeries.labels} series={yearlyChartSeries.series} selectedLabel={year} onBarClick={handleBarClick} /></div>
        ) : (
          monthlyTableRaw.length === 0 ? <Empty colSpan={1} text="No financial data available for this period." /> :
          <div style={{ paddingTop: 12 }}><BarChartRoot labels={yearMonths} series={monthlyChartSeries} selectedLabel={month} onBarClick={handleBarClick} /></div>
        )}
      </Card>

      {/* Collection vs Outstanding + Profit Breakdown */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card pad>
          <CardHeader title={`💰 Collection vs Outstanding — ${scopeLabel}`} />
          <div style={{ paddingTop: 12 }}>
            {loading ? <TableSkeleton rows={2} cols={2} /> : revenue === 0 ? <Empty colSpan={1} text="No financial data available for this period." /> : (<>
              <div className="flex justify-between text-[13px] font-semibold"><span>Total Revenue</span><span>{inr(revenue)}</span></div>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#fff1f2]">
                <div className="h-full rounded-full bg-[oklch(0.7_0.16_155)]" style={{ width: `${revenue > 0 ? (collected / revenue) * 100 : 0}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[12px] text-[#6B7280]">
                <span>Collected <strong className="text-[#166534]">{inr(collected)}</strong></span>
                <button onClick={jumpToOutstanding} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>Outstanding <strong className="text-[#9f1239]">{inr(outstanding)}</strong></button>
              </div>
            </>)}
          </div>
        </Card>

        <Card pad>
          <CardHeader title={`🧮 Profit Breakdown — ${scopeLabel}`} />
          <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5 }}>
            {loading ? <TableSkeleton rows={5} cols={2} /> : (<>
              <div className="flex justify-between"><span>Collected Revenue</span><strong>{inr(collected)}</strong></div>
              <div className="flex justify-between text-[#9f1239]"><span>− Tutor Payout</span><strong>{inr(tutorCost)}</strong></div>
              <div className="flex justify-between border-t border-black/[0.08] pt-1.5 font-bold"><span>= Gross Profit</span><span>{inr(grossProfit)}</span></div>
              <div className="flex justify-between pt-2 text-[#166534]"><span>+ Extra Income</span><strong>{inr(scopedIncomeTotal)}</strong></div>
              <div className="flex justify-between text-[#9f1239]"><span>− Other Expenses</span><strong>{inr(scopedExpenseTotal)}</strong></div>
              <div className="flex justify-between border-t border-black/[0.08] pt-1.5 font-bold" style={{ color: netProfit >= 0 ? '#166534' : '#9f1239' }}><span>= Net Profit</span><span>{inr(netProfit)}</span></div>
              <div className="flex justify-between pt-1 text-[11.5px] text-[#6B7280]"><span>Profit Margin</span><span>{margin}%</span></div>
            </>)}
          </div>
        </Card>
      </div>

      {/* Financial table */}
      <Card>
        <CardHeader title={viewMode==='year' ? '📅 Yearly Financial Table' : `📅 Monthly Financial Table — ${year}`} />
        <TableWrap>
          {loading ? <TableSkeleton rows={5} cols={9} /> : viewMode === 'year' ? (
            <table>
              <thead><tr>
                <SortTh label="Year" sortKey="year" sort={yearlySort} setSort={setYearlySort} />
                <SortTh label="Revenue" sortKey="revenue" sort={yearlySort} setSort={setYearlySort} />
                <SortTh label="Collected" sortKey="collected" sort={yearlySort} setSort={setYearlySort} />
                <SortTh label="Outstanding" sortKey="outstanding" sort={yearlySort} setSort={setYearlySort} />
                <SortTh label="Tutor Cost" sortKey="tutorCost" sort={yearlySort} setSort={setYearlySort} />
                <SortTh label="Expenses" sortKey="expenses" sort={yearlySort} setSort={setYearlySort} />
                <SortTh label="Gross Profit" sortKey="grossProfit" sort={yearlySort} setSort={setYearlySort} />
                <SortTh label="Net Profit" sortKey="netProfit" sort={yearlySort} setSort={setYearlySort} />
                <SortTh label="Margin" sortKey="margin" sort={yearlySort} setSort={setYearlySort} />
              </tr></thead>
              <tbody>
                {yearlyTable.length === 0 && <Empty colSpan={9} text="No financial data available yet." />}
                {yearlyTable.map(r => (
                  <tr key={r.year} onClick={() => { setYear(r.year); setViewMode('month'); }} style={{ background: r.netProfit < 0 ? '#fff1f2' : undefined, cursor: 'pointer' }}>
                    <td style={{ fontWeight: 700 }}>{r.year}</td><td>{inr(r.revenue)}</td><td>{inr(r.collected)}</td><td>{inr(r.outstanding)}</td>
                    <td>{inr(r.tutorCost)}</td><td>{inr(r.expenses)}</td><td>{inr(r.grossProfit)}</td>
                    <td style={{ fontWeight: 700, color: r.netProfit >= 0 ? '#166534' : '#9f1239' }}>{inr(r.netProfit)}</td>
                    <td>{r.margin}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead><tr>
                <SortTh label="Month" sortKey="month" sort={monthlySort} setSort={setMonthlySort} />
                <SortTh label="Revenue" sortKey="revenue" sort={monthlySort} setSort={setMonthlySort} />
                <SortTh label="Collected" sortKey="collected" sort={monthlySort} setSort={setMonthlySort} />
                <SortTh label="Outstanding" sortKey="outstanding" sort={monthlySort} setSort={setMonthlySort} />
                <SortTh label="Tutor Cost" sortKey="tutorCost" sort={monthlySort} setSort={setMonthlySort} />
                <SortTh label="Expenses" sortKey="expenses" sort={monthlySort} setSort={setMonthlySort} />
                <SortTh label="Gross Profit" sortKey="grossProfit" sort={monthlySort} setSort={setMonthlySort} />
                <SortTh label="Net Profit" sortKey="netProfit" sort={monthlySort} setSort={setMonthlySort} />
                <SortTh label="Margin" sortKey="margin" sort={monthlySort} setSort={setMonthlySort} />
              </tr></thead>
              <tbody>
                {monthlyTable.length === 0 && <Empty colSpan={9} text="No financial data available for this period." />}
                {monthlyTable.map(r => (
                  <tr key={r.month} onClick={() => setMonth(r.month)} style={{ background: r.netProfit < 0 ? '#fff1f2' : undefined, cursor: 'pointer' }}>
                    <td>{r.month}</td><td>{inr(r.revenue)}</td><td>{inr(r.collected)}</td><td>{inr(r.outstanding)}</td>
                    <td>{inr(r.tutorCost)}</td><td>{inr(r.expenses)}</td><td>{inr(r.grossProfit)}</td>
                    <td style={{ fontWeight: 700, color: r.netProfit >= 0 ? '#166534' : '#9f1239' }}>{inr(r.netProfit)}</td>
                    <td>{r.margin}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableWrap>
      </Card>

      {/* Student profitability — click a row to expand its fee records */}
      <Card>
        <CardHeader title={`🎓 Student Profitability — ${scopeLabel}`}>
          <SearchBox value={studentSearch} onChange={setStudentSearch} placeholder="Search parent or subject…" />
        </CardHeader>
        <TableWrap>
          {loading ? <TableSkeleton rows={4} cols={7} /> : (
            <table>
              <thead><tr>
                <th style={{ width: 20 }}></th>
                <SortTh label="Parent/Student" sortKey="parent" sort={studentSort} setSort={setStudentSort} />
                <SortTh label="Subject" sortKey="subject" sort={studentSort} setSort={setStudentSort} />
                <SortTh label="Fee" sortKey="parentFee" sort={studentSort} setSort={setStudentSort} />
                <SortTh label="Tutor Cost" sortKey="tutorFee" sort={studentSort} setSort={setStudentSort} />
                <SortTh label="Gross Profit" sortKey="profit" sort={studentSort} setSort={setStudentSort} />
                <SortTh label="Margin" sortKey="margin" sort={studentSort} setSort={setStudentSort} />
                <th>Status</th>
              </tr></thead>
              <tbody>
                {studentProfitability.length === 0 && <Empty colSpan={8} text="No financial data available for this period." />}
                {studentProfitability.map(s => {
                  const isOpen = expandedStudent === s.parent;
                  const records = scopedFees.filter(f => f.parentName === s.parent);
                  return (
                    <>
                      <tr key={s.parent} onClick={() => setExpandedStudent(isOpen ? null : s.parent)} style={{ cursor: 'pointer' }}>
                        <td>{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />}</td>
                        <td>{s.parent}</td><td>{s.subject}</td><td>{inr(s.parentFee)}</td><td>{inr(s.tutorFee)}</td>
                        <td style={{ fontWeight: 700 }}>{inr(s.profit)}</td><td>{s.margin}%</td>
                        <td><span style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color: s.status === 'pending' ? '#9f1239' : '#166534' }}>{s.status}</span></td>
                      </tr>
                      {isOpen && (
                        <tr key={s.parent + '-detail'}>
                          <td colSpan={8} style={{ background: '#fafbfc', padding: '10px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {records.map(r => (
                                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px dashed var(--border)' }}>
                                  <span>{r.tutorName} · {r.subject} ({r.classLevel})</span>
                                  <span>{inr(r.parentFee)} <span style={{ color: 'var(--text-muted)' }}>({r.paymentStatus})</span></span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </TableWrap>
      </Card>

      {/* Tutor profitability — click a row to expand its fee records */}
      <Card>
        <CardHeader title={`👥 Tutor Profitability — ${scopeLabel}`}>
          <SearchBox value={tutorSearch} onChange={setTutorSearch} placeholder="Search tutor…" />
        </CardHeader>
        <TableWrap>
          {loading ? <TableSkeleton rows={4} cols={6} /> : (
            <table>
              <thead><tr>
                <th style={{ width: 20 }}></th>
                <SortTh label="Tutor" sortKey="tutor" sort={tutorSort} setSort={setTutorSort} />
                <SortTh label="Students" sortKey="students" sort={tutorSort} setSort={setTutorSort} />
                <SortTh label="Revenue Generated" sortKey="revenue" sort={tutorSort} setSort={setTutorSort} />
                <SortTh label="Tutor Payout" sortKey="payout" sort={tutorSort} setSort={setTutorSort} />
                <SortTh label="Gross Profit" sortKey="profit" sort={tutorSort} setSort={setTutorSort} />
                <SortTh label="Margin" sortKey="margin" sort={tutorSort} setSort={setTutorSort} />
              </tr></thead>
              <tbody>
                {tutorProfitability.length === 0 && <Empty colSpan={7} text="No financial data available for this period." />}
                {tutorProfitability.map(t => {
                  const isOpen = expandedTutor === t.tutor;
                  const records = scopedFees.filter(f => f.tutorName === t.tutor);
                  return (
                    <>
                      <tr key={t.tutor} onClick={() => setExpandedTutor(isOpen ? null : t.tutor)} style={{ cursor: 'pointer' }}>
                        <td>{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />}</td>
                        <td>{t.tutor}</td><td>{t.students}</td><td>{inr(t.revenue)}</td><td>{inr(t.payout)}</td>
                        <td style={{ fontWeight: 700 }}>{inr(t.profit)}</td><td>{t.margin}%</td>
                      </tr>
                      {isOpen && (
                        <tr key={t.tutor + '-detail'}>
                          <td colSpan={7} style={{ background: '#fafbfc', padding: '10px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {records.map(r => (
                                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px dashed var(--border)' }}>
                                  <span>{r.parentName} · {r.subject} ({r.classLevel})</span>
                                  <span>{inr(r.tutorFee)} <span style={{ color: 'var(--text-muted)' }}>({r.paymentStatus})</span></span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </TableWrap>
      </Card>

      {/* Outstanding payments */}
      <Card>
        <div ref={outstandingRef} />
        <CardHeader title={`⏳ Outstanding Payments — ${scopeLabel}`}>
          <SearchBox value={outstandingSearch} onChange={setOutstandingSearch} placeholder="Search parent, tutor, subject…" />
          <BtnSecondary onClick={exportOutstanding}><Download className="h-3.5 w-3.5" style={{ display: 'inline', marginRight: 4 }} />Export</BtnSecondary>
        </CardHeader>
        <FilterRow>
          {(['all', 'pending', 'received', 'paid'] as OutstandingFilter[]).map(s => (
            <FilterBtn key={s} active={outstandingFilter === s} onClick={() => setOutstandingFilter(s)}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</FilterBtn>
          ))}
        </FilterRow>
        <TableWrap>
          {loading ? <TableSkeleton rows={4} cols={6} /> : (
            <table>
              <thead><tr>
                <SortTh label="Parent" sortKey="parentName" sort={outstandingSort} setSort={setOutstandingSort} />
                <SortTh label="Tutor" sortKey="tutorName" sort={outstandingSort} setSort={setOutstandingSort} />
                <SortTh label="Subject" sortKey="subject" sort={outstandingSort} setSort={setOutstandingSort} />
                <SortTh label="Tuition Month" sortKey="month" sort={outstandingSort} setSort={setOutstandingSort} />
                <SortTh label="Amount" sortKey="parentFee" sort={outstandingSort} setSort={setOutstandingSort} />
                <SortTh label="Status" sortKey="paymentStatus" sort={outstandingSort} setSort={setOutstandingSort} />
              </tr></thead>
              <tbody>
                {outstandingRows.length === 0 && <Empty colSpan={6} text="No outstanding records for this filter." />}
                {outstandingRows.map(f => (
                  <tr key={f.id}>
                    <td>{f.parentName}</td><td>{f.tutorName}</td><td>{f.subject}</td><td>{f.month}</td>
                    <td style={{ fontWeight: 700 }}>{inr(f.parentFee)}</td>
                    <td><span style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color: f.paymentStatus === 'pending' ? '#9f1239' : '#166534' }}>{f.paymentStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableWrap>
      </Card>
    </AppShell>
  );
}