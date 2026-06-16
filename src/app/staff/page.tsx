'use client';
// src/app/staff/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, BtnPrimary, BtnSecondary,
  Modal, ModalForm, FormRow, FormGroup, ModalFooter, Badge,
} from '@/components/UI';
import { getStaff, addStaff, updateStaff, deleteStaff, StaffMember, StaffRole } from '@/lib/firestore';
import { createStaffAccount, generateTempPassword } from '@/lib/firebase';

const ROLES: StaffRole[] = ['admin','manager','staff'];
const ROLE_ICON: Record<StaffRole,string> = { admin:'👑', manager:'🎯', staff:'👤' };
const ROLE_DESC: Record<StaffRole,string> = {
  admin:   'Full access to all modules',
  manager: 'Access to leads, fees, comms',
  staff:   'Basic access only',
};

const today = () => new Date().toISOString().split('T')[0];

const EMPTY: Omit<StaffMember,'id'|'createdAt'> = {
  name:'', email:'', phone:'', role:'staff',
  status:'active', joinDate: today(), notes:'',
  hasLogin: false, passwordChanged: false,
};

// ── Credential display modal ─────────────────────────────────────────────────
function CredentialModal({ name, email, password, onClose }: {
  name: string; email: string; password: string; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyAll() {
    const text = `CRM Login Credentials\nName: ${name}\nEmail: ${email}\nPassword: ${password}\nURL: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal title="✅ Staff Login Created!" onClose={onClose}>
      <div style={{padding:'20px 22px 24px',display:'flex',flexDirection:'column',gap:16}}>
        <div style={{background:'#f0fdf4',border:'1.5px solid #bbf7d0',borderRadius:12,padding:16}}>
          <p style={{fontSize:13,color:'#166534',fontWeight:600,marginBottom:12}}>
            ✅ Firebase account created successfully! Share these credentials with <strong>{name}</strong>:
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[
              { label:'🌐 CRM URL', value: typeof window!=='undefined' ? window.location.origin : '' },
              { label:'📧 Email',    value: email },
              { label:'🔑 Password', value: password },
            ].map(item => (
              <div key={item.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff',border:'1px solid #d1fae5',borderRadius:8,padding:'10px 14px'}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:.5}}>{item.label}</div>
                  <div style={{fontSize:14,fontWeight:700,color:'#0f1923',marginTop:2,fontFamily:'monospace'}}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{background:'#fff8e5',border:'1px solid #fde68a',borderRadius:10,padding:12,fontSize:12.5,color:'#92400e',lineHeight:1.6}}>
          ⚠️ <strong>Important:</strong> This password is shown only once. Ask staff to change it after first login. Share via WhatsApp or call — do not send over email.
        </div>

        <div style={{display:'flex',gap:10}}>
          <button onClick={copyAll}
            style={{flex:1,padding:'11px 16px',borderRadius:10,border:'1.5px solid var(--border)',background:copied?'#f0fdf4':'#fff',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'var(--font)',color:copied?'var(--green)':'var(--text)'}}>
            {copied ? '✅ Copied!' : '📋 Copy All Credentials'}
          </button>
          <BtnPrimary onClick={onClose}>Done</BtnPrimary>
        </div>
      </div>
    </Modal>
  );
}

// ── Add / Edit staff modal ───────────────────────────────────────────────────
function StaffModal({ initial, onSave, onClose }: {
  initial?: StaffMember;
  onSave: (d: typeof EMPTY, createLogin: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm]         = useState(initial ? { ...EMPTY,...initial } : { ...EMPTY });
  const [createLogin, setCreate] = useState(!initial?.hasLogin);
  const [saving, setSaving]     = useState(false);
  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (createLogin && !form.email) { alert('Email is required to create a login.'); return; }
    setSaving(true);
    await onSave(form, createLogin);
    setSaving(false); onClose();
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

        <FormGroup label="Email (required for login)">
          <input type="email" value={form.email} onChange={e=>f('email',e.target.value)} placeholder="staff@example.com" />
        </FormGroup>

        {/* Role picker */}
        <FormGroup label="Role *">
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {ROLES.map(r => (
              <button key={r} type="button" onClick={() => f('role',r)}
                style={{
                  padding:'12px 8px', borderRadius:10, border:'2px solid',
                  cursor:'pointer', fontFamily:'var(--font)', fontSize:12, fontWeight:700,
                  borderColor: form.role===r ? 'var(--blue)' : 'var(--border)',
                  background:  form.role===r ? 'var(--blue-light)' : '#fff',
                  color:       form.role===r ? 'var(--blue)' : 'var(--text-muted)',
                  transition:'all .15s', textAlign:'center',
                }}>
                <div style={{fontSize:22,marginBottom:4}}>{ROLE_ICON[r]}</div>
                <div>{r.charAt(0).toUpperCase()+r.slice(1)}</div>
                <div style={{fontSize:10,fontWeight:500,marginTop:3,opacity:.7}}>{ROLE_DESC[r]}</div>
              </button>
            ))}
          </div>
        </FormGroup>

        <FormRow>
          <FormGroup label="Join Date">
            <input type="date" value={form.joinDate} onChange={e=>f('joinDate',e.target.value)} />
          </FormGroup>
          <FormGroup label="Status">
            <select value={form.status} onChange={e=>f('status',e.target.value)}>
              <option value="active">✅ Active</option>
              <option value="inactive">❌ Inactive</option>
            </select>
          </FormGroup>
        </FormRow>

        <FormGroup label="Notes">
          <textarea rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="Any notes…" />
        </FormGroup>

        {/* Login creation toggle */}
        {!initial?.hasLogin && (
          <div style={{
            background: createLogin ? 'var(--blue-light)' : 'var(--bg)',
            border:'1.5px solid', borderColor: createLogin ? 'var(--blue)' : 'var(--border)',
            borderRadius:12, padding:14,
          }}>
            <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
              <input type="checkbox" checked={createLogin} onChange={e=>setCreate(e.target.checked)}
                style={{width:16,height:16,accentColor:'var(--blue)',cursor:'pointer'}} />
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--ink)'}}>🔑 Create CRM Login Account</div>
                <div style={{fontSize:11.5,color:'var(--text-muted)',marginTop:2}}>
                  A temporary password will be generated. Staff can change it after first login.
                </div>
              </div>
            </label>
          </div>
        )}

        {initial?.hasLogin && (
          <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:12,fontSize:12.5,color:'#166534'}}>
            ✅ This staff member already has a CRM login account.
          </div>
        )}

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>
            {saving
              ? (createLogin ? 'Creating account…' : 'Saving…')
              : initial ? 'Update Staff' : createLogin ? '+ Add & Create Login' : '+ Add Staff'
            }
          </BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function StaffPage() {
  const [staff, setStaff]   = useState<StaffMember[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal]   = useState<{open:boolean;record?:StaffMember}>({open:false});
  const [creds, setCreds]   = useState<{name:string;email:string;password:string}|null>(null);

  const loadAll = useCallback(async () => setStaff(await getStaff()), []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = staff.filter(s =>
    !search || [s.name,s.email,s.phone,s.role].some(v=>v?.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleSave(data: typeof EMPTY, createLogin: boolean) {
    let uid: string | undefined;
    let tempPassword: string | undefined;

    // Step 1 — create Firebase Auth account if requested
    if (createLogin && data.email) {
      tempPassword = generateTempPassword();
      try {
        uid = await createStaffAccount(data.email, tempPassword);
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          alert('This email already has a Firebase account. Staff can log in with their existing password.');
          uid = 'existing';
        } else {
          throw err;
        }
      }
    }

    const staffData = {
      ...data,
      ...(uid ? { uid, hasLogin: true } : {}),
    };

    // Step 2 — save to Firestore
    if (modal.record?.id) {
      await updateStaff(modal.record.id, staffData);
      setStaff(p => p.map(x => x.id===modal.record!.id ? {...x,...staffData} : x));
    } else {
      const ref = await addStaff(staffData);
      setStaff(p => [{id:ref.id,...staffData,createdAt:{seconds:Date.now()/1000}},...p]);
    }

    // Step 3 — show credentials if login was created
    if (createLogin && tempPassword && data.email && uid !== 'existing') {
      setCreds({ name: data.name, email: data.email, password: tempPassword });
    }
  }

  async function handleCreateLogin(s: StaffMember) {
    if (!s.email) { alert('Please add an email address first by editing the staff member.'); return; }
    if (!confirm(`Create a CRM login for ${s.name} (${s.email})?`)) return;
    const tempPassword = generateTempPassword();
    try {
      const uid = await createStaffAccount(s.email, tempPassword);
      await updateStaff(s.id!, { uid, hasLogin: true });
      setStaff(p => p.map(x => x.id===s.id ? {...x, uid, hasLogin:true} : x));
      setCreds({ name: s.name, email: s.email, password: tempPassword });
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        alert('This email already has a Firebase login account.');
      } else {
        alert('Error creating account: ' + err.message);
      }
    }
  }

  async function toggleStatus(s: StaffMember) {
    const status = s.status === 'active' ? 'inactive' : 'active';
    await updateStaff(s.id!, { status });
    setStaff(p => p.map(x => x.id===s.id ? {...x,status} : x));
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this staff member? Their Firebase login will still exist — delete it manually in Firebase Console if needed.')) return;
    await deleteStaff(id);
    setStaff(p => p.filter(x => x.id !== id));
  }

  const active   = staff.filter(s=>s.status==='active').length;
  const withLogin= staff.filter(s=>s.hasLogin).length;

  return (
    <AppShell title="Staff Management" onRefresh={loadAll}>
      <StatsRow>
        <StatCard icon="👥" num={staff.length}  label="Total Staff"    sub={`${active} active`}       color="blue"  />
        <StatCard icon="🔑" num={withLogin}      label="Have Login"     sub="can access CRM"          color="green" />
        <StatCard icon="👑" num={staff.filter(s=>s.role==='admin').length}   label="Admins"   sub="full access"   color="gold" />
        <StatCard icon="🎯" num={staff.filter(s=>s.role==='manager').length} label="Managers" sub="team leads"    color="blue" />
      </StatsRow>

      {/* Search + Add */}
      <Card>
        <CardHeader title={`👥 Staff Members (${staff.length})`}>
          <input
            className="searchInput"
            style={{padding:'9px 14px',border:'1.5px solid var(--border)',borderRadius:8,fontSize:13,width:220,fontFamily:'var(--font)'}}
            placeholder="🔍 Search name, role, email…"
            value={search} onChange={e=>setSearch(e.target.value)}
          />
          <BtnPrimary onClick={() => setModal({open:true})}>+ Add Staff</BtnPrimary>
        </CardHeader>

        {/* Staff cards grid */}
        <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
          {filtered.length===0 && (
            <p style={{color:'var(--text-muted)',fontSize:13,gridColumn:'1/-1',textAlign:'center',padding:24}}>
              No staff members added yet. Click "+ Add Staff" to get started.
            </p>
          )}

          {filtered.map(s => (
            <div key={s.id} style={{
              background: s.status==='inactive' ? '#fafafa' : '#fff',
              border:'1.5px solid var(--border)', borderRadius:14, padding:18,
              opacity: s.status==='inactive' ? 0.75 : 1, transition:'all .15s',
            }}>
              {/* Header */}
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{
                    width:46,height:46,borderRadius:'50%',flexShrink:0,
                    background:'linear-gradient(135deg,var(--blue),#2a8de0)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:18,color:'#fff',fontWeight:800,
                  }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:'var(--ink)'}}>{s.name}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:1}}>
                      {ROLE_ICON[s.role as StaffRole]} {s.role.charAt(0).toUpperCase()+s.role.slice(1)}
                    </div>
                  </div>
                </div>
                <Badge status={s.status} />
              </div>

              {/* Info */}
              <div style={{fontSize:12.5,color:'var(--text-muted)',display:'flex',flexDirection:'column',gap:5,marginBottom:12}}>
                {s.phone    && <span>📞 <a href={`tel:${s.phone}`} style={{color:'var(--blue)',fontWeight:600}}>{s.phone}</a></span>}
                {s.email    && <span>📧 {s.email}</span>}
                {s.joinDate && <span>📅 Joined: {s.joinDate}</span>}
                {s.notes    && <span style={{color:'#aaa',fontStyle:'italic'}}>"{s.notes}"</span>}
              </div>

              {/* Login status */}
              <div style={{
                padding:'8px 12px', borderRadius:8, marginBottom:12, fontSize:12,
                background: s.hasLogin ? '#f0fdf4' : '#fff8e5',
                border:`1px solid ${s.hasLogin ? '#bbf7d0' : '#fde68a'}`,
                color: s.hasLogin ? '#166534' : '#92400e',
                display:'flex', alignItems:'center', gap:6,
              }}>
                {s.hasLogin
                  ? <><span>🔑</span><span>Has CRM login · <strong>{s.email}</strong></span></>
                  : <><span>⚠️</span><span>No CRM login yet</span></>
                }
              </div>

              {/* Action buttons */}
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <button onClick={() => setModal({open:true,record:s})}
                  style={{flex:1,padding:'8px 10px',borderRadius:8,border:'1.5px solid var(--border)',background:'#fff',cursor:'pointer',fontSize:12.5,fontWeight:600,fontFamily:'var(--font)'}}>
                  ✏️ Edit
                </button>

                {!s.hasLogin && s.email && (
                  <button onClick={() => handleCreateLogin(s)}
                    style={{flex:1,padding:'8px 10px',borderRadius:8,border:'1.5px solid #bbf7d0',background:'#f0fdf4',cursor:'pointer',fontSize:12.5,fontWeight:600,fontFamily:'var(--font)',color:'#166534'}}>
                    🔑 Create Login
                  </button>
                )}

                <button onClick={() => toggleStatus(s)}
                  style={{flex:1,padding:'8px 10px',borderRadius:8,border:'1.5px solid var(--border)',background:'#fff',cursor:'pointer',fontSize:12.5,fontWeight:600,fontFamily:'var(--font)',color:s.status==='active'?'var(--red)':'var(--green)'}}>
                  {s.status==='active' ? '❌ Deactivate' : '✅ Activate'}
                </button>

                <button onClick={() => handleDelete(s.id!)}
                  style={{padding:'8px 10px',borderRadius:8,border:'1.5px solid #fecdd3',background:'#fff0f0',cursor:'pointer',fontSize:13}}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Modals */}
      {modal.open && (
        <StaffModal initial={modal.record} onSave={handleSave} onClose={() => setModal({open:false})} />
      )}
      {creds && (
        <CredentialModal {...creds} onClose={() => setCreds(null)} />
      )}
    </AppShell>
  );
}