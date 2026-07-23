'use client';
// src/app/fees/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import ExportButton from '@/components/ExportButton';
import { exportFees } from '@/lib/exportExcel';
import { Modal, ModalFooter, BtnPrimary, BtnSecondary, currency } from '@/components/UI';
import {
  getFees, addFee, updateFee, deleteFee, generateReminderForFee,
  getParents, getTutors,
  FeeRecord, Parent, Tutor,
} from '@/lib/firestore';
import {
  Search, Plus, Wallet, TrendingDown, TrendingUp, Clock,
  Pencil, Trash2, ChevronDown,
} from 'lucide-react';

const CLASS_LEVELS = ['Nursery','LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10 (Board)','Class 11','Class 12 (Board)','Competitive Exam (JEE/NEET)','Competitive Exam (Govt Job)','Summer Classes','Drawing / Art','Music / Singing','Dance','Other'];
const SUBJECTS = ['Maths','Science','Physics','Chemistry','Biology','English','Hindi','Social Science','Computer Science','Accountancy / Commerce','Economics','JEE Coaching','NEET Coaching','Drawing / Art','Music / Singing','Dance','All Subjects','Other'];
type PayStatus = 'pending'|'received'|'paid';
const inr = currency;
const initialsOf = (name:string) => name.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]?.toUpperCase()).join('');

// NOTE: hoursPerMonth isn't on FeeRecord yet — add `hoursPerMonth?: number` to the
// FeeRecord type in lib/firestore.ts so this stops needing `as any` casts below.
type FeeRow = FeeRecord & { hoursPerMonth?: number };

const STATUS_STYLE: Record<PayStatus, {label:string;bg:string;fg:string;border:string;dot:string}> = {
  pending:  { label:'Pending',  bg:'oklch(0.9 0.05 85)',  fg:'oklch(0.5 0.13 70)',   border:'oklch(0.75 0.12 75 / 0.6)',  dot:'oklch(0.78 0.17 75)' },
  received: { label:'Received', bg:'oklch(0.9 0.05 245)', fg:'oklch(0.4 0.16 258)',  border:'oklch(0.65 0.14 245 / 0.55)', dot:'oklch(0.58 0.19 258)' },
  paid:     { label:'Paid',     bg:'oklch(0.92 0.06 155)',fg:'oklch(0.35 0.15 155)', border:'oklch(0.65 0.16 155 / 0.55)', dot:'oklch(0.55 0.16 158)' },
};

function getMonthOptions() {
  const months: string[] = []; const now = new Date();
  for (let i=0;i<12;i++){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); months.push(d.toLocaleString('en-IN',{month:'long',year:'numeric'})); }
  return months;
}

// ── Shared Tailwind form primitives (kept local so the modal matches the page) ──

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

function StatusBadge({ status, onChange }: { status: PayStatus; onChange?: (s:PayStatus)=>void }) {
  const style = STATUS_STYLE[status];
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={()=>onChange && setOpen(v=>!v)} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-90" style={{ background:style.bg, color:style.fg, borderColor:style.border }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background:style.dot }} />{style.label}{onChange && <ChevronDown className="h-3 w-3 opacity-70" />}
      </button>
      {open && onChange && (<>
        <div className="fixed inset-0 z-30" onClick={()=>setOpen(false)} />
        <div className="absolute z-40 mt-1.5 min-w-[120px] rounded-xl border border-black/[0.08] bg-white p-1 shadow-[0_12px_30px_-12px_oklch(0.14_0.03_265/0.4)]">
          {(Object.keys(STATUS_STYLE) as PayStatus[]).map(s => (
            <button key={s} type="button" onClick={()=>{onChange(s); setOpen(false);}} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition hover:bg-black/[0.05]" style={{ color:STATUS_STYLE[s].fg }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background:STATUS_STYLE[s].dot }} />{STATUS_STYLE[s].label}
            </button>
          ))}
        </div>
      </>)}
    </div>
  );
}

// ── Contact search dropdown (rebuilt to match the Tailwind design used above) ──

