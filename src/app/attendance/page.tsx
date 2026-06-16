'use client';
// src/app/attendance/page.tsx
export const dynamic = 'force-dynamic';
import ExportButton from '@/components/ExportButton';
import { exportAttendance } from '@/lib/exportExcel';
import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, FilterRow, FilterBtn,
  TableWrap, Empty, Badge, SearchInput, BtnPrimary, ActionBtn,
  Modal, ModalForm, FormRow, FormGroup, ModalFooter, BtnSecondary,
  fmtDate,
} from '@/components/UI';
import {
  getAttendance, addAttendance, updateAttendance, deleteAttendance,
  AttendanceRecord, AttendanceStatus,
} from '@/lib/firestore';

const SUBJECTS = ['Maths','Science','Physics','Chemistry','Biology','English','Hindi','Social Science','Computer Science','Accountancy / Commerce','Economics','JEE Coaching','NEET Coaching','Drawing / Art','Music / Singing','Dance','All Subjects','Other'];
const CLASS_LEVELS = ['Nursery','LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10 (Board)','Class 11','Class 12 (Board)','Competitive Exam (JEE/NEET)','Competitive Exam (Govt Job)','Summer Classes','Drawing / Art','Music / Singing','Dance','Other'];
const ATT_STATUSES: AttendanceStatus[] = ['present','absent','holiday','cancelled'];

const today = () => new Date().toISOString().split('T')[0];

const EMPTY: Omit<AttendanceRecord,'id'|'createdAt'> = {
  studentName:'', tutorName:'', subject:'', classLevel:'',
  date: today(), status:'present', sessionDuration:60, notes:'',
};

