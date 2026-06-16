'use client';
// src/app/tasks/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, FilterRow, FilterBtn,
  TableWrap, Empty, Badge, SearchInput, BtnPrimary, BtnGold, ActionBtn,
  Modal, ModalForm, FormRow, FormGroup, ModalFooter, BtnSecondary,
  AlertBox, AlertLink,
} from '@/components/UI';
import { getTasks, addTask, updateTask, deleteTask, Task, TaskPriority, TaskStatus } from '@/lib/firestore';

const today = () => new Date().toISOString().split('T')[0];

const PRIORITIES: TaskPriority[] = ['high','medium','low'];
const STATUSES:   TaskStatus[]   = ['pending','in_progress','done'];

const PRIORITY_ICON: Record<TaskPriority, string> = { high:'🔴', medium:'🟡', low:'🟢' };
const STATUS_ICON:   Record<TaskStatus, string>   = { pending:'⏳', in_progress:'🔄', done:'✅' };

const EMPTY: Omit<Task,'id'|'createdAt'> = {
  title:'', description:'', assignedTo:'', relatedContact:'',
  dueDate:'', priority:'medium', status:'pending',
};

function TaskModal({ initial, onSave, onClose }: {
  initial?: Task;
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
    <Modal title={initial ? 'Edit Task' : 'Add New Task'} onClose={onClose}>
      <ModalForm onSubmit={submit}>
        <FormGroup label="Task Title *">
          <input value={form.title} onChange={e=>f('title',e.target.value)} placeholder="e.g. Call Ramesh Verma for demo follow-up" required />
        </FormGroup>
        <FormGroup label="Description">
          <textarea rows={2} value={form.description} onChange={e=>f('description',e.target.value)} placeholder="More details about this task…" />
        </FormGroup>
        <FormRow>
          <FormGroup label="Assigned To">
            <input value={form.assignedTo} onChange={e=>f('assignedTo',e.target.value)} placeholder="Staff member name" />
          </FormGroup>
          <FormGroup label="Related Contact">
            <input value={form.relatedContact} onChange={e=>f('relatedContact',e.target.value)} placeholder="Parent / tutor name" />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Due Date">
            <input type="date" value={form.dueDate} onChange={e=>f('dueDate',e.target.value)} />
          </FormGroup>
          <FormGroup label="Status">
            <select value={form.status} onChange={e=>f('status',e.target.value as TaskStatus)}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_ICON[s]} {s.replace(/_/g,' ')}</option>)}
            </select>
          </FormGroup>
        </FormRow>

        {/* Priority as visual toggle */}
        <FormGroup label="Priority">
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
            {PRIORITIES.map(p => (
              <button key={p} type="button" onClick={() => f('priority', p)}
                style={{
                  padding:'10px 8px', borderRadius:10, border:'2px solid', cursor:'pointer',
                  fontFamily:'var(--font)', fontSize:13, fontWeight:700,
                  borderColor: form.priority===p ? 'var(--blue)' : 'var(--border)',
                  background: form.priority===p ? 'var(--blue-light)' : '#fff',
                  color: form.priority===p ? 'var(--blue)' : 'var(--text-muted)',
                  transition:'all .15s',
                }}>
                <div style={{fontSize:22, marginBottom:4}}>{PRIORITY_ICON[p]}</div>
                {p.charAt(0).toUpperCase()+p.slice(1)}
              </button>
            ))}
          </div>
        </FormGroup>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Update Task' : 'Add Task'}</BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

