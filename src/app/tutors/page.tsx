'use client';
// src/app/tutors/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  Card, CardHeader, FilterRow, FilterBtn, TableWrap, Empty, Badge,
  SearchInput, PhoneLink, StatusSelect, BtnPrimary, ActionBtn,
  Modal, ModalForm, FormRow, FormGroup, ModalFooter, BtnSecondary,
  fmtDate, currency,
} from '@/components/UI';
import { getTutors, addTutor, updateTutor, deleteTutor, Tutor, LeadStatus } from '@/lib/firestore';

const STATUSES: (LeadStatus|'all')[] = ['all','new','contacted','demo_scheduled','converted','closed'];
const LEAD_STATUSES: LeadStatus[] = ['new','contacted','demo_scheduled','converted','closed'];

const QUALIFICATIONS = ['12th Pass','Pursuing Graduation','B.A','B.Sc','B.Com','B.Tech / B.E','BCA','B.Ed','M.A','M.Sc','M.Com','M.Tech','MBA','PhD','Other'];
const AREAS = ['Shankar Nagar','Civil Lines','Pandri','Telibandha','Tatibandh','Devendra Nagar','Raipur Station Road','Pachpedi Naka','Avanti Vihar','Byron Bazar','Mowa','Khamardih','Fafadih','Rajendra Nagar','Kabir Nagar','Gopal Nagar','New Rajendra Nagar','Shanti Nagar','Other'];

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
      <ModalForm onSubmit={submit}>
        <FormRow>
          <FormGroup label="Full Name *"><input value={form.name} onChange={e=>f('name',e.target.value)} required /></FormGroup>
          <FormGroup label="Phone *"><input value={form.phone} onChange={e=>f('phone',e.target.value)} placeholder="+91 XXXXX XXXXX" required /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Email"><input type="email" value={form.email} onChange={e=>f('email',e.target.value)} /></FormGroup>
          <FormGroup label="Gender">
            <select value={form.gender} onChange={e=>f('gender',e.target.value)}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Area">
            <select value={form.area} onChange={e=>f('area',e.target.value)}><option value="">Select</option>{AREAS.map(a=><option key={a}>{a}</option>)}</select>
          </FormGroup>
          <FormGroup label="Qualification">
            <select value={form.qualification} onChange={e=>f('qualification',e.target.value)}><option value="">Select</option>{QUALIFICATIONS.map(q=><option key={q}>{q}</option>)}</select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Subjects (comma separated)"><input value={form.subjects} onChange={e=>f('subjects',e.target.value)} placeholder="Maths, Physics, Chemistry" /></FormGroup>
          <FormGroup label="Classes (comma separated)"><input value={form.classes} onChange={e=>f('classes',e.target.value)} placeholder="Class 6-8, Class 9-10" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Experience"><input value={form.experience} onChange={e=>f('experience',e.target.value)} placeholder="e.g. 3 years" /></FormGroup>
          <FormGroup label="Availability"><input value={form.availability} onChange={e=>f('availability',e.target.value)} placeholder="e.g. Mon-Fri evenings" /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Expected Monthly Fee (₹)"><input type="number" min="0" value={form.monthlyFee||''} onChange={e=>f('monthlyFee',Number(e.target.value))} placeholder="3000" /></FormGroup>
          <FormGroup label="Status">
            <select value={form.status} onChange={e=>f('status',e.target.value)}>{LEAD_STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select>
          </FormGroup>
        </FormRow>
        <FormGroup label="Notes"><textarea rows={3} value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="Any additional notes…" /></FormGroup>
        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Update' : 'Add Tutor'}</BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

export default function TutorsPage() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LeadStatus|'all'>('all');
  const [modal, setModal] = useState<{open:boolean; record?:Tutor}>({open:false});

  const loadAll = useCallback(async () => setTutors(await getTutors()), []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = tutors
    .filter(t => filter==='all' || t.status===filter)
    .filter(t => !search || [t.name,t.phone,t.area,t.subjects,t.qualification].some(v => v?.toLowerCase().includes(search.toLowerCase())));

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

  return (
    <AppShell title="Tutor Leads" onRefresh={loadAll} badges={{'/tutors': tutors.filter(t=>t.status==='new').length}}>
      <Card>
        <CardHeader title={`👩‍🏫 Tutors (${tutors.length})`}>
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 Search name, phone, subject…" />
          <BtnPrimary onClick={() => setModal({open:true})}>+ Add Tutor</BtnPrimary>
        </CardHeader>
        <FilterRow>
          {STATUSES.map(s => <FilterBtn key={s} active={filter===s} onClick={() => setFilter(s)}>{s==='all'?'All':s.replace(/_/g,' ')}</FilterBtn>)}
        </FilterRow>
        <TableWrap>
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Gender</th><th>Area</th><th>Qualification</th><th>Subjects</th><th>Classes</th><th>Fee</th><th>Date</th><th>Status</th><th>Update</th><th></th></tr></thead>
            <tbody>
              {filtered.length===0 && <Empty colSpan={12} text="No tutor leads found." />}
              {filtered.map(t => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong>{t.experience && <div style={{fontSize:11,color:'#999'}}>{t.experience} exp</div>}</td>
                  <td><PhoneLink phone={t.phone} /></td>
                  <td>{t.gender || '—'}</td>
                  <td>{t.area}</td><td>{t.qualification}</td>
                  <td style={{maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.subjects}</td>
                  <td style={{maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.classes}</td>
                  <td>{t.monthlyFee ? currency(t.monthlyFee) : '—'}</td>
                  <td style={{color:'#aaa',fontSize:12}}>{fmtDate(t)}</td>
                  <td><Badge status={t.status} /></td>
                  <td><StatusSelect value={t.status} options={LEAD_STATUSES} onChange={s => handleStatusChange(t.id!, s)} /></td>
                  <td><ActionBtn onClick={() => setModal({open:true,record:t})}>✏️</ActionBtn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      {modal.open && <TutorModal initial={modal.record} onSave={handleSave} onClose={() => setModal({open:false})} />}
    </AppShell>
  );
}
