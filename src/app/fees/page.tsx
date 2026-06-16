'use client';
// src/app/fees/page.tsx
export const dynamic = 'force-dynamic';
import ExportButton from '@/components/ExportButton';
import { exportFees } from '@/lib/exportExcel';
import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, FilterRow, FilterBtn,
  TableWrap, Empty, Badge, SearchInput, BtnPrimary, ActionBtn,
  Modal, ModalForm, FormRow, FormGroup, ModalFooter, BtnSecondary,
  FinanceStrip, FinItem, FinDivider, ProfitBox,
  currency, fmtDate,
} from '@/components/UI';
import { getFees, addFee, updateFee, deleteFee, FeeRecord } from '@/lib/firestore';

const CLASS_LEVELS = ['Nursery','LKG','UKG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10 (Board)','Class 11','Class 12 (Board)','Competitive Exam (JEE/NEET)','Competitive Exam (Govt Job)','Summer Classes','Drawing / Art','Music / Singing','Dance','Other'];
const SUBJECTS = ['Maths','Science','Physics','Chemistry','Biology','English','Hindi','Social Science','Computer Science','Accountancy / Commerce','Economics','JEE Coaching','NEET Coaching','Drawing / Art','Music / Singing','Dance','All Subjects','Other'];
type PayStatus = 'pending' | 'received' | 'paid';
const PAY_STATUSES: PayStatus[] = ['pending','received','paid'];

const EMPTY: Omit<FeeRecord,'id'|'createdAt'> = {
  tutorName:'', parentName:'', subject:'', classLevel:'',
  parentFee:0, tutorFee:0, profit:0,
  month:'', paymentStatus:'pending', notes:'',
};

// Generate last 12 months for the month dropdown
function getMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    months.push(label);
  }
  return months;
}

