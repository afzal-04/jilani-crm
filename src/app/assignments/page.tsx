'use client';
// src/app/assignments/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, FilterRow, FilterBtn,
  TableWrap, Empty, Badge, SearchInput, PhoneLink, BtnPrimary,
  ActionBtn, Modal, ModalForm, FormRow, FormGroup, ModalFooter,
  BtnSecondary, currency, fmtDate,
} from '@/components/UI';
import {
  getAssignments, addAssignment, updateAssignment, deleteAssignment,
  Assignment, ClassStatus,
} from '@/lib/firestore';

const CLASS_LEVELS = ['Nursery','LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10 (Board)','Class 11','Class 12 (Board)','Competitive Exam (JEE/NEET)','Competitive Exam (Govt Job)','Summer Classes','Drawing / Art','Music / Singing','Dance','Other'];
const SUBJECTS = ['Maths','Science','Physics','Chemistry','Biology','English','Hindi','Social Science','Computer Science','Accountancy / Commerce','Economics','JEE Coaching','NEET Coaching','Drawing / Art','Music / Singing','Dance','All Subjects','Other'];
const AREAS = ['Shankar Nagar','Civil Lines','Pandri','Telibandha','Tatibandh','Devendra Nagar','Raipur Station Road','Pachpedi Naka','Avanti Vihar','Byron Bazar','Mowa','Khamardih','Fafadih','Rajendra Nagar','Kabir Nagar','Gopal Nagar','New Rajendra Nagar','Shanti Nagar','Other'];
const CLASS_STATUSES: ClassStatus[] = ['active','paused','completed'];

const EMPTY: Omit<Assignment,'id'|'createdAt'> = {
  tutorId:'', tutorName:'', tutorPhone:'',
  parentId:'', parentName:'', parentPhone:'',
  subject:'', classLevel:'', classesPerWeek:3,
  startDate:'', monthlyFeeParent:0, monthlyFeeTutor:0,
  status:'active', area:'', notes:'',
};

