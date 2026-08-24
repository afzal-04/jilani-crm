'use client';
// src/app/assignments/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import ExportButton from '@/components/ExportButton';
import { exportAssignments } from '@/lib/exportExcel';
import {
  Modal, ModalForm, FormRow, FormGroup, ModalFooter,
  BtnPrimary, BtnSecondary, BtnGold, currency,
} from '@/components/UI';
import {
  getAssignments, addAssignment, updateAssignment, deleteAssignment,
  generateRemindersForAssignment, addFee,
  getParents, getTutors,
  Assignment, ClassStatus, Parent, Tutor,
} from '@/lib/firestore';
import {
  Search, Plus, CalendarPlus, ClipboardList, Wallet, TrendingDown, TrendingUp,
  MapPin, Phone, Pencil, Trash2, Copy, ChevronDown, Filter, Calendar,
} from 'lucide-react';

const CLASS_LEVELS = ['Nursery','LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10 (Board)','Class 11','Class 12 (Board)','Competitive Exam (JEE/NEET)','Competitive Exam (Govt Job)','Summer Classes','Drawing / Art','Music / Singing','Dance','Other'];
const SUBJECTS = ['Maths','Science','Physics','Chemistry','Biology','English','Hindi','Social Science','Computer Science','Accountancy / Commerce','Economics','JEE Coaching','NEET Coaching','Drawing / Art','Music / Singing','Dance','All Subjects','Other'];
const AREAS = ['Shankar Nagar','Civil Lines','Pandri','Telibandha','Tatibandh','Devendra Nagar','Raipur Station Road','Pachpedi Naka','Avanti Vihar','Byron Bazar','Mowa','Khamardih','Fafadih','Rajendra Nagar','Kabir Nagar','Gopal Nagar','New Rajendra Nagar','Shanti Nagar','Other'];

const inr = currency;
const initialsOf = (name: string) => name.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]?.toUpperCase()).join('');
const fmtDate = (iso: string) => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); };

