
'use client';
// src/app/staff/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, TableWrap, Empty, Badge,
  SearchInput, BtnPrimary, ActionBtn,
  Modal, ModalForm, FormRow, FormGroup, ModalFooter, BtnSecondary,
  fmtDate,
} from '@/components/UI';
import { getStaff, addStaff, updateStaff, deleteStaff, StaffMember, StaffRole } from '@/lib/firestore';

const ROLES: StaffRole[] = ['admin','manager','staff'];
const ROLE_ICON: Record<StaffRole,string> = { admin:'👑', manager:'🎯', staff:'👤' };

const today = () => new Date().toISOString().split('T')[0];

const EMPTY: Omit<StaffMember,'id'|'createdAt'> = {
  name:'', email:'', phone:'', role:'staff',
  status:'active', joinDate: today(), notes:'',
};

function StaffModal({ initial, onSave, onClose }: {
  initial?: StaffMember;
  onSave: (d: typeof EMPTY) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial ? { ...EMPTY,...initial } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await onSave(form); setSaving(false); onClose();
  }

  return (
    <Modal title={initial ? 'Edit Staff Member' : 'Add Staff Member'} onClose={onClose}>
      <ModalForm onSubmit={submit}>
        <FormRow>
          <FormGroup label="Full Name *">
            <input value={form.name} onChange={e=>f('name',e.target.value)} placeholder="Full name" required />
          </FormGroup>
          <FormGroup label="Phone *">
            <input value={form.phone} onChange={e=>f('phone',e.target.value)} placeholder="+91 XXXXX XXXXX" required />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Email">
            <input type="email" value={form.email} onChange={e=>f('email',e.target.value)} placeholder="email@example.com" />
          </FormGroup>
          <FormGroup label="Join Date">
            <input type="date" value={form.joinDate} onChange={e=>f('joinDate',e.target.value)} />
          </FormGroup>
        </FormRow>

        {/* Role — visual picker */}
        <FormGroup label="Role *">
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {ROLES.map(r => (
              <button key={r} type="button" onClick={() => f('role',r)}
                style={{
                  padding:'12px 8px', borderRadius:10, border:'2px solid',
                  cursor:'pointer', fontFamily:'var(--font)', fontSize:13, fontWeight:700,
                  borderColor: form.role===r ? 'var(--blue)' : 'var(--border)',
                  background: form.role===r ? 'var(--blue-light)' : '#fff',
                  color: form.role===r ? 'var(--blue)' : 'var(--text-muted)',
                  transition:'all .15s',
                }}>
                <div style={{fontSize:24,marginBottom:4}}>{ROLE_ICON[r]}</div>
                {r.charAt(0).toUpperCase()+r.slice(1)}
              </button>
            ))}
          </div>
        </FormGroup>

        <FormGroup label="Status">
          <select value={form.status} onChange={e=>f('status',e.target.value)}>
            <option value="active">✅ Active</option>
            <option value="inactive">❌ Inactive</option>
          </select>
        </FormGroup>

        <FormGroup label="Notes">
          <textarea rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="Any notes about this staff member…" />
        </FormGroup>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Update' : 'Add Staff Member'}
          </BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

export default function StaffPage() {
  const [staff, setStaff]   = useState<StaffMember[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal]   = useState<{open:boolean;record?:StaffMember}>({open:false});

  const loadAll = useCallback(async () => setStaff(await getStaff()), []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = staff.filter(s =>
    !search || [s.name,s.email,s.phone,s.role]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      await updateStaff(modal.record.id, data);
      setStaff(p => p.map(x => x.id===modal.record!.id ? {...x,...data} : x));
    } else {
      const ref = await addStaff(data);
      setStaff(p => [{id:ref.id,...data,createdAt:{seconds:Date.now()/1000}},...p]);
    }
  }

  async function toggleStatus(s: StaffMember) {
    const status = s.status === 'active' ? 'inactive' : 'active';
    await updateStaff(s.id!, { status });
    setStaff(p => p.map(x => x.id===s.id ? {...x,status} : x));
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this staff member?')) return;
    await deleteStaff(id);
    setStaff(p => p.filter(x => x.id !== id));
  }

  const active   = staff.filter(s=>s.status==='active').length;
  const admins   = staff.filter(s=>s.role==='admin').length;
  const managers = staff.filter(s=>s.role==='manager').length;

  return (
    <AppShell title="Staff Management" onRefresh={loadAll}>
      <StatsRow>
        <StatCard icon="👥" num={staff.length} label="Total Staff"   sub={`${active} active`}   color="blue"  />
        <StatCard icon="👑" num={admins}        label="Admins"        sub="full access"          color="gold"  />
        <StatCard icon="🎯" num={managers}      label="Managers"      sub="team leads"           color="green" />
        <StatCard icon="👤" num={staff.filter(s=>s.role==='staff').length} label="Staff" sub="regular members" color="blue" />
      </StatsRow>

      <Card>
        <CardHeader title={`👥 Staff Members (${staff.length})`}>
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 Search name, role…" />
          <BtnPrimary onClick={() => setModal({open:true})}>+ Add Staff</BtnPrimary>
        </CardHeader>

        {/* Staff cards */}
        <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
          {filtered.length === 0 && (
            <p style={{color:'var(--text-muted)',fontSize:13,gridColumn:'1/-1',textAlign:'center',padding:24}}>
              No staff members added yet.
            </p>
          )}
          {filtered.map(s => (
            <div key={s.id} style={{
              background: s.status==='inactive' ? '#fafafa' : '#fff',
              border:'1.5px solid var(--border)', borderRadius:14, padding:18,
              opacity: s.status==='inactive' ? 0.7 : 1,
            }}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{
                    width:44,height:44,borderRadius:50,
                    background:'linear-gradient(135deg,var(--blue),#2a8de0)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:18,color:'#fff',fontWeight:700,
                  }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:14}}>{s.name}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{ROLE_ICON[s.role]} {s.role.charAt(0).toUpperCase()+s.role.slice(1)}</div>
                  </div>
                </div>
                <Badge status={s.status} />
              </div>

              <div style={{fontSize:12.5,color:'var(--text-muted)',display:'flex',flexDirection:'column',gap:5}}>
                {s.phone && <span>📞 <a href={`tel:${s.phone}`} style={{color:'var(--blue)',fontWeight:600}}>{s.phone}</a></span>}
                {s.email && <span>📧 {s.email}</span>}
                {s.joinDate && <span>📅 Joined: {s.joinDate}</span>}
                {s.notes && <span style={{color:'#aaa',fontStyle:'italic'}}>"{s.notes}"</span>}
              </div>

              <div style={{display:'flex',gap:6,marginTop:14}}>
                <button onClick={() => setModal({open:true,record:s})}
                  style={{flex:1,padding:'7px 10px',borderRadius:8,border:'1.5px solid var(--border)',background:'#fff',cursor:'pointer',fontSize:12.5,fontWeight:600,fontFamily:'var(--font)'}}>
                  ✏️ Edit
                </button>
                <button onClick={() => toggleStatus(s)}
                  style={{flex:1,padding:'7px 10px',borderRadius:8,border:'1.5px solid var(--border)',background:'#fff',cursor:'pointer',fontSize:12.5,fontWeight:600,fontFamily:'var(--font)',color: s.status==='active'?'var(--red)':'var(--green)'}}>
                  {s.status==='active' ? '❌ Deactivate' : '✅ Activate'}
                </button>
                <button onClick={() => handleDelete(s.id!)}
                  style={{padding:'7px 10px',borderRadius:8,border:'1.5px solid #fecdd3',background:'#fff0f0',cursor:'pointer',fontSize:13}}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {modal.open && (
        <StaffModal initial={modal.record} onSave={handleSave} onClose={() => setModal({open:false})} />
      )}
    </AppShell>
  );
}
