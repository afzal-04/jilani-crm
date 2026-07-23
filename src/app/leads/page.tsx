'use client';
// src/app/leads/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import {
  getParents, getTutors, updateParent, updateTutor,
  Parent, Tutor, LeadStatus,
} from '@/lib/firestore';
import {
  MapPin, Phone, ArrowRight, Users, GraduationCap,
  Plus, Search, Filter, Inbox,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type LeadKind = 'parent' | 'tutor';
type UILead = {
  id: string; name: string; type: LeadKind;
  subject: string; detail: string; area: string; phone: string; status: LeadStatus;
};

const STAGES: { id: LeadStatus; label: string; color: string; glow: string }[] = [
  { id: 'new',            label: 'New',            color: 'oklch(0.68 0.17 245)', glow: 'oklch(0.68 0.17 245 / 0.35)' },
  { id: 'contacted',      label: 'Contacted',      color: 'oklch(0.7 0.14 210)',  glow: 'oklch(0.7 0.14 210 / 0.35)' },
  { id: 'demo_scheduled', label: 'Demo Scheduled', color: 'oklch(0.78 0.17 75)',  glow: 'oklch(0.78 0.17 75 / 0.35)' },
  { id: 'converted',      label: 'Converted',      color: 'oklch(0.7 0.16 155)',  glow: 'oklch(0.7 0.16 155 / 0.35)' },
  { id: 'closed',         label: 'Closed',         color: 'oklch(0.6 0.02 260)',  glow: 'oklch(0.6 0.02 260 / 0.3)' },
];

function initialsOf(name: string) {
  return name.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]?.toUpperCase()).join('');
}
function nextStage(stage: LeadStatus): LeadStatus | null {
  const idx = STAGES.findIndex(s => s.id === stage);
  if (idx < 0 || idx >= STAGES.length-1) return null;
  return STAGES[idx+1].id;
}
function displayName(r: { name?: string; studentName?: string }): string {
  return r.name?.trim() || r.studentName?.trim() || 'Unnamed';
}
function displayLocation(r: { area?: string; address?: string }): string {
  return r.area?.trim() || r.address?.trim() || '—';
}

// ── Lead card ──────────────────────────────────────────────────────────────────

