'use client';
// src/app/parents/page.tsx
export const dynamic = 'force-dynamic';

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
const AREAS = ['Shankar Nagar','Civil Lines','Pandri','Telibandha','Tatibandh','Devendra Nagar','Raipur Station Road','Pachpedi Naka','Avanti Vihar','Byron Bazar','Mowa','Khamardih','Fafadih','Rajendra Nagar','Kabir Nagar','Gopal Nagar','New Rajendra Nagar','Shanti Nagar','Other'];

const EMPTY: Omit<Parent,'id'|'createdAt'|'updatedAt'> = {
  name:'', phone:'', email:'', area:'', class:'', subject:'',
  status:'new', notes:'', preferredGender:'', budget:'', source:'',
};

function ParentModal({ initial, onSave, onClose }: { initial?: Parent; onSave: (d: typeof EMPTY) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await onSave(form); setSaving(false); onClose();
  }

  return (
    <Modal title={initial ? 'Edit Parent' : 'Add Parent Lead'} onClose={onClose}>
      <ModalForm onSubmit={submit}>
        <FormRow>
          <FormGroup label="Full Name *"><input value={form.name} onChange={e=>f('name',e.target.value)} required /></FormGroup>
          <FormGroup label="Phone *"><input value={form.phone} onChange={e=>f('phone',e.target.value)} placeholder="+91 XXXXX XXXXX" required /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Email"><input type="email" value={form.email} onChange={e=>f('email',e.target.value)} /></FormGroup>
          <FormGroup label="Area">
            <select value={form.area} onChange={e=>f('area',e.target.value)}><option value="">Select</option>{AREAS.map(a=><option key={a}>{a}</option>)}</select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Class / Grade *">
            <select value={form.class} onChange={e=>f('class',e.target.value)} required><option value="">Select</option>{CLASS_LEVELS.map(c=><option key={c}>{c}</option>)}</select>
          </FormGroup>
          <FormGroup label="Subject *">
            <select value={form.subject} onChange={e=>f('subject',e.target.value)} required><option value="">Select</option>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Preferred Tutor Gender">
            <select value={form.preferredGender} onChange={e=>f('preferredGender',e.target.value)}><option value="">No preference</option><option>Male</option><option>Female</option></select>
          </FormGroup>
          <FormGroup label="Budget (₹/month)"><input value={form.budget} onChange={e=>f('budget',e.target.value)} placeholder="e.g. 3000-5000" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Status">
            <select value={form.status} onChange={e=>f('status',e.target.value)}>{LEAD_STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select>
          </FormGroup>
          <FormGroup label="Source"><input value={form.source} onChange={e=>f('source',e.target.value)} placeholder="e.g. Website, Referral, JustDial" /></FormGroup>
        </FormRow>
        <FormGroup label="Notes"><textarea rows={3} value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="Any additional notes…" /></FormGroup>
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
    .filter(p => !search || [p.name,p.phone,p.area,p.subject,p.class].some(v => v?.toLowerCase().includes(search.toLowerCase())));

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
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 Search name, phone, area…" />
          <BtnPrimary onClick={() => setModal({open:true})}>+ Add Parent</BtnPrimary>
        </CardHeader>
        <FilterRow>
          {STATUSES.map(s => <FilterBtn key={s} active={filter===s} onClick={() => setFilter(s)}>{s==='all'?'All':s.replace(/_/g,' ')}</FilterBtn>)}
        </FilterRow>
        <TableWrap>
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Area</th><th>Class</th><th>Subject</th><th>Pref. Gender</th><th>Source</th><th>Date</th><th>Status</th><th>Update</th><th></th></tr></thead>
            <tbody>
              {filtered.length===0 && <Empty colSpan={11} text="No parent leads found." />}
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong>{p.notes && <div style={{fontSize:11,color:'#999',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.notes}</div>}</td>
                  <td><PhoneLink phone={p.phone} /></td>
                  <td>{p.area}</td><td>{p.class}</td><td>{p.subject}</td>
                  <td>{p.preferredGender || '—'}</td>
                  <td>{p.source || '—'}</td>
                  <td style={{color:'#aaa',fontSize:12}}>{fmtDate(p)}</td>
                  <td><Badge status={p.status} /></td>
                  <td><StatusSelect value={p.status} options={LEAD_STATUSES} onChange={s => handleStatusChange(p.id!, s)} /></td>
                  <td><ActionBtn onClick={() => setModal({open:true,record:p})}>✏️</ActionBtn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      {modal.open && <ParentModal initial={modal.record} onSave={handleSave} onClose={() => setModal({open:false})} />}
    </AppShell>
  );
}
