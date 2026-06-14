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
  getAttendance, getComms, getStaff, getTasks,
  Parent, Tutor, FeeRecord, Assignment, AttendanceRecord, CommunicationLog, StaffMember, Task,
} from '@/lib/firestore';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const [parents, setParents]   = useState<Parent[]>([]);
  const [tutors, setTutors]     = useState<Tutor[]>([]);
  const [fees, setFees]         = useState<FeeRecord[]>([]);
  const [classes, setClasses]   = useState<Assignment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [comms, setComms]       = useState<CommunicationLog[]>([]);
  const [staff, setStaff]       = useState<StaffMember[]>([]);
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);

  const loadAll = useCallback(async () => {
    const [p,t,f,c,a,co,s,tk] = await Promise.all([
      getParents(), getTutors(), getFees(), getAssignments(),
      getAttendance(), getComms(), getStaff(), getTasks(),
    ]);
    setParents(p); setTutors(t); setFees(f); setClasses(c);
    setAttendance(a); setComms(co); setStaff(s); setTasks(tk);
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

  const todayStr = new Date().toISOString().split('T')[0];
  const presentToday = attendance.filter(a => a.date === todayStr && a.status === 'present').length;
  const absentToday  = attendance.filter(a => a.date === todayStr && a.status === 'absent').length;

  const pendingFollowups = comms.filter(c => c.followUpStatus === 'pending').length;
  const pendingTasks = tasks.filter(t => t.status !== 'done').length;
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayStr).length;

  const activeStaff = staff.filter(s => s.status === 'active').length;

  const conversionRate = parents.length > 0 ? Math.round((parents.filter(p => p.status === 'converted').length / parents.length) * 100) : 0;
  const attendanceTotal = attendance.filter(a => a.status !== 'holiday').length;
  const attendanceRate  = attendanceTotal > 0 ? Math.round((attendance.filter(a => a.status === 'present').length / attendanceTotal) * 100) : 0;

  const badges: Record<string, number> = {
    '/parents': newParents,
    '/tutors': newTutors,
    '/communications': pendingFollowups,
    '/tasks': overdueTasks,
  };

  // Recent activity (mix of parents/tutors)
  const recentActivity = [
    ...parents.map(p => ({...p, _type:'Parent' as const})),
    ...tutors.map(t => ({...t, _type:'Tutor' as const})),
  ].sort((a,b) => (b.createdAt?.seconds??0)-(a.createdAt?.seconds??0)).slice(0,8);

  // Upcoming tasks (next 5, not done, sorted by due date)
  const upcomingTasks = tasks.filter(t => t.status !== 'done')
    .sort((a,b) => (a.dueDate||'').localeCompare(b.dueDate||'')).slice(0,5);

  return (
    <AppShell title="Dashboard" onRefresh={loadAll} badges={badges}>

      {/* Top stats */}
      <StatsRow>
        <StatCard icon="👨‍👩‍👧" num={parents.length} label="Total Parents" sub={`${newParents} new leads`} color="blue" />
        <StatCard icon="👩‍🏫" num={tutors.length} label="Total Tutors" sub={`${newTutors} new leads`} color="gold" />
        <StatCard icon="📋" num={activeClasses} label="Active Classes" sub="running now" color="green" />
        <StatCard icon="🏦" num={currency(totalProfit)} label="Net Profit" sub="all confirmed fees" color="blue" />
      </StatsRow>
      <StatsRow>
        <StatCard icon="✅" num={presentToday} label="Present Today" sub={`${absentToday} absent`} color="green" />
        <StatCard icon="🔔" num={pendingFollowups} label="Follow-ups Due" sub="need callback" color="red" />
        <StatCard icon="📝" num={pendingTasks} label="Open Tasks" sub={`${overdueTasks} overdue`} color="red" />
        <StatCard icon="👥" num={activeStaff} label="Active Staff" sub="team members" color="gold" />
      </StatsRow>

      {/* Finance strip */}
      <FinanceStrip>
        <FinItem label="💳 Received from Parents" value={currency(totalFromParents)} positive />
        <FinDivider />
        <FinItem label="📤 Tutor Fee Due" value={currency(totalToTutors)} positive={false} sub={`Paid: ${currency(totalPaidToTutors)}`} />
        <FinDivider />
        <FinItem label="🏦 Net Profit" value={currency(totalProfit)} positive={totalProfit >= 0} />
        <FinDivider />
        <FinItem label="📊 Conversion Rate" value={`${conversionRate}%`} positive />
        <FinDivider />
        <FinItem label="📈 Attendance Rate" value={`${attendanceRate}%`} positive />
      </FinanceStrip>

      {/* Alerts */}
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

      {/* Two-column: recent activity + upcoming tasks */}
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
                    <td><strong>{r.name}</strong></td>
                    <td>{r.phone}</td>
                    <td>{r.area}</td>
                    <td><Badge status={r.status} /></td>
                    <td style={{color:'#aaa',fontSize:12}}>{fmtDate(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>

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
