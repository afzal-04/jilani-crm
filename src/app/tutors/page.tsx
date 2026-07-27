'use client';
// src/app/tutors/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import ExportButton from '@/components/ExportButton';
import { exportTutors } from '@/lib/exportExcel';
import { Modal, ModalFooter, BtnPrimary, BtnSecondary, currency } from '@/components/UI';
import { getTutors, addTutor, updateTutor, deleteTutor, Tutor, LeadStatus } from '@/lib/firestore';
import {
  Search, Plus, Users, UserCheck, Sparkles, Wallet,
  Phone, Pencil, Trash2, ChevronDown,
} from 'lucide-react';

const LEAD_STATUSES: LeadStatus[] = ['new','contacted','demo_scheduled','converted','closed'];
const QUALIFICATIONS = ['12th Pass','Pursuing Graduation','B.A','B.Sc','B.Com','B.Tech / B.E','BCA','B.Ed','M.A','M.Sc','M.Com','M.Tech','MBA','PhD','Other'];
const AREAS = ['Shankar Nagar','Civil Lines','Pandri','Telibandha','Tatibandh','Devendra Nagar','Raipur Station Road','Pachpedi Naka','Avanti Vihar','Byron Bazar','Mowa','Khamardih','Fafadih','Rajendra Nagar','Kabir Nagar','Gopal Nagar','New Rajendra Nagar','Shanti Nagar','Other'];

const inr = currency;
const initialsOf = (name:string) => name.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]?.toUpperCase()).join('');
const fmtDate = (t: Tutor) => {
  const secs = (t as any).createdAt?.seconds;
  if (!secs) return '—';
  return new Date(secs*1000).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
};

const STATUS_STYLE: Record<LeadStatus, {label:string;bg:string;fg:string;border:string;dot:string}> = {
  new:             { label:'New',            bg:'oklch(0.9 0.05 245)', fg:'oklch(0.4 0.16 258)',  border:'oklch(0.65 0.14 245 / 0.55)', dot:'oklch(0.58 0.19 258)' },
  contacted:       { label:'Contacted',       bg:'oklch(0.9 0.05 85)',  fg:'oklch(0.5 0.13 70)',   border:'oklch(0.75 0.12 75 / 0.6)',   dot:'oklch(0.78 0.17 75)' },
  demo_scheduled:  { label:'Demo Scheduled',  bg:'oklch(0.9 0.06 300)', fg:'oklch(0.45 0.17 300)', border:'oklch(0.72 0.14 300 / 0.55)', dot:'oklch(0.6 0.19 300)' },
  converted:       { label:'Converted',       bg:'oklch(0.92 0.06 155)',fg:'oklch(0.35 0.15 155)', border:'oklch(0.65 0.16 155 / 0.55)', dot:'oklch(0.55 0.16 158)' },
  closed:          { label:'Closed',          bg:'oklch(0.93 0.005 260)',fg:'oklch(0.5 0.02 260)', border:'oklch(0.85 0.01 260)',        dot:'oklch(0.65 0.02 260)' },
};

// ── Shared Tailwind form primitives (matches fees/assignments pages) ───────────

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-black/65">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "h-10 w-full rounded-xl border border-black/[0.14] bg-white px-3 text-[13px] text-black/85 shadow-sm outline-none transition placeholder:text-black/40 focus:border-[oklch(0.58_0.19_258)] focus:ring-2 focus:ring-[oklch(0.58_0.19_258/0.15)]";
const selectCls = inputCls + " appearance-none";
const textareaCls = "w-full rounded-xl border border-black/[0.14] bg-white px-3 py-2 text-[13px] text-black/85 shadow-sm outline-none transition placeholder:text-black/40 focus:border-[oklch(0.58_0.19_258)] focus:ring-2 focus:ring-[oklch(0.58_0.19_258/0.15)]";

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, subtitle, icon: Icon, accent, valueColor }: { label:string; value:string; subtitle:string; icon:any; accent:string; valueColor?:string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/[0.09] bg-white p-5 shadow-[0_1px_3px_oklch(0.14_0.03_265/0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-20px_oklch(0.14_0.03_265/0.4)]">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background:`linear-gradient(90deg, ${accent}, transparent)`, boxShadow:`0 0 14px ${accent.replace(')',' / 0.4)')}` }} />
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-60" style={{ background:`radial-gradient(closest-side, ${accent.replace(')',' / 0.18)')}, transparent)` }} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold text-black/60">{label}</p>
          <p className="mt-1 text-[26px] font-bold tracking-tight" style={{ color: valueColor || 'oklch(0.2 0.02 265)' }}>{value}</p>
          <p className="mt-1 text-[12px] text-black/50">{subtitle}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-black/[0.06]" style={{ background:accent.replace(')',' / 0.12)'), color:accent }}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

// ── Status badge dropdown ──────────────────────────────────────────────────────

function StatusBadge({ status, onChange }: { status: LeadStatus; onChange?: (s:LeadStatus)=>void }) {
  const style = STATUS_STYLE[status];
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={()=>onChange && setOpen(v=>!v)} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-90" style={{ background:style.bg, color:style.fg, borderColor:style.border }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background:style.dot }} />{style.label}{onChange && <ChevronDown className="h-3 w-3 opacity-70" />}
      </button>
      {open && onChange && (<>
        <div className="fixed inset-0 z-30" onClick={()=>setOpen(false)} />
        <div className="absolute z-40 mt-1.5 min-w-[150px] rounded-xl border border-black/[0.08] bg-white p-1 shadow-[0_12px_30px_-12px_oklch(0.14_0.03_265/0.4)]">
          {LEAD_STATUSES.map(s => (
            <button key={s} type="button" onClick={()=>{onChange(s); setOpen(false);}} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition hover:bg-black/[0.05]" style={{ color:STATUS_STYLE[s].fg }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background:STATUS_STYLE[s].dot }} />{STATUS_STYLE[s].label}
            </button>
          ))}
        </div>
      </>)}
    </div>
  );
}

// ── Add/Edit modal ─────────────────────────────────────────────────────────────

const EMPTY: Omit<Tutor,'id'|'createdAt'|'updatedAt'> = {
  name:'', phone:'', email:'', gender:'', area:'',
  qualification:'', subjects:'', classes:'', experience:'', availability:'',
  status:'new', notes:'', monthlyFee: 0,
};

function TutorModal({ initial, onSave, onClose }: { initial?: Tutor; onSave: (d: typeof EMPTY) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await onSave(form); setSaving(false); onClose();
  }

  return (
    <Modal title={initial ? 'Edit Tutor' : 'Add Tutor Lead'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name *"><input value={form.name} onChange={e=>f('name',e.target.value)} required className={inputCls} /></Field>
          <Field label="Phone *"><input value={form.phone} onChange={e=>f('phone',e.target.value)} placeholder="+91 XXXXX XXXXX" required className={inputCls} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Email"><input type="email" value={form.email} onChange={e=>f('email',e.target.value)} className={inputCls} /></Field>
          <Field label="Gender">
            <select value={form.gender} onChange={e=>f('gender',e.target.value)} className={selectCls}>
              <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Area">
            <select value={form.area} onChange={e=>f('area',e.target.value)} className={selectCls}>
              <option value="">Select</option>{AREAS.map(a=><option key={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Qualification">
            <select value={form.qualification} onChange={e=>f('qualification',e.target.value)} className={selectCls}>
              <option value="">Select</option>{QUALIFICATIONS.map(q=><option key={q}>{q}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Subjects (comma separated)"><input value={form.subjects} onChange={e=>f('subjects',e.target.value)} placeholder="Maths, Physics, Chemistry" className={inputCls} /></Field>
          <Field label="Classes (comma separated)"><input value={form.classes} onChange={e=>f('classes',e.target.value)} placeholder="Class 6-8, Class 9-10" className={inputCls} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Experience"><input value={form.experience} onChange={e=>f('experience',e.target.value)} placeholder="e.g. 3 years" className={inputCls} /></Field>
          <Field label="Availability"><input value={form.availability} onChange={e=>f('availability',e.target.value)} placeholder="e.g. Mon-Fri evenings" className={inputCls} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Expected Monthly Fee (₹)"><input type="number" min="0" value={form.monthlyFee||''} onChange={e=>f('monthlyFee',Number(e.target.value))} placeholder="3000" className={inputCls} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={e=>f('status',e.target.value as LeadStatus)} className={selectCls}>
              {LEAD_STATUSES.map(s=><option key={s} value={s}>{STATUS_STYLE[s].label}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Notes">
          <textarea rows={3} value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="Any additional notes…" className={textareaCls} />
        </Field>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Update' : 'Add Tutor'}</BtnPrimary>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TutorsPage() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|LeadStatus>('all');
  const [modal, setModal] = useState<{open:boolean; record?:Tutor}>({open:false});

  const loadAll = useCallback(async () => setTutors(await getTutors()), []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = useMemo(() => {
    return tutors
      .filter(t => statusFilter==='all' || t.status===statusFilter)
      .filter(t => !search || [t.name,t.phone,t.area,t.subjects,t.qualification].some(v => v?.toLowerCase().includes(search.toLowerCase())));
  }, [tutors, search, statusFilter]);

  const counts = useMemo(() => ({
    all: tutors.length,
    new: tutors.filter(t=>t.status==='new').length,
    contacted: tutors.filter(t=>t.status==='contacted').length,
    demo_scheduled: tutors.filter(t=>t.status==='demo_scheduled').length,
    converted: tutors.filter(t=>t.status==='converted').length,
    closed: tutors.filter(t=>t.status==='closed').length,
  }), [tutors]);

  const avgFee = useMemo(() => {
    const withFee = tutors.filter(t => t.monthlyFee);
    if (!withFee.length) return 0;
    return Math.round(withFee.reduce((s,t)=>s+(t.monthlyFee||0),0) / withFee.length);
  }, [tutors]);

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      await updateTutor(modal.record.id, data);
      setTutors(t => t.map(x => x.id===modal.record!.id ? {...x,...data} : x));
    } else {
      const ref = await addTutor(data);
      setTutors(t => [{id:ref.id,...data,createdAt:{seconds:Date.now()/1000}},...t]);
    }
  }

  async function handleStatusChange(id: string, status: LeadStatus) {
    await updateTutor(id, { status });
    setTutors(t => t.map(x => x.id===id ? {...x,status} : x));
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this tutor lead?')) return;
    await deleteTutor(id);
    setTutors(t => t.filter(x => x.id !== id));
  }

  return (
    <AppShell title="Tutor Leads" onRefresh={loadAll} badges={{'/tutors': counts.new}}>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Tutors" value={String(counts.all)} subtitle="all leads on file" icon={Users} accent="oklch(0.53 0.19 258)" />
        <StatCard label="New Leads" value={String(counts.new)} subtitle="awaiting first contact" icon={Sparkles} accent="oklch(0.68 0.16 75)" valueColor="oklch(0.45 0.14 75)" />
        <StatCard label="Converted" value={String(counts.converted)} subtitle="successfully onboarded" icon={UserCheck} accent="oklch(0.5 0.16 158)" valueColor="oklch(0.35 0.15 155)" />
        <StatCard label="Avg. Expected Fee" value={inr(avgFee)} subtitle="across tutors with a fee set" icon={Wallet} accent="oklch(0.6 0.19 300)" />
      </div>

      {/* Action bar */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, subject…"
              className="h-10 w-full rounded-xl border border-black/[0.14] bg-white pl-9 pr-4 text-[13px] text-black/85 shadow-sm outline-none transition placeholder:text-black/40 focus:border-[oklch(0.58_0.19_258)] focus:ring-2 focus:ring-[oklch(0.58_0.19_258/0.15)]" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', ...LEAD_STATUSES] as const).map(s => (
              <button key={s} type="button" onClick={()=>setStatusFilter(s)}
                className={['rounded-full border px-3 py-1.5 text-[12px] font-semibold capitalize transition', statusFilter===s ? 'border-[oklch(0.58_0.19_258)] bg-[oklch(0.58_0.19_258)] text-white shadow-sm' : 'border-black/[0.14] bg-white text-black/65 hover:border-black/[0.22] hover:bg-black/[0.03]'].join(' ')}>
                {s==='all' ? 'All' : STATUS_STYLE[s].label}
                <span className={['ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold', statusFilter===s?'bg-white/20 text-white':'bg-black/[0.08] text-black/60'].join(' ')}>{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton label="Export" onExport={() => exportTutors(filtered)} />
          <button type="button" onClick={()=>setModal({open:true})}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_oklch(0.58_0.19_258/0.7)] transition hover:brightness-110 active:scale-[0.98]"
            style={{ background:'var(--gradient-blue)' }}><Plus className="h-4 w-4" />Add Tutor</button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-black/[0.1] bg-white shadow-[0_1px_3px_oklch(0.14_0.03_265/0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-black/[0.1] bg-[oklch(0.96_0.006_260)]">
                {['Tutor','Area','Qualification','Subjects & Classes','Fee','Added','Status'].map(h => <th key={h} className="px-3 py-3 font-semibold text-black/65">{h}</th>)}
                <th className="px-3 py-3 text-right font-semibold text-black/65">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-[13px] text-black/50">No tutor leads found.</td></tr>
              ) : filtered.map((t,i) => (
                <tr key={t.id} className={['group border-b border-black/[0.06] transition hover:bg-[oklch(0.58_0.19_258/0.04)]', i%2===1?'bg-black/[0.02]':'bg-white'].join(' ')}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10.5px] font-bold text-white ring-1 ring-black/[0.08]" style={{ background:'var(--gradient-blue)' }}>{initialsOf(t.name)}</div>
                      <div className="min-w-0">
                        <div className="font-semibold text-black/90">{t.name}</div>
                        <div className="flex items-center gap-1 text-[11px] text-black/50"><Phone className="h-2.5 w-2.5" />{t.phone||'—'}</div>
                        {t.experience && <div className="text-[10.5px] text-black/40">{t.experience} exp</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-black/70">{t.area||'—'}</td>
                  <td className="px-3 py-3 text-black/70">{t.qualification||'—'}</td>
                  <td className="px-3 py-3">
                    <div className="max-w-[220px] truncate text-black/75">{t.subjects||'—'}</div>
                    <div className="max-w-[220px] truncate text-[10.5px] text-black/45">{t.classes||'—'}</div>
                  </td>
                  <td className="px-3 py-3"><span className="font-bold text-black/80">{t.monthlyFee ? inr(t.monthlyFee) : '—'}</span></td>
                  <td className="px-3 py-3 text-black/60">{fmtDate(t)}</td>
                  <td className="px-3 py-3"><StatusBadge status={t.status} onChange={s=>handleStatusChange(t.id!,s)} /></td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button type="button" onClick={()=>setModal({open:true,record:t})} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-black/55 transition hover:bg-black/[0.06] hover:text-black/85"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={()=>handleDelete(t.id!)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-black/55 transition hover:bg-[oklch(0.6_0.22_25/0.1)] hover:text-[oklch(0.55_0.22_25)]"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && <TutorModal initial={modal.record} onSave={handleSave} onClose={() => setModal({open:false})} />}
    </AppShell>
  );
}