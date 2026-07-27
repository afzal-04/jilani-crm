'use client';
// src/app/parents/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import ExportButton from '@/components/ExportButton';
import { exportParents } from '@/lib/exportExcel';
import {
  Modal, ModalForm, FormRow, FormGroup, ModalFooter,
  BtnPrimary, BtnSecondary,
} from '@/components/UI';
import { getParents, addParent, updateParent, Parent, LeadStatus } from '@/lib/firestore';
import {
  Users, UserPlus, CheckCircle2, CalendarCheck, Search, Plus,
  MapPin, Phone, MessageCircle, Clock, User, Users2, Pencil, ChevronDown, Filter,
} from 'lucide-react';

const CLASS_LEVELS = ['Nursery','LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10 (Board)','Class 11','Class 12 (Board)','Competitive Exam (JEE/NEET)','Competitive Exam (Govt Job)','Summer Classes','Drawing / Art','Music / Singing','Dance','Other'];
const SUBJECTS = ['Maths','Science','Physics','Chemistry','Biology','English','Hindi','Social Science','Computer Science','Accountancy / Commerce','Economics','JEE Coaching','NEET Coaching','Drawing / Art','Music / Singing','Dance','All Subjects','Other'];

const STATUSES: { id: LeadStatus; label:string; color:string; bg:string; border:string }[] = [
  { id:'new',            label:'New',            color:'oklch(0.5 0.18 258)',  bg:'oklch(0.68 0.17 245 / 0.10)', border:'oklch(0.68 0.17 245 / 0.28)' },
  { id:'contacted',      label:'Contacted',      color:'oklch(0.5 0.13 210)',  bg:'oklch(0.7 0.14 210 / 0.10)',  border:'oklch(0.7 0.14 210 / 0.28)' },
  { id:'demo_scheduled', label:'Demo Scheduled', color:'oklch(0.55 0.15 68)',  bg:'oklch(0.78 0.17 75 / 0.14)',  border:'oklch(0.78 0.17 75 / 0.32)' },
  { id:'converted',      label:'Converted',      color:'oklch(0.48 0.14 155)', bg:'oklch(0.7 0.16 155 / 0.12)',  border:'oklch(0.7 0.16 155 / 0.3)' },
  { id:'closed',         label:'Closed',         color:'oklch(0.5 0.02 260)',  bg:'oklch(0.6 0.02 260 / 0.10)',  border:'oklch(0.6 0.02 260 / 0.25)' },
];

function displayName(p: Parent): string { return p.name?.trim() || (p as any).studentName?.trim() || 'Unnamed'; }
function displayStudent(p: Parent): string { return (p as any).studentName?.trim() || ''; }
function displayLocation(p: Parent): string { return (p as any).address?.trim() || p.area?.trim() || '—'; }

function initialsOf(name: string) { return name.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]?.toUpperCase()).join(''); }
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, oklch(0.58 0.19 258), oklch(0.68 0.17 245))',
  'linear-gradient(135deg, oklch(0.72 0.17 60), oklch(0.82 0.17 78))',
  'linear-gradient(135deg, oklch(0.55 0.17 300), oklch(0.68 0.16 320))',
  'linear-gradient(135deg, oklch(0.55 0.16 155), oklch(0.7 0.16 165))',
  'linear-gradient(135deg, oklch(0.6 0.15 25), oklch(0.7 0.15 40))',
  'linear-gradient(135deg, oklch(0.55 0.14 210), oklch(0.68 0.14 220))',
];
function gradientFor(id: string) { let h=0; for (let i=0;i<id.length;i++) h=(h*31+id.charCodeAt(i))>>>0; return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]; }

