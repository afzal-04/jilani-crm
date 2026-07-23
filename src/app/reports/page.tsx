'use client';
// src/app/reports/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { currency } from '@/components/UI';
import {
  getParents, getTutors, getFees, getAssignments, getComms, getTasks,
  Parent, Tutor, FeeRecord, Assignment, CommunicationLog, Task,
} from '@/lib/firestore';
import {
  TrendingUp, Users, GraduationCap, Target, CheckCircle2, ClipboardList,
  Wallet, MessageCircle, MapPin, BookOpen, Globe2, ArrowUpRight, ArrowDownRight,
  Sparkles, type LucideIcon,
} from 'lucide-react';

// ── Known Raipur areas — for matching free-text address/area fields ──────────
const KNOWN_AREAS = [
  'Shankar Nagar','Civil Lines','Pandri','Telibandha','Tatibandh','Devendra Nagar',
  'Raipur Station Road','Pachpedi Naka','Avanti Vihar','Byron Bazar','Mowa',
  'Khamardih','Fafadih','Rajendra Nagar','Kabir Nagar','Gopal Nagar',
  'New Rajendra Nagar','Shanti Nagar','Daganiya','Sundar Nagar',
];
function findArea(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  return KNOWN_AREAS.find(a => lower.includes(a.toLowerCase())) || null;
}

const PALETTE = [
  'oklch(0.58 0.19 258)', 'oklch(0.68 0.17 245)', 'oklch(0.78 0.17 75)',
  'oklch(0.62 0.18 200)', 'oklch(0.7 0.16 155)', 'oklch(0.72 0.15 40)',
  'oklch(0.55 0.2 300)', 'oklch(0.62 0.2 340)',
];

const SOURCE_ICON: Record<string, LucideIcon> = {
  website: Globe2, referral: Users, justdial: Target,
  instagram: Sparkles, whatsapp: MessageCircle, 'walk-in': MapPin, walkin: MapPin,
};

// ── Radial ─────────────────────────────────────────────────────────────────────

function Radial({ value, label, sub, color, size = 128 }: { value: number; label: string; sub: string; color: string; size?: number }) {
  const stroke = 12, r = (size-stroke)/2, c = 2*Math.PI*r, dash = (value/100)*c;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} stroke="oklch(0.92 0.008 260)" strokeWidth={stroke} fill="none" />
          <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${dash} ${c}`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[28px] font-bold tracking-tight text-[#111827] tabular-nums">{value}%</div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">{label}</div>
        </div>
      </div>
      <div className="mt-2 text-[11.5px] text-[#6B7280]">{sub}</div>
    </div>
  );
}

// ── Area chart ─────────────────────────────────────────────────────────────────

function AreaChart({ data }: { data: { m: string; v: number }[] }) {
  const w = 800, h = 240, pad = { l:44, r:16, t:20, b:28 };
  const iw = w-pad.l-pad.r, ih = h-pad.t-pad.b;
  const max = Math.max(...data.map(d=>d.v), 1) * 1.1;
  const step = iw / Math.max(data.length-1, 1);
  const pts = data.map((d,i) => [pad.l+i*step, pad.t+ih-(d.v/max)*ih] as const);
  const path = pts.map((p,i) => `${i===0?'M':'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${pad.l+iw} ${pad.t+ih} L ${pad.l} ${pad.t+ih} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[240px] w-full">
      <defs>
        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.68 0.17 245)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="oklch(0.68 0.17 245)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="revLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.58 0.19 258)" /><stop offset="100%" stopColor="oklch(0.78 0.17 75)" />
        </linearGradient>
      </defs>
      {Array.from({length:5},(_,i) => {
        const y = pad.t + (ih/4)*i;
        const v = Math.round((max - (max/4)*i)/1000);
        return <g key={i}>
          <line x1={pad.l} x2={pad.l+iw} y1={y} y2={y} stroke="oklch(0.92 0.008 260)" strokeDasharray="2 4" />
          <text x={pad.l-8} y={y+3} textAnchor="end" fontSize="10" fill="oklch(0.5 0.03 260)">₹{v}k</text>
        </g>;
      })}
      {data.length > 1 && <><path d={area} fill="url(#revGrad)" /><path d={path} fill="none" stroke="url(#revLine)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /></>}
      {pts.map((p,i) => <g key={i}>
        <circle cx={p[0]} cy={p[1]} r="3.5" fill="white" stroke="oklch(0.58 0.19 258)" strokeWidth="2" />
        <text x={p[0]} y={h-8} textAnchor="middle" fontSize="10.5" fill="oklch(0.5 0.03 260)" fontWeight="500">{data[i].m}</text>
      </g>)}
    </svg>
  );
}