function LeadCard({ lead, onMove, onClose }: { lead: UILead; onMove:(id:string,type:LeadKind,to:LeadStatus)=>void; onClose:(id:string,type:LeadKind)=>void }) {
  const isParent = lead.type === 'parent';
  const avatarBg = isParent
    ? 'linear-gradient(135deg, oklch(0.58 0.19 258) 0%, oklch(0.68 0.17 245) 100%)'
    : 'linear-gradient(135deg, oklch(0.82 0.17 78) 0%, oklch(0.72 0.17 60) 100%)';
  const next = nextStage(lead.status);
  const showClose = lead.status !== 'closed';

  return (
    <div className="group relative rounded-xl border border-black/[0.05] bg-white p-3.5 shadow-[0_1px_2px_oklch(0.14_0.03_265/0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-16px_oklch(0.14_0.03_265/0.35)] hover:border-black/[0.09]">
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[12px] font-semibold text-white ring-1 ring-white/20" style={{ background: avatarBg }}>
          {initialsOf(lead.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold tracking-tight text-[#111827]">{lead.name}</div>
          <div className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-medium">
            {isParent ? (
              <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5" style={{ background:'oklch(0.68 0.17 245 / 0.10)', color:'oklch(0.5 0.18 258)', border:'1px solid oklch(0.68 0.17 245 / 0.22)' }}>
                <Users className="h-2.5 w-2.5" />Parent
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5" style={{ background:'oklch(0.78 0.17 75 / 0.14)', color:'oklch(0.55 0.15 68)', border:'1px solid oklch(0.78 0.17 75 / 0.3)' }}>
                <GraduationCap className="h-2.5 w-2.5" />Tutor
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="text-[12px] font-medium text-[#111827]/85">
          {lead.subject || '—'}<span className="mx-1.5 text-[#6B7280]/50">·</span><span className="text-[#6B7280]">{lead.detail || '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11.5px] text-[#6B7280]">
          <MapPin className="h-3 w-3 flex-none" style={{ color:'oklch(0.6 0.14 25)' }} /><span className="truncate">{lead.area}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11.5px] text-[#6B7280]">
          <Phone className="h-3 w-3 flex-none" style={{ color:'oklch(0.6 0.15 155)' }} /><span className="truncate">{lead.phone || '—'}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {next && (
          <button type="button" onClick={() => onMove(lead.id, lead.type, next)}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-transparent bg-black/[0.03] px-2 py-1 text-[11px] font-medium text-[#111827]/70 transition hover:border-[color:var(--brand-blue)]/25 hover:bg-[color:var(--brand-blue)]/[0.06] hover:text-[color:var(--brand-blue)]">
            <ArrowRight className="h-3 w-3" />{STAGES.find(s=>s.id===next)!.label}
          </button>
        )}
        {showClose && (
          <button type="button" onClick={() => onClose(lead.id, lead.type)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-black/[0.03] px-2 py-1 text-[11px] font-medium text-[#111827]/60 transition hover:border-black/10 hover:bg-black/[0.05] hover:text-[#111827]">
            Close
          </button>
        )}
      </div>
    </div>
  );
}

// ── Column ─────────────────────────────────────────────────────────────────────

function Column({ stage, leads, onMove, onClose }: { stage: typeof STAGES[number]; leads: UILead[]; onMove:(id:string,type:LeadKind,to:LeadStatus)=>void; onClose:(id:string,type:LeadKind)=>void }) {
  return (
    <div className="flex w-[300px] flex-none flex-col md:w-auto">
      <div className="relative mb-3 rounded-xl border border-black/[0.05] bg-white px-3.5 py-3 shadow-sm">
        <span aria-hidden className="absolute inset-x-3.5 top-0 h-[3px] rounded-b-full" style={{ background:`linear-gradient(90deg, ${stage.color}, transparent)`, boxShadow:`0 0 12px ${stage.glow}` }} />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background:stage.color, boxShadow:`0 0 8px ${stage.glow}` }} />
            <span className="text-[12.5px] font-semibold tracking-tight text-[#111827]">{stage.label}</span>
          </div>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold" style={{ background:`${stage.color.replace(')',' / 0.12)')}`, color:stage.color, border:`1px solid ${stage.color.replace(')',' / 0.25)')}` }}>
            {leads.length}
          </span>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 max-h-[70vh]">
        {leads.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-black/[0.08] bg-black/[0.015] text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#6B7280] shadow-sm" style={{ border:'1px solid oklch(0.9 0.005 260)' }}><Inbox className="h-4 w-4" /></div>
            <div className="mt-2 text-[12px] font-medium text-[#111827]/70">No leads</div>
            <div className="text-[11px] text-[#6B7280]">Nothing in this stage yet</div>
          </div>
        ) : leads.map(l => <LeadCard key={`${l.type}-${l.id}`} lead={l} onMove={onMove} onClose={onClose} />)}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type TypeFilter = 'all' | 'parent' | 'tutor';

export default function LeadsPage() {
  const router = useRouter();
  const [parents, setParents] = useState<Parent[]>([]);
  const [tutors, setTutors]   = useState<Tutor[]>([]);
  const [filter, setFilter]   = useState<TypeFilter>('all');
  const [query, setQuery]     = useState('');

  const loadAll = useCallback(async () => {
    const [p,t] = await Promise.all([getParents(), getTutors()]);
    setParents(p); setTutors(t);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const allLeads: UILead[] = useMemo(() => [
    ...parents.map(p => ({
      id: p.id!, name: displayName(p), type: 'parent' as LeadKind,
      subject: p.subject || '', detail: p.class || '',
      area: displayLocation(p), phone: p.phone || '', status: p.status,
    })),
    ...tutors.map(t => ({
      id: t.id!, name: t.name, type: 'tutor' as LeadKind,
      subject: t.subjects || '', detail: t.qualification || '',
      area: displayLocation(t as any), phone: t.phone || '', status: t.status,
    })),
  ], [parents, tutors]);

  const counts = useMemo(() => ({
    all: allLeads.length,
    parent: allLeads.filter(l=>l.type==='parent').length,
    tutor: allLeads.filter(l=>l.type==='tutor').length,
  }), [allLeads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allLeads.filter(l => {
      if (filter !== 'all' && l.type !== filter) return false;
      if (!q) return true;
      return [l.name,l.subject,l.area,l.phone].some(v => v.toLowerCase().includes(q));
    });
  }, [allLeads, filter, query]);

  const byStage = useMemo(() => {
    const map: Record<LeadStatus, UILead[]> = { new:[], contacted:[], demo_scheduled:[], converted:[], closed:[] };
    visible.forEach(l => map[l.status].push(l));
    return map;
  }, [visible]);

  async function move(id: string, type: LeadKind, to: LeadStatus) {
    if (type === 'parent') {
      await updateParent(id, { status: to });
      setParents(p => p.map(x => x.id===id ? {...x,status:to} : x));
    } else {
      await updateTutor(id, { status: to });
      setTutors(t => t.map(x => x.id===id ? {...x,status:to} : x));
    }
  }
  function close(id: string, type: LeadKind) { move(id, type, 'closed'); }

  const filterOptions: { id: TypeFilter; label: string; count: number }[] = [
    { id:'all', label:'All', count:counts.all },
    { id:'parent', label:'Parents', count:counts.parent },
    { id:'tutor', label:'Tutors', count:counts.tutor },
  ];

  const badges = {
    '/parents': parents.filter(p=>p.status==='new').length,
    '/tutors': tutors.filter(t=>t.status==='new').length,
  };

  return (
    <AppShell title="Lead Pipeline" onRefresh={loadAll} badges={badges}>

      {/* Filter bar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl border border-black/[0.06] bg-white p-1 shadow-sm">
          {filterOptions.map(opt => {
            const active = filter === opt.id;
            return (
              <button key={opt.id} type="button" onClick={() => setFilter(opt.id)}
                className={['inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition',
                  active ? 'text-white shadow-sm' : 'text-[#6B7280] hover:bg-black/[0.03] hover:text-[#111827]'].join(' ')}
                style={active ? { background:'linear-gradient(135deg, oklch(0.2 0.03 265) 0%, oklch(0.14 0.03 265) 100%)' } : undefined}>
                {opt.id==='parent' && <Users className="h-3.5 w-3.5" />}
                {opt.id==='tutor' && <GraduationCap className="h-3.5 w-3.5" />}
                {opt.id==='all' && <Filter className="h-3.5 w-3.5" />}
                <span>{opt.label}</span>
                <span className={['inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold', active ? 'bg-white/15 text-white' : 'bg-black/[0.05] text-[#6B7280]'].join(' ')}>{opt.count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search leads…"
              className="h-9 w-56 rounded-lg border border-black/[0.06] bg-white/80 pl-9 pr-3 text-[13px] text-[#111827] shadow-sm outline-none transition placeholder:text-[#6B7280]/70 focus:border-[color:var(--brand-blue)]/40 focus:ring-2 focus:ring-[color:var(--brand-blue)]/10" />
          </div>
          <button type="button" onClick={() => router.push('/parents')}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-95"
            style={{ background:'var(--gradient-blue)', boxShadow:'0 8px 24px -10px oklch(0.58 0.19 258 / 0.7)' }}>
            <Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">New Lead</span>
          </button>
        </div>
      </div>

      <div className="mb-4 text-[11.5px] text-[#6B7280]">
        Showing <span className="font-semibold text-[#111827]">{visible.length}</span> of {allLeads.length} leads
      </div>

      {/* Board */}
      <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        <div className="flex gap-4 md:grid md:grid-cols-5 md:gap-4">
          {STAGES.map(s => <Column key={s.id} stage={s} leads={byStage[s.id]} onMove={move} onClose={close} />)}
        </div>
      </div>
    </AppShell>
  );
}