const STATUS_STYLE: Record<ClassStatus, { bg:string; fg:string; border:string; dot:string; label:string }> = {
  active:    { label:'Active',    bg:'oklch(0.7 0.16 155 / 0.12)',  fg:'oklch(0.45 0.16 155)', border:'oklch(0.7 0.16 155 / 0.3)',  dot:'oklch(0.7 0.16 155)' },
  paused:    { label:'Paused',    bg:'oklch(0.78 0.17 75 / 0.14)',  fg:'oklch(0.55 0.15 68)',  border:'oklch(0.78 0.17 75 / 0.3)',  dot:'oklch(0.78 0.17 75)' },
  completed: { label:'Completed',bg:'oklch(0.9 0.005 260)',        fg:'oklch(0.5 0.02 260)',  border:'oklch(0.85 0.01 260)',       dot:'oklch(0.65 0.02 260)' },
};

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, subtitle, icon: Icon, accent }: { label:string; value:string; subtitle:string; icon:any; accent:string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/[0.05] bg-white p-5 shadow-[0_1px_2px_oklch(0.14_0.03_265/0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-20px_oklch(0.14_0.03_265/0.35)]">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background:`linear-gradient(90deg, ${accent}, transparent)`, boxShadow:`0 0 14px ${accent.replace(')',' / 0.4)')}` }} />
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-60" style={{ background:`radial-gradient(closest-side, ${accent.replace(')',' / 0.18)')}, transparent)` }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[26px] font-bold tracking-tight text-[#111827]">{value}</div>
          <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">{label}</div>
          <div className="mt-1 text-[11.5px] text-[#6B7280]/85">{subtitle}</div>
        </div>
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl" style={{ background:accent.replace(')',' / 0.12)'), color:accent, border:`1px solid ${accent.replace(')',' / 0.22)')}` }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────

function AssignmentRow({ a, onStatus, onDelete, onEdit, onDuplicate, muted=false }: { a: Assignment; onStatus:(id:string,s:ClassStatus)=>void; onDelete:(id:string)=>void; onEdit:(a:Assignment)=>void; onDuplicate:(a:Assignment)=>void; muted?:boolean }) {  const [menuOpen, setMenuOpen] = useState(false);
  const profit = (a.monthlyFeeParent||0) - (a.monthlyFeeTutor||0);
  const st = STATUS_STYLE[a.status];

  return (
    <div className={['group relative grid grid-cols-12 items-center gap-4 rounded-xl border border-black/[0.05] bg-white px-4 py-3.5 shadow-[0_1px_2px_oklch(0.14_0.03_265/0.03)] transition-all duration-200',
      // While the status menu is open, lift this row's stacking order above its
      // siblings. Without this, `hover:-translate-y-0.5` below creates a new
      // stacking context on hover (any transform does), which traps the menu's
      // z-30 inside this row — so the row *after* it (later in the DOM, painted
      // on top by default) covers the bottom of the dropdown and hides
      // "Completed". Explicit z-index on the row wins regardless of transform.
      menuOpen ? 'z-30' : 'z-0',
      muted ? 'opacity-70 hover:opacity-100' : 'hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-16px_oklch(0.14_0.03_265/0.3)]'].join(' ')}>

      <div className="col-span-12 flex items-center gap-3 md:col-span-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[12px] font-semibold text-white ring-1 ring-white/20" style={{ background:'linear-gradient(135deg, oklch(0.82 0.17 78) 0%, oklch(0.72 0.17 60) 100%)' }}>{initialsOf(a.tutorName)}</div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold tracking-tight text-[#111827]">{a.tutorName}</div>
          <div className="flex items-center gap-1 text-[11px] text-[#6B7280]"><Phone className="h-2.5 w-2.5" /><span className="truncate">{a.tutorPhone||'—'}</span></div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider" style={{ color:'oklch(0.55 0.15 68)' }}>Tutor</div>
        </div>
      </div>

      <div className="col-span-12 flex items-center gap-3 md:col-span-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[12px] font-semibold text-white ring-1 ring-white/20" style={{ background:'linear-gradient(135deg, oklch(0.58 0.19 258) 0%, oklch(0.68 0.17 245) 100%)' }}>{initialsOf(a.parentName)}</div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold tracking-tight text-[#111827]">{a.parentName}</div>
          <div className="flex items-center gap-1 text-[11px] text-[#6B7280]"><Phone className="h-2.5 w-2.5" /><span className="truncate">{a.parentPhone||'—'}</span></div>
        </div>
      </div>

      <div className="col-span-12 md:col-span-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background:'oklch(0.68 0.17 245 / 0.1)', color:'oklch(0.5 0.18 258)', border:'1px solid oklch(0.68 0.17 245 / 0.22)' }}>{a.subject}</span>
          <span className="inline-flex items-center rounded-md bg-black/[0.04] px-2 py-0.5 text-[11px] font-medium text-[#111827]/70">{a.classLevel}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-[#6B7280]"><MapPin className="h-3 w-3" style={{ color:'oklch(0.6 0.14 25)' }} /><span className="truncate">{a.area||'—'}</span></div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#6B7280]">
          <Calendar className="h-3 w-3" style={{ color:'oklch(0.58 0.19 258)' }} />
          <span>{a.classesPerWeek}×/wk · {(a as any).hoursPerSession ?? 1}hr</span>
          <span className="text-[#6B7280]/40">·</span><span>from {fmtDate(a.startDate)}</span>
        </div>
      </div>

      <div className="col-span-8 md:col-span-2">
        <div className="grid grid-cols-3 gap-2 text-right">
          <div><div className="text-[9.5px] font-semibold uppercase tracking-wider text-[#6B7280]">Pays</div><div className="text-[13px] font-bold tabular-nums" style={{ color:'oklch(0.5 0.16 155)' }}>{inr(a.monthlyFeeParent||0)}</div></div>
          <div><div className="text-[9.5px] font-semibold uppercase tracking-wider text-[#6B7280]">Tutor</div><div className="text-[13px] font-bold tabular-nums" style={{ color:'oklch(0.55 0.18 25)' }}>{inr(a.monthlyFeeTutor||0)}</div></div>
          <div><div className="text-[9.5px] font-semibold uppercase tracking-wider text-[#6B7280]">Profit</div><div className="text-[13px] font-bold tabular-nums" style={{ color:'oklch(0.55 0.15 68)' }}>{inr(profit)}</div></div>
        </div>
      </div>

      <div className="col-span-4 flex items-center justify-end gap-2 md:col-span-2">
        <div className="relative">
          <button type="button" onClick={()=>setMenuOpen(v=>!v)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition hover:opacity-90" style={{ background:st.bg, color:st.fg, border:`1px solid ${st.border}` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background:st.dot, boxShadow:`0 0 6px ${st.dot}` }} />{st.label}<ChevronDown className="h-3 w-3 opacity-70" />
          </button>
          {menuOpen && (<>
            <div className="fixed inset-0 z-20" onClick={()=>setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-lg border border-black/[0.08] bg-white shadow-lg">
              {(['active','paused','completed'] as ClassStatus[]).map(s => (
                <button key={s} type="button" onClick={()=>{onStatus(a.id!,s); setMenuOpen(false);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] font-medium text-[#111827]/80 hover:bg-black/[0.04]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background:STATUS_STYLE[s].dot }} />{STATUS_STYLE[s].label}
                </button>
              ))}
            </div>
          </>)}
        </div>
        <div className="flex items-center opacity-0 transition group-hover:opacity-100">
          <button type="button" onClick={()=>onEdit(a)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] hover:bg-black/[0.05] hover:text-[#111827]" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={()=>onDelete(a.id!)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] hover:bg-[oklch(0.55_0.18_25/0.1)] hover:text-[oklch(0.55_0.18_25)]" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={()=>onDuplicate(a)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] hover:bg-[oklch(0.58_0.19_258/0.1)] hover:text-[oklch(0.58_0.19_258)]" aria-label="Duplicate for new month"><Copy className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

// ── Contact search dropdown (reused pattern) ──────────────────────────────────

function ContactSelect({ label, contacts, nameValue, phoneValue, onSelect, placeholder }: {
  label:string; contacts:{id?:string;name:string;phone:string}[]; nameValue:string; phoneValue:string;
  onSelect:(name:string,phone:string,id?:string)=>void; placeholder:string;
}) {
  const [query, setQuery] = useState(nameValue);
  const [open, setOpen] = useState(false);
  useEffect(() => { setQuery(nameValue); }, [nameValue]);
  const filtered = query.trim().length===0 ? contacts.slice(0,8) : contacts.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query)).slice(0,8);
  return (
    <FormGroup label={label}>
      <div style={{position:'relative'}}>
        <input value={query} onChange={e=>{setQuery(e.target.value); setOpen(true); onSelect(e.target.value,'',undefined);}} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),180)} placeholder={placeholder} autoComplete="off" />
        {open && filtered.length>0 && (
          <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:100,background:'#fff',border:'1.5px solid var(--border)',borderRadius:'0 0 8px 8px',boxShadow:'var(--shadow-md)',maxHeight:200,overflowY:'auto'}}>
            {filtered.map((c,i) => (
              <div key={i} onMouseDown={()=>{onSelect(c.name,c.phone,c.id); setQuery(c.name); setOpen(false);}}
                style={{padding:'9px 12px',cursor:'pointer',fontSize:13,borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between'}}>
                <span style={{fontWeight:600}}>{c.name}</span><span style={{color:'var(--text-muted)',fontSize:12}}>{c.phone}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {phoneValue && <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:3}}>📞 {phoneValue}</div>}
    </FormGroup>
  );
}

// ── Add/Edit modal ─────────────────────────────────────────────────────────────

const EMPTY: Omit<Assignment,'id'|'createdAt'> = {
  tutorId:'', tutorName:'', tutorPhone:'', parentId:'', parentName:'', parentPhone:'',
  subject:'', classLevel:'', classesPerWeek:3, hoursPerSession:1 as any,
  startDate:'', monthlyFeeParent:0, monthlyFeeTutor:0, status:'active', area:'', notes:'',
};

function AssignmentModal({ initial, onSave, onClose, parents, tutors }: { initial?:Assignment; onSave:(d:typeof EMPTY)=>Promise<void>; onClose:()=>void; parents:Parent[]; tutors:Tutor[] }) {
  const [form, setForm] = useState(initial ? {...EMPTY, ...initial} : {...EMPTY});
  const [customSubject, setCustomSubject] = useState('');
  const [customArea, setCustomArea] = useState('');
  const [saving, setSaving] = useState(false);
  const profit = (form.monthlyFeeParent||0)-(form.monthlyFeeTutor||0);
  const f = (k:keyof typeof form, v:string|number) => setForm(p=>({...p,[k]:v}));

  useEffect(() => {
    if (initial?.subject && !SUBJECTS.includes(initial.subject)) { setForm(p=>({...p,subject:'Other'})); setCustomSubject(initial.subject); }
    if (initial?.area && !AREAS.includes(initial.area)) { setForm(p=>({...p,area:'Other'})); setCustomArea(initial.area); }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const finalSubject = form.subject==='Other' ? (customSubject.trim()||'Other') : form.subject;
    const finalArea = form.area==='Other' ? (customArea.trim()||'Other') : form.area;
    await onSave({...form, subject:finalSubject, area:finalArea});
    setSaving(false); onClose();
  }

  return (
    <Modal title={initial ? 'Edit Assignment' : 'New Class Assignment'} onClose={onClose}>
      <ModalForm onSubmit={submit}>
        <FormRow>
          <ContactSelect label="Tutor Name *" contacts={tutors.map(t=>({id:t.id,name:t.name,phone:t.phone}))} nameValue={form.tutorName} phoneValue={form.tutorPhone}
            onSelect={(name,phone,id)=>setForm(p=>({...p,tutorName:name,tutorPhone:phone,tutorId:id||''}))} placeholder="Type to search tutors…" />
          <FormGroup label="Tutor Phone"><input value={form.tutorPhone} onChange={e=>f('tutorPhone',e.target.value)} placeholder="+91 XXXXX XXXXX" /></FormGroup>
        </FormRow>
        <FormRow>
          <ContactSelect label="Parent / Student Name *" contacts={parents.map(p=>({id:p.id,name:p.name||(p as any).studentName||'',phone:p.phone}))} nameValue={form.parentName} phoneValue={form.parentPhone}
            onSelect={(name,phone,id)=>setForm(p=>({...p,parentName:name,parentPhone:phone,parentId:id||''}))} placeholder="Type to search parents…" />
          <FormGroup label="Parent Phone"><input value={form.parentPhone} onChange={e=>f('parentPhone',e.target.value)} placeholder="+91 XXXXX XXXXX" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Subject *">
            <select value={form.subject} onChange={e=>f('subject',e.target.value)} required><option value="">Select</option>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
            {form.subject==='Other' && <input style={{marginTop:6}} value={customSubject} onChange={e=>setCustomSubject(e.target.value)} placeholder="Enter subject" required />}
          </FormGroup>
          <FormGroup label="Class Level *"><select value={form.classLevel} onChange={e=>f('classLevel',e.target.value)} required><option value="">Select</option>{CLASS_LEVELS.map(c=><option key={c}>{c}</option>)}</select></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Classes Per Week"><select value={form.classesPerWeek} onChange={e=>f('classesPerWeek',Number(e.target.value))}>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n}/week</option>)}</select></FormGroup>
          <FormGroup label="Hours Per Session"><select value={(form as any).hoursPerSession||1} onChange={e=>f('hoursPerSession' as any,Number(e.target.value))}>{[0.5,1,1.5,2,2.5,3].map(n=><option key={n} value={n}>{n} hr{n!==1?'s':''}</option>)}</select></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Start Date *"><input type="date" value={form.startDate} onChange={e=>f('startDate',e.target.value)} required /></FormGroup>
          <FormGroup label="Area">
            <select value={form.area} onChange={e=>f('area',e.target.value)}><option value="">Select</option>{AREAS.map(a=><option key={a}>{a}</option>)}</select>
            {form.area==='Other' && <input style={{marginTop:6}} value={customArea} onChange={e=>setCustomArea(e.target.value)} placeholder="Enter area" />}
          </FormGroup>
        </FormRow>
        <FormGroup label="Status"><select value={form.status} onChange={e=>f('status',e.target.value as ClassStatus)}>{(['active','paused','completed'] as ClassStatus[]).map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}</select></FormGroup>
        <FormRow>
          <FormGroup label="Parent Pays You (₹/month)"><input type="number" min="0" value={form.monthlyFeeParent||''} onChange={e=>f('monthlyFeeParent',Number(e.target.value))} placeholder="3500" /></FormGroup>
          <FormGroup label="You Pay Tutor (₹/month)"><input type="number" min="0" value={form.monthlyFeeTutor||''} onChange={e=>f('monthlyFeeTutor',Number(e.target.value))} placeholder="2500" /></FormGroup>
        </FormRow>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',borderRadius:10,border:'1.5px solid',background:profit>=0?'#f0fdf4':'#fff1f2',borderColor:profit>=0?'#bbf7d0':'#fecdd3',color:profit>=0?'#166534':'#9f1239',fontSize:13.5}}>
          <span>💡 Monthly Profit:</span><strong style={{fontSize:17}}>{inr(profit)}</strong>
        </div>
        <FormGroup label="Notes"><textarea rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} /></FormGroup>
        <ModalFooter><BtnSecondary onClick={onClose}>Cancel</BtnSecondary><BtnPrimary type="submit" disabled={saving}>{saving?'Saving…':initial?'Update':'Create Assignment'}</BtnPrimary></ModalFooter>
      </ModalForm>
    </Modal>
  );
}

// ── Start New Month modal ──────────────────────────────────────────────────────

function NewMonthModal({ activeAssignments, onConfirm, onClose }: { activeAssignments:Assignment[]; onConfirm:(month:string,ids:string[])=>Promise<void>; onClose:()=>void }) {
  const currentMonth = new Date().toLocaleString('en-IN',{month:'long',year:'numeric'});
  const [month, setMonth] = useState(currentMonth);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function getMonthOptions() { const m=[]; const now=new Date(); for(let i=0;i<6;i++){const d=new Date(now.getFullYear(),now.getMonth()+i,1);m.push(d.toLocaleString('en-IN',{month:'long',year:'numeric'}));} return m; }
  function toggleAll() { setSelected(selected.length===activeAssignments.length ? [] : activeAssignments.map(a=>a.id!)); }
  async function handleConfirm() { setSaving(true); await onConfirm(month, selected); setSaving(false); onClose(); }

  return (
    <Modal title="🗓️ Start New Month — Bulk Fee Records" onClose={onClose}>
      <div style={{padding:'18px 22px 22px',display:'flex',flexDirection:'column',gap:14}}>
        <div style={{padding:12,background:'#EFF6FF',borderRadius:10,border:'1px solid #BFDBFE',fontSize:13,color:'#1D4ED8'}}>Creates fee records for selected active assignments for the chosen month.</div>
        <div>
          <label style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.7,display:'block',marginBottom:6}}>Month</label>
          <select value={month} onChange={e=>setMonth(e.target.value)} style={{padding:'9px 12px',border:'1.5px solid var(--border)',borderRadius:8,fontSize:13.5,width:'100%'}}>{getMonthOptions().map(m=><option key={m}>{m}</option>)}</select>
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <label style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.7}}>Select ({selected.length}/{activeAssignments.length})</label>
            <button onClick={toggleAll} style={{fontSize:12,color:'var(--blue)',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>{selected.length===activeAssignments.length?'Deselect All':'Select All'}</button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:240,overflowY:'auto'}}>
            {activeAssignments.map(a => (
              <label key={a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,border:'1.5px solid',borderColor:selected.includes(a.id!)?'var(--blue)':'var(--border)',background:selected.includes(a.id!)?'var(--blue-light)':'#fff',cursor:'pointer'}}>
                <input type="checkbox" checked={selected.includes(a.id!)} onChange={()=>setSelected(s=>s.includes(a.id!)?s.filter(x=>x!==a.id):[...s,a.id!])} style={{accentColor:'var(--blue)',width:15,height:15}} />
                <div style={{flex:1}}><span style={{fontWeight:600,fontSize:13}}>{a.tutorName}</span><span style={{color:'var(--text-muted)',fontSize:12}}> → {a.parentName} · {a.subject}</span></div>
                <div style={{fontSize:12,fontWeight:700,color:'var(--green-dark)'}}>{inr(a.monthlyFeeParent||0)}</div>
              </label>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnGold onClick={handleConfirm} disabled={saving||selected.length===0}>{saving?'Creating…':`Create ${selected.length} Fee Records`}</BtnGold>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type FilterId = 'all'|'active'|'paused'|'completed';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [tutors, setTutors]   = useState<Tutor[]>([]);
  const [filter, setFilter]   = useState<FilterId>('all');
  const [query, setQuery]     = useState('');
  const [modal, setModal]     = useState<{open:boolean; record?:Assignment}>({open:false});
  const [newMonthModal, setNewMonthModal] = useState(false);

  const loadAll = useCallback(async () => {
    const [a,p,t] = await Promise.all([getAssignments(), getParents(), getTutors()]);
    setAssignments(a); setParents(p); setTutors(t);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const counts = useMemo(() => ({
    all: assignments.length,
    active: assignments.filter(a=>a.status==='active').length,
    paused: assignments.filter(a=>a.status==='paused').length,
    completed: assignments.filter(a=>a.status==='completed').length,
  }), [assignments]);

  const stats = useMemo(() => {
    const active = assignments.filter(a=>a.status==='active');
    const revenue = active.reduce((s,a)=>s+(a.monthlyFeeParent||0),0);
    const pay = active.reduce((s,a)=>s+(a.monthlyFeeTutor||0),0);
    return { count:active.length, revenue, pay, profit:revenue-pay };
  }, [assignments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assignments.filter(a => {
      if (filter!=='all' && a.status!==filter) return false;
      if (!q) return true;
      return [a.tutorName,a.parentName,a.subject,a.area].some(v=>v?.toLowerCase().includes(q));
    });
  }, [assignments, filter, query]);

  const activeLike = filtered.filter(a=>a.status!=='completed');
  const completed = filtered.filter(a=>a.status==='completed');
  const activeAssignments = assignments.filter(a=>a.status==='active');

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      await updateAssignment(modal.record.id, data);
      setAssignments(p => p.map(x => x.id===modal.record!.id ? {...x,...data} : x));
    } else {
      const ref = await addAssignment(data);
      const newA = { id: ref.id, ...data };
      setAssignments(p => [{...newA, createdAt:{seconds:Date.now()/1000}}, ...p]);
      try { await generateRemindersForAssignment(newA); } catch {}
    }
  }

  function handleDuplicate(a: Assignment) {
  const today = new Date().toISOString().split('T')[0];
  const { id, createdAt, ...rest } = a;
  setModal({
    open: true,
    record: {
      ...rest,
      startDate: today,   // reset to today so the new month's start date is correct
      status: 'active',   // new cycle starts active regardless of the old one's status
    } as Assignment,
  });
}
  async function setStatus(id: string, status: ClassStatus) {
    await updateAssignment(id, { status });
    setAssignments(p => p.map(x => x.id===id ? {...x,status} : x));
  }
  async function remove(id: string) {
    if (!confirm('Delete this assignment?')) return;
    await deleteAssignment(id);
    setAssignments(p => p.filter(x => x.id !== id));
  }
  async function handleNewMonth(month: string, selectedIds: string[]) {
    const toCreate = assignments.filter(a => selectedIds.includes(a.id!));
    await Promise.all(toCreate.map(a => addFee({
      tutorName:a.tutorName, parentName:a.parentName, subject:a.subject, classLevel:a.classLevel,
      parentFee:a.monthlyFeeParent||0, tutorFee:a.monthlyFeeTutor||0, profit:(a.monthlyFeeParent||0)-(a.monthlyFeeTutor||0),
      month, paymentStatus:'pending', notes:`Auto-created for ${month}`,
    })));
    alert(`✅ Created ${toCreate.length} fee records for ${month}!`);
  }

  const filterOptions: { id:FilterId; label:string; count:number }[] = [
    { id:'all', label:'All', count:counts.all },
    { id:'active', label:'Active', count:counts.active },
    { id:'paused', label:'Paused', count:counts.paused },
    { id:'completed', label:'Completed', count:counts.completed },
  ];

  return (
    <AppShell title="Assignments" onRefresh={loadAll}>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Assignments" value={String(stats.count)} subtitle="Currently teaching" icon={ClipboardList} accent="oklch(0.68 0.17 245)" />
        <StatCard label="Monthly Revenue" value={inr(stats.revenue)} subtitle="Collected from parents" icon={Wallet} accent="oklch(0.7 0.16 155)" />
        <StatCard label="Monthly Tutor Pay" value={inr(stats.pay)} subtitle="Paid out to tutors" icon={TrendingDown} accent="oklch(0.6 0.18 25)" />
        <StatCard label="Monthly Profit" value={inr(stats.profit)} subtitle="Net margin this month" icon={TrendingUp} accent="oklch(0.78 0.17 75)" />
      </div>

      <div className="mt-6 rounded-2xl border border-black/[0.05] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tutor, parent, subject, area…"
              className="h-9 w-full rounded-lg border border-black/[0.06] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none transition placeholder:text-[#6B7280]/70 focus:border-[color:var(--brand-blue)]/40 focus:ring-2 focus:ring-[color:var(--brand-blue)]/10" />
          </div>
          <div className="inline-flex items-center gap-1 rounded-xl border border-black/[0.06] bg-white p-1">
            {filterOptions.map(opt => {
              const active = filter===opt.id;
              return (
                <button key={opt.id} type="button" onClick={()=>setFilter(opt.id)}
                  className={['inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition', active?'text-white shadow-sm':'text-[#6B7280] hover:bg-black/[0.03] hover:text-[#111827]'].join(' ')}
                  style={active ? { background:'linear-gradient(135deg, oklch(0.2 0.03 265) 0%, oklch(0.14 0.03 265) 100%)' } : undefined}>
                  {opt.id==='all' && <Filter className="h-3 w-3" />}{opt.label}
                  <span className={['inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold', active?'bg-white/15 text-white':'bg-black/[0.05] text-[#6B7280]'].join(' ')}>{opt.count}</span>
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ExportButton label="Export" onExport={() => exportAssignments(filtered)} />
            <button type="button" onClick={()=>setNewMonthModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-[oklch(0.35_0.09_70)] transition hover:opacity-90"
              style={{ background:'linear-gradient(135deg, oklch(0.9 0.14 88) 0%, oklch(0.82 0.17 78) 100%)', boxShadow:'0 8px 24px -12px oklch(0.78 0.17 75 / 0.7)' }}>
              <CalendarPlus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Start New Month</span>
            </button>
            <button type="button" onClick={()=>setModal({open:true})}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-95"
              style={{ background:'var(--gradient-blue)', boxShadow:'0 8px 24px -10px oklch(0.58 0.19 258 / 0.7)' }}>
              <Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">New Assignment</span>
            </button>
          </div>
        </div>
      </div>

      <section className="mt-6 space-y-2.5">
        {activeLike.length===0 && completed.length===0 ? (
          <div className="rounded-2xl border border-dashed border-black/[0.08] bg-white/60 px-6 py-16 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm" style={{ border:'1px solid oklch(0.9 0.005 260)' }}><ClipboardList className="h-4 w-4 text-[#6B7280]" /></div>
            <div className="mt-3 text-[13px] font-medium text-[#111827]/80">No assignments found</div>
            <div className="text-[11.5px] text-[#6B7280]">Try clearing filters or add a new assignment.</div>
          </div>
        ) : (<>
            {activeLike.map(a => <AssignmentRow key={a.id} a={a} onStatus={setStatus} onDelete={remove} onEdit={(a)=>setModal({open:true,record:a})} onDuplicate={handleDuplicate} />)}          {completed.length>0 && (
            <div className="pt-6">
              <div className="mb-3 flex items-center gap-3">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Completed · {completed.length}</div>
                <div className="h-px flex-1 bg-gradient-to-r from-black/[0.08] to-transparent" />
              </div>
            <div className="space-y-2.5">{completed.map(a => <AssignmentRow key={a.id} a={a} onStatus={setStatus} onDelete={remove} onEdit={(a)=>setModal({open:true,record:a})} onDuplicate={handleDuplicate} muted />)}</div>            </div>
          )}
        </>)}
      </section>

      {modal.open && <AssignmentModal initial={modal.record} onSave={handleSave} onClose={()=>setModal({open:false})} parents={parents} tutors={tutors} />}
      {newMonthModal && <NewMonthModal activeAssignments={activeAssignments} onConfirm={handleNewMonth} onClose={()=>setNewMonthModal(false)} />}
    </AppShell>
  );
}