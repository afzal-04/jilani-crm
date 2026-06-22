'use client';
// src/app/reminders/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, FilterRow, FilterBtn,
  TableWrap, Empty, ActionBtn, AlertBox,
  currency,
} from '@/components/UI';
import {
  getReminders, updateReminder, deleteReminder, rollReminderToNextMonth,
  FeeReminder, ReminderType,
} from '@/lib/firestore';

const today = () => new Date().toISOString().split('T')[0];
const in2Days = () => { const d = new Date(); d.setDate(d.getDate()+2); return d.toISOString().split('T')[0]; };

const TYPE_CONFIG: Record<ReminderType, { icon: string; label: string; color: string }> = {
  collect_from_parent: { icon: '💳', label: 'Collect from Parent', color: 'var(--green)' },
  pay_to_tutor:         { icon: '📤', label: 'Pay to Tutor',        color: 'var(--blue)'  },
};

export default function RemindersPage() {
  const [reminders, setReminders] = useState<FeeReminder[]>([]);
  const [typeFilter, setTypeFilter] = useState<ReminderType|'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all'|'pending'|'done'>('pending');

  const loadAll = useCallback(async () => setReminders(await getReminders()), []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const todayStr = today();
  const alertDate = in2Days();

  const filtered = reminders
    .filter(r => typeFilter==='all' || r.type===typeFilter)
    .filter(r => statusFilter==='all' || r.status===statusFilter);

  // Stats
  const pending      = reminders.filter(r => r.status === 'pending');
  const dueWithin2Days = pending.filter(r => r.dueDate <= alertDate && r.dueDate >= todayStr);
  const overdue       = pending.filter(r => r.dueDate < todayStr);
  const collectCount  = pending.filter(r => r.type === 'collect_from_parent').length;
  const payCount      = pending.filter(r => r.type === 'pay_to_tutor').length;
  const totalToCollect = pending.filter(r => r.type === 'collect_from_parent').reduce((s,r) => s+(r.amount||0), 0);
  const totalToPay      = pending.filter(r => r.type === 'pay_to_tutor').reduce((s,r) => s+(r.amount||0), 0);

  async function markDone(r: FeeReminder, repeatNextMonth: boolean) {
    await updateReminder(r.id!, { status: 'done' });
    setReminders(p => p.map(x => x.id===r.id ? {...x,status:'done'} : x));

    if (repeatNextMonth) {
      await rollReminderToNextMonth(r);
      loadAll(); // refresh to show the new next-month reminder
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this reminder?')) return;
    await deleteReminder(id);
    setReminders(p => p.filter(x => x.id !== id));
  }

  function whatsappLink(phone?: string, msg?: string) {
    if (!phone) return undefined;
    const clean = phone.replace(/\D/g,'');
    return `https://wa.me/${clean}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
  }

  return (
    <AppShell title="Fee Reminders" onRefresh={loadAll}>

      <StatsRow>
        <StatCard icon="🔔" num={dueWithin2Days.length} label="Due in 2 Days" sub="needs action soon" color="gold" />
        <StatCard icon="⚠️" num={overdue.length} label="Overdue" sub="past due date" color="red" />
        <StatCard icon="💳" num={currency(totalToCollect)} label="To Collect" sub={`${collectCount} pending`} color="green" />
        <StatCard icon="📤" num={currency(totalToPay)} label="To Pay Tutors" sub={`${payCount} pending`} color="blue" />
      </StatsRow>

      {overdue.length > 0 && (
        <AlertBox>
          ⚠️ <strong>{overdue.length} reminder{overdue.length>1?'s':''}</strong> overdue — action needed now!
        </AlertBox>
      )}
      {dueWithin2Days.length > 0 && (
        <AlertBox>
          🔔 <strong>{dueWithin2Days.length} reminder{dueWithin2Days.length>1?'s':''}</strong> due within 2 days
        </AlertBox>
      )}

      <Card>
        <CardHeader title={`📋 Reminders (${filtered.length})`} />

        <FilterRow>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>Status:</span>
          <FilterBtn active={statusFilter==='pending'} onClick={() => setStatusFilter('pending')}>⏳ Pending ({pending.length})</FilterBtn>
          <FilterBtn active={statusFilter==='done'} onClick={() => setStatusFilter('done')}>✅ Done</FilterBtn>
          <FilterBtn active={statusFilter==='all'} onClick={() => setStatusFilter('all')}>All</FilterBtn>
        </FilterRow>
        <FilterRow>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>Type:</span>
          <FilterBtn active={typeFilter==='all'} onClick={() => setTypeFilter('all')}>All</FilterBtn>
          <FilterBtn active={typeFilter==='collect_from_parent'} onClick={() => setTypeFilter('collect_from_parent')}>💳 Collect from Parent</FilterBtn>
          <FilterBtn active={typeFilter==='pay_to_tutor'} onClick={() => setTypeFilter('pay_to_tutor')}>📤 Pay to Tutor</FilterBtn>
        </FilterRow>

        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Type</th><th>Tutor</th><th>Parent</th>
                <th>Amount</th><th>Due Date</th><th>Notes</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <Empty colSpan={7} text="No reminders found." />}
              {filtered.map(r => {
                const cfg = TYPE_CONFIG[r.type];
                const isOverdue  = r.status==='pending' && r.dueDate < todayStr;
                const isDueSoon  = r.status==='pending' && r.dueDate <= alertDate && r.dueDate >= todayStr;
                const contactPhone = r.type === 'collect_from_parent' ? r.parentPhone : r.tutorPhone;
                const contactName  = r.type === 'collect_from_parent' ? r.parentName : r.tutorName;
                const waMsg = r.type === 'collect_from_parent'
                  ? `Hi ${r.parentName}, this is a reminder regarding the monthly fee of ₹${r.amount} for your child's tuition. Please share the payment at your convenience. Thank you! — Jilani Home Tutor`
                  : `Hi ${r.tutorName}, your payment of ₹${r.amount} for this month's classes is ready. Please confirm your bank/UPI details. Thank you! — Jilani Home Tutor`;

                return (
                  <tr key={r.id} style={{opacity: r.status==='done' ? 0.55 : 1}}>
                    <td>
                      <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,fontWeight:700,color:cfg.color}}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td style={{fontSize:13}}>{r.tutorName}</td>
                    <td style={{fontSize:13}}>{r.parentName}</td>
                    <td style={{fontWeight:700,color:cfg.color}}>{r.amount ? currency(r.amount) : '—'}</td>
                    <td style={{whiteSpace:'nowrap'}}>
                      <span style={{
                        fontWeight:700,
                        color: isOverdue ? 'var(--red)' : isDueSoon ? 'var(--gold)' : undefined,
                      }}>
                        {r.dueDate}
                      </span>
                      {isOverdue && <div style={{fontSize:10,color:'var(--red)',fontWeight:700}}>OVERDUE</div>}
                      {isDueSoon && <div style={{fontSize:10,color:'var(--gold)',fontWeight:700}}>DUE SOON</div>}
                    </td>
                    <td style={{maxWidth:160,fontSize:11.5,color:'#999'}}>{r.notes || '—'}</td>
                    <td style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      {contactPhone && (
                        <a href={whatsappLink(contactPhone, waMsg)} target="_blank" rel="noreferrer"
                          style={{padding:'5px 9px',borderRadius:6,border:'1px solid #b9e5c9',background:'#e8f7ee',fontSize:13,textDecoration:'none'}}
                          title={`WhatsApp ${contactName}`}>
                          💬
                        </a>
                      )}
                      {r.status === 'pending' && (
                        <>
                          <button onClick={() => markDone(r, true)}
                            title="Mark done & schedule next month"
                            style={{padding:'5px 9px',borderRadius:6,border:'1px solid var(--border)',background:'#fff',cursor:'pointer',fontSize:11,fontFamily:'var(--font)',fontWeight:600}}>
                            ✅ Done + Repeat
                          </button>
                          <button onClick={() => markDone(r, false)}
                            title="Mark done (no repeat)"
                            style={{padding:'5px 9px',borderRadius:6,border:'1px solid var(--border)',background:'#fff',cursor:'pointer',fontSize:11,fontFamily:'var(--font)'}}>
                            ✓ Done
                          </button>
                        </>
                      )}
                      <ActionBtn variant="delete" onClick={() => handleDelete(r.id!)}>🗑️</ActionBtn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </AppShell>
  );
}