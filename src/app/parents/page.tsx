'use client';
// src/app/parents/page.tsx
export const dynamic = 'force-dynamic';
import ExportButton from '@/components/ExportButton';
import { exportParents } from '@/lib/exportExcel';
import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  Card, CardHeader, FilterRow, FilterBtn, TableWrap, Empty, Badge,
  SearchInput, PhoneLink, StatusSelect, BtnPrimary, ActionBtn,
  Modal, ModalForm, FormRow, FormGroup, ModalFooter, BtnSecondary,
  fmtDate,
} from '@/components/UI';
import { getParents, addParent, updateParent, deleteParent, Parent, LeadStatus } from '@/lib/firestore';

const STATUSES: (LeadStatus|'all')[] = ['all','new','contacted','demo_scheduled','converted','closed'];
const LEAD_STATUSES: LeadStatus[] = ['new','contacted','demo_scheduled','converted','closed'];

const CLASS_LEVELS = ['Nursery','LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10 (Board)','Class 11','Class 12 (Board)','Competitive Exam (JEE/NEET)','Competitive Exam (Govt Job)','Summer Classes','Drawing / Art','Music / Singing','Dance','Other'];
const SUBJECTS = ['Maths','Science','Physics','Chemistry','Biology','English','Hindi','Social Science','Computer Science','Accountancy / Commerce','Economics','JEE Coaching','NEET Coaching','Drawing / Art','Music / Singing','Dance','All Subjects','Other'];

// EMPTY matches actual Firestore field names from Google Form + manual entries
const EMPTY: Omit<Parent,'id'|'createdAt'|'updatedAt'> = {
  name: '',                   // parent name
  studentName: '',            // student name
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  area: '',
  class: '',
  subject: '',
  board: '',
  school: '',
  studentAge: '',
  studentGender: '',
  preferredTeacherGender: '', // was "preferredGender" — actual Firestore key
  preferredContact: '',
  daysPerWeek: '',
  duration: '',
  timeSlot: '',
  wantsDemo: '',
  specialNote: '',
  budget: '',
  source: '',
  status: 'new',
  notes: '',
};

// Helper: get display name — parent name if available, else student name + "(student)"
function displayName(p: Parent): { primary: string; secondary: string } {
  const parent = p.name?.trim();
  const student = (p as any).studentName?.trim();
  if (parent) return { primary: parent, secondary: student ? `Student: ${student}` : '' };
  if (student) return { primary: student, secondary: '(student name — parent unknown)' };
  return { primary: '—', secondary: '' };
}

