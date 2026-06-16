'use client';
// src/app/reports/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader,
  FinanceStrip, FinItem, FinDivider,
  currency,
} from '@/components/UI';
import {
  getParents, getTutors, getFees, getAssignments,
  getAttendance, getComms, getTasks,
  Parent, Tutor, FeeRecord, Assignment, AttendanceRecord, CommunicationLog, Task,
} from '@/lib/firestore';
import styles from './reports.module.css';

// ── Bar chart (pure CSS) ─────────────────────────────────────────────────────

function BarChart({ data, color = 'var(--blue)' }: {
  data: { label: string; value: number; sub?: string }[];
  color?: string;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className={styles.barChart}>
      {data.map((d, i) => (
        <div key={i} className={styles.barRow}>
          <div className={styles.barLabel}>{d.label}</div>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{ width: `${Math.round((d.value / max) * 100)}%`, background: color }}
            />
          </div>
          <div className={styles.barValue}>{d.sub ?? d.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Donut (CSS only) ─────────────────────────────────────────────────────────

function DonutStat({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 30; const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className={styles.donut}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f0f4f8" strokeWidth="10" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 40 40)" />
      </svg>
      <div className={styles.donutInner}>
        <strong>{value}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

// ── Pipeline funnel ──────────────────────────────────────────────────────────

function PipelineFunnel({ parents }: { parents: Parent[] }) {
  const stages = [
    { key: 'new',            label: 'New',            color: '#1A6FBF' },
    { key: 'contacted',      label: 'Contacted',      color: '#C8941A' },
    { key: 'demo_scheduled', label: 'Demo Scheduled', color: '#7B3DBF' },
    { key: 'converted',      label: 'Converted',      color: '#1A7A4A' },
    { key: 'closed',         label: 'Closed',         color: '#888'    },
  ] as const;

  return (
    <div className={styles.funnel}>
      {stages.map(s => {
        const count = parents.filter(p => p.status === s.key).length;
        const pct   = parents.length ? Math.round((count / parents.length) * 100) : 0;
        return (
          <div key={s.key} className={styles.funnelRow}>
            <div className={styles.funnelLabel}>{s.label}</div>
            <div className={styles.funnelTrack}>
              <div className={styles.funnelFill} style={{ width:`${pct}%`, background: s.color }} />
            </div>
            <div className={styles.funnelMeta}>
              <strong>{count}</strong>
              <span>{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [parents,    setParents]    = useState<Parent[]>([]);
  const [tutors,     setTutors]     = useState<Tutor[]>([]);
  const [fees,       setFees]       = useState<FeeRecord[]>([]);
  const [classes,    setClasses]    = useState<Assignment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [comms,      setComms]      = useState<CommunicationLog[]>([]);
  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [loading,    setLoading]    = useState(true);

  const loadAll = useCallback(async () => {
    const [p,t,f,c,a,co,tk] = await Promise.all([
      getParents(), getTutors(), getFees(), getAssignments(),
      getAttendance(), getComms(), getTasks(),
    ]);
    setParents(p); setTutors(t); setFees(f); setClasses(c);
    setAttendance(a); setComms(co); setTasks(tk);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Financial ──
  const confirmed     = fees.filter(f => f.paymentStatus !== 'pending');
  const totalRevenue  = confirmed.reduce((s,f) => s+(f.parentFee||0), 0);
  const totalTutorPay = confirmed.reduce((s,f) => s+(f.tutorFee||0), 0);
  const totalProfit   = totalRevenue - totalTutorPay;
  const pendingAmt    = fees.filter(f=>f.paymentStatus==='pending').reduce((s,f)=>s+(f.parentFee||0),0);

  // Monthly revenue
  const monthlyMap = fees.filter(f=>f.paymentStatus!=='pending').reduce<Record<string,{rev:number,profit:number}>>((acc,f) => {
    if (!f.month) return acc;
    if (!acc[f.month]) acc[f.month] = {rev:0, profit:0};
    acc[f.month].rev    += f.parentFee||0;
    acc[f.month].profit += f.profit||0;
    return acc;
  }, {});
  const monthlyData = Object.entries(monthlyMap)
    .slice(0,6)
    .map(([label,{rev,profit}]) => ({label, value:rev, sub: currency(rev)}));

  // ── Leads ──
  const conversionRate  = parents.length ? Math.round((parents.filter(p=>p.status==='converted').length / parents.length)*100) : 0;
  const tutorConversion = tutors.length  ? Math.round((tutors.filter(t=>t.status==='converted').length  / tutors.length)*100)  : 0;

  // Subject breakdown
  const subjectMap = parents.reduce<Record<string,number>>((acc,p) => {
    if (!p.subject) return acc;
    acc[p.subject] = (acc[p.subject]||0)+1;
    return acc;
  }, {});
  const subjectData = Object.entries(subjectMap)
    .sort(([,a],[,b])=>b-a).slice(0,7)
    .map(([label,value]) => ({label, value}));

  // Area breakdown
  const areaMap = parents.reduce<Record<string,number>>((acc,p) => {
    if (!p.area) return acc;
    acc[p.area] = (acc[p.area]||0)+1;
    return acc;
  }, {});
  const areaData = Object.entries(areaMap)
    .sort(([,a],[,b])=>b-a).slice(0,7)
    .map(([label,value]) => ({label, value}));

  // Source breakdown
  const sourceMap = parents.reduce<Record<string,number>>((acc,p) => {
    const src = p.source || 'Unknown';
    acc[src] = (acc[src]||0)+1;
    return acc;
  }, {});
  const sourceData = Object.entries(sourceMap)
    .sort(([,a],[,b])=>b-a)
    .map(([label,value]) => ({label, value}));

  // ── Attendance ──
  const nonHoliday   = attendance.filter(a=>a.status!=='holiday').length;
  const presentCount = attendance.filter(a=>a.status==='present').length;
  const attRate      = nonHoliday ? Math.round((presentCount/nonHoliday)*100) : 0;
  const totalHours   = Math.round(attendance.filter(a=>a.status==='present').reduce((s,a)=>s+(a.sessionDuration||0),0)/60);

  // Tutor attendance breakdown
  const tutorAttMap = attendance.reduce<Record<string,{present:number,total:number}>>((acc,a) => {
    if (!a.tutorName) return acc;
    if (!acc[a.tutorName]) acc[a.tutorName] = {present:0,total:0};
    if (a.status!=='holiday') acc[a.tutorName].total++;
    if (a.status==='present') acc[a.tutorName].present++;
    return acc;
  }, {});
  const tutorAttData = Object.entries(tutorAttMap)
    .map(([label,{present,total}]) => ({label, value:total?Math.round(present/total*100):0, sub:`${present}/${total} (${total?Math.round(present/total*100):0}%)`}))
    .sort((a,b)=>b.value-a.value).slice(0,7);

  // ── Comms ──
  const commByChannel = ['call','whatsapp','visit','email','sms'].map(ch => ({
    label: {call:'📞 Call',whatsapp:'💬 WhatsApp',visit:'🏠 Visit',email:'📧 Email',sms:'✉️ SMS'}[ch]||ch,
    value: comms.filter(c=>c.channel===ch).length,
  }));

  // ── Tasks ──
  const taskCompletion = tasks.length ? Math.round((tasks.filter(t=>t.status==='done').length/tasks.length)*100) : 0;

  return (
    <AppShell title="Reports & Analytics" onRefresh={loadAll}>

      {/* Top KPIs */}
      <StatsRow>
        <StatCard icon="💰" num={currency(totalRevenue)}  label="Total Revenue"     sub="all confirmed"     color="green" />
        <StatCard icon="🏦" num={currency(totalProfit)}   label="Total Profit"      sub="revenue - tutor"   color="blue"  />
        <StatCard icon="📈" num={`${conversionRate}%`}    label="Parent Conversion" sub="leads → converted" color="gold"  />
        <StatCard icon="📊" num={`${attRate}%`}           label="Attendance Rate"   sub="present sessions"  color="green" />
      </StatsRow>

      <FinanceStrip>
        <FinItem label="💳 Revenue" value={currency(totalRevenue)} positive />
        <FinDivider />
        <FinItem label="📤 Tutor Paid" value={currency(totalTutorPay)} positive={false} />
        <FinDivider />
        <FinItem label="🏦 Profit" value={currency(totalProfit)} positive={totalProfit>=0} />
        <FinDivider />
        <FinItem label="⏳ Pending" value={currency(pendingAmt)} />
        <FinDivider />
        <FinItem label="⏱️ Hours Taught" value={`${totalHours}h`} positive />
      </FinanceStrip>

      {/* Donuts row */}
      <div className={styles.donutsRow}>
        <div className={styles.donutCard}>
          <DonutStat value={conversionRate}  label="Parent Conversion"  color="var(--blue)"  />
          <DonutStat value={tutorConversion} label="Tutor Conversion"   color="var(--gold)"  />
          <DonutStat value={attRate}         label="Attendance Rate"    color="var(--green)" />
          <DonutStat value={taskCompletion}  label="Task Completion"    color="#7B3DBF"      />
        </div>
      </div>

      {/* Charts row 1 */}
      <div className={styles.gridTwo}>

        {/* Lead pipeline funnel */}
        <Card pad>
          <CardHeader title="🔄 Parent Lead Pipeline" />
          <PipelineFunnel parents={parents} />
          <div style={{marginTop:14,fontSize:12,color:'var(--text-muted)',display:'flex',gap:16,flexWrap:'wrap'}}>
            <span>Total Parents: <strong>{parents.length}</strong></span>
            <span>Converted: <strong>{parents.filter(p=>p.status==='converted').length}</strong></span>
            <span>Closed: <strong>{parents.filter(p=>p.status==='closed').length}</strong></span>
          </div>
        </Card>

        {/* Monthly revenue */}
        <Card pad>
          <CardHeader title="💰 Monthly Revenue" />
          {monthlyData.length === 0
            ? <p style={{color:'var(--text-muted)',fontSize:13,paddingTop:12}}>No fee data yet.</p>
            : <BarChart data={monthlyData} color="var(--green)" />
          }
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className={styles.gridTwo}>

        {/* Subject demand */}
        <Card pad>
          <CardHeader title="📚 Subject Demand" />
          {subjectData.length === 0
            ? <p style={{color:'var(--text-muted)',fontSize:13,paddingTop:12}}>No data yet.</p>
            : <BarChart data={subjectData} color="var(--blue)" />
          }
        </Card>

        {/* Area heatmap */}
        <Card pad>
          <CardHeader title="📍 Top Areas in Raipur" />
          {areaData.length === 0
            ? <p style={{color:'var(--text-muted)',fontSize:13,paddingTop:12}}>No area data yet.</p>
            : <BarChart data={areaData} color="var(--gold)" />
          }
        </Card>
      </div>

      {/* Charts row 3 */}
      <div className={styles.gridTwo}>

        {/* Tutor attendance */}
        <Card pad>
          <CardHeader title="👩‍🏫 Tutor Attendance Rate" />
          {tutorAttData.length === 0
            ? <p style={{color:'var(--text-muted)',fontSize:13,paddingTop:12}}>No attendance data yet.</p>
            : <BarChart data={tutorAttData} color="#7B3DBF" />
          }
        </Card>

        {/* Comms by channel */}
        <Card pad>
          <CardHeader title="💬 Communications by Channel" />
          <BarChart data={commByChannel.filter(c=>c.value>0)} color="var(--blue)" />
          <div style={{marginTop:14,fontSize:12,color:'var(--text-muted)'}}>
            Total logs: <strong>{comms.length}</strong> &nbsp;|&nbsp;
            Pending follow-ups: <strong>{comms.filter(c=>c.followUpStatus==='pending').length}</strong>
          </div>
        </Card>
      </div>

      {/* Lead sources */}
      {sourceData.length > 0 && (
        <Card pad>
          <CardHeader title="🔗 Lead Sources" />
          <BarChart data={sourceData} color="var(--green)" />
        </Card>
      )}

      {/* Summary table */}
      <Card>
        <CardHeader title="📋 Quick Summary" />
        <div className={styles.summaryGrid}>
          {[
            { label:'Total Parents',       value: parents.length },
            { label:'New Leads',           value: parents.filter(p=>p.status==='new').length },
            { label:'Demo Scheduled',      value: parents.filter(p=>p.status==='demo_scheduled').length },
            { label:'Converted Parents',   value: parents.filter(p=>p.status==='converted').length },
            { label:'Total Tutors',        value: tutors.length },
            { label:'Active Tutors',       value: tutors.filter(t=>t.status==='converted').length },
            { label:'Active Classes',      value: classes.filter(c=>c.status==='active').length },
            { label:'Total Fee Records',   value: fees.length },
            { label:'Attendance Sessions', value: attendance.length },
            { label:'Comm Logs',           value: comms.length },
            { label:'Pending Tasks',       value: tasks.filter(t=>t.status!=='done').length },
            { label:'Completed Tasks',     value: tasks.filter(t=>t.status==='done').length },
          ].map(item => (
            <div key={item.label} className={styles.summaryItem}>
              <div className={styles.summaryValue}>{item.value}</div>
              <div className={styles.summaryLabel}>{item.label}</div>
            </div>
          ))}
        </div>
      </Card>

    </AppShell>
  );
}
