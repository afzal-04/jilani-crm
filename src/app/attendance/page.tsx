'use client';
// src/app/attendance/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, FilterRow, FilterBtn,
  TableWrap, Empty, BtnPrimary, BtnSecondary, ActionBtn,
  Modal, ModalForm, FormRow, FormGroup, ModalFooter,
} from '@/components/UI';
import {
  getAttendance, addAttendance, updateAttendance, deleteAttendance,
  getAssignments,
  AttendanceRecord, AttendanceStatus, Assignment,
} from '@/lib/firestore';

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'holiday', 'cancelled'];

const STATUS_ICON: Record<AttendanceStatus, string> = {
  present: '✅', absent: '❌', holiday: '🏖️', cancelled: '🚫',
};
const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: '#1A7A4A', absent: '#C0392B', holiday: '#C8941A', cancelled: '#888',
};

const today = () => new Date().toISOString().split('T')[0];
const firstOfThisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

const EMPTY: Omit<AttendanceRecord, 'id' | 'createdAt'> = {
  studentName: '', tutorName: '', subject: '', classLevel: '',
  date: today(), status: 'present', sessionDuration: 1, notes: '',
};

// ── Add/Edit Modal ───────────────────────────────────────────────────────────

function AttendanceModal({ initial, onSave, onClose, assignments }: {
  initial?: AttendanceRecord;
  onSave: (d: typeof EMPTY) => Promise<void>;
  onClose: () => void;
  assignments: Assignment[];
}) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  function pickAssignment(id: string) {
    const a = assignments.find(x => x.id === id);
    if (!a) return;
    setForm(p => ({ ...p, studentName: a.parentName, tutorName: a.tutorName, subject: a.subject, classLevel: a.classLevel, sessionDuration: (a as any).hoursPerSession || 1 }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await onSave(form); setSaving(false); onClose();
  }

  return (
    <Modal title={initial ? 'Edit Attendance' : 'Mark Attendance'} onClose={onClose}>
      <ModalForm onSubmit={submit}>
        {!initial && assignments.length > 0 && (
          <FormGroup label="Quick-fill from Assignment">
            <select onChange={e => pickAssignment(e.target.value)} defaultValue="">
              <option value="">— Select an active assignment —</option>
              {assignments.map(a => <option key={a.id} value={a.id}>{a.tutorName} → {a.parentName} · {a.subject}</option>)}
            </select>
          </FormGroup>
        )}
        <FormRow>
          <FormGroup label="Student/Parent Name *"><input value={form.studentName} onChange={e => f('studentName', e.target.value)} required /></FormGroup>
          <FormGroup label="Tutor Name *"><input value={form.tutorName} onChange={e => f('tutorName', e.target.value)} required /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Subject *"><input value={form.subject} onChange={e => f('subject', e.target.value)} required /></FormGroup>
          <FormGroup label="Class Level"><input value={form.classLevel} onChange={e => f('classLevel', e.target.value)} /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Date *"><input type="date" value={form.date} onChange={e => f('date', e.target.value)} required /></FormGroup>
          <FormGroup label="Session Duration (hrs)"><input type="number" min="0" step="0.5" value={form.sessionDuration || ''} onChange={e => f('sessionDuration', Number(e.target.value))} /></FormGroup>
        </FormRow>
        <FormGroup label="Status *">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {STATUSES.map(s => (
              <button key={s} type="button" onClick={() => f('status', s)}
                style={{
                  padding: '10px 6px', borderRadius: 10, border: '2px solid', cursor: 'pointer',
                  fontFamily: 'var(--font)', fontSize: 11, fontWeight: 700,
                  borderColor: form.status === s ? 'var(--blue)' : 'var(--border)',
                  background: form.status === s ? 'var(--blue-light)' : '#fff',
                  color: form.status === s ? 'var(--blue)' : 'var(--text-muted)',
                }}>
                <div style={{ fontSize: 18, marginBottom: 3 }}>{STATUS_ICON[s]}</div>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </FormGroup>
        <FormGroup label="Notes"><textarea rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="e.g. Rescheduled to evening" /></FormGroup>
        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Update' : 'Mark Attendance'}</BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [modal, setModal] = useState<{ open: boolean; record?: AttendanceRecord }>({ open: false });
  const [showFilter, setShowFilter] = useState(true);

  // Pending = what's typed in the filter inputs; Applied = what's actually
  // filtering the table below. They only sync when "Search" is clicked,
  // matching the reference UI (not live-filter-as-you-type).
  const [pendingFrom, setPendingFrom] = useState(firstOfThisMonth());
  const [pendingTo, setPendingTo] = useState(today());
  const [pendingTutor, setPendingTutor] = useState('all');
  const [appliedFrom, setAppliedFrom] = useState(firstOfThisMonth());
  const [appliedTo, setAppliedTo] = useState(today());
  const [appliedTutor, setAppliedTutor] = useState('all');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'all'>('all');

  const loadAll = useCallback(async () => {
    const [r, a] = await Promise.all([getAttendance(), getAssignments()]);
    setRecords(r);
    setAssignments(a.filter(x => x.status === 'active'));
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const allTutors = Array.from(new Set(records.map(r => r.tutorName).filter(Boolean))).sort();

  function handleSearch() {
    setAppliedFrom(pendingFrom);
    setAppliedTo(pendingTo);
    setAppliedTutor(pendingTutor);
  }
  function handleClearFilter() {
    const from = firstOfThisMonth(), to = today();
    setPendingFrom(from); setPendingTo(to); setPendingTutor('all');
    setAppliedFrom(from); setAppliedTo(to); setAppliedTutor('all');
    setStatusFilter('all');
  }

  const filtered = records
    .filter(r => (!appliedFrom || r.date >= appliedFrom) && (!appliedTo || r.date <= appliedTo))
    .filter(r => appliedTutor === 'all' || r.tutorName === appliedTutor)
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = filtered.length;
  const presentCount = filtered.filter(r => r.status === 'present').length;
  const absentCount = filtered.filter(r => r.status === 'absent').length;
  const attendanceRate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      await updateAttendance(modal.record.id, data);
      setRecords(p => p.map(x => x.id === modal.record!.id ? { ...x, ...data } : x));
    } else {
      const ref = await addAttendance(data);
      setRecords(p => [{ id: ref.id, ...data, createdAt: { seconds: Date.now() / 1000 } }, ...p]);
    }
  }
  async function handleDelete(id: string) {
    if (!confirm('Delete this attendance record?')) return;
    await deleteAttendance(id);
    setRecords(p => p.filter(x => x.id !== id));
  }

  const rangeLabel = appliedFrom && appliedTo
    ? (appliedFrom === appliedTo ? appliedFrom : `${appliedFrom} to ${appliedTo}`)
    : 'All Time';

  return (
    <AppShell title="Attendance" onRefresh={loadAll}>

      <StatsRow>
        <StatCard icon="📋" num={String(total)} label={`Sessions — ${rangeLabel}`} sub="all statuses" color="blue" />
        <StatCard icon="✅" num={`${attendanceRate}%`} label="Attendance Rate" sub={`${presentCount} present`} color="green" />
        <StatCard icon="❌" num={String(absentCount)} label="Absences" sub={rangeLabel} color="red" />
        <StatCard icon="👥" num={String(allTutors.length)} label="Tutors Tracked" sub="with records" color="gold" />
      </StatsRow>

      {/* Date range + tutor filter panel */}
      {showFilter && (
        <div style={{ background: '#FCEFEF', border: '1px solid #F3D5D5', borderRadius: 12, padding: 16, marginBottom: 4 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-dark, #333)', marginBottom: 6 }}>From Date</label>
              <input type="date" value={pendingFrom} onChange={e => setPendingFrom(e.target.value)}
                style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13.5, background: '#fff', minWidth: 160 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-dark, #333)', marginBottom: 6 }}>To Date</label>
              <input type="date" value={pendingTo} onChange={e => setPendingTo(e.target.value)}
                style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13.5, background: '#fff', minWidth: 160 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-dark, #333)', marginBottom: 6 }}>Tutor Name</label>
              <select value={pendingTutor} onChange={e => setPendingTutor(e.target.value)}
                style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13.5, background: '#fff', minWidth: 200 }}>
                <option value="all">All Tutors</option>
                {allTutors.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={handleSearch}
              style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: '#6FA84B', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
              SEARCH
            </button>
          </div>
          <button onClick={() => setShowFilter(false)}
            style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: '#C0392B', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            ✕ HIDE FILTER
          </button>
        </div>
      )}
      {!showFilter && (
        <button onClick={() => setShowFilter(true)}
          style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--blue)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', width: 'fit-content' }}>
          ▸ SHOW FILTER
        </button>
      )}

      <Card>
        <CardHeader title={`📅 Attendance Records — ${rangeLabel} (${filtered.length})`}>
          <BtnPrimary onClick={() => setModal({ open: true })}>+ Mark Attendance</BtnPrimary>
        </CardHeader>

        <FilterRow>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>Status:</span>
          <FilterBtn active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</FilterBtn>
          {STATUSES.map(s => <FilterBtn key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{STATUS_ICON[s]} {s.charAt(0).toUpperCase() + s.slice(1)}</FilterBtn>)}
        </FilterRow>

        <TableWrap>
          <table>
            <thead><tr><th>Date</th><th>Student/Parent</th><th>Tutor</th><th>Subject</th><th>Duration</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <Empty colSpan={8} text={records.length === 0 ? 'No attendance recorded yet.' : `No records found for ${rangeLabel}.`} />}
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{r.date}</td>
                  <td>{r.studentName}</td><td>{r.tutorName}</td><td>{r.subject} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({r.classLevel})</span></td>
                  <td>{r.sessionDuration}hr</td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100,
                      fontSize: 12, fontWeight: 700, background: STATUS_COLOR[r.status] + '20', color: STATUS_COLOR[r.status],
                    }}>{STATUS_ICON[r.status]} {r.status}</span>
                  </td>
                  <td style={{ maxWidth: 180, fontSize: 12, color: '#666' }}>{r.notes || '—'}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <ActionBtn onClick={() => setModal({ open: true, record: r })}>✏️</ActionBtn>
                    <ActionBtn variant="delete" onClick={() => handleDelete(r.id!)}>🗑️</ActionBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {modal.open && <AttendanceModal initial={modal.record} onSave={handleSave} onClose={() => setModal({ open: false })} assignments={assignments} />}
    </AppShell>
  );
}