function AttModal({ initial, onSave, onClose }: {
  initial?: AttendanceRecord;
  onSave: (d: typeof EMPTY) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await onSave(form); setSaving(false); onClose();
  }

  const statusIcon: Record<AttendanceStatus, string> = {
    present: '✅', absent: '❌', holiday: '🏖️', cancelled: '⚠️',
  };

  return (
    <Modal title={initial ? 'Edit Attendance' : 'Mark Attendance'} onClose={onClose}>
      <ModalForm onSubmit={submit}>
        <FormRow>
          <FormGroup label="Student / Parent Name *">
            <input value={form.studentName} onChange={e=>f('studentName',e.target.value)} placeholder="Student or parent name" required />
          </FormGroup>
          <FormGroup label="Tutor Name *">
            <input value={form.tutorName} onChange={e=>f('tutorName',e.target.value)} placeholder="Tutor name" required />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Subject">
            <select value={form.subject} onChange={e=>f('subject',e.target.value)}>
              <option value="">Select Subject</option>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Class Level">
            <select value={form.classLevel} onChange={e=>f('classLevel',e.target.value)}>
              <option value="">Select Class</option>
              {CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}
            </select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Date *">
            <input type="date" value={form.date} onChange={e=>f('date',e.target.value)} required />
          </FormGroup>
          <FormGroup label="Session Duration">
            <select value={form.sessionDuration} onChange={e=>f('sessionDuration',Number(e.target.value))}>
              {[30,45,60,75,90,120].map(n => <option key={n} value={n}>{n} minutes</option>)}
            </select>
          </FormGroup>
        </FormRow>

        {/* Status as big toggle buttons */}
        <FormGroup label="Attendance Status *">
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            {ATT_STATUSES.map(s => (
              <button
                key={s} type="button"
                onClick={() => f('status', s)}
                style={{
                  padding:'10px 6px', borderRadius:10, border:'2px solid',
                  cursor:'pointer', fontFamily:'var(--font)', fontSize:12, fontWeight:700,
                  borderColor: form.status===s ? 'var(--blue)' : 'var(--border)',
                  background: form.status===s ? 'var(--blue-light)' : '#fff',
                  color: form.status===s ? 'var(--blue)' : 'var(--text-muted)',
                  transition:'all .15s',
                }}
              >
                <div style={{fontSize:20,marginBottom:4}}>{statusIcon[s]}</div>
                {s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>
        </FormGroup>

        <FormGroup label="Notes">
          <input value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="Optional notes about the session" />
        </FormGroup>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Update' : 'Mark Attendance'}
          </BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<AttendanceStatus|'all'>('all');
  const [dateFilter, setDateFilter] = useState<'all'|'today'|'week'>('all');
  const [modal, setModal]     = useState<{open:boolean; record?:AttendanceRecord}>({open:false});

  const loadAll = useCallback(async () => setRecords(await getAttendance()), []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const todayStr = today();
  const weekAgo  = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];

  const filtered = records
    .filter(r => filter==='all' || r.status===filter)
    .filter(r => {
      if (dateFilter==='today') return r.date === todayStr;
      if (dateFilter==='week')  return r.date >= weekAgo;
      return true;
    })
    .filter(r => !search || [r.studentName,r.tutorName,r.subject,r.classLevel]
      .some(v => v?.toLowerCase().includes(search.toLowerCase())));

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      await updateAttendance(modal.record.id, data);
      setRecords(p => p.map(x => x.id===modal.record!.id ? {...x,...data} : x));
    } else {
      const ref = await addAttendance(data);
      setRecords(p => [{id:ref.id,...data,createdAt:{seconds:Date.now()/1000}},...p]);
    }
  }

  async function quickStatus(id: string, status: AttendanceStatus) {
    await updateAttendance(id, { status });
    setRecords(p => p.map(x => x.id===id ? {...x,status} : x));
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this record?')) return;
    await deleteAttendance(id);
    setRecords(p => p.filter(x => x.id !== id));
  }

  // Stats
  const nonHoliday    = records.filter(r => r.status !== 'holiday');
  const presentAll    = records.filter(r => r.status === 'present').length;
  const absentAll     = records.filter(r => r.status === 'absent').length;
  const presentToday  = records.filter(r => r.date === todayStr && r.status === 'present').length;
  const absentToday   = records.filter(r => r.date === todayStr && r.status === 'absent').length;
  const attRate       = nonHoliday.length > 0 ? Math.round((presentAll / nonHoliday.length) * 100) : 0;
  const totalMins     = records.filter(r=>r.status==='present').reduce((s,r) => s+(r.sessionDuration||0), 0);
  const totalHours    = Math.round(totalMins / 60);

  const statusIcon: Record<string, string> = {
    present:'✅', absent:'❌', holiday:'🏖️', cancelled:'⚠️',
  };

  return (
    <AppShell title="Attendance Tracker" onRefresh={loadAll}>
      <StatsRow>
        <StatCard icon="✅" num={presentToday} label="Present Today"    sub={`${absentToday} absent`}      color="green" />
        <StatCard icon="📊" num={`${attRate}%`} label="Overall Rate"   sub="present / total sessions"     color="blue"  />
        <StatCard icon="❌" num={absentAll}     label="Total Absences"  sub="all time"                    color="red"   />
        <StatCard icon="⏱️" num={`${totalHours}h`} label="Total Hours" sub="all present sessions"        color="gold"  />
      </StatsRow>

      <Card>
        <CardHeader title={`📅 Attendance Records (${records.length})`}>
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 Search student, tutor…" />
          <BtnPrimary onClick={() => setModal({open:true})}>+ Mark Attendance</BtnPrimary>
          <ExportButton label="Export Attendance" onExport={() => exportAttendance(filtered)} />
        </CardHeader>

        <FilterRow>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>Date:</span>
          {([['all','All Time'],['today','Today'],['week','This Week']] as [string,string][]).map(([k,l]) => (
            <FilterBtn key={k} active={dateFilter===k} onClick={() => setDateFilter(k as any)}>{l}</FilterBtn>
          ))}
        </FilterRow>
        <FilterRow>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>Status:</span>
          {(['all','present','absent','holiday','cancelled'] as (AttendanceStatus|'all')[]).map(s => (
            <FilterBtn key={s} active={filter===s} onClick={() => setFilter(s)}>
              {s==='all' ? 'All' : `${statusIcon[s]} ${s.charAt(0).toUpperCase()+s.slice(1)}`}
            </FilterBtn>
          ))}
        </FilterRow>

        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Tutor</th><th>Subject</th>
                <th>Class</th><th>Date</th><th>Duration</th>
                <th>Status</th><th>Notes</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <Empty colSpan={9} text="No attendance records found." />}
              {filtered.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.studentName}</strong></td>
                  <td>{r.tutorName}</td>
                  <td>{r.subject}</td>
                  <td style={{whiteSpace:'nowrap'}}>{r.classLevel}</td>
                  <td style={{whiteSpace:'nowrap',fontWeight: r.date===todayStr ? 700 : 400, color: r.date===todayStr ? 'var(--blue)' : undefined}}>{r.date}</td>
                  <td style={{whiteSpace:'nowrap'}}>{r.sessionDuration} min</td>
                  <td>
                    {/* Quick status toggle */}
                    <div style={{display:'flex',gap:4}}>
                      {ATT_STATUSES.map(s => (
                        <button
                          key={s} title={s}
                          onClick={() => quickStatus(r.id!, s)}
                          style={{
                            padding:'3px 7px', borderRadius:6, border:'1.5px solid',
                            cursor:'pointer', fontSize:13, background:'#fff',
                            borderColor: r.status===s ? 'var(--blue)' : 'var(--border)',
                            opacity: r.status===s ? 1 : 0.45,
                            transition:'all .1s',
                          }}
                        >
                          {statusIcon[s]}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#999',fontSize:12}}>{r.notes||'—'}</td>
                  <td style={{display:'flex',gap:4}}>
                    <ActionBtn onClick={() => setModal({open:true,record:r})}>✏️</ActionBtn>
                    <ActionBtn variant="delete" onClick={() => handleDelete(r.id!)}>🗑️</ActionBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {modal.open && (
        <AttModal
          initial={modal.record}
          onSave={handleSave}
          onClose={() => setModal({open:false})}
        />
      )}
    </AppShell>
  );
}