export default function TasksPage() {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus|'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority|'all'>('all');
  const [modal, setModal]       = useState<{open:boolean; record?:Task}>({open:false});

  const loadAll = useCallback(async () => setTasks(await getTasks()), []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const todayStr = today();

  const filtered = tasks
    .filter(t => statusFilter==='all'   || t.status===statusFilter)
    .filter(t => priorityFilter==='all' || t.priority===priorityFilter)
    .filter(t => !search || [t.title,t.description,t.assignedTo,t.relatedContact]
      .some(v => v?.toLowerCase().includes(search.toLowerCase())));

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      await updateTask(modal.record.id, data);
      setTasks(p => p.map(x => x.id===modal.record!.id ? {...x,...data} : x));
    } else {
      const ref = await addTask(data);
      setTasks(p => [{id:ref.id,...data,createdAt:{seconds:Date.now()/1000}},...p]);
    }
  }

  async function quickStatus(id: string, status: TaskStatus) {
    await updateTask(id, { status });
    setTasks(p => p.map(x => x.id===id ? {...x, status} : x));
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this task?')) return;
    await deleteTask(id);
    setTasks(p => p.filter(x => x.id !== id));
  }

  // Stats
  const pending    = tasks.filter(t => t.status === 'pending').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const done       = tasks.filter(t => t.status === 'done').length;
  const overdue    = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayStr).length;
  const highPrio   = tasks.filter(t => t.priority === 'high' && t.status !== 'done').length;

  return (
    <AppShell title="Tasks" onRefresh={loadAll} badges={{'/tasks': overdue}}>
      <StatsRow>
        <StatCard icon="⏳" num={pending}    label="Pending"     sub="not started yet"       color="gold"  />
        <StatCard icon="🔄" num={inProgress} label="In Progress" sub="currently working on"  color="blue"  />
        <StatCard icon="✅" num={done}       label="Completed"   sub="all time"              color="green" />
        <StatCard icon="🔴" num={overdue}    label="Overdue"     sub={`${highPrio} high priority open`} color="red" />
      </StatsRow>

      {overdue > 0 && (
        <AlertBox>
          ⚠️ <strong>{overdue} task{overdue>1?'s':''}</strong> overdue —
          <AlertLink onClick={() => { setStatusFilter('pending'); setPriorityFilter('all'); }}>
            Show overdue tasks →
          </AlertLink>
        </AlertBox>
      )}

      <Card>
        <CardHeader title={`✅ Tasks (${tasks.length})`}>
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 Search title, contact…" />
          <BtnGold onClick={() => setModal({open:true})}>+ Add Task</BtnGold>
        </CardHeader>

        <FilterRow>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>Status:</span>
          <FilterBtn active={statusFilter==='all'} onClick={() => setStatusFilter('all')}>All ({tasks.length})</FilterBtn>
          {STATUSES.map(s => (
            <FilterBtn key={s} active={statusFilter===s} onClick={() => setStatusFilter(s)}>
              {STATUS_ICON[s]} {s.replace(/_/g,' ')} ({tasks.filter(t=>t.status===s).length})
            </FilterBtn>
          ))}
        </FilterRow>

        <FilterRow>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>Priority:</span>
          <FilterBtn active={priorityFilter==='all'} onClick={() => setPriorityFilter('all')}>All</FilterBtn>
          {PRIORITIES.map(p => (
            <FilterBtn key={p} active={priorityFilter===p} onClick={() => setPriorityFilter(p)}>
              {PRIORITY_ICON[p]} {p.charAt(0).toUpperCase()+p.slice(1)}
            </FilterBtn>
          ))}
        </FilterRow>

        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Task</th><th>Assigned To</th><th>Contact</th>
                <th>Due Date</th><th>Priority</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <Empty colSpan={7} text="No tasks found. 🎉" />}
              {filtered.map(t => {
                const isOverdue = t.status !== 'done' && t.dueDate && t.dueDate < todayStr;
                const isDueToday = t.dueDate === todayStr && t.status !== 'done';
                return (
                  <tr key={t.id}>
                    <td>
                      <strong style={{color: t.status==='done' ? '#aaa' : undefined, textDecoration: t.status==='done' ? 'line-through' : undefined}}>
                        {t.title}
                      </strong>
                      {t.description && (
                        <div style={{fontSize:11,color:'#999',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td style={{fontSize:13}}>{t.assignedTo || '—'}</td>
                    <td style={{fontSize:13}}>{t.relatedContact || '—'}</td>
                    <td style={{whiteSpace:'nowrap'}}>
                      <span style={{
                        fontWeight: 700,
                        color: isOverdue ? 'var(--red)' : isDueToday ? 'var(--gold)' : undefined,
                      }}>
                        {t.dueDate || '—'}
                        {isOverdue  && <span style={{fontSize:10,display:'block',color:'var(--red)'}}>OVERDUE</span>}
                        {isDueToday && <span style={{fontSize:10,display:'block',color:'var(--gold)'}}>TODAY</span>}
                      </span>
                    </td>
                    <td><Badge status={t.priority} /></td>
                    <td>
                      {/* Quick status cycle buttons */}
                      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                        {STATUSES.map(s => (
                          <button key={s} title={s.replace(/_/g,' ')}
                            onClick={() => quickStatus(t.id!, s)}
                            style={{
                              padding:'3px 8px', borderRadius:6, border:'1.5px solid',
                              cursor:'pointer', fontSize:12, background:'#fff',
                              borderColor: t.status===s ? 'var(--blue)' : 'var(--border)',
                              fontWeight: t.status===s ? 700 : 400,
                              color: t.status===s ? 'var(--blue)' : 'var(--text-muted)',
                              transition:'all .1s',
                            }}>
                            {STATUS_ICON[s]}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td style={{display:'flex',gap:4}}>
                      <ActionBtn onClick={() => setModal({open:true,record:t})}>✏️</ActionBtn>
                      <ActionBtn variant="delete" onClick={() => handleDelete(t.id!)}>🗑️</ActionBtn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {modal.open && (
        <TaskModal
          initial={modal.record}
          onSave={handleSave}
          onClose={() => setModal({open:false})}
        />
      )}
    </AppShell>
  );
}