function FeeModal({ initial, onSave, onClose }: {
  initial?: FeeRecord;
  onSave: (d: typeof EMPTY) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const profit = (form.parentFee||0) - (form.tutorFee||0);
  const f = (k: keyof typeof form, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await onSave({ ...form, profit }); setSaving(false); onClose();
  }

  return (
    <Modal title={initial ? 'Edit Fee Record' : 'Add Fee Record'} onClose={onClose}>
      <ModalForm onSubmit={submit}>
        <FormRow>
          <FormGroup label="Tutor Name *">
            <input value={form.tutorName} onChange={e=>f('tutorName',e.target.value)} placeholder="Tutor name" required />
          </FormGroup>
          <FormGroup label="Parent Name *">
            <input value={form.parentName} onChange={e=>f('parentName',e.target.value)} placeholder="Parent name" required />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Subject *">
            <select value={form.subject} onChange={e=>f('subject',e.target.value)} required>
              <option value="">Select Subject</option>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Class Level *">
            <select value={form.classLevel} onChange={e=>f('classLevel',e.target.value)} required>
              <option value="">Select Class</option>
              {CLASS_LEVELS.map(c => <option key={c}>{c}</option>)}
            </select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Month *">
            <select value={form.month} onChange={e=>f('month',e.target.value)} required>
              <option value="">Select Month</option>
              {getMonthOptions().map(m => <option key={m}>{m}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Payment Status">
            <select value={form.paymentStatus} onChange={e=>f('paymentStatus',e.target.value as PayStatus)}>
              <option value="pending">⏳ Pending</option>
              <option value="received">✅ Received from Parent</option>
              <option value="paid">💳 Paid to Tutor</option>
            </select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Parent Pays You (₹) *">
            <input type="number" min="0" value={form.parentFee||''} onChange={e=>f('parentFee',Number(e.target.value))} placeholder="3500" required />
          </FormGroup>
          <FormGroup label="You Pay Tutor (₹) *">
            <input type="number" min="0" value={form.tutorFee||''} onChange={e=>f('tutorFee',Number(e.target.value))} placeholder="2500" required />
          </FormGroup>
        </FormRow>
        <ProfitBox profit={profit} />
        <FormGroup label="Notes">
          <textarea rows={2} value={form.notes} onChange={e=>f('notes',e.target.value)} placeholder="Any payment notes…" />
        </FormGroup>
        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Update' : 'Add Record'}</BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

export default function FeesPage() {
  const [fees, setFees]     = useState<FeeRecord[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PayStatus|'all'>('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [modal, setModal]   = useState<{open:boolean; record?:FeeRecord}>({open:false});

  const loadAll = useCallback(async () => setFees(await getFees()), []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const months = ['all', ...Array.from(new Set(fees.map(f => f.month).filter(Boolean)))];

  const filtered = fees
    .filter(f => filter==='all' || f.paymentStatus===filter)
    .filter(f => monthFilter==='all' || f.month===monthFilter)
    .filter(f => !search || [f.tutorName,f.parentName,f.subject,f.classLevel,f.month]
      .some(v => v?.toLowerCase().includes(search.toLowerCase())));

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      await updateFee(modal.record.id, data);
      setFees(p => p.map(x => x.id===modal.record!.id ? {...x,...data} : x));
    } else {
      const ref = await addFee(data);
      setFees(p => [{id:ref.id,...data,createdAt:{seconds:Date.now()/1000}},...p]);
    }
  }

  async function handleStatusChange(id: string, status: PayStatus) {
    await updateFee(id, { paymentStatus: status });
    setFees(p => p.map(x => x.id===id ? {...x, paymentStatus:status} : x));
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this fee record?')) return;
    await deleteFee(id);
    setFees(p => p.filter(x => x.id !== id));
  }

  // Summaries
  const confirmed       = fees.filter(f => f.paymentStatus !== 'pending');
  const totalFromParent = confirmed.reduce((s,f) => s + (f.parentFee||0), 0);
  const totalToTutor    = confirmed.reduce((s,f) => s + (f.tutorFee||0), 0);
  const totalPaid       = fees.filter(f=>f.paymentStatus==='paid').reduce((s,f) => s+(f.tutorFee||0), 0);
  const totalProfit     = totalFromParent - totalToTutor;
  const pendingCount    = fees.filter(f => f.paymentStatus === 'pending').length;
  const pendingAmount   = fees.filter(f => f.paymentStatus === 'pending').reduce((s,f) => s+(f.parentFee||0), 0);

  return (
    <AppShell title="Fees & Payments" onRefresh={loadAll}>
      <StatsRow>
        <StatCard icon="💳" num={currency(totalFromParent)} label="Received from Parents" sub="confirmed payments" color="green" />
        <StatCard icon="📤" num={currency(totalToTutor)}   label="Tutor Fee Due"          sub={`Paid: ${currency(totalPaid)}`} color="red" />
        <StatCard icon="🏦" num={currency(totalProfit)}    label="Net Profit"              sub="revenue - tutor fees" color="blue" />
        <StatCard icon="⏳" num={pendingCount}             label="Pending Records"         sub={`${currency(pendingAmount)} due`} color="gold" />
      </StatsRow>

      <FinanceStrip>
        <FinItem label="💳 Total Collected" value={currency(totalFromParent)} positive />
        <FinDivider />
        <FinItem label="📤 Tutor Fee (Due)" value={currency(totalToTutor)} positive={false} sub={`Actually paid: ${currency(totalPaid)}`} />
        <FinDivider />
        <FinItem label="🏦 Net Profit" value={currency(totalProfit)} positive={totalProfit>=0} />
        <FinDivider />
        <FinItem label="⏳ Pending Collection" value={currency(pendingAmount)} />
      </FinanceStrip>

      <Card>
        <CardHeader title={`💰 Fee Records (${fees.length})`}>
          <SearchInput value={search} onChange={setSearch} placeholder="🔍 Search tutor, parent, month…" />
          <BtnPrimary onClick={() => setModal({open:true})}>+ Add Record</BtnPrimary>
          <ExportButton label="Export Fees" onExport={() => exportFees(filtered)} />
        </CardHeader>

        {/* Filters */}
        <FilterRow>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>Status:</span>
          {(['all','pending','received','paid'] as (PayStatus|'all')[]).map(s => (
            <FilterBtn key={s} active={filter===s} onClick={() => setFilter(s)}>
              {s==='all' ? 'All' : s==='pending' ? '⏳ Pending' : s==='received' ? '✅ Received' : '💳 Paid'}
            </FilterBtn>
          ))}
        </FilterRow>
        <FilterRow>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>Month:</span>
          {months.slice(0,7).map(m => (
            <FilterBtn key={m} active={monthFilter===m} onClick={() => setMonthFilter(m)}>
              {m==='all' ? 'All Months' : m}
            </FilterBtn>
          ))}
        </FilterRow>

        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Tutor</th><th>Parent</th><th>Subject</th><th>Class</th>
                <th>Month</th><th>Parent Pays</th><th>Tutor Gets</th>
                <th>Profit</th><th>Status</th><th>Update</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <Empty colSpan={11} text="No fee records found." />}
              {filtered.map(f => {
                const profit = (f.parentFee||0) - (f.tutorFee||0);
                return (
                  <tr key={f.id}>
                    <td><strong>{f.tutorName}</strong></td>
                    <td>{f.parentName}</td>
                    <td>{f.subject}</td>
                    <td style={{whiteSpace:'nowrap'}}>{f.classLevel}</td>
                    <td style={{whiteSpace:'nowrap'}}>{f.month}</td>
                    <td style={{color:'var(--green)',fontWeight:700}}>{currency(f.parentFee||0)}</td>
                    <td style={{color:'var(--red)',fontWeight:700}}>{currency(f.tutorFee||0)}</td>
                    <td style={{color:profit>=0?'var(--green)':'var(--red)',fontWeight:700}}>{currency(profit)}</td>
                    <td><Badge status={f.paymentStatus} /></td>
                    <td>
                      <select
                        style={{padding:'5px 8px',border:'1.5px solid var(--border)',borderRadius:6,fontSize:12,fontFamily:'var(--font)'}}
                        value={f.paymentStatus}
                        onChange={e => handleStatusChange(f.id!, e.target.value as PayStatus)}
                      >
                        <option value="pending">⏳ Pending</option>
                        <option value="received">✅ Received</option>
                        <option value="paid">💳 Paid</option>
                      </select>
                    </td>
                    <td style={{display:'flex',gap:4}}>
                      <ActionBtn onClick={() => setModal({open:true,record:f})}>✏️</ActionBtn>
                      <ActionBtn variant="delete" onClick={() => handleDelete(f.id!)}>🗑️</ActionBtn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {modal.open && (
        <FeeModal
          initial={modal.record}
          onSave={handleSave}
          onClose={() => setModal({open:false})}
        />
      )}
    </AppShell>
  );
}