function ParentModal({ initial, onSave, onClose }: { initial?: Parent; onSave: (d: typeof EMPTY) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<typeof EMPTY>(initial ? { ...EMPTY, ...(initial as any) } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await onSave(form); setSaving(false); onClose();
  }

  return (
    <Modal title={initial ? 'Edit Parent' : 'Add Parent Lead'} onClose={onClose}>
      <ModalForm onSubmit={submit}>

        {/* ── Contact Info ── */}
        <FormRow>
          <FormGroup label="Parent Name"><input value={form.name} onChange={e=>f('name',e.target.value)} placeholder="e.g. Ruchi Gupta" /></FormGroup>
          <FormGroup label="Student Name *"><input value={(form as any).studentName||''} onChange={e=>f('studentName' as any,e.target.value)} required placeholder="e.g. Shanvi Gupta" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Phone *"><input value={form.phone} onChange={e=>f('phone',e.target.value)} placeholder="+91 XXXXX XXXXX" required /></FormGroup>
          <FormGroup label="WhatsApp"><input value={(form as any).whatsapp||''} onChange={e=>f('whatsapp' as any,e.target.value)} placeholder="+91 XXXXX XXXXX" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Email"><input type="email" value={form.email} onChange={e=>f('email',e.target.value)} /></FormGroup>
          <FormGroup label="Preferred Contact">
            <select value={(form as any).preferredContact||''} onChange={e=>f('preferredContact' as any,e.target.value)}>
              <option value="">Select</option><option>Call</option><option>WhatsApp</option><option>Both</option>
            </select>
          </FormGroup>
        </FormRow>
        <FormGroup label="Address">
          <input value={(form as any).address||''} onChange={e=>f('address' as any,e.target.value)} placeholder="e.g. Jagmal Chowk, Bilaspur, CG" />
        </FormGroup>

        {/* ── Student Info ── */}
        <FormRow>
          <FormGroup label="Class / Grade *">
            <select value={form.class} onChange={e=>f('class',e.target.value)} required><option value="">Select</option>{CLASS_LEVELS.map(c=><option key={c}>{c}</option>)}</select>
          </FormGroup>
          <FormGroup label="Subject *">
            <select value={form.subject} onChange={e=>f('subject',e.target.value)} required><option value="">Select</option>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Board">
            <select value={(form as any).board||''} onChange={e=>f('board' as any,e.target.value)}>
              <option value="">Select</option><option>CBSE</option><option>ICSE</option><option>State Board</option><option>Other</option>
            </select>
          </FormGroup>
          <FormGroup label="School"><input value={(form as any).school||''} onChange={e=>f('school' as any,e.target.value)} placeholder="e.g. St. Francis School" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Student Age"><input value={(form as any).studentAge||''} onChange={e=>f('studentAge' as any,e.target.value)} placeholder="e.g. 8" /></FormGroup>
          <FormGroup label="Student Gender">
            <select value={(form as any).studentGender||''} onChange={e=>f('studentGender' as any,e.target.value)}>
              <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
            </select>
          </FormGroup>
        </FormRow>

        {/* ── Tutor Preferences ── */}
        <FormRow>
          <FormGroup label="Preferred Tutor Gender">
            <select value={(form as any).preferredTeacherGender||''} onChange={e=>f('preferredTeacherGender' as any,e.target.value)}>
              <option value="">No preference</option><option>Male</option><option>Female</option>
            </select>
          </FormGroup>
          <FormGroup label="Budget (₹/month)"><input value={form.budget||''} onChange={e=>f('budget',e.target.value)} placeholder="e.g. 3000-5000" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Days per Week">
            <select value={(form as any).daysPerWeek||''} onChange={e=>f('daysPerWeek' as any,e.target.value)}>
              <option value="">Select</option><option>1 Day</option><option>2 Days</option><option>3 Days</option><option>4 Days</option><option>5 Days</option><option>6 Days</option><option>Daily</option>
            </select>
          </FormGroup>
          <FormGroup label="Session Duration">
            <select value={(form as any).duration||''} onChange={e=>f('duration' as any,e.target.value)}>
              <option value="">Select</option><option>30 Min</option><option>45 Min</option><option>1 Hour</option><option>1.5 Hours</option><option>2 Hours</option>
            </select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Time Slot">
            <select value={(form as any).timeSlot||''} onChange={e=>f('timeSlot' as any,e.target.value)}>
              <option value="">Select</option><option>Morning (6–9 AM)</option><option>Afternoon (12–4 PM)</option><option>Evening (5–9 PM)</option><option>Flexible</option>
            </select>
          </FormGroup>
          <FormGroup label="Wants Demo">
            <select value={(form as any).wantsDemo||''} onChange={e=>f('wantsDemo' as any,e.target.value)}>
              <option value="">Select</option><option>Yes</option><option>No</option>
            </select>
          </FormGroup>
        </FormRow>

        {/* ── CRM Fields ── */}
        <FormRow>
          <FormGroup label="Status">
            <select value={form.status} onChange={e=>f('status',e.target.value)}>{LEAD_STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select>
          </FormGroup>
          <FormGroup label="Source"><input value={form.source||''} onChange={e=>f('source',e.target.value)} placeholder="e.g. Website, Referral, JustDial" /></FormGroup>
        </FormRow>
        <FormGroup label="Special Note / Notes">
          <textarea rows={3} value={form.notes||(form as any).specialNote||''} onChange={e=>f('notes',e.target.value)} placeholder="Any additional notes…" />
        </FormGroup>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Update' : 'Add Parent'}</BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

export default function ParentsPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LeadStatus|'all'>('all');
  const [modal, setModal] = useState<{open:boolean; record?:Parent}>({open:false});

  const loadAll = useCallback(async () => setParents(await getParents()), []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = parents
    .filter(p => filter==='all' || p.status===filter)
    .filter(p => !search || [
      p.name,
      (p as any).studentName,
      p.phone,
      (p as any).whatsapp,
      (p as any).address,
      (p as any).area,
      p.subject,
      p.class,
      (p as any).school,
    ].some(v => v?.toLowerCase().includes(search.toLowerCase())));

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      await updateParent(modal.record.id, data);
      setParents(p => p.map(x => x.id===modal.record!.id ? {...x,...data} : x));
    } else {
      const ref = await addParent(data);
      setParents(p => [{id:ref.id,...data,createdAt:{seconds:Date.now()/1000}},...p]);
    }
  }

  async function handleStatusChange(id: string, status: LeadStatus) {
    await updateParent(id, { status });
    setParents(p => p.map(x => x.id===id ? {...x,status} : x));
  }

  return (
    <AppShell title="Parent Leads" onRefresh={loadAll} badges={{'/parents': parents.filter(p=>p.status==='new').length}}>
      <Card>
        <CardHeader title={`👨‍👩‍👧 Parents (${parents.length})`}>
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 Search name, phone, school, area…" />
          <BtnPrimary onClick={() => setModal({open:true})}>+ Add Parent</BtnPrimary>
          <ExportButton label="Export Parents" onExport={() => exportParents(filtered)} />
        </CardHeader>
        <FilterRow>
          {STATUSES.map(s => <FilterBtn key={s} active={filter===s} onClick={() => setFilter(s)}>{s==='all'?'All':s.replace(/_/g,' ')}</FilterBtn>)}
        </FilterRow>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Parent / Student</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Board</th>
                <th>Time Slot</th>
                <th>Demo?</th>
                <th>Pref. Gender</th>
                <th>Source</th>
                <th>Date</th>
                <th>Status</th>
                <th>Update</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <Empty colSpan={14} text="No parent leads found." />}
              {filtered.map(p => {
                const { primary, secondary } = displayName(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{primary}</strong>
                      {secondary && <div style={{fontSize:11,color:'#999'}}>{secondary}</div>}
                    </td>
                    <td>
                      <PhoneLink phone={p.phone} />
                      {(p as any).whatsapp && (p as any).whatsapp !== p.phone &&
                        <div style={{fontSize:11,color:'#25d366'}}>WA: {(p as any).whatsapp}</div>}
                    </td>
                    <td style={{fontSize:12,maxWidth:160}}>
                      {(p as any).address || (p as any).area || '—'}
                    </td>
                    <td>{p.class}</td>
                    <td>{p.subject}</td>
                    <td>{(p as any).board || '—'}</td>
                    <td style={{fontSize:12}}>{(p as any).timeSlot || '—'}</td>
                    <td style={{fontSize:12,textAlign:'center'}}>
                      {(p as any).wantsDemo === 'Yes'
                        ? <span style={{color:'#1d9e75',fontWeight:500}}>✓ Yes</span>
                        : <span style={{color:'#aaa'}}>No</span>}
                    </td>
                    <td>{(p as any).preferredTeacherGender || p.preferredGender || '—'}</td>
                    <td>{p.source || '—'}</td>
                    <td style={{color:'#aaa',fontSize:12}}>{fmtDate(p)}</td>
                    <td><Badge status={p.status} /></td>
                    <td><StatusSelect value={p.status} options={LEAD_STATUSES} onChange={s => handleStatusChange(p.id!, s)} /></td>
                    <td><ActionBtn onClick={() => setModal({open:true,record:p})}>✏️</ActionBtn></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      {modal.open && <ParentModal initial={modal.record} onSave={handleSave} onClose={() => setModal({open:false})} />}
    </AppShell>
  );
}