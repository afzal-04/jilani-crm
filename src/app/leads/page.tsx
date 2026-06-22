'use client';
// src/app/leads/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { getParents, getTutors, updateParent, updateTutor, Parent, Tutor, LeadStatus } from '@/lib/firestore';
import styles from './leads.module.css';

type LeadType = 'all' | 'parents' | 'tutors';
type Lead = (Parent | Tutor) & { _type: 'parent' | 'tutor' };

// Helper — get display name with fallbacks for different form field names
function displayName(l: { name?: string; studentName?: string }): string {
  return l.name?.trim() || l.studentName?.trim() || 'Unnamed Lead';
}

// Helper — get display area/address with fallbacks
function displayLocation(l: { area?: string; address?: string }): string {
  return l.area?.trim() || l.address?.trim() || '—';
}

const COLUMNS: { key: LeadStatus; label: string; icon: string }[] = [
  { key: 'new',            label: 'New',            icon: '🆕' },
  { key: 'contacted',      label: 'Contacted',      icon: '📞' },
  { key: 'demo_scheduled', label: 'Demo Scheduled', icon: '📅' },
  { key: 'converted',      label: 'Converted',      icon: '✅' },
  { key: 'closed',         label: 'Closed',         icon: '🔒' },
];

// Order to show "move to" buttons (excluding current status)
const NEXT_STATUSES: Record<LeadStatus, LeadStatus[]> = {
  new:            ['contacted', 'closed'],
  contacted:      ['demo_scheduled', 'closed'],
  demo_scheduled: ['converted', 'closed'],
  converted:      ['closed'],
  closed:         ['new'],
};

export default function LeadsPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [tutors, setTutors]   = useState<Tutor[]>([]);
  const [filter, setFilter]   = useState<LeadType>('all');
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [p, t] = await Promise.all([getParents(), getTutors()]);
    setParents(p); setTutors(t); setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const allLeads: Lead[] = [
    ...parents.map(p => ({ ...p, _type: 'parent' as const })),
    ...tutors.map(t => ({ ...t, _type: 'tutor' as const })),
  ];

  const filtered = allLeads.filter(l =>
    filter === 'all' || (filter === 'parents' && l._type === 'parent') || (filter === 'tutors' && l._type === 'tutor')
  );

  async function moveStatus(lead: Lead, newStatus: LeadStatus) {
    if (lead._type === 'parent') {
      await updateParent(lead.id!, { status: newStatus });
      setParents(p => p.map(x => x.id === lead.id ? { ...x, status: newStatus } : x));
    } else {
      await updateTutor(lead.id!, { status: newStatus });
      setTutors(t => t.map(x => x.id === lead.id ? { ...x, status: newStatus } : x));
    }
  }

  return (
    <AppShell title="Lead Pipeline" onRefresh={loadAll} badges={{ '/parents': parents.filter(p=>p.status==='new').length, '/tutors': tutors.filter(t=>t.status==='new').length }}>

      <div className={styles.toolbar}>
        <div className={styles.toggleGroup}>
          <button className={`${styles.toggleBtn} ${filter==='all' ? styles.toggleActive : ''}`} onClick={() => setFilter('all')}>All ({allLeads.length})</button>
          <button className={`${styles.toggleBtn} ${filter==='parents' ? styles.toggleActive : ''}`} onClick={() => setFilter('parents')}>👨‍👩‍👧 Parents ({parents.length})</button>
          <button className={`${styles.toggleBtn} ${filter==='tutors' ? styles.toggleActive : ''}`} onClick={() => setFilter('tutors')}>👩‍🏫 Tutors ({tutors.length})</button>
        </div>
      </div>

      <div className={styles.board}>
        {COLUMNS.map(col => {
          const items = filtered.filter(l => l.status === col.key);
          return (
            <div key={col.key} className={styles.column}>
              <div className={styles.columnHeader}>
                <span className={styles.columnTitle}>{col.icon} {col.label}</span>
                <span className={styles.columnCount}>{items.length}</span>
              </div>
              <div className={styles.columnBody}>
                {items.length === 0 && <div className={styles.emptyCol}>No leads</div>}
                {items.map(lead => (
                  <div key={`${lead._type}-${lead.id}`} className={styles.leadCard}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardName}>{displayName(lead)}</span>
                      <span className={styles.cardTypeIcon}>{lead._type === 'parent' ? '👨‍👩‍👧' : '👩‍🏫'}</span>
                    </div>
                    <div className={styles.cardMeta}>
                      📍 {displayLocation(lead)}<br/>
                      {lead._type === 'parent'
                        ? <>📚 {(lead as Parent).class || '—'} · {(lead as Parent).subject || '—'}</>
                        : <>🎓 {(lead as Tutor).qualification || '—'}<br/>📚 {(lead as Tutor).subjects || '—'}</>
                      }
                    </div>
                    <div className={styles.cardPhone}>📞 {lead.phone || '—'}</div>
                    <div className={styles.moveRow}>
                      {NEXT_STATUSES[lead.status].map(next => (
                        <button key={next} className={styles.moveBtn} onClick={() => moveStatus(lead, next)}>
                          → {COLUMNS.find(c => c.key === next)?.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}