function boardStyle(b: string) {
  const board = (b||'').toUpperCase();
  if (board==='CBSE') return { bg:'oklch(0.68 0.17 245 / 0.10)', color:'oklch(0.5 0.18 258)', border:'oklch(0.68 0.17 245 / 0.28)' };
  if (board==='ICSE') return { bg:'oklch(0.55 0.17 300 / 0.10)', color:'oklch(0.45 0.18 300)', border:'oklch(0.55 0.17 300 / 0.28)' };
  if (board.includes('STATE')) return { bg:'oklch(0.7 0.16 155 / 0.10)', color:'oklch(0.45 0.14 155)', border:'oklch(0.7 0.16 155 / 0.28)' };
  return { bg:'oklch(0.9 0.005 260)', color:'oklch(0.5 0.02 260)', border:'oklch(0.85 0.01 260)' };
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, glow }: { label:string; value:string; sub:string; icon:any; color:string; glow:string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/[0.05] bg-white p-5 shadow-[0_1px_2px_oklch(0.14_0.03_265/0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_oklch(0.14_0.03_265/0.35)]">
      <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b-full" style={{ background:`linear-gradient(90deg, ${color}, transparent)`, boxShadow:`0 0 14px ${glow}` }} />
      <span aria-hidden className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-60 transition group-hover:opacity-100" style={{ background:`radial-gradient(closest-side, ${glow}, transparent 70%)` }} />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">{label}</div>
          <div className="mt-1.5 text-[26px] font-bold tracking-tight text-[#111827]">{value}</div>
          <div className="mt-0.5 text-[11.5px] text-[#6B7280]">{sub}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background:glow, color }}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

// ── Status pill ────────────────────────────────────────────────────────────────

function StatusPill({ status, onChange }: { status: LeadStatus; onChange:(s:LeadStatus)=>void }) {
  const s = STATUSES.find(x=>x.id===status)!;
  return (
    <div className="relative inline-flex">
      <select value={status} onChange={e=>onChange(e.target.value as LeadStatus)}
        className="appearance-none rounded-full border pl-2.5 pr-6 py-1 text-[11px] font-semibold outline-none cursor-pointer"
        style={{ background:s.bg, color:s.color, borderColor:s.border }}>
        {STATUSES.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color:s.color }} />
    </div>
  );
}

// ── Add/Edit modal — full rich field set ──────────────────────────────────────

const EMPTY: any = {
  name:'', studentName:'', phone:'', whatsapp:'', email:'', address:'', area:'',
  class:'', subject:'', board:'', school:'', studentAge:'', studentGender:'',
  preferredTeacherGender:'', preferredContact:'', daysPerWeek:'', duration:'',
  timeSlot:'', wantsDemo:'', specialNote:'', budget:'', source:'', status:'new', notes:'',
};

