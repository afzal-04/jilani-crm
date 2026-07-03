'use client';
// src/app/dashboard/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, TableWrap, Empty, Badge,
  FinanceStrip, FinItem, FinDivider, AlertBox, AlertLink,
  currency, fmtDate,
} from '@/components/UI';
import {
  getParents, getTutors, getFees, getAssignments,
  getComms, getStaff, getTasks, getReminders,
  Parent, Tutor, FeeRecord, Assignment, CommunicationLog, StaffMember, Task, FeeReminder,
} from '@/lib/firestore';
import styles from './dashboard.module.css';

function displayName(r: { name?: string; studentName?: string }): string {
  return r.name?.trim() || r.studentName?.trim() || 'Unnamed Lead';
}
function displayLocation(r: { area?: string; address?: string }): string {
  return r.area?.trim() || r.address?.trim() || '—';
}

const today = () => new Date().toISOString().split('T')[0];
const in2Days = () => { const d = new Date(); d.setDate(d.getDate()+2); return d.toISOString().split('T')[0]; };

export default function DashboardPage() {
  const router = useRouter();
  const [parents, setParents]   = useState<Parent[]>([]);
  const [tutors, setTutors]     = useState<Tutor[]>([]);
  const [fees, setFees]         = useState<FeeRecord[]>([]);
  const [classes, setClasses]   = useState<Assignment[]>([]);
  const [comms, setComms]       = useState<CommunicationLog[]>([]);
  const [staff, setStaff]       = useState<StaffMember[]>([]);
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [reminders, setReminders] = useState<FeeReminder[]>([]);
  const [loading, setLoading]   = useState(true);

  const loadAll = useCallback(async () => {
    const [p,t,f,c,co,s,tk,rm] = await Promise.all([
      getParents(), getTutors(), getFees(), getAssignments(),
      getComms(), getStaff(), getTasks(), getReminders(),
    ]);
    setParents(p); setTutors(t); setFees(f); setClasses(c);
    setComms(co); setStaff(s); setTasks(tk); setReminders(rm);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Computed values ──
  const newParents = parents.filter(p => p.status === 'new').length;
  const newTutors  = tutors.filter(t => t.status === 'new').length;
  const activeClasses = classes.filter(c => c.status === 'active').length;

  const totalFromParents  = fees.filter(f => f.paymentStatus !== 'pending').reduce((s,f) => s+f.parentFee, 0);
  const totalToTutors     = fees.filter(f => f.paymentStatus !== 'pending').reduce((s,f) => s+f.tutorFee, 0);
  const totalPaidToTutors = fees.filter(f => f.paymentStatus === 'paid').reduce((s,f) => s+f.tutorFee, 0);
  const totalProfit       = totalFromParents - totalToTutors;

  const todayStr = today();

  const pendingFollowups = comms.filter(c => c.followUpStatus === 'pending').length;
  const pendingTasks = tasks.filter(t => t.status !== 'done').length;
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayStr).length;

  const activeStaff = staff.filter(s => s.status === 'active').length;

  const conversionRate = parents.length > 0 ? Math.round((parents.filter(p => p.status === 'converted').length / parents.length) * 100) : 0;

  // ── Fee reminders ──
  const alertDate = in2Days();
  const pendingReminders   = reminders.filter(r => r.status === 'pending');
  const remindersDueSoon   = pendingReminders.filter(r => r.dueDate <= alertDate && r.dueDate >= todayStr);
  const remindersOverdue   = pendingReminders.filter(r => r.dueDate < todayStr);
  const remindersUrgent    = remindersDueSoon.length + remindersOverdue.length;


  const badges: Record<string, number> = {
    '/parents': newParents,
    '/tutors': newTutors,
    '/communications': pendingFollowups,
    '/tasks': overdueTasks,
    '/reminders': remindersUrgent,
  };

  const recentActivity = [
    ...parents.map(p => ({...p, _type:'Parent' as const})),
    ...tutors.map(t => ({...t, _type:'Tutor' as const})),
  ].sort((a,b) => (b.createdAt?.seconds??0)-(a.createdAt?.seconds??0)).slice(0,8);

  const upcomingTasks = tasks.filter(t => t.status !== 'done')
    .sort((a,b) => (a.dueDate||'').localeCompare(b.dueDate||'')).slice(0,5);

  return (
    <AppShell title="Dashboard" onRefresh={loadAll} badges={badges}>

      <StatsRow>
        <StatCard icon="👨‍👩‍👧" num={parents.length} label="Total Parents" sub={`${newParents} new leads`} color="blue" />
        <StatCard icon="👩‍🏫" num={tutors.length} label="Total Tutors" sub={`${newTutors} new leads`} color="gold" />
        <StatCard icon="📋" num={activeClasses} label="Active Classes" sub="running now" color="green" />
        <StatCard icon="🏦" num={currency(totalProfit)} label="Net Profit" sub="all confirmed fees" color="blue" />
      </StatsRow>
      <StatsRow>
        <StatCard icon="🔔" num={remindersUrgent} label="Fee Reminders Due" sub={`${remindersOverdue.length} overdue`} color="red" />
        <StatCard icon="📝" num={pendingTasks} label="Open Tasks" sub={`${overdueTasks} overdue`} color="red" />
      </StatsRow>

      <FinanceStrip>
        <FinItem label="💳 Received from Parents" value={currency(totalFromParents)} positive />
        <FinDivider />
        <FinItem label="📤 Tutor Fee Due" value={currency(totalToTutors)} positive={false} sub={`Paid: ${currency(totalPaidToTutors)}`} />
        <FinDivider />
        <FinItem label="🏦 Net Profit" value={currency(totalProfit)} positive={totalProfit >= 0} />
        <FinDivider />
        <FinItem label="📊 Conversion Rate" value={`${conversionRate}%`} positive />
      </FinanceStrip>

      {/* Alerts */}
      {remindersOverdue.length > 0 && (
        <AlertBox>
          ⚠️ <strong>{remindersOverdue.length} fee reminder{remindersOverdue.length>1?'s':''}</strong> overdue —
          <AlertLink onClick={() => router.push('/reminders')}>View Reminders →</AlertLink>
        </AlertBox>
      )}
      {remindersDueSoon.length > 0 && (
        <AlertBox>
          🔔 <strong>{remindersDueSoon.length} fee reminder{remindersDueSoon.length>1?'s':''}</strong> due within 2 days —
          <AlertLink onClick={() => router.push('/reminders')}>View Reminders →</AlertLink>
        </AlertBox>
      )}
      {pendingFollowups > 0 && (
        <AlertBox>
          🔔 <strong>{pendingFollowups} follow-up{pendingFollowups>1?'s':''}</strong> pending —
          <AlertLink onClick={() => router.push('/communications')}>View Communication Log →</AlertLink>
        </AlertBox>
      )}
      {overdueTasks > 0 && (
        <AlertBox>
          ⚠️ <strong>{overdueTasks} task{overdueTasks>1?'s':''}</strong> overdue —
          <AlertLink onClick={() => router.push('/tasks')}>View Tasks →</AlertLink>
        </AlertBox>
      )}

      <div className={styles.grid2}>
        <Card>
          <CardHeader title="📋 Recent Registrations" />
          <TableWrap>
            <table>
              <thead><tr><th>Type</th><th>Name</th><th>Phone</th><th>Area</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {recentActivity.length === 0 && <Empty colSpan={6} text="No registrations yet." />}
                {recentActivity.map((r,i) => (
                  <tr key={i}>
                    <td><Badge status={r._type.toLowerCase()} /></td>
                    <td><strong>{displayName(r)}</strong></td>
                    <td>{r.phone || '—'}</td>
                    <td>{displayLocation(r)}</td>
                    <td><Badge status={r.status} /></td>
                    <td style={{color:'#aaa',fontSize:12}}>{fmtDate(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader title="🔔 Upcoming Fee Reminders" />
          <TableWrap>
            <table>
              <thead><tr><th>Type</th><th>Contact</th><th>Amount</th><th>Due</th></tr></thead>
              <tbody>
                {pendingReminders.length === 0 && <Empty colSpan={4} text="No pending reminders. 🎉" />}
                {pendingReminders
                  .sort((a,b) => a.dueDate.localeCompare(b.dueDate))
                  .slice(0,5)
                  .map(r => {
                    const isOverdue = r.dueDate < todayStr;
                    return (
                      <tr key={r.id}>
                        <td style={{fontSize:12}}>{r.type === 'collect_from_parent' ? '💳 Collect' : '📤 Pay'}</td>
                        <td style={{fontSize:13}}>{r.type === 'collect_from_parent' ? r.parentName : r.tutorName}</td>
                        <td style={{fontWeight:700,fontSize:13}}>{r.amount ? currency(r.amount) : '—'}</td>
                        <td style={{color: isOverdue ? 'var(--red)' : undefined, fontWeight: isOverdue ? 700 : 400, fontSize:12}}>
                          {r.dueDate}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>

      <div className={styles.grid2}>
        <Card>
          <CardHeader title="✅ Upcoming Tasks" />
          <TableWrap>
            <table>
              <thead><tr><th>Task</th><th>Due</th><th>Priority</th><th>Status</th></tr></thead>
              <tbody>
                {upcomingTasks.length === 0 && <Empty colSpan={4} text="No pending tasks. 🎉" />}
                {upcomingTasks.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.title}</strong><br/><small style={{color:'#999'}}>{t.assignedTo}</small></td>
                    <td style={{color: t.dueDate < todayStr ? 'var(--red)' : undefined, fontWeight: t.dueDate < todayStr ? 700 : 400}}>{t.dueDate || '—'}</td>
                    <td><Badge status={t.priority} /></td>
                    <td><Badge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>

      {loading && <div className={styles.loadingNote}>Loading data…</div>}
    </AppShell>
  );
}