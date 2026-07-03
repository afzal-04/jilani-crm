'use client';
// src/app/assignments/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, FilterRow, FilterBtn,
  TableWrap, Empty, Badge, SearchInput, PhoneLink, BtnPrimary, BtnGold,
  ActionBtn, Modal, ModalForm, FormRow, FormGroup, ModalFooter,
  BtnSecondary, currency, fmtDate,
} from '@/components/UI';
import {
  getAssignments, addAssignment, updateAssignment, deleteAssignment,
  generateRemindersForAssignment, addFee,
  getParents, getTutors,
  Assignment, ClassStatus, Parent, Tutor,
} from '@/lib/firestore';

const CLASS_LEVELS = ['Nursery','LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10 (Board)','Class 11','Class 12 (Board)','Competitive Exam (JEE/NEET)','Competitive Exam (Govt Job)','Summer Classes','Drawing / Art','Music / Singing','Dance','Other'];
const SUBJECTS     = ['Maths','Science','Physics','Chemistry','Biology','English','Hindi','Social Science','Computer Science','Accountancy / Commerce','Economics','JEE Coaching','NEET Coaching','Drawing / Art','Music / Singing','Dance','All Subjects','Other'];
const AREAS        = ['Shankar Nagar','Civil Lines','Pandri','Telibandha','Tatibandh','Devendra Nagar','Raipur Station Road','Pachpedi Naka','Avanti Vihar','Byron Bazar','Mowa','Khamardih','Fafadih','Rajendra Nagar','Kabir Nagar','Gopal Nagar','New Rajendra Nagar','Shanti Nagar','Other'];
const CLASS_STATUSES: ClassStatus[] = ['active','paused','completed'];

const EMPTY: Omit<Assignment,'id'|'createdAt'> = {
  tutorId:'', tutorName:'', tutorPhone:'',
  parentId:'', parentName:'', parentPhone:'',
  subject:'', classLevel:'', classesPerWeek:3,
  hoursPerSession: 1,
  startDate:'', monthlyFeeParent:0, monthlyFeeTutor:0,
  status:'active', area:'', notes:'',
};

// ── Tutor/Parent name dropdown with phone auto-fill ───────────────────────────

