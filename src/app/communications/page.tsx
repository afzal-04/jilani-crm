'use client';
// src/app/communications/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, FilterRow, FilterBtn,
  TableWrap, Empty, Badge, SearchInput, BtnPrimary, ActionBtn,
  Modal, ModalForm, FormRow, FormGroup, ModalFooter, BtnSecondary,
  AlertBox, AlertLink, fmtDate,
} from '@/components/UI';
import {
  getComms, addComm, updateComm, deleteComm,
  CommunicationLog, CommChannel,
} from '@/lib/firestore';

const CHANNELS: CommChannel[] = ['call','whatsapp','visit','email','sms'];
const CHANNEL_ICON: Record<CommChannel, string> = {
  call:'📞', whatsapp:'💬', visit:'🏠', email:'📧', sms:'✉️',
};

const today = () => new Date().toISOString().split('T')[0];

const EMPTY: Omit<CommunicationLog,'id'|'createdAt'> = {
  contactName:'', contactType:'parent', contactPhone:'',
  channel:'call', date: today(), time:'',
  notes:'', outcome:'', followUpDate:'',
  followUpStatus:'none', handledBy:'',
};

function CommModal({ initial, onSave, onClose }: {
  initial?: CommunicationLog;
  onSave: (d: typeof EMPTY) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await onSave(form); setSaving(false); onClose();
  }

  return (
    <Modal title={initial ? 'Edit Log' : 'Log Communication'} onClose={onClose}>
      <ModalForm onSubmit={submit}>

        {/* Contact */}
        <FormRow>
          <FormGroup label="Contact Name *">
            <input value={form.contactName} onChange={e=>f('contactName',e.target.value)} placeholder="Parent or tutor name" required />
          </FormGroup>
          <FormGroup label="Contact Type">
            <select value={form.contactType} onChange={e=>f('contactType',e.target.value)}>
              <option value="parent">👨‍👩‍👧 Parent</option>
              <option value="tutor">👩‍🏫 Tutor</option>
            </select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Phone">
            <input value={form.contactPhone} onChange={e=>f('contactPhone',e.target.value)} placeholder="+91 XXXXX XXXXX" />
          </FormGroup>
          <FormGroup label="Handled By">
            <input value={form.handledBy} onChange={e=>f('handledBy',e.target.value)} placeholder="Your name or staff name" />
          </FormGroup>
        </FormRow>

        {/* Channel — visual picker */}
        <FormGroup label="Communication Channel *">
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
            {CHANNELS.map(ch => (
              <button
                key={ch} type="button"
                onClick={() => f('channel', ch)}
                style={{
                  padding:'10px 4px', borderRadius:10, border:'2px solid',
                  cursor:'pointer', fontFamily:'var(--font)', fontSize:11, fontWeight:700,
                  borderColor: form.channel===ch ? 'var(--blue)' : 'var(--border)',
                  background: form.channel===ch ? 'var(--blue-light)' : '#fff',
                  color: form.channel===ch ? 'var(--blue)' : 'var(--text-muted)',
                  transition:'all .15s',
                }}
              >
                <div style={{fontSize:22,marginBottom:4}}>{CHANNEL_ICON[ch]}</div>
                {ch.charAt(0).toUpperCase()+ch.slice(1)}
              </button>
            ))}
          </div>
        </FormGroup>

        {/* Date / Time */}
        <FormRow>
          <FormGroup label="Date *">
            <input type="date" value={form.date} onChange={e=>f('date',e.target.value)} required />
          </FormGroup>
          <FormGroup label="Time">
            <input type="time" value={form.time} onChange={e=>f('time',e.target.value)} />
          </FormGroup>
        </FormRow>

        {/* Notes + Outcome */}
        <FormGroup label="Notes / What was discussed *">
          <textarea rows={3} value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="Describe what was discussed in detail…" required />
        </FormGroup>
        <FormGroup label="Outcome">
          <input value={form.outcome} onChange={e=>f('outcome',e.target.value)} placeholder="e.g. Demo scheduled for Monday 5pm" />
        </FormGroup>

        {/* Follow-up */}
        <FormRow>
          <FormGroup label="Follow-up Date">
            <input type="date" value={form.followUpDate} onChange={e=>f('followUpDate',e.target.value)} />
          </FormGroup>
          <FormGroup label="Follow-up Status">
            <select value={form.followUpStatus} onChange={e=>f('followUpStatus',e.target.value)}>
              <option value="none">No follow-up needed</option>
              <option value="pending">🔔 Follow-up Pending</option>
              <option value="done">✅ Follow-up Done</option>
            </select>
          </FormGroup>
        </FormRow>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Update Log' : 'Save Log'}
          </BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

export default function CommunicationsPage() {
  const [comms, setComms]     = useState<CommunicationLog[]>([]);
  const [search, setSearch]   = useState('');
  const [chFilter, setChFilter] = useState<CommChannel|'all'>('all');
  const [fuFilter, setFuFilter] = useState<'all'|'pending'|'done'>('all');
  const [dateFilter, setDateFilter] = useState<'all'|'today'|'week'>('all');
  const [modal, setModal]     = useState<{open:boolean; record?:CommunicationLog}>({open:false});

  const loadAll = useCallback(async () => setComms(await getComms()), []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const todayStr = today();
  const weekAgo  = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];

  const filtered = comms
    .filter(c => chFilter==='all' || c.channel===chFilter)
    .filter(c => fuFilter==='all' || c.followUpStatus===fuFilter)
    .filter(c => {
      if (dateFilter==='today') return c.date===todayStr;
      if (dateFilter==='week')  return c.date>=weekAgo;
      return true;
    })
    .filter(c => !search || [c.contactName,c.contactPhone,c.notes,c.outcome,c.handledBy]
      .some(v => v?.toLowerCase().includes(search.toLowerCase())));

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      await updateComm(modal.record.id, data);
      setComms(p => p.map(x => x.id===modal.record!.id ? {...x,...data} : x));
    } else {
      const ref = await addComm(data);
      setComms(p => [{id:ref.id,...data,createdAt:{seconds:Date.now()/1000}},...p]);
    }
  }

  async function markFollowUpDone(id: string) {
    await updateComm(id, { followUpStatus: 'done' });
    setComms(p => p.map(x => x.id===id ? {...x, followUpStatus:'done'} : x));
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this log?')) return;
    await deleteComm(id);
    setComms(p => p.filter(x => x.id !== id));
  }

  // Stats
  const pendingFollowups = comms.filter(c => c.followUpStatus === 'pending').length;
  const overdueFollowups = comms.filter(c => c.followUpStatus === 'pending' && c.followUpDate && c.followUpDate < todayStr).length;
  const todayComms       = comms.filter(c => c.date === todayStr).length;

  return (
    <AppShell title="Communication Log" onRefresh={loadAll}
      badges={{'/communications': pendingFollowups}}>

      <StatsRow>
        <StatCard icon="📞" num={comms.filter(c=>c.channel==='call').length}     label="Total Calls"       sub="all time"          color="blue"  />
        <StatCard icon="💬" num={comms.filter(c=>c.channel==='whatsapp').length} label="WhatsApp Logs"     sub="all time"          color="green" />
        <StatCard icon="🔔" num={pendingFollowups}                                label="Follow-ups Pending" sub={`${overdueFollowups} overdue`} color="red"  />
        <StatCard icon="📅" num={todayComms}                                      label="Today's Comms"     sub="logged today"      color="gold"  />
      </StatsRow>

      {/* Overdue alert */}
      {overdueFollowups > 0 && (
        <AlertBox>
          ⚠️ <strong>{overdueFollowups} follow-up{overdueFollowups>1?'s':''}</strong> overdue —
          <AlertLink onClick={() => setFuFilter('pending')}>Show pending follow-ups →</AlertLink>
        </AlertBox>
      )}

      <Card>
        <CardHeader title={`💬 Communication Log (${comms.length})`}>
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 Search contact, notes…" />
          <BtnPrimary onClick={() => setModal({open:true})}>+ Log Communication</BtnPrimary>
        </CardHeader>

        {/* Date filter */}
        <FilterRow>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>Date:</span>
          {([['all','All Time'],['today','Today'],['week','This Week']] as [string,string][]).map(([k,l]) => (
            <FilterBtn key={k} active={dateFilter===k} onClick={() => setDateFilter(k as any)}>{l}</FilterBtn>
          ))}
        </FilterRow>

        {/* Channel filter */}
        <FilterRow>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>Channel:</span>
          <FilterBtn active={chFilter==='all'} onClick={() => setChFilter('all')}>All</FilterBtn>
          {CHANNELS.map(ch => (
            <FilterBtn key={ch} active={chFilter===ch} onClick={() => setChFilter(ch)}>
              {CHANNEL_ICON[ch]} {ch.charAt(0).toUpperCase()+ch.slice(1)}
            </FilterBtn>
          ))}
        </FilterRow>

        {/* Follow-up filter */}
        <FilterRow>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>Follow-up:</span>
          <FilterBtn active={fuFilter==='all'} onClick={() => setFuFilter('all')}>All</FilterBtn>
          <FilterBtn active={fuFilter==='pending'} onClick={() => setFuFilter('pending')}>🔔 Pending ({pendingFollowups})</FilterBtn>
          <FilterBtn active={fuFilter==='done'} onClick={() => setFuFilter('done')}>✅ Done</FilterBtn>
        </FilterRow>

        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Contact</th><th>Type</th><th>Channel</th>
                <th>Date / Time</th><th>Notes</th><th>Outcome</th>
                <th>Follow-up</th><th>By</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <Empty colSpan={9} text="No communication logs found." />}
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.contactName}</strong>
                    {c.contactPhone && (
                      <div style={{fontSize:11}}>
                        <a href={`tel:${c.contactPhone}`} style={{color:'var(--blue)',fontWeight:600}}>{c.contactPhone}</a>
                        {' '}
                        <a href={`https://wa.me/${c.contactPhone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{color:'#25D366',fontWeight:600}}>💬</a>
                      </div>
                    )}
                  </td>
                  <td><Badge status={c.contactType} /></td>
                  <td style={{whiteSpace:'nowrap'}}>{CHANNEL_ICON[c.channel]} {c.channel}</td>
                  <td style={{whiteSpace:'nowrap',fontSize:12}}>
                    <strong>{c.date}</strong>
                    {c.time && <div style={{color:'#999'}}>{c.time}</div>}
                  </td>
                  <td style={{maxWidth:200,fontSize:12,lineHeight:1.5}}>{c.notes}</td>
                  <td style={{maxWidth:150,fontSize:12,color:'#666'}}>{c.outcome||'—'}</td>
                  <td>
                    {c.followUpDate ? (
                      <div>
                        <div style={{
                          fontSize:12, fontWeight:700,
                          color: c.followUpStatus==='pending' && c.followUpDate < todayStr ? 'var(--red)' : 'var(--text)',
                        }}>
                          {c.followUpDate}
                        </div>
                        <div style={{marginTop:4}}>
                          {c.followUpStatus === 'pending' ? (
                            <button
                              onClick={() => markFollowUpDone(c.id!)}
                              style={{fontSize:11,padding:'3px 8px',borderRadius:6,border:'1px solid var(--border)',background:'#fff',cursor:'pointer',fontFamily:'var(--font)'}}
                            >
                              ✅ Mark Done
                            </button>
                          ) : (
                            <span style={{fontSize:11,color:'var(--green)',fontWeight:600}}>✅ Done</span>
                          )}
                        </div>
                      </div>
                    ) : <span style={{color:'#ccc',fontSize:12}}>None</span>}
                  </td>
                  <td style={{fontSize:12,color:'#888'}}>{c.handledBy||'—'}</td>
                  <td style={{display:'flex',gap:4}}>
                    <ActionBtn onClick={() => setModal({open:true,record:c})}>✏️</ActionBtn>
                    <ActionBtn variant="delete" onClick={() => handleDelete(c.id!)}>🗑️</ActionBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {modal.open && (
        <CommModal
          initial={modal.record}
          onSave={handleSave}
          onClose={() => setModal({open:false})}
        />
      )}
    </AppShell>
  );
}
