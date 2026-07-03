'use client';
// src/app/matching/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, TableWrap, Empty,
  SearchInput, BtnPrimary, BtnGold, BtnSecondary,
  Modal, ModalForm, FormRow, FormGroup, ModalFooter,
  currency,
} from '@/components/UI';
import {
  getParents, getTutors, getAssignments, addAssignment,
  generateRemindersForAssignment,
  Parent, Tutor, Assignment,
} from '@/lib/firestore';
import { matchTutorsForParent, MatchResult } from '@/lib/matching';

// ── Quick Assign Modal — prefilled from matched parent + tutor ────────────────

function QuickAssignModal({ parent, tutor, onSave, onClose }: {
  parent: Parent; tutor: Tutor;
  onSave: (data: Omit<Assignment,'id'|'createdAt'>) => Promise<void>;
  onClose: () => void;
}) {
  const [subject, setSubject]       = useState(parent.subject || '');
  const [classLevel, setClassLevel] = useState(parent.class || '');
  const [classesPerWeek, setCpw]    = useState(3);
  const [hoursPerSession, setHrs]   = useState(1);
  const [startDate, setStartDate]   = useState(new Date().toISOString().split('T')[0]);
  const [area, setArea]             = useState(parent.area || '');
  const [monthlyFeeParent, setMFP]  = useState(0);
  const [monthlyFeeTutor, setMFT]   = useState(0);
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);

  const profit = monthlyFeeParent - monthlyFeeTutor;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await onSave({
      tutorId: tutor.id, tutorName: tutor.name, tutorPhone: tutor.phone,
      parentId: parent.id, parentName: parent.name || (parent as any).studentName || '',
      parentPhone: parent.phone,
      subject, classLevel, classesPerWeek,
      hoursPerSession, startDate,
      monthlyFeeParent, monthlyFeeTutor,
      status: 'active', area, notes,
    } as any);
    setSaving(false); onClose();
  }

  return (
    <Modal title="⚡ Quick Assign" onClose={onClose}>
      <ModalForm onSubmit={submit}>
        <div style={{ display:'flex', gap:12, padding:12, background:'var(--bg)', borderRadius:10, border:'1px solid var(--border)' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' }}>Tutor</div>
            <div style={{ fontSize:14, fontWeight:700 }}>{tutor.name}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>{tutor.phone}</div>
          </div>
          <div style={{ width:1, background:'var(--border)' }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' }}>Parent</div>
            <div style={{ fontSize:14, fontWeight:700 }}>{parent.name || (parent as any).studentName}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>{parent.phone}</div>
          </div>
        </div>

        <FormRow>
          <FormGroup label="Subject *"><input value={subject} onChange={e=>setSubject(e.target.value)} required /></FormGroup>
          <FormGroup label="Class Level *"><input value={classLevel} onChange={e=>setClassLevel(e.target.value)} required /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Classes/Week">
            <select value={classesPerWeek} onChange={e=>setCpw(Number(e.target.value))}>
              {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}/week</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Hours/Session">
            <select value={hoursPerSession} onChange={e=>setHrs(Number(e.target.value))}>
              {[0.5,1,1.5,2,2.5,3].map(n => <option key={n} value={n}>{n} hr{n!==1?'s':''}</option>)}
            </select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Start Date *"><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} required /></FormGroup>
          <FormGroup label="Area"><input value={area} onChange={e=>setArea(e.target.value)} /></FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Parent Pays (₹/mo)"><input type="number" min="0" value={monthlyFeeParent||''} onChange={e=>setMFP(Number(e.target.value))} /></FormGroup>
          <FormGroup label="Tutor Gets (₹/mo)"><input type="number" min="0" value={monthlyFeeTutor||''} onChange={e=>setMFT(Number(e.target.value))} /></FormGroup>
        </FormRow>

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

        <FormGroup label="Notes"><textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} /></FormGroup>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>{saving ? 'Creating…' : '✅ Create Assignment'}</BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

// ── Score bar component ───────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--gold)' : 'var(--red)';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:60, height:6, background:'#f0f4f8', borderRadius:6, overflow:'hidden' }}>
        <div style={{ width:`${score}%`, height:'100%', background:color, borderRadius:6 }} />
      </div>
      <span style={{ fontSize:12, fontWeight:800, color, minWidth:32 }}>{score}%</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MatchingPage() {
  const [parents, setParents]         = useState<Parent[]>([]);
  const [tutors, setTutors]           = useState<Tutor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [search, setSearch]           = useState('');
  const [quickAssign, setQuickAssign] = useState<{parent:Parent; tutor:Tutor} | null>(null);

  const loadAll = useCallback(async () => {
    const [p, t, a] = await Promise.all([getParents(), getTutors(), getAssignments()]);
    setParents(p); setTutors(t); setAssignments(a);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  // Converted parents who don't yet have an active/paused assignment
  const unmatchedParents = useMemo(() => {
    const assignedParentIds = new Set(assignments.filter(a => a.status !== 'completed').map(a => a.parentId).filter(Boolean));
    const assignedNames = new Set(assignments.filter(a => a.status !== 'completed').map(a => a.parentName));
    return parents.filter(p =>
      p.status === 'converted' &&
      !assignedParentIds.has(p.id) &&
      !assignedNames.has(p.name || (p as any).studentName || '')
    );
  }, [parents, assignments]);

  const filteredUnmatched = unmatchedParents.filter(p =>
    !search || [p.name, (p as any).studentName, p.subject, p.class, p.area]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  // Compute matches for the currently selected parent
  const matches: MatchResult[] = useMemo(() => {
    if (!selectedParent) return [];
    return matchTutorsForParent(selectedParent, tutors).slice(0, 10);
  }, [selectedParent, tutors]);

  async function handleQuickAssign(data: Omit<Assignment,'id'|'createdAt'>) {
    const ref = await addAssignment(data);
    const newA = { id: ref.id, ...data };
    try { await generateRemindersForAssignment(newA); } catch {}
    setSelectedParent(null);
    loadAll();
    alert('✅ Assignment created! Reminders scheduled automatically.');
  }

  const displayName = (p: Parent) => p.name?.trim() || (p as any).studentName?.trim() || 'Unnamed';

  return (
    <AppShell title="Tutor Matching" onRefresh={loadAll}>

      <StatsRow>
        <StatCard icon="🎯" num={unmatchedParents.length} label="Awaiting Match" sub="converted, no tutor yet" color="gold" />
        <StatCard icon="👩‍🏫" num={tutors.filter(t=>t.status!=='closed').length} label="Available Tutors" sub="active pool" color="blue" />
        <StatCard icon="✅" num={assignments.filter(a=>a.status==='active').length} label="Active Matches" sub="currently teaching" color="green" />
        <StatCard icon="📊" num={parents.filter(p=>p.status==='converted').length} label="Total Converted" sub="all-time" color="red" />
      </StatsRow>

      <div style={{ display:'grid', gridTemplateColumns: selectedParent ? '340px 1fr' : '1fr', gap:16 }}>

        {/* Left: unmatched parents list */}
        <Card>
          <CardHeader title={`🎯 Needs Matching (${unmatchedParents.length})`}>
            <SearchInput value={search} onChange={setSearch} placeholder="🔍 Search…" />
          </CardHeader>
          <div style={{ maxHeight: 560, overflowY:'auto' }}>
            {filteredUnmatched.length === 0 && (
              <div style={{ padding:32, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
                🎉 All converted parents are matched!
              </div>
            )}
            {filteredUnmatched.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedParent(p)}
                style={{
                  padding:'12px 16px', borderBottom:'1px solid var(--border)',
                  cursor:'pointer', transition:'background .15s',
                  background: selectedParent?.id === p.id ? 'var(--blue-light)' : 'transparent',
                  borderLeft: selectedParent?.id === p.id ? '3px solid var(--blue)' : '3px solid transparent',
                }}
              >
                <div style={{ fontWeight:700, fontSize:13.5 }}>{displayName(p)}</div>
                <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2 }}>
                  📚 {p.subject || '—'} · {p.class || '—'}
                </div>
                <div style={{ fontSize:11.5, color:'var(--text-muted)' }}>
                  📍 {p.area || (p as any).address || '—'}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Right: matched tutors for selected parent */}
        {selectedParent && (
          <Card>
            <CardHeader title={`🔍 Best Matches for ${displayName(selectedParent)}`}>
              <BtnSecondary onClick={() => setSelectedParent(null)}>✕ Close</BtnSecondary>
            </CardHeader>

            <div style={{ padding:'12px 18px', background:'var(--bg)', borderBottom:'1px solid var(--border)', fontSize:12.5, color:'var(--text-muted)', display:'flex', gap:16, flexWrap:'wrap' }}>
              <span>📚 Needs: <strong style={{color:'var(--text)'}}>{selectedParent.subject}</strong></span>
              <span>🎓 Class: <strong style={{color:'var(--text)'}}>{selectedParent.class}</strong></span>
              <span>📍 Area: <strong style={{color:'var(--text)'}}>{selectedParent.area || (selectedParent as any).address || '—'}</strong></span>
            </div>

            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Tutor</th><th>Phone</th><th>Area</th>
                    <th>Match Score</th><th>Why This Match</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.length === 0 && <Empty colSpan={6} text="No tutors available to match." />}
                  {matches.map(m => (
                    <tr key={m.tutor.id}>
                      <td><strong>{m.tutor.name}</strong></td>
                      <td style={{fontSize:12}}>{m.tutor.phone}</td>
                      <td style={{fontSize:12,maxWidth:140}}>{m.tutor.area || (m.tutor as any).address || '—'}</td>
                      <td><ScoreBar score={m.totalScore} /></td>
                      <td style={{fontSize:11}}>
                        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                          {m.reasons.slice(0,2).map((r,i) => <span key={i} style={{color:'var(--text-muted)'}}>{r}</span>)}
                        </div>
                      </td>
                      <td>
                        <BtnGold onClick={() => setQuickAssign({ parent: selectedParent, tutor: m.tutor })}>
                          ⚡ Assign
                        </BtnGold>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        )}
      </div>

      {quickAssign && (
        <QuickAssignModal
          parent={quickAssign.parent}
          tutor={quickAssign.tutor}
          onSave={handleQuickAssign}
          onClose={() => setQuickAssign(null)}
        />
      )}
    </AppShell>
  );
}