function ContactSelect({ label, contacts, nameValue, phoneValue, onSelect, placeholder }: {
  label: string;
  contacts: { id?: string; name: string; phone: string }[];
  nameValue: string;
  phoneValue: string;
  onSelect: (name: string, phone: string, id?: string) => void;
  placeholder: string;
}) {
  const [query, setQuery]   = useState(nameValue);
  const [open, setOpen]     = useState(false);

  useEffect(() => { setQuery(nameValue); }, [nameValue]);

  const filtered = query.trim().length === 0
    ? contacts.slice(0, 8)
    : contacts.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.phone.includes(query)
      ).slice(0, 8);

  return (
    <FormGroup label={label}>
      <div style={{ position:'relative' }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); onSelect(e.target.value, '', undefined); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {open && filtered.length > 0 && (
          <div style={{
            position:'absolute', top:'100%', left:0, right:0, zIndex:100,
            background:'#fff', border:'1.5px solid var(--border)',
            borderRadius:'0 0 8px 8px', boxShadow:'var(--shadow-md)',
            maxHeight:200, overflowY:'auto',
          }}>
            {filtered.map((c, i) => (
              <div key={i}
                onMouseDown={() => { onSelect(c.name, c.phone, c.id); setQuery(c.name); setOpen(false); }}
                style={{
                  padding:'9px 12px', cursor:'pointer', fontSize:13,
                  borderBottom:'1px solid var(--border)',
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.background='var(--blue-light)')}
                onMouseLeave={e => (e.currentTarget.style.background='#fff')}
              >
                <span style={{ fontWeight:600 }}>{c.name}</span>
                <span style={{ color:'var(--text-muted)', fontSize:12 }}>{c.phone}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Auto-filled phone shown below */}
      {phoneValue && (
        <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:3 }}>
          📞 {phoneValue}
        </div>
      )}
    </FormGroup>
  );
}

// ── Assignment Modal ──────────────────────────────────────────────────────────

function AssignmentModal({ initial, onSave, onClose, parents, tutors }: {
  initial?: Assignment;
  onSave: (d: typeof EMPTY) => Promise<void>;
  onClose: () => void;
  parents: Parent[];
  tutors: Tutor[];
}) {
  const [form, setForm]       = useState(initial ? { ...EMPTY, ...initial } : { ...EMPTY });
  const [customSubject, setCustomSubject] = useState('');
  const [customArea, setCustomArea]       = useState('');
  const [saving, setSaving]   = useState(false);
  const profit = (form.monthlyFeeParent || 0) - (form.monthlyFeeTutor || 0);
  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  // Initialise custom fields if editing a record with "Other"
  useEffect(() => {
    if (initial?.subject && !SUBJECTS.includes(initial.subject)) {
      setForm(p => ({ ...p, subject: 'Other' }));
      setCustomSubject(initial.subject);
    }
    if (initial?.area && !AREAS.includes(initial.area)) {
      setForm(p => ({ ...p, area: 'Other' }));
      setCustomArea(initial.area);
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const finalSubject = form.subject === 'Other' ? (customSubject.trim() || 'Other') : form.subject;
    const finalArea    = form.area    === 'Other' ? (customArea.trim()    || 'Other') : form.area;
    await onSave({ ...form, subject: finalSubject, area: finalArea });
    setSaving(false); onClose();
  }

  const addDays = (dateStr: string, days: number) => {
    const d = new Date(dateStr); d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-IN');
  };

  return (
    <Modal title={initial ? 'Edit Assignment' : 'New Class Assignment'} onClose={onClose}>
      <ModalForm onSubmit={submit}>

        {/* ── Tutor ── */}
        <div style={{ padding:'8px 12px', background:'var(--bg)', borderRadius:8, fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 }}>
          👩‍🏫 Tutor Details
        </div>
        <FormRow>
          <ContactSelect
            label="Tutor Name *"
            contacts={tutors.map(t => ({ id: t.id, name: t.name, phone: t.phone }))}
            nameValue={form.tutorName}
            phoneValue={form.tutorPhone}
            onSelect={(name, phone, id) => setForm(p => ({ ...p, tutorName: name, tutorPhone: phone, tutorId: id || '' }))}
            placeholder="Type to search tutors…"
          />
          <FormGroup label="Tutor Phone">
            <input value={form.tutorPhone} onChange={e=>f('tutorPhone',e.target.value)} placeholder="+91 XXXXX XXXXX" />
          </FormGroup>
        </FormRow>

        {/* ── Parent ── */}
        <div style={{ padding:'8px 12px', background:'var(--bg)', borderRadius:8, fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 }}>
          👨‍👩‍👧 Student / Parent Details
        </div>
        <FormRow>
          <ContactSelect
            label="Parent / Student Name *"
            contacts={parents.map(p => ({ id: p.id, name: p.name || (p as any).studentName || '', phone: p.phone }))}
            nameValue={form.parentName}
            phoneValue={form.parentPhone}
            onSelect={(name, phone, id) => setForm(p => ({ ...p, parentName: name, parentPhone: phone, parentId: id || '' }))}
            placeholder="Type to search parents…"
          />
          <FormGroup label="Parent Phone">
            <input value={form.parentPhone} onChange={e=>f('parentPhone',e.target.value)} placeholder="+91 XXXXX XXXXX" />
          </FormGroup>
        </FormRow>

        {/* ── Class Details ── */}
        <div style={{ padding:'8px 12px', background:'var(--bg)', borderRadius:8, fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 }}>
          📚 Class Details
        </div>
        <FormRow>
          <FormGroup label="Subject *">
            <select value={form.subject} onChange={e=>f('subject',e.target.value)} required>
              <option value="">Select Subject</option>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
            {form.subject === 'Other' && (
              <input
                style={{ marginTop:6 }}
                value={customSubject}
                onChange={e => setCustomSubject(e.target.value)}
                placeholder="Enter subject name"
                required
              />
            )}
          </FormGroup>
          <FormGroup label="Class Level *">
            <select value={form.classLevel} onChange={e=>f('classLevel',e.target.value)} required>
              <option value="">Select Class</option>
              {CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}
            </select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Classes Per Week">
            <select value={form.classesPerWeek} onChange={e=>f('classesPerWeek',Number(e.target.value))}>
              {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}/week</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Hours Per Session">
            <select value={form.hoursPerSession || 1} onChange={e=>f('hoursPerSession',Number(e.target.value))}>
              {[0.5,1,1.5,2,2.5,3].map(n => <option key={n} value={n}>{n} hr{n!==1?'s':''}</option>)}
            </select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Start Date *">
            <input type="date" value={form.startDate} onChange={e=>f('startDate',e.target.value)} required />
          </FormGroup>
          <FormGroup label="Area">
            <select value={form.area} onChange={e=>f('area',e.target.value)}>
              <option value="">Select Area</option>
              {AREAS.map(a => <option key={a}>{a}</option>)}
            </select>
            {form.area === 'Other' && (
              <input
                style={{ marginTop:6 }}
                value={customArea}
                onChange={e => setCustomArea(e.target.value)}
                placeholder="Enter area / locality"
              />
            )}
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Status">
            <select value={form.status} onChange={e=>f('status',e.target.value as ClassStatus)}>
              {CLASS_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
          </FormGroup>
        </FormRow>

        {/* ── Fees ── */}
        <div style={{ padding:'8px 12px', background:'var(--bg)', borderRadius:8, fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 }}>
          💰 Monthly Fee
        </div>
        <FormRow>
          <FormGroup label="Parent Pays You (₹/month)">
            <input type="number" min="0" value={form.monthlyFeeParent||''} onChange={e=>f('monthlyFeeParent',Number(e.target.value))} placeholder="3500" />
          </FormGroup>
          <FormGroup label="You Pay Tutor (₹/month)">
            <input type="number" min="0" value={form.monthlyFeeTutor||''} onChange={e=>f('monthlyFeeTutor',Number(e.target.value))} placeholder="2500" />
          </FormGroup>
        </FormRow>

        {/* Live profit */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'11px 16px', borderRadius:10, border:'1.5px solid',
          background: profit>=0 ? '#f0fdf4' : '#fff1f2',
          borderColor: profit>=0 ? '#bbf7d0' : '#fecdd3',
          color: profit>=0 ? '#166534' : '#9f1239', fontSize:13.5,
        }}>
          <span>💡 Monthly Profit:</span>
          <strong style={{fontSize:17}}>{currency(profit)}</strong>
        </div>

        {/* Reminder preview */}
        {!initial && form.startDate && (
          <div style={{ display:'flex', gap:8, padding:'11px 14px', borderRadius:10, background:'#EFF6FF', border:'1.5px solid #BFDBFE', fontSize:12, color:'#1D4ED8' }}>
            <span>🔔</span>
            <span>
              Auto reminders: collect from parent by <strong>{addDays(form.startDate,5)}</strong>,
              pay tutor by <strong>{addDays(form.startDate,30)}</strong>
            </span>
          </div>
        )}

        <FormGroup label="Notes">
          <textarea rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="Any notes…" />
        </FormGroup>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Update' : 'Create Assignment'}</BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

// ── Start New Month Modal ─────────────────────────────────────────────────────

function NewMonthModal({ activeAssignments, onConfirm, onClose }: {
  activeAssignments: Assignment[];
  onConfirm: (month: string, selected: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const currentMonth = new Date().toLocaleString('en-IN', { month:'long', year:'numeric' });
  const [month, setMonth]       = useState(currentMonth);
  const [selected, setSelected] = useState<string[]>([]); // nothing pre-selected — admin picks manually
  const [saving, setSaving]     = useState(false);

  function getMonthOptions() {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(d.toLocaleString('en-IN', { month:'long', year:'numeric' }));
    }
    return months;
  }

  function toggleAll() {
    setSelected(selected.length === activeAssignments.length ? [] : activeAssignments.map(a => a.id!));
  }

  async function handleConfirm() {
    setSaving(true);
    await onConfirm(month, selected);
    setSaving(false); onClose();
  }

  return (
    <Modal title="🗓️ Start New Month — Bulk Fee Records" onClose={onClose}>
      <div style={{ padding:'18px 22px 22px', display:'flex', flexDirection:'column', gap:14 }}>

        <div style={{ padding:12, background:'#EFF6FF', borderRadius:10, border:'1px solid #BFDBFE', fontSize:13, color:'#1D4ED8' }}>
          This will create fee records for all selected active assignments for the chosen month. You won't need to enter them one by one.
        </div>

        <div>
          <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.7, display:'block', marginBottom:6 }}>
            Month
          </label>
          <select value={month} onChange={e=>setMonth(e.target.value)} style={{ padding:'9px 12px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13.5, fontFamily:'var(--font)', width:'100%' }}>
            {getMonthOptions().map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.7 }}>
              Select Assignments ({selected.length}/{activeAssignments.length})
            </label>
            <button onClick={toggleAll} style={{ fontSize:12, color:'var(--blue)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font)', fontWeight:600 }}>
              {selected.length === activeAssignments.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:240, overflowY:'auto' }}>
            {activeAssignments.map(a => (
              <label key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, border:'1.5px solid', borderColor: selected.includes(a.id!) ? 'var(--blue)' : 'var(--border)', background: selected.includes(a.id!) ? 'var(--blue-light)' : '#fff', cursor:'pointer', transition:'all .15s' }}>
                <input
                  type="checkbox"
                  checked={selected.includes(a.id!)}
                  onChange={() => setSelected(s => s.includes(a.id!) ? s.filter(x=>x!==a.id) : [...s, a.id!])}
                  style={{ accentColor:'var(--blue)', width:15, height:15 }}
                />
                <div style={{ flex:1 }}>
                  <span style={{ fontWeight:600, fontSize:13 }}>{a.tutorName}</span>
                  <span style={{ color:'var(--text-muted)', fontSize:12 }}> → {a.parentName}</span>
                  <span style={{ color:'var(--text-muted)', fontSize:12 }}> · {a.subject}</span>
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--green-dark)' }}>
                  {currency(a.monthlyFeeParent || 0)}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderRadius:8, background:'var(--bg)', border:'1px solid var(--border)', fontSize:13 }}>
          <span>Total fee records to create:</span>
          <strong>{selected.length} records</strong>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnGold onClick={handleConfirm} disabled={saving || selected.length === 0}>
            {saving ? 'Creating…' : `Create ${selected.length} Fee Records`}
          </BtnGold>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [parents, setParents]         = useState<Parent[]>([]);
  const [tutors, setTutors]           = useState<Tutor[]>([]);
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState<ClassStatus|'all'>('all');
  const [modal, setModal]             = useState<{open:boolean; record?:Assignment}>({open:false});
  const [newMonthModal, setNewMonthModal] = useState(false);

  const loadAll = useCallback(async () => {
    const [a, p, t] = await Promise.all([getAssignments(), getParents(), getTutors()]);
    setAssignments(a); setParents(p); setTutors(t);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Sort: active/paused first, completed at bottom ──
  const sorted = [...assignments].sort((a, b) => {
    const order: Record<ClassStatus, number> = { active:0, paused:1, completed:2 };
    return order[a.status] - order[b.status];
  });

  const filtered = sorted
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => !search || [a.tutorName,a.parentName,a.subject,a.classLevel,a.area]
      .some(v => v?.toLowerCase().includes(search.toLowerCase())));

  const activeAssignments = assignments.filter(a => a.status === 'active');

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      await updateAssignment(modal.record.id, data);
      setAssignments(p => p.map(x => x.id===modal.record!.id ? {...x,...data} : x));
    } else {
      const ref = await addAssignment(data);
      const newA = { id: ref.id, ...data };
      setAssignments(p => [{ ...newA, createdAt:{seconds:Date.now()/1000} }, ...p]);
      try { await generateRemindersForAssignment(newA); } catch {}
    }
  }

  async function handleStatusChange(id: string, status: ClassStatus) {
    await updateAssignment(id, { status });
    setAssignments(p => p.map(x => x.id===id ? {...x,status} : x));
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this assignment?')) return;
    await deleteAssignment(id);
    setAssignments(p => p.filter(x => x.id !== id));
  }

  // ── Start New Month: bulk create fee records ──
  async function handleNewMonth(month: string, selectedIds: string[]) {
    const toCreate = assignments.filter(a => selectedIds.includes(a.id!));
    await Promise.all(toCreate.map(a => addFee({
      tutorName:     a.tutorName,
      parentName:    a.parentName,
      subject:       a.subject,
      classLevel:    a.classLevel,
      parentFee:     a.monthlyFeeParent || 0,
      tutorFee:      a.monthlyFeeTutor  || 0,
      profit:        (a.monthlyFeeParent||0) - (a.monthlyFeeTutor||0),
      month,
      paymentStatus: 'pending',
      notes: `Auto-created for ${month}`,
    })));
    alert(`✅ Created ${toCreate.length} fee records for ${month}!`);
  }

  // Stats
  const active      = assignments.filter(a => a.status === 'active');
  const totalRev    = active.reduce((s,a) => s + (a.monthlyFeeParent||0), 0);
  const totalPay    = active.reduce((s,a) => s + (a.monthlyFeeTutor||0), 0);
  const totalProfit = totalRev - totalPay;

  return (
    <AppShell title="Class Assignments" onRefresh={loadAll}>
      <StatsRow>
        <StatCard icon="📋" num={active.length} label="Active" sub={`${assignments.filter(a=>a.status==='paused').length} paused · ${assignments.filter(a=>a.status==='completed').length} completed`} color="blue" />
        <StatCard icon="💳" num={currency(totalRev)} label="Monthly Revenue" sub="active classes" color="green" />
        <StatCard icon="📤" num={currency(totalPay)} label="Monthly Tutor Pay" sub="active classes" color="red" />
        <StatCard icon="🏦" num={currency(totalProfit)} label="Monthly Profit" sub="active classes" color="gold" />
      </StatsRow>

      <Card>
        <CardHeader title={`📋 Assignments (${assignments.length})`}>
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 Search tutor, parent, subject…" />
          <BtnGold onClick={() => setNewMonthModal(true)}>🗓️ Start New Month</BtnGold>
          <BtnPrimary onClick={() => setModal({open:true})}>+ New Assignment</BtnPrimary>
        </CardHeader>
        <FilterRow>
          {(['all','active','paused','completed'] as (ClassStatus|'all')[]).map(s => (
            <FilterBtn key={s} active={filter===s} onClick={() => setFilter(s)}>
              {s==='all' ? 'All' : s.charAt(0).toUpperCase()+s.slice(1)}
              {s !== 'all' && ` (${assignments.filter(a=>a.status===s).length})`}
            </FilterBtn>
          ))}
        </FilterRow>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Tutor</th><th>Parent / Student</th><th>Subject</th>
                <th>Class</th><th>Area</th><th>Days/Wk</th><th>Hrs/Session</th>
                <th>Start</th><th>Parent Pays</th><th>Tutor Gets</th>
                <th>Profit</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <Empty colSpan={13} text="No assignments found." />}
              {filtered.map(a => {
                const profit    = (a.monthlyFeeParent||0) - (a.monthlyFeeTutor||0);
                const completed = a.status === 'completed';
                return (
                  <tr key={a.id} style={{ opacity: completed ? 0.55 : 1 }}>
                    <td>
                      <strong>{a.tutorName}</strong>
                      {a.tutorPhone && <div style={{fontSize:11}}><PhoneLink phone={a.tutorPhone} /></div>}
                    </td>
                    <td>
                      <strong>{a.parentName}</strong>
                      {a.parentPhone && <div style={{fontSize:11}}><PhoneLink phone={a.parentPhone} /></div>}
                    </td>
                    <td>{a.subject}</td>
                    <td style={{whiteSpace:'nowrap'}}>{a.classLevel}</td>
                    <td>{a.area}</td>
                    <td style={{textAlign:'center'}}>{a.classesPerWeek}/wk</td>
                    <td style={{textAlign:'center'}}>{(a as any).hoursPerSession || 1}h</td>
                    <td style={{whiteSpace:'nowrap'}}>{a.startDate}</td>
                    <td style={{color:'var(--green-dark)',fontWeight:700}}>{a.monthlyFeeParent ? currency(a.monthlyFeeParent) : '—'}</td>
                    <td style={{color:'var(--red-dark)',fontWeight:700}}>{a.monthlyFeeTutor ? currency(a.monthlyFeeTutor) : '—'}</td>
                    <td style={{color: profit>=0 ? 'var(--green-dark)' : 'var(--red-dark)', fontWeight:700}}>{currency(profit)}</td>
                    <td>
                      <select
                        style={{padding:'5px 8px',border:'1.5px solid var(--border)',borderRadius:6,fontSize:12,fontFamily:'var(--font)'}}
                        value={a.status}
                        onChange={e => handleStatusChange(a.id!, e.target.value as ClassStatus)}
                      >
                        {CLASS_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                      </select>
                    </td>
                    <td style={{display:'flex',gap:4}}>
                      <ActionBtn onClick={() => setModal({open:true,record:a})}>✏️</ActionBtn>
                      <ActionBtn variant="delete" onClick={() => handleDelete(a.id!)}>🗑️</ActionBtn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {modal.open && (
        <AssignmentModal
          initial={modal.record}
          onSave={handleSave}
          onClose={() => setModal({open:false})}
          parents={parents}
          tutors={tutors}
        />
      )}
      {newMonthModal && (
        <NewMonthModal
          activeAssignments={activeAssignments}
          onConfirm={handleNewMonth}
          onClose={() => setNewMonthModal(false)}
        />
      )}
    </AppShell>
  );
}