function AssignmentModal({ initial, onSave, onClose }: {
  initial?: Assignment;
  onSave: (d: typeof EMPTY) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const profit = (form.monthlyFeeParent || 0) - (form.monthlyFeeTutor || 0);
  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await onSave(form); setSaving(false); onClose();
  }

  return (
    <Modal title={initial ? 'Edit Assignment' : 'New Class Assignment'} onClose={onClose}>
      <ModalForm onSubmit={submit}>

        {/* Tutor */}
        <div style={{ padding:'10px 12px', background:'var(--bg)', borderRadius:8, fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 }}>
          👩‍🏫 Tutor Details
        </div>
        <FormRow>
          <FormGroup label="Tutor Name *">
            <input value={form.tutorName} onChange={e=>f('tutorName',e.target.value)} placeholder="Tutor full name" required />
          </FormGroup>
          <FormGroup label="Tutor Phone">
            <input value={form.tutorPhone} onChange={e=>f('tutorPhone',e.target.value)} placeholder="+91 XXXXX XXXXX" />
          </FormGroup>
        </FormRow>

        {/* Student / Parent */}
        <div style={{ padding:'10px 12px', background:'var(--bg)', borderRadius:8, fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 }}>
          👨‍👩‍👧 Student / Parent Details
        </div>
        <FormRow>
          <FormGroup label="Parent / Student Name *">
            <input value={form.parentName} onChange={e=>f('parentName',e.target.value)} placeholder="Parent or student name" required />
          </FormGroup>
          <FormGroup label="Parent Phone">
            <input value={form.parentPhone} onChange={e=>f('parentPhone',e.target.value)} placeholder="+91 XXXXX XXXXX" />
          </FormGroup>
        </FormRow>

        {/* Class info */}
        <div style={{ padding:'10px 12px', background:'var(--bg)', borderRadius:8, fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 }}>
          📚 Class Details
        </div>
        <FormRow>
          <FormGroup label="Subject *">
            <select value={form.subject} onChange={e=>f('subject',e.target.value)} required>
              <option value="">Select Subject</option>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
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
              {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} class{n>1?'es':''}/week</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Start Date *">
            <input type="date" value={form.startDate} onChange={e=>f('startDate',e.target.value)} required />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Area">
            <select value={form.area} onChange={e=>f('area',e.target.value)}>
              <option value="">Select Area</option>
              {AREAS.map(a => <option key={a}>{a}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Status">
            <select value={form.status} onChange={e=>f('status',e.target.value as ClassStatus)}>
              {CLASS_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
          </FormGroup>
        </FormRow>

        {/* Fees */}
        <div style={{ padding:'10px 12px', background:'var(--bg)', borderRadius:8, fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 }}>
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

        {/* Live profit display */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 16px', borderRadius:10, border:'1.5px solid',
          background: profit >= 0 ? '#f0fdf4' : '#fff1f2',
          borderColor: profit >= 0 ? '#bbf7d0' : '#fecdd3',
          color: profit >= 0 ? '#166534' : '#9f1239',
          fontSize: 14,
        }}>
          <span>💡 Your Monthly Profit from this class:</span>
          <strong style={{fontSize:18}}>{currency(profit)}</strong>
        </div>

        <FormGroup label="Notes">
          <textarea rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="Any additional notes about this assignment…" />
        </FormGroup>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Update' : 'Create Assignment'}</BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState<ClassStatus|'all'>('all');
  const [modal, setModal]             = useState<{open:boolean; record?:Assignment}>({open:false});

  const loadAll = useCallback(async () => setAssignments(await getAssignments()), []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = assignments
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => !search || [a.tutorName,a.parentName,a.subject,a.classLevel,a.area]
      .some(v => v?.toLowerCase().includes(search.toLowerCase())));

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      await updateAssignment(modal.record.id, data);
      setAssignments(p => p.map(x => x.id===modal.record!.id ? {...x,...data} : x));
    } else {
      const ref = await addAssignment(data);
      setAssignments(p => [{id:ref.id,...data,createdAt:{seconds:Date.now()/1000}},...p]);
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

  // Summary stats
  const active    = assignments.filter(a => a.status === 'active');
  const totalRev  = active.reduce((s,a) => s + (a.monthlyFeeParent||0), 0);
  const totalPay  = active.reduce((s,a) => s + (a.monthlyFeeTutor||0), 0);
  const totalProfit = totalRev - totalPay;
  const totalClassesPerWeek = active.reduce((s,a) => s + (a.classesPerWeek||0), 0);

  return (
    <AppShell title="Class Assignments" onRefresh={loadAll}>
      <StatsRow>
        <StatCard icon="📋" num={active.length} label="Active Assignments" sub={`${assignments.filter(a=>a.status==='paused').length} paused`} color="blue" />
        <StatCard icon="💳" num={currency(totalRev)} label="Monthly Revenue" sub="from active classes" color="green" />
        <StatCard icon="📤" num={currency(totalPay)} label="Monthly Tutor Pay" sub="from active classes" color="red" />
        <StatCard icon="🏦" num={currency(totalProfit)} label="Monthly Profit" sub="active classes only" color="gold" />
      </StatsRow>

      <Card>
        <CardHeader title={`📋 Assignments (${assignments.length})`}>
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 Search tutor, parent, subject…" />
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
                <th>Class</th><th>Area</th><th>Days/Wk</th>
                <th>Start</th><th>Parent Pays</th><th>Tutor Gets</th>
                <th>Profit</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <Empty colSpan={12} text="No assignments found." />}
              {filtered.map(a => {
                const profit = (a.monthlyFeeParent||0) - (a.monthlyFeeTutor||0);
                return (
                  <tr key={a.id}>
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
                    <td style={{whiteSpace:'nowrap'}}>{a.startDate}</td>
                    <td style={{color:'var(--green)',fontWeight:700}}>{a.monthlyFeeParent ? currency(a.monthlyFeeParent) : '—'}</td>
                    <td style={{color:'var(--red)',fontWeight:700}}>{a.monthlyFeeTutor ? currency(a.monthlyFeeTutor) : '—'}</td>
                    <td style={{color: profit>=0 ? 'var(--green)' : 'var(--red)', fontWeight:700}}>{currency(profit)}</td>
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
        />
      )}
    </AppShell>
  );
}