function ParentModal({ initial, onSave, onClose }: { initial?:Parent; onSave:(d:any)=>Promise<void>; onClose:()=>void }) {
  const [form, setForm] = useState<any>(initial ? {...EMPTY, ...(initial as any)} : {...EMPTY});
  const [saving, setSaving] = useState(false);
  const f = (k:string, v:string) => setForm((p:any)=>({...p,[k]:v}));

  async function submit(e: React.FormEvent) { e.preventDefault(); setSaving(true); await onSave(form); setSaving(false); onClose(); }

  return (
    <Modal title={initial ? 'Edit Parent' : 'Add Parent Lead'} onClose={onClose}>
      <ModalForm onSubmit={submit}>
        <FormRow>
          <FormGroup label="Parent Name"><input value={form.name} onChange={e=>f('name',e.target.value)} placeholder="e.g. Ruchi Gupta" /></FormGroup>
          <FormGroup label="Student Name *"><input value={form.studentName} onChange={e=>f('studentName',e.target.value)} required placeholder="e.g. Shanvi Gupta" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Phone *"><input value={form.phone} onChange={e=>f('phone',e.target.value)} placeholder="+91 XXXXX XXXXX" required /></FormGroup>
          <FormGroup label="WhatsApp"><input value={form.whatsapp} onChange={e=>f('whatsapp',e.target.value)} placeholder="+91 XXXXX XXXXX" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Email"><input type="email" value={form.email} onChange={e=>f('email',e.target.value)} /></FormGroup>
          <FormGroup label="Preferred Contact">
            <select value={form.preferredContact} onChange={e=>f('preferredContact',e.target.value)}><option value="">Select</option><option>Call</option><option>WhatsApp</option><option>Both</option></select>
          </FormGroup>
        </FormRow>
        <FormGroup label="Address"><input value={form.address} onChange={e=>f('address',e.target.value)} placeholder="e.g. Jagmal Chowk, Bilaspur, CG" /></FormGroup>
        <FormRow>
          <FormGroup label="Class / Grade *"><select value={form.class} onChange={e=>f('class',e.target.value)} required><option value="">Select</option>{CLASS_LEVELS.map(c=><option key={c}>{c}</option>)}</select></FormGroup>
          <FormGroup label="Subject *"><select value={form.subject} onChange={e=>f('subject',e.target.value)} required><option value="">Select</option>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Board"><select value={form.board} onChange={e=>f('board',e.target.value)}><option value="">Select</option><option>CBSE</option><option>ICSE</option><option>State Board</option><option>Other</option></select></FormGroup>
          <FormGroup label="School"><input value={form.school} onChange={e=>f('school',e.target.value)} placeholder="e.g. St. Francis School" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Student Age"><input value={form.studentAge} onChange={e=>f('studentAge',e.target.value)} placeholder="e.g. 8" /></FormGroup>
          <FormGroup label="Student Gender"><select value={form.studentGender} onChange={e=>f('studentGender',e.target.value)}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Preferred Tutor Gender"><select value={form.preferredTeacherGender} onChange={e=>f('preferredTeacherGender',e.target.value)}><option value="">No preference</option><option>Male</option><option>Female</option></select></FormGroup>
          <FormGroup label="Budget (₹/month)"><input value={form.budget} onChange={e=>f('budget',e.target.value)} placeholder="e.g. 3000-5000" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Days per Week"><select value={form.daysPerWeek} onChange={e=>f('daysPerWeek',e.target.value)}><option value="">Select</option><option>1 Day</option><option>2 Days</option><option>3 Days</option><option>4 Days</option><option>5 Days</option><option>6 Days</option><option>Daily</option></select></FormGroup>
          <FormGroup label="Session Duration"><select value={form.duration} onChange={e=>f('duration',e.target.value)}><option value="">Select</option><option>30 Min</option><option>45 Min</option><option>1 Hour</option><option>1.5 Hours</option><option>2 Hours</option></select></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Time Slot"><select value={form.timeSlot} onChange={e=>f('timeSlot',e.target.value)}><option value="">Select</option><option>Morning (6–9 AM)</option><option>Afternoon (12–4 PM)</option><option>Evening (5–9 PM)</option><option>Flexible</option></select></FormGroup>
          <FormGroup label="Wants Demo"><select value={form.wantsDemo} onChange={e=>f('wantsDemo',e.target.value)}><option value="">Select</option><option>Yes</option><option>No</option></select></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Status"><select value={form.status} onChange={e=>f('status',e.target.value)}>{STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></FormGroup>
          <FormGroup label="Source"><input value={form.source} onChange={e=>f('source',e.target.value)} placeholder="e.g. Website, Referral, JustDial" /></FormGroup>
        </FormRow>
        <FormGroup label="Special Note / Notes"><textarea rows={3} value={form.notes||form.specialNote||''} onChange={e=>f('notes',e.target.value)} placeholder="Any additional notes…" /></FormGroup>
        <ModalFooter><BtnSecondary onClick={onClose}>Cancel</BtnSecondary><BtnPrimary type="submit" disabled={saving}>{saving?'Saving…':initial?'Update':'Add Parent'}</BtnPrimary></ModalFooter>
      </ModalForm>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ParentsPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [query, setQuery]     = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus|'all'>('all');
  const [modal, setModal]     = useState<{open:boolean; record?:Parent}>({open:false});

  const loadAll = useCallback(async () => setParents(await getParents()), []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const counts = useMemo(() => {
    const c: any = { all: parents.length, new:0, contacted:0, demo_scheduled:0, converted:0, closed:0 };
    parents.forEach(p => { c[p.status] = (c[p.status]||0)+1; });
    return c;
  }, [parents]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7*86400000;
    return {
      total: parents.length,
      newWeek: parents.filter(p => p.createdAt?.seconds && p.createdAt.seconds*1000 >= weekAgo).length,
      converted: parents.filter(p=>p.status==='converted').length,
      wantsDemo: parents.filter(p=>(p as any).wantsDemo==='Yes').length,
    };
  }, [parents]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parents.filter(p => {
      if (statusFilter!=='all' && p.status!==statusFilter) return false;
      if (!q) return true;
      return [displayName(p),displayStudent(p),p.phone,displayLocation(p),p.subject].some(v=>v?.toLowerCase().includes(q));
    });
  }, [parents, query, statusFilter]);

  async function updateStatus(id: string, status: LeadStatus) {
    await updateParent(id, { status });
    setParents(p => p.map(x => x.id===id ? {...x,status} : x));
  }

  async function handleSave(data: any) {
    if (modal.record?.id) {
      await updateParent(modal.record.id, data);
      setParents(p => p.map(x => x.id===modal.record!.id ? {...x,...data} : x));
    } else {
      const ref = await addParent(data);
      setParents(p => [{id:ref.id,...data,createdAt:{seconds:Date.now()/1000}},...p]);
    }
  }

  const filterPills: { id:LeadStatus|'all'; label:string; count:number }[] = [
    { id:'all', label:'All', count:counts.all },
    ...STATUSES.map(s => ({ id:s.id, label:s.label, count:counts[s.id]||0 })),
  ];

  return (
    <AppShell title="Parents" onRefresh={loadAll} badges={{'/parents': parents.filter(p=>p.status==='new').length}}>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Parents" value={String(stats.total)} sub="all-time enquiries" icon={Users} color="oklch(0.5 0.18 258)" glow="oklch(0.68 0.17 245 / 0.18)" />
        <StatCard label="New This Week" value={String(stats.newWeek)} sub="fresh leads" icon={UserPlus} color="oklch(0.55 0.15 68)" glow="oklch(0.78 0.17 75 / 0.22)" />
        <StatCard label="Converted" value={String(stats.converted)} sub="active families" icon={CheckCircle2} color="oklch(0.48 0.14 155)" glow="oklch(0.7 0.16 155 / 0.18)" />
        <StatCard label="Wants Demo" value={String(stats.wantsDemo)} sub="free demo requested" icon={CalendarCheck} color="oklch(0.55 0.18 25)" glow="oklch(0.65 0.18 25 / 0.18)" />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search parents, students, phone…"
              className="h-9 w-72 rounded-lg border border-black/[0.06] bg-white pl-9 pr-3 text-[13px] text-[#111827] shadow-sm outline-none transition placeholder:text-[#6B7280]/70 focus:border-[color:var(--brand-blue)]/40 focus:ring-2 focus:ring-[color:var(--brand-blue)]/10" />
          </div>
          <div className="inline-flex items-center gap-1 rounded-xl border border-black/[0.06] bg-white p-1 shadow-sm">
            {filterPills.map(opt => {
              const active = statusFilter===opt.id;
              return (
                <button key={opt.id} type="button" onClick={()=>setStatusFilter(opt.id)}
                  className={['inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition', active?'text-white shadow-sm':'text-[#6B7280] hover:bg-black/[0.03] hover:text-[#111827]'].join(' ')}
                  style={active ? { background:'linear-gradient(135deg, oklch(0.2 0.03 265) 0%, oklch(0.14 0.03 265) 100%)' } : undefined}>
                  {opt.id==='all' && <Filter className="h-3 w-3" />}<span>{opt.label}</span>
                  <span className={['inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold', active?'bg-white/15 text-white':'bg-black/[0.05] text-[#6B7280]'].join(' ')}>{opt.count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton label="Export Parents" onExport={() => exportParents(visible as any)} />
          <button type="button" onClick={()=>setModal({open:true})}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-95"
            style={{ background:'var(--gradient-blue)', boxShadow:'0 8px 24px -10px oklch(0.58 0.19 258 / 0.7)' }}>
            <Plus className="h-3.5 w-3.5" />Add Parent
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-black/[0.05] bg-white shadow-[0_1px_2px_oklch(0.14_0.03_265/0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-black/[0.06] text-[10.5px] font-semibold uppercase tracking-wider text-[#6B7280]">
                <th className="px-4 py-3">Parent / Student</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Area</th>
                <th className="px-3 py-3">Class · Subject</th><th className="px-3 py-3">Board</th><th className="px-3 py-3">Time Slot</th>
                <th className="px-3 py-3 text-center">Demo</th><th className="px-3 py-3">Prefers</th><th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length===0 ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-[13px] text-[#6B7280]">No parents match your filters.</td></tr>
              ) : visible.map((p,idx) => {
                const bStyle = boardStyle((p as any).board);
                const wa = (p as any).whatsapp;
                const hasDifferentWa = wa && wa !== p.phone;
                const prefGender = ((p as any).preferredTeacherGender || p.preferredGender || '').toLowerCase();
                return (
                  <tr key={p.id} className={['border-b border-black/[0.04] transition-colors hover:bg-[color:var(--brand-blue)]/[0.03]', idx%2===1?'bg-black/[0.012]':''].join(' ')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[11.5px] font-semibold text-white ring-1 ring-white/20" style={{ background:gradientFor(p.id||displayName(p)) }}>{initialsOf(displayName(p))}</div>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-[#111827]">{displayName(p)}</div>
                          {displayStudent(p) && <div className="truncate text-[11.5px] text-[#6B7280]">{displayStudent(p)}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-[12px] text-[#111827]/85">
                        <Phone className="h-3 w-3 flex-none text-[#6B7280]" /><span className="tabular-nums">{p.phone||'—'}</span>
                        {hasDifferentWa && <span title={`WhatsApp: ${wa}`} className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full" style={{ background:'oklch(0.7 0.16 155 / 0.15)', color:'oklch(0.48 0.14 155)' }}><MessageCircle className="h-2.5 w-2.5" /></span>}
                      </div>
                    </td>
                    <td className="px-3 py-3"><div className="flex items-center gap-1.5 text-[12px] text-[#111827]/85"><MapPin className="h-3 w-3 flex-none" style={{ color:'oklch(0.6 0.14 25)' }} /><span className="truncate">{displayLocation(p)}</span></div></td>
                    <td className="px-3 py-3"><span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium" style={{ background:'oklch(0.68 0.17 245 / 0.06)', color:'oklch(0.35 0.1 258)', borderColor:'oklch(0.68 0.17 245 / 0.18)' }}>{p.class||'—'} · {p.subject||'—'}</span></td>
                    <td className="px-3 py-3">{(p as any).board ? <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold" style={{ background:bStyle.bg, color:bStyle.color, borderColor:bStyle.border }}>{(p as any).board}</span> : <span className="text-[#9CA3AF]">—</span>}</td>
                    <td className="px-3 py-3"><div className="flex items-center gap-1.5 text-[11.5px] text-[#111827]/80"><Clock className="h-3 w-3 flex-none text-[#6B7280]" /><span className="whitespace-nowrap">{(p as any).timeSlot || '—'}</span></div></td>
                    <td className="px-3 py-3 text-center">{(p as any).wantsDemo==='Yes' ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full" style={{ background:'oklch(0.7 0.16 155 / 0.15)', color:'oklch(0.48 0.14 155)' }}><CheckCircle2 className="h-3 w-3" /></span> : <span className="text-[#9CA3AF]">—</span>}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 text-[11.5px] text-[#111827]/80">
                        {prefGender==='female' ? <><User className="h-3 w-3" style={{ color:'oklch(0.55 0.17 340)' }} /><span>Female</span></> :
                         prefGender==='male' ? <><User className="h-3 w-3" style={{ color:'oklch(0.5 0.15 240)' }} /><span>Male</span></> :
                         <><Users2 className="h-3 w-3 text-[#6B7280]" /><span>Any</span></>}
                      </div>
                    </td>
                    <td className="px-3 py-3"><span className="inline-flex items-center rounded-md border border-black/[0.06] bg-black/[0.03] px-1.5 py-0.5 text-[10.5px] font-medium text-[#111827]/70">{p.source||'—'}</span></td>
                    <td className="px-3 py-3"><StatusPill status={p.status} onChange={s=>updateStatus(p.id!,s)} /></td>
                    <td className="px-3 py-3"><div className="flex items-center justify-end gap-1"><button type="button" onClick={()=>setModal({open:true,record:p})} aria-label="Edit" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#6B7280] transition hover:border-[color:var(--brand-blue)]/25 hover:bg-[color:var(--brand-blue)]/[0.06] hover:text-[color:var(--brand-blue)]"><Pencil className="h-3.5 w-3.5" /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-black/[0.05] bg-black/[0.015] px-4 py-2.5 text-[11.5px] text-[#6B7280]">
          <span>Showing <span className="font-semibold text-[#111827]">{visible.length}</span> of {parents.length} parents</span>
        </div>
      </div>

      {modal.open && <ParentModal initial={modal.record} onSave={handleSave} onClose={()=>setModal({open:false})} />}
    </AppShell>
  );
}