// ── Donut ──────────────────────────────────────────────────────────────────────

function Donut({ data, total }: { data: { name: string; value: number; color: string }[]; total: number }) {
  const size = 168, stroke = 22, r = (size-stroke)/2, c = 2*Math.PI*r;
  let offset = 0;
  return (
    <div className="relative" style={{ width:size, height:size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} stroke="oklch(0.95 0.008 260)" strokeWidth={stroke} fill="none" />
        {data.map(d => {
          const dash = total ? (d.value/total)*c : 0;
          const el = <circle key={d.name} cx={size/2} cy={size/2} r={r} stroke={d.color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${dash} ${c}`} strokeDashoffset={-offset} />;
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[26px] font-bold tracking-tight text-[#111827] tabular-nums">{total}</div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Total leads</div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [parents, setParents]   = useState<Parent[]>([]);
  const [tutors, setTutors]     = useState<Tutor[]>([]);
  const [fees, setFees]         = useState<FeeRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [comms, setComms]       = useState<CommunicationLog[]>([]);
  const [tasks, setTasks]       = useState<Task[]>([]);

  const loadAll = useCallback(async () => {
    const [p,t,f,a,co,tk] = await Promise.all([getParents(), getTutors(), getFees(), getAssignments(), getComms(), getTasks()]);
    setParents(p); setTutors(t); setFees(f); setAssignments(a); setComms(co); setTasks(tk);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Pipeline — real parent status counts ──
  const PIPELINE_STAGES = ['new','contacted','demo_scheduled','converted','closed'] as const;
  const pipeline = PIPELINE_STAGES.map((stage, i) => ({
    stage: stage.replace('_',' ').replace(/\b\w/g, c=>c.toUpperCase()),
    count: parents.filter(p=>p.status===stage).length,
    color: PALETTE[i],
  }));
  const maxPipeline = Math.max(...pipeline.map(p=>p.count), 1);
  const overallConversion = pipeline[0].count ? Math.round((pipeline[4].count/pipeline[0].count)*100) : 0;

  // ── Subjects — real, from parent.subject ──
  const subjectCounts: Record<string, number> = {};
  parents.forEach(p => { if (p.subject) subjectCounts[p.subject] = (subjectCounts[p.subject]||0)+1; });
  const subjects = Object.entries(subjectCounts).sort(([,a],[,b])=>b-a).slice(0,7)
    .map(([name,value],i) => ({ name, value, color: PALETTE[i%PALETTE.length] }));
  const maxSubject = Math.max(...subjects.map(s=>s.value), 1);

  // ── Areas — real, matched against known area list ──
  const areaCounts: Record<string, { leads: number; tutors: number }> = {};
  parents.forEach(p => {
    const area = findArea(`${p.area||''} ${(p as any).address||''}`);
    if (area) { areaCounts[area] = areaCounts[area] || {leads:0,tutors:0}; areaCounts[area].leads++; }
  });
  tutors.forEach(t => {
    const area = findArea(`${(t as any).area||''} ${(t as any).address||''}`);
    if (area) { areaCounts[area] = areaCounts[area] || {leads:0,tutors:0}; areaCounts[area].tutors++; }
  });
  const areas = Object.entries(areaCounts).map(([name,v]) => ({ name, ...v }))
    .sort((a,b) => b.leads-a.leads).slice(0,7);
  const maxAreaLeads = Math.max(...areas.map(a=>a.leads), 1);
  const maxAreaTutors = Math.max(...areas.map(a=>a.tutors), 1);

  // ── Revenue — real, grouped by fee.month field, chronological ──
  const monthlyMap: Record<string, number> = {};
  fees.filter(f=>f.paymentStatus!=='pending').forEach(f => {
    if (!f.month) return;
    monthlyMap[f.month] = (monthlyMap[f.month]||0) + (f.parentFee||0);
  });
  const revenue = Object.entries(monthlyMap)
    .map(([month,v]) => ({ m: month.split(' ')[0].slice(0,3), v, date: new Date(month) }))
    .filter(e => !isNaN(e.date.getTime()))
    .sort((a,b) => a.date.getTime()-b.date.getTime())
    .slice(-12);
  const totalRevenue = revenue.reduce((s,r)=>s+r.v,0);
  const lastMonth = revenue[revenue.length-1]?.v || 0;
  const prevMonth = revenue[revenue.length-2]?.v || 0;
  const revenueDelta = prevMonth ? Math.round(((lastMonth-prevMonth)/prevMonth)*100) : null;
  const peakMonth = revenue.length ? revenue.reduce((a,b)=>a.v>b.v?a:b) : null;
  const avgMonthly = revenue.length ? Math.round(totalRevenue/revenue.length) : 0;

  // ── Sources — real, from parent.source ──
  const sourceCounts: Record<string, number> = {};
  parents.forEach(p => { const src = p.source?.trim() || 'Unknown'; sourceCounts[src] = (sourceCounts[src]||0)+1; });
  const sources = Object.entries(sourceCounts).sort(([,a],[,b])=>b-a).slice(0,7)
    .map(([name,value],i) => ({ name, value, icon: SOURCE_ICON[name.toLowerCase()] || Globe2, color: PALETTE[i%PALETTE.length] }));
  const totalSources = sources.reduce((s,x)=>s+x.value,0);

  // ── Conversion + task completion ──
  const parentConv = parents.length ? Math.round((parents.filter(p=>p.status==='converted').length/parents.length)*100) : 0;
  const tutorConv  = tutors.length ? Math.round((tutors.filter(t=>t.status==='converted').length/tutors.length)*100) : 0;
  const doneTasks = tasks.filter(t=>t.status==='done').length;
  const taskCompletion = tasks.length ? Math.round((doneTasks/tasks.length)*100) : 0;

  // ── Summary grid ──
  const summaryStats: { label: string; value: string; icon: LucideIcon; tone: 'blue'|'gold'|'green'|'red' }[] = [
    { label:'Total Parents', value:String(parents.length), icon:Users, tone:'blue' },
    { label:'New Leads', value:String(parents.filter(p=>p.status==='new').length), icon:Target, tone:'gold' },
    { label:'Converted', value:String(parents.filter(p=>p.status==='converted').length), icon:CheckCircle2, tone:'green' },
    { label:'Total Tutors', value:String(tutors.length), icon:GraduationCap, tone:'blue' },
    { label:'Active Classes', value:String(assignments.filter(a=>a.status==='active').length), icon:BookOpen, tone:'green' },
    { label:'Fee Records', value:String(fees.length), icon:Wallet, tone:'gold' },
    { label:'Comm Logs', value:String(comms.length), icon:MessageCircle, tone:'blue' },
    { label:'Pending Tasks', value:String(tasks.filter(t=>t.status!=='done').length), icon:ClipboardList, tone:'red' },
    { label:'Completed Tasks', value:String(doneTasks), icon:CheckCircle2, tone:'green' },
    { label:'Pending Fees', value:String(fees.filter(f=>f.paymentStatus==='pending').length), icon:TrendingUp, tone:'red' },
  ];
  const toneMap: Record<string, {fg:string; bg:string; ring:string}> = {
    blue:  { fg:'oklch(0.45 0.14 258)', bg:'oklch(0.58 0.19 258 / 0.1)', ring:'oklch(0.58 0.19 258 / 0.25)' },
    gold:  { fg:'oklch(0.5 0.12 70)',   bg:'oklch(0.78 0.17 75 / 0.14)', ring:'oklch(0.78 0.17 75 / 0.3)' },
    green: { fg:'oklch(0.42 0.12 155)', bg:'oklch(0.7 0.16 155 / 0.12)', ring:'oklch(0.7 0.16 155 / 0.3)' },
    red:   { fg:'oklch(0.5 0.18 25)',   bg:'oklch(0.62 0.22 25 / 0.1)',  ring:'oklch(0.62 0.22 25 / 0.3)' },
  };

  return (
    <AppShell title="Analytics" onRefresh={loadAll}>

      {/* ---------- Hero: Revenue trend ---------- */}
      <section className="relative overflow-hidden rounded-2xl p-6 md:p-8" style={{ background:'var(--gradient-navy)', boxShadow:'0 30px 80px -30px oklch(0.14 0.03 265 / 0.5)' }}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background:'radial-gradient(60% 55% at 85% 0%, oklch(0.6 0.2 258 / 0.28) 0%, transparent 70%), radial-gradient(40% 40% at 10% 100%, oklch(0.78 0.17 75 / 0.14) 0%, transparent 70%)' }} />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/50">Monthly revenue trend</div>
            <div className="mt-2 flex items-baseline gap-3">
              <div className="text-[40px] font-bold tracking-tight text-white tabular-nums">₹{(totalRevenue/100000).toFixed(2)}L</div>
              {revenueDelta !== null && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{
                  background: revenueDelta>=0 ? 'oklch(0.7 0.16 155 / 0.15)' : 'oklch(0.62 0.22 25 / 0.15)',
                  color: revenueDelta>=0 ? 'oklch(0.85 0.15 155)' : 'oklch(0.78 0.16 25)',
                  border: `1px solid ${revenueDelta>=0 ? 'oklch(0.7 0.16 155 / 0.3)' : 'oklch(0.62 0.22 25 / 0.3)'}`,
                }}>
                  {revenueDelta>=0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {revenueDelta>=0?'+':''}{revenueDelta}% MoM
                </span>
              )}
            </div>
            <p className="mt-1 text-[12.5px] text-white/60">
              {revenue.length ? `Last ${revenue.length} months · Last: ${currency(lastMonth)}` : 'No fee data yet'}
            </p>
          </div>
          {revenue.length > 0 && (
            <div className="flex gap-6">
              <div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Peak</div>
                <div className="mt-1 text-[18px] font-bold text-white tabular-nums">{currency(peakMonth?.v||0)}</div>
                <div className="text-[10.5px] text-white/50">{peakMonth?.m}</div></div>
              <div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Avg / mo</div>
                <div className="mt-1 text-[18px] font-bold text-white tabular-nums">{currency(avgMonthly)}</div>
                <div className="text-[10.5px] text-white/50">{revenue.length}-mo mean</div></div>
              <div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">This Month</div>
                <div className="mt-1 text-[18px] font-bold text-white tabular-nums">{currency(lastMonth)}</div>
                <div className="text-[10.5px] text-white/50">latest</div></div>
            </div>
          )}
        </div>
        <div className="relative mt-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          {revenue.length > 0 ? <AreaChart data={revenue} /> : <p className="py-16 text-center text-[13px] text-white/40">No fee records yet — add fees to see revenue trends.</p>}
        </div>
      </section>

      {/* ---------- Pipeline + Conversion radials ---------- */}
      <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-black/[0.05] bg-white p-6 transition hover:-translate-y-0.5" style={{ boxShadow:'var(--shadow-card, 0 1px 3px rgba(0,0,0,.06))' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Lead pipeline</div>
              <h3 className="mt-1 text-[17px] font-bold tracking-tight text-[#111827]">Funnel by stage</h3>
            </div>
            <span className="rounded-md border border-black/[0.06] bg-[#F9FAFB] px-2 py-0.5 text-[10.5px] font-semibold text-[#6B7280]">{pipeline[0].count} → {pipeline[4].count}</span>
          </div>
          <div className="mt-6 space-y-3">
            {pipeline.map((p,i) => {
              const pct = (p.count/maxPipeline)*100;
              const conv = i===0 ? 100 : (pipeline[0].count ? Math.round((p.count/pipeline[0].count)*100) : 0);
              return (
                <div key={p.stage} className="flex items-center gap-4">
                  <div className="w-32 flex-none text-[12.5px] font-semibold text-[#111827]">{p.stage}</div>
                  <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-[#F3F4F6]">
                    <div className="absolute inset-y-0 left-0 flex items-center justify-end pr-3 text-[12px] font-bold text-white" style={{ width:`${pct}%`, background:p.color, minWidth: p.count>0?'32px':'0' }}>{p.count}</div>
                  </div>
                  <div className="w-16 flex-none text-right text-[11.5px] font-semibold tabular-nums text-[#6B7280]">{conv}%</div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex items-center justify-between rounded-lg border border-black/[0.05] bg-[#F9FAFB] px-4 py-3">
            <div className="text-[11.5px] text-[#6B7280]">Overall conversion (New → Closed)</div>
            <div className="text-[15px] font-bold tabular-nums" style={{ color:'oklch(0.55 0.16 158)' }}>{overallConversion}%</div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/[0.05] bg-white p-6 transition hover:-translate-y-0.5" style={{ boxShadow:'var(--shadow-card, 0 1px 3px rgba(0,0,0,.06))' }}>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Conversion rate</div>
          <h3 className="mt-1 text-[17px] font-bold tracking-tight text-[#111827]">Parents vs Tutors</h3>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Radial value={parentConv} label="Parents" sub={`${parents.filter(p=>p.status==='converted').length} of ${parents.length}`} color="oklch(0.58 0.19 258)" />
            <Radial value={tutorConv} label="Tutors" sub={`${tutors.filter(t=>t.status==='converted').length} of ${tutors.length}`} color="oklch(0.78 0.17 75)" />
          </div>
          <div className="mt-6 rounded-lg border border-black/[0.05] bg-[#F9FAFB] p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11.5px] font-semibold text-[#111827]">Task completion</div>
              <div className="text-[13px] font-bold tabular-nums" style={{ color:'oklch(0.55 0.16 158)' }}>{taskCompletion}%</div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full rounded-full" style={{ width:`${taskCompletion}%`, background:'linear-gradient(90deg, oklch(0.7 0.16 155) 0%, oklch(0.62 0.16 160) 100%)' }} />
            </div>
            <div className="mt-1.5 text-[10.5px] text-[#6B7280]">{doneTasks} completed · {tasks.length-doneTasks} pending</div>
          </div>
        </div>
      </section>

      {/* ---------- Subjects + Areas + Sources ---------- */}
      <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-6">
        <div className="lg:col-span-2 rounded-2xl border border-black/[0.05] bg-white p-6 transition hover:-translate-y-0.5" style={{ boxShadow:'var(--shadow-card, 0 1px 3px rgba(0,0,0,.06))' }}>
          <div className="flex items-center justify-between">
            <div><div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Subject demand</div>
              <h3 className="mt-1 text-[17px] font-bold tracking-tight text-[#111827]">Most requested</h3></div>
            <BookOpen className="h-4 w-4 text-[#6B7280]" />
          </div>
          <div className="mt-5 space-y-3">
            {subjects.length===0 && <p className="text-[12.5px] text-[#9CA3AF]">No subject data yet.</p>}
            {subjects.map((s,i) => (
              <div key={s.name} className="flex items-center gap-3">
                <div className="w-5 flex-none text-center text-[10.5px] font-bold tabular-nums" style={{ color: i<3?s.color:'oklch(0.55 0.03 260)' }}>{String(i+1).padStart(2,'0')}</div>
                <div className="w-28 flex-none truncate text-[12.5px] font-medium text-[#111827]">{s.name}</div>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#F3F4F6]">
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width:`${(s.value/maxSubject)*100}%`, background:s.color }} />
                </div>
                <div className="w-8 flex-none text-right text-[11.5px] font-bold tabular-nums text-[#111827]">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-black/[0.05] bg-white p-6 transition hover:-translate-y-0.5" style={{ boxShadow:'var(--shadow-card, 0 1px 3px rgba(0,0,0,.06))' }}>
          <div className="flex items-center justify-between">
            <div><div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Raipur localities</div>
              <h3 className="mt-1 text-[17px] font-bold tracking-tight text-[#111827]">Lead concentration</h3></div>
            <MapPin className="h-4 w-4 text-[#6B7280]" />
          </div>
          <div className="mt-4 flex items-center gap-4 text-[10.5px] font-semibold text-[#6B7280]">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{background:'oklch(0.58 0.19 258)'}} />Parents</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{background:'oklch(0.78 0.17 75)'}} />Tutors</span>
          </div>
          <div className="mt-3 space-y-3">
            {areas.length===0 && <p className="text-[12.5px] text-[#9CA3AF]">No area data yet.</p>}
            {areas.map(a => (
              <div key={a.name}>
                <div className="flex items-center justify-between text-[11.5px]"><span className="font-semibold text-[#111827]">{a.name}</span><span className="tabular-nums text-[#6B7280]">{a.leads} · {a.tutors}</span></div>
                <div className="mt-1 space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]"><div className="h-full rounded-full" style={{ width:`${(a.leads/maxAreaLeads)*100}%`, background:'linear-gradient(90deg, oklch(0.58 0.19 258) 0%, oklch(0.68 0.17 245) 100%)' }} /></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]"><div className="h-full rounded-full" style={{ width:`${(a.tutors/maxAreaTutors)*100}%`, background:'linear-gradient(90deg, oklch(0.78 0.17 75) 0%, oklch(0.72 0.17 60) 100%)' }} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-black/[0.05] bg-white p-6 transition hover:-translate-y-0.5" style={{ boxShadow:'var(--shadow-card, 0 1px 3px rgba(0,0,0,.06))' }}>
          <div><div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Lead sources</div>
            <h3 className="mt-1 text-[17px] font-bold tracking-tight text-[#111827]">Where leads come from</h3></div>
          <div className="mt-4 flex items-center justify-center">
            {totalSources>0 ? <Donut data={sources} total={totalSources} /> : <p className="py-8 text-[12.5px] text-[#9CA3AF]">No source data yet.</p>}
          </div>
          <div className="mt-5 space-y-2">
            {sources.map(s => {
              const Icon = s.icon;
              const pct = totalSources ? Math.round((s.value/totalSources)*100) : 0;
              return (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md" style={{ background:`${s.color.replace(')',' / 0.14)')}`, color:s.color }}><Icon className="h-3 w-3" /></div>
                  <div className="flex-1 text-[12px] font-medium text-[#111827]">{s.name}</div>
                  <div className="w-8 text-right text-[11.5px] font-bold tabular-nums text-[#111827]">{pct}%</div>
                  <div className="w-8 text-right text-[10.5px] tabular-nums text-[#6B7280]">{s.value}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Quick summary ---------- */}
      <section className="mt-6">
        <div className="mb-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Quick summary</div>
          <h3 className="mt-0.5 text-[17px] font-bold tracking-tight text-[#111827]">All key numbers at a glance</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {summaryStats.map(s => {
            const t = toneMap[s.tone];
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl border border-black/[0.05] bg-white p-4 transition hover:-translate-y-0.5" style={{ boxShadow:'var(--shadow-card, 0 1px 3px rgba(0,0,0,.06))' }}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background:t.bg, color:t.fg, boxShadow:`inset 0 0 0 1px ${t.ring}` }}><Icon className="h-4 w-4" /></div>
                <div className="mt-3 text-[22px] font-bold tracking-tight tabular-nums text-[#111827]">{s.value}</div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">{s.label}</div>
              </div>
            );
          })}
        </div>
      </section>

    </AppShell>
  );
}