function ContactSelect({ label, contacts, value, onSelect, placeholder }: { label:string; contacts:{id?:string;name:string;phone:string}[]; value:string; onSelect:(name:string,phone:string)=>void; placeholder:string }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  useEffect(() => { setQuery(value); }, [value]);
  const filtered = query.trim().length===0 ? contacts.slice(0,8) : contacts.filter(c=>c.name.toLowerCase().includes(query.toLowerCase())||c.phone.includes(query)).slice(0,8);
  return (
    <Field label={label}>
      <div className="relative">
        <input
          value={query}
          onChange={e=>{setQuery(e.target.value); setOpen(true); onSelect(e.target.value,'');}}
          onFocus={()=>setOpen(true)}
          onBlur={()=>setTimeout(()=>setOpen(false),180)}
          placeholder={placeholder}
          autoComplete="off"
          required
          className={inputCls}
        />
        {open && filtered.length>0 && (
          <div className="absolute z-50 mt-1.5 max-h-[200px] w-full overflow-y-auto rounded-xl border border-black/[0.08] bg-white p-1 shadow-[0_12px_30px_-12px_oklch(0.14_0.03_265/0.4)]">
            {filtered.map((c,i) => (
              <div
                key={i}
                onMouseDown={()=>{onSelect(c.name,c.phone); setQuery(c.name); setOpen(false);}}
                className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] transition hover:bg-black/[0.05]"
              >
                <span className="font-semibold text-black/85">{c.name}</span>
                <span className="text-[11px] text-black/45">{c.phone}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}

// ── Add/Edit modal ─────────────────────────────────────────────────────────────

const EMPTY: Omit<FeeRow,'id'|'createdAt'> = { tutorName:'', parentName:'', subject:'', classLevel:'', hoursPerMonth:0, parentFee:0, tutorFee:0, profit:0, month:'', paymentStatus:'pending', notes:'' };

function FeeModal({ initial, onSave, onClose, parents, tutors }: { initial?:FeeRow; onSave:(d:typeof EMPTY)=>Promise<void>; onClose:()=>void; parents:Parent[]; tutors:Tutor[] }) {
  const [form, setForm] = useState(initial ? {...EMPTY,...initial} : {...EMPTY});
  const [customSubject, setCustomSubject] = useState('');
  const [saving, setSaving] = useState(false);
  const profit = (form.parentFee||0)-(form.tutorFee||0);
  const f = (k:keyof typeof form, v:string|number) => setForm(p=>({...p,[k]:v}));

  useEffect(() => { if (initial?.subject && !SUBJECTS.includes(initial.subject)) { setForm(p=>({...p,subject:'Other'})); setCustomSubject(initial.subject); } }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const finalSubject = form.subject==='Other' ? (customSubject.trim()||'Other') : form.subject;
    await onSave({...form, subject:finalSubject, profit});
    setSaving(false); onClose();
  }

  return (
    <Modal title={initial ? 'Edit Fee Record' : 'Add Fee Record'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <ContactSelect label="Tutor Name *" contacts={tutors.map(t=>({id:t.id,name:t.name,phone:t.phone}))} value={form.tutorName} onSelect={name=>f('tutorName',name)} placeholder="Type to search tutors…" />
          <ContactSelect label="Parent Name *" contacts={parents.map(p=>({id:p.id,name:p.name||(p as any).studentName||'',phone:p.phone}))} value={form.parentName} onSelect={name=>f('parentName',name)} placeholder="Type to search parents…" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Subject *">
            <select value={form.subject} onChange={e=>f('subject',e.target.value)} required className={selectCls}>
              <option value="">Select</option>{SUBJECTS.map(s=><option key={s}>{s}</option>)}
            </select>
            {form.subject==='Other' && <input className={inputCls + ' mt-2'} value={customSubject} onChange={e=>setCustomSubject(e.target.value)} placeholder="Enter subject" required />}
          </Field>
          <Field label="Class Level *">
            <select value={form.classLevel} onChange={e=>f('classLevel',e.target.value)} required className={selectCls}>
              <option value="">Select</option>{CLASS_LEVELS.map(c=><option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Month *">
            <select value={form.month} onChange={e=>f('month',e.target.value)} required className={selectCls}>
              <option value="">Select Month</option>{getMonthOptions().map(m=><option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Hours This Month">
            <input type="number" min="0" step="0.5" value={form.hoursPerMonth||''} onChange={e=>f('hoursPerMonth',Number(e.target.value))} placeholder="e.g. 12" className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Parent Pays You (₹) *">
            <input type="number" min="0" value={form.parentFee||''} onChange={e=>f('parentFee',Number(e.target.value))} placeholder="3500" required className={inputCls} />
          </Field>
          <Field label="You Pay Tutor (₹) *">
            <input type="number" min="0" value={form.tutorFee||''} onChange={e=>f('tutorFee',Number(e.target.value))} placeholder="2500" required className={inputCls} />
          </Field>
        </div>

        <Field label="Payment Status">
          <select value={form.paymentStatus} onChange={e=>f('paymentStatus',e.target.value as PayStatus)} className={selectCls}>
            <option value="pending">⏳ Pending</option><option value="received">✅ Received from Parent</option><option value="paid">💳 Paid to Tutor</option>
          </select>
        </Field>

        <div
          className="flex items-center justify-between rounded-xl border-2 px-4 py-3 text-[13.5px] font-medium"
          style={{
            background: profit>=0 ? 'oklch(0.95 0.04 155)' : 'oklch(0.95 0.04 25)',
            borderColor: profit>=0 ? 'oklch(0.75 0.13 155)' : 'oklch(0.75 0.13 25)',
            color: profit>=0 ? 'oklch(0.35 0.15 155)' : 'oklch(0.45 0.17 25)',
          }}
        >
          <span>Profit:</span><strong className="text-[19px]">{inr(profit)}</strong>
        </div>

        {form.paymentStatus==='pending' && (
          <div className="flex items-center gap-2 rounded-xl border-2 px-3.5 py-2.5 text-[12.5px] font-medium" style={{ background:'oklch(0.94 0.04 245)', borderColor:'oklch(0.72 0.13 245)', color:'oklch(0.4 0.16 258)' }}>
            🔔 A follow-up reminder will be auto-created (due in 5 days).
          </div>
        )}

        <Field label="Notes">
          <textarea rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="Any payment notes…" className={textareaCls} />
        </Field>

        <ModalFooter><BtnSecondary onClick={onClose}>Cancel</BtnSecondary><BtnPrimary type="submit" disabled={saving}>{saving?'Saving…':initial?'Update':'Add Record'}</BtnPrimary></ModalFooter>
      </form>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FeesPage() {
  const [fees, setFees]       = useState<FeeRow[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [tutors, setTutors]   = useState<Tutor[]>([]);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|PayStatus>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [modal, setModal]     = useState<{open:boolean; record?:FeeRow}>({open:false});

  const loadAll = useCallback(async () => {
    const [f,p,t] = await Promise.all([getFees(), getParents(), getTutors()]);
    setFees(f as FeeRow[]); setParents(p); setTutors(t);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const availableMonths = useMemo(() => {
    const set = new Set(fees.map(f=>f.month).filter(Boolean));
    return Array.from(set).sort((a,b) => new Date(b).getTime()-new Date(a).getTime()).slice(0,7);
  }, [fees]);

  const scopedFees = useMemo(() => monthFilter==='all' ? fees : fees.filter(f=>f.month===monthFilter), [fees, monthFilter]);

  const filtered = useMemo(() => {
    return scopedFees.filter(r => {
      const matchesSearch = [r.tutorName,r.parentName,r.subject].some(v=>v?.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter==='all' || r.paymentStatus===statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [scopedFees, search, statusFilter]);

  const totals = useMemo(() => {
    const confirmed = scopedFees.filter(r=>r.paymentStatus!=='pending');
    const paidOut = scopedFees.filter(r=>r.paymentStatus==='paid').reduce((a,r)=>a+(r.tutorFee||0),0);
    const tutorDue = confirmed.reduce((a,r)=>a+(r.tutorFee||0),0);
    const totalReceived = confirmed.reduce((a,r)=>a+(r.parentFee||0),0);
    const net = totalReceived - tutorDue;
    const pending = scopedFees.filter(r=>r.paymentStatus==='pending').reduce((a,r)=>a+(r.parentFee||0),0);
    return { received: totalReceived, paidOut, tutorDue, net, pending };
  }, [scopedFees]);

  const counts = useMemo(() => ({
    all: scopedFees.length,
    pending: scopedFees.filter(r=>r.paymentStatus==='pending').length,
    received: scopedFees.filter(r=>r.paymentStatus==='received').length,
    paid: scopedFees.filter(r=>r.paymentStatus==='paid').length,
  }), [scopedFees]);

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      const wasNotPending = modal.record.paymentStatus !== 'pending';
      await updateFee(modal.record.id, data);
      setFees(p => p.map(x => x.id===modal.record!.id ? {...x,...data} : x));
      if (data.paymentStatus==='pending' && wasNotPending) { try { await generateReminderForFee({id:modal.record.id,...data}); } catch {} }
    } else {
      const ref = await addFee(data);
      const newFee = { id: ref.id, ...data };
      setFees(p => [{...newFee, createdAt:{seconds:Date.now()/1000}},...p]);
      if (data.paymentStatus==='pending') { try { await generateReminderForFee(newFee); } catch {} }
    }
  }

  async function updateStatus(id: string, status: PayStatus) {
    const fee = fees.find(f=>f.id===id);
    const wasNotPending = fee?.paymentStatus !== 'pending';
    await updateFee(id, { paymentStatus: status });
    setFees(p => p.map(x => x.id===id ? {...x,paymentStatus:status} : x));
    if (status==='pending' && wasNotPending && fee) { try { await generateReminderForFee({...fee,id}); } catch {} }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this fee record?')) return;
    await deleteFee(id);
    setFees(p => p.filter(x => x.id !== id));
  }

  return (
    <AppShell title="Fees & Payments" onRefresh={loadAll}>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Received from Parents" value={inr(totals.received)} subtitle="confirmed payments" icon={Wallet} accent="oklch(0.5 0.16 158)" valueColor="oklch(0.35 0.15 155)" />
        <StatCard label="Tutor Fee Due" value={inr(totals.tutorDue)} subtitle={`Paid ${inr(totals.paidOut)}`} icon={TrendingDown} accent="oklch(0.55 0.2 25)" valueColor="oklch(0.45 0.17 25)" />
        <StatCard label="Net Profit" value={inr(totals.net)} subtitle="revenue minus tutor fees" icon={TrendingUp} accent="oklch(0.53 0.19 258)" valueColor={totals.net>=0 ? 'oklch(0.35 0.15 155)' : 'oklch(0.45 0.17 25)'} />
        <StatCard label="Pending Records" value={inr(totals.pending)} subtitle={`${counts.pending} records awaiting payment`} icon={Clock} accent="oklch(0.68 0.16 75)" valueColor="oklch(0.45 0.14 75)" />
      </div>

      {/* Action bar */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tutor, parent, subject..."
              className="h-10 w-full rounded-xl border border-black/[0.14] bg-white pl-9 pr-4 text-[13px] text-black/85 shadow-sm outline-none transition placeholder:text-black/40 focus:border-[oklch(0.58_0.19_258)] focus:ring-2 focus:ring-[oklch(0.58_0.19_258/0.15)]" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['all','pending','received','paid'] as const).map(s => (
              <button key={s} type="button" onClick={()=>setStatusFilter(s)}
                className={['rounded-full border px-3 py-1.5 text-[12px] font-semibold transition', statusFilter===s ? 'border-[oklch(0.58_0.19_258)] bg-[oklch(0.58_0.19_258)] text-white shadow-sm' : 'border-black/[0.14] bg-white text-black/65 hover:border-black/[0.22] hover:bg-black/[0.03]'].join(' ')}>
                {s[0].toUpperCase()+s.slice(1)}
                <span className={['ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold', statusFilter===s?'bg-white/20 text-white':'bg-black/[0.08] text-black/60'].join(' ')}>{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={()=>setMonthFilter('all')} className={['rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition', monthFilter==='all'?'border-black/[0.14] bg-black/[0.06] text-black/90':'border-transparent text-black/55 hover:bg-black/[0.04] hover:text-black/80'].join(' ')}>All Months</button>
            {availableMonths.map(m => (
              <button key={m} type="button" onClick={()=>setMonthFilter(m)} className={['rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition', monthFilter===m?'border-black/[0.14] bg-black/[0.06] text-black/90':'border-transparent text-black/55 hover:bg-black/[0.04] hover:text-black/80'].join(' ')}>{m}</button>
            ))}
          </div>
          <ExportButton label="Export" onExport={() => exportFees(filtered)} />
          <button type="button" onClick={()=>setModal({open:true})}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_oklch(0.58_0.19_258/0.7)] transition hover:brightness-110 active:scale-[0.98]"
            style={{ background:'var(--gradient-blue)' }}><Plus className="h-4 w-4" />Add Record</button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-black/[0.1] bg-white shadow-[0_1px_3px_oklch(0.14_0.03_265/0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-black/[0.1] bg-[oklch(0.96_0.006_260)]">
                {['Tutor','Parent','Subject & Class','Month','Hrs','Parent Pays','Tutor Gets','Profit','Status'].map(h => <th key={h} className="px-3 py-3 font-semibold text-black/65">{h}</th>)}
                <th className="px-3 py-3 text-right font-semibold text-black/65">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={10} className="px-4 py-16 text-center text-[13px] text-black/50">No fee records found.</td></tr>
              ) : filtered.map((r,i) => {
                const profit = (r.parentFee||0)-(r.tutorFee||0);
                return (
                  <tr key={r.id} className={['group border-b border-black/[0.06] transition hover:bg-[oklch(0.58_0.19_258/0.04)]', i%2===1?'bg-black/[0.02]':'bg-white'].join(' ')}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10.5px] font-bold text-white ring-1 ring-black/[0.08]" style={{ background:'var(--gradient-blue)' }}>{initialsOf(r.tutorName)}</div>
                        <div className="font-semibold text-black/90">{r.tutorName}</div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-medium text-black/85">{r.parentName}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center rounded-md border border-black/[0.1] bg-black/[0.04] px-1.5 py-1 text-[10.5px] font-medium text-black/75">{r.subject}<span className="mx-1.5 h-3 w-px bg-black/[0.15]" />{r.classLevel}</span>
                    </td>
                    <td className="px-3 py-3 text-black/70">{r.month}</td>
                    <td className="px-3 py-3 text-black/70">{r.hoursPerMonth ? `${r.hoursPerMonth}h` : '—'}</td>
                    <td className="px-3 py-3"><span className="font-bold" style={{ color:'oklch(0.4 0.17 155)' }}>{inr(r.parentFee||0)}</span></td>
                    <td className="px-3 py-3 "><span className="font-bold" style={{ color:'oklch(0.5 0.19 25)' }}>{inr(r.tutorFee||0)}</span></td>
                    <td className="px-3 py-3"><span className="font-bold text-nowrap" style={{ color: profit>=0 ? 'oklch(0.4 0.17 155)' : 'oklch(0.5 0.19 25)' }}>{profit>0?'+':''}{inr(profit)}</span></td>
                    <td className="px-3 py-3"><StatusBadge status={r.paymentStatus as PayStatus} onChange={s=>updateStatus(r.id!,s)} /></td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button type="button" onClick={()=>setModal({open:true,record:r})} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-black/55 transition hover:bg-black/[0.06] hover:text-black/85"><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={()=>handleDelete(r.id!)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-black/55 transition hover:bg-[oklch(0.6_0.22_25/0.1)] hover:text-[oklch(0.55_0.22_25)]"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && <FeeModal initial={modal.record} onSave={handleSave} onClose={()=>setModal({open:false})} parents={parents} tutors={tutors} />}
    </AppShell>
  );
}