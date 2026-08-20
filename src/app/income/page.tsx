'use client';
// src/app/income/page.tsx
export const dynamic = 'force-dynamic';


import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, FilterRow, FilterBtn,
  TableWrap, Empty, BtnPrimary, BtnSecondary, ActionBtn,
  Modal, ModalForm, FormRow, FormGroup, ModalFooter,
  currency,
} from '@/components/UI';
import {
  getIncomes, addIncome, updateIncome, deleteIncome,
  Income, IncomeCategory,
} from '@/lib/firestore';

const CATEGORIES: IncomeCategory[] = [
  'Referral Bonus', 'Registration Fee', 'Material/Book Sale',
  'Late Fee', 'Donation/Grant', 'Other',
];

const CATEGORY_ICON: Record<IncomeCategory, string> = {
  'Referral Bonus': '🎁', 'Registration Fee': '📝', 'Material/Book Sale': '📚',
  'Late Fee': '⏰', 'Donation/Grant': '💝', 'Other': '📦',
};

const CATEGORY_COLOR: Record<IncomeCategory, string> = {
  'Referral Bonus': '#1A7A4A', 'Registration Fee': '#1A6FBF', 'Material/Book Sale': '#C8941A',
  'Late Fee': '#C0392B', 'Donation/Grant': '#7B3DBF', 'Other': '#888',
};

const today = () => new Date().toISOString().split('T')[0];
const currentMonthLabel = () => new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

function monthLabelOf(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function yearOf(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).getFullYear().toString();
}

const EMPTY: Omit<Income,'id'|'createdAt'> = {
  category: 'Other', amount: 0, date: today(), note: '', addedBy: '',
};

// ── Add/Edit Income Modal ───────────────────────────────────────────────────

function IncomeModal({ initial, onSave, onClose }: {
  initial?: Income;
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

  return (
    <Modal title={initial ? 'Edit Income' : 'Add Extra Income'} onClose={onClose}>
      <ModalForm onSubmit={submit}>
        <FormGroup label="Category *">
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {CATEGORIES.map(c => (
              <button key={c} type="button" onClick={() => f('category', c)}
                style={{
                  padding:'10px 6px', borderRadius:10, border:'2px solid',
                  cursor:'pointer', fontFamily:'var(--font)', fontSize:11, fontWeight:700,
                  borderColor: form.category===c ? 'var(--blue)' : 'var(--border)',
                  background: form.category===c ? 'var(--blue-light)' : '#fff',
                  color: form.category===c ? 'var(--blue)' : 'var(--text-muted)',
                  transition:'all .15s',
                }}>
                <div style={{fontSize:18,marginBottom:3}}>{CATEGORY_ICON[c]}</div>
                {c}
              </button>
            ))}
          </div>
        </FormGroup>
        <FormRow>
          <FormGroup label="Amount (₹) *">
            <input type="number" min="0" value={form.amount||''} onChange={e=>f('amount',Number(e.target.value))} placeholder="2000" required />
          </FormGroup>
          <FormGroup label="Date *">
            <input type="date" value={form.date} onChange={e=>f('date',e.target.value)} required />
          </FormGroup>
        </FormRow>
        <FormGroup label="Note">
          <textarea rows={2} value={form.note} onChange={e=>f('note',e.target.value)} placeholder="e.g. Referral bonus from parent" />
        </FormGroup>
        <FormGroup label="Added By">
          <input value={form.addedBy} onChange={e=>f('addedBy',e.target.value)} placeholder="Your name" />
        </FormGroup>
        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Update' : 'Add Income'}</BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IncomePage() {
  const [incomes, setIncomes]         = useState<Income[]>([]);
  const [yearFilter, setYearFilter]   = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>(currentMonthLabel());
  const [catFilter, setCatFilter]     = useState<IncomeCategory|'all'>('all');
  const [modal, setModal]             = useState<{open:boolean; record?:Income}>({open:false});

  const loadAll = useCallback(async () => {
    const inc = await getIncomes();
    setIncomes(inc);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const allYears = Array.from(new Set(
    incomes.map(e => yearOf(e.date)).filter(Boolean)
  )).sort((a,b) => Number(b) - Number(a));

  const availableMonths = Array.from(new Set(
    incomes
      .filter(e => yearFilter === 'all' || yearOf(e.date) === yearFilter)
      .map(e => monthLabelOf(e.date))
      .filter(Boolean)
  )).sort((a,b) => new Date(b).getTime() - new Date(a).getTime());

  const filtered = incomes
    .filter(e => {
      if (yearFilter === 'all' && monthFilter === 'all') return true;
      if (monthFilter !== 'all') return monthLabelOf(e.date) === monthFilter;
      if (yearFilter !== 'all') return yearOf(e.date) === yearFilter;
      return true;
    })
    .filter(e => catFilter === 'all' || e.category === catFilter);

  const filteredTotal = filtered.reduce((s,e) => s + (e.amount||0), 0);

  const currentYear = new Date().getFullYear().toString();
  const yearlyTotal = incomes
    .filter(e => yearOf(e.date) === currentYear)
    .reduce((s,e) => s + (e.amount||0), 0);

  const allTimeTotal = incomes.reduce((s,e) => s + (e.amount||0), 0);

  const catTotals = CATEGORIES.map(c => ({
    cat: c,
    total: filtered.filter(e => e.category === c).reduce((s,e) => s+(e.amount||0), 0),
  })).filter(c => c.total > 0).sort((a,b) => b.total - a.total);

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      await updateIncome(modal.record.id, data);
      setIncomes(p => p.map(x => x.id===modal.record!.id ? {...x,...data} : x));
    } else {
      const ref = await addIncome(data);
      setIncomes(p => [{id:ref.id,...data,createdAt:{seconds:Date.now()/1000}},...p]);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this income entry?')) return;
    await deleteIncome(id);
    setIncomes(p => p.filter(x => x.id !== id));
  }

  function handleYearChange(year: string) {
    setYearFilter(year);
    setMonthFilter('all');
  }

  const viewLabel = monthFilter !== 'all'
    ? monthFilter
    : yearFilter !== 'all' ? `Year ${yearFilter}` : 'All Time';

  return (
    <AppShell title="Extra Income" onRefresh={loadAll}>

      <StatsRow>
        <StatCard icon="💰" num={currency(filteredTotal)} label={`Earned — ${viewLabel}`}  sub={`${filtered.length} entries`}          color="green" />
        <StatCard icon="📅" num={currency(yearlyTotal)}   label={`Total ${currentYear}`}    sub="this calendar year"                    color="blue"  />
        <StatCard icon="🗂️" num={currency(allTimeTotal)}  label="All-Time Total"            sub={`across ${allYears.length} year(s)`}   color="gold"  />
      </StatsRow>

      <Card>
        <CardHeader title={`💰 Extra Income — ${viewLabel} (${filtered.length})`}>
          <BtnPrimary onClick={() => setModal({open:true})}>+ Add Extra Income</BtnPrimary>
        </CardHeader>

        <FilterRow>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',flexShrink:0}}>Year:</span>
          <FilterBtn active={yearFilter==='all' && monthFilter==='all'} onClick={() => { setYearFilter('all'); setMonthFilter('all'); }}>
            All Time
          </FilterBtn>
          {allYears.map(y => (
            <FilterBtn key={y} active={yearFilter===y && monthFilter==='all'} onClick={() => handleYearChange(y)}>
              {y} {y===currentYear ? '(This Year)' : ''}
            </FilterBtn>
          ))}
        </FilterRow>

        {availableMonths.length > 0 && (
          <FilterRow>
            <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',flexShrink:0}}>Month:</span>
            <FilterBtn active={monthFilter==='all'} onClick={() => setMonthFilter('all')}>
              {yearFilter === 'all' ? 'All Months' : `All of ${yearFilter}`}
            </FilterBtn>
            {availableMonths.map(m => (
              <FilterBtn key={m} active={monthFilter===m} onClick={() => setMonthFilter(m)}>
                {m.split(' ')[0].substring(0,3)} {m.split(' ')[1]}
              </FilterBtn>
            ))}
          </FilterRow>
        )}

        <FilterRow>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-muted)',flexShrink:0}}>Category:</span>
          <FilterBtn active={catFilter==='all'} onClick={() => setCatFilter('all')}>All</FilterBtn>
          {CATEGORIES.map(c => (
            <FilterBtn key={c} active={catFilter===c} onClick={() => setCatFilter(c)}>
              {CATEGORY_ICON[c]} {c}
            </FilterBtn>
          ))}
        </FilterRow>

        <TableWrap>
          <table>
            <thead><tr><th>Category</th><th>Amount</th><th>Date</th><th>Note</th><th>Added By</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length===0 && (
                <Empty colSpan={6} text={incomes.length === 0 ? 'No extra income recorded yet.' : `No income found for ${viewLabel}.`} />
              )}
              {filtered.map(e => (
                <tr key={e.id}>
                  <td>
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:6,
                      padding:'4px 10px', borderRadius:100, fontSize:12, fontWeight:700,
                      background: CATEGORY_COLOR[e.category]+'20', color: CATEGORY_COLOR[e.category],
                    }}>
                      {CATEGORY_ICON[e.category]} {e.category}
                    </span>
                  </td>
                  <td style={{color:'var(--green)',fontWeight:700}}>{currency(e.amount)}</td>
                  <td style={{whiteSpace:'nowrap',fontSize:12}}>{e.date}</td>
                  <td style={{maxWidth:200,fontSize:12,color:'#666'}}>{e.note || '—'}</td>
                  <td style={{fontSize:12,color:'#888'}}>{e.addedBy || '—'}</td>
                  <td style={{display:'flex',gap:4}}>
                    <ActionBtn onClick={() => setModal({open:true,record:e})}>✏️</ActionBtn>
                    <ActionBtn variant="delete" onClick={() => handleDelete(e.id!)}>🗑️</ActionBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {catTotals.length > 0 && (
        <Card pad>
          <CardHeader title={`📊 Category Breakdown — ${viewLabel}`} />
          <div style={{display:'flex',flexDirection:'column',gap:10,paddingTop:12}}>
            {catTotals.map(({cat,total}) => {
              const pct = Math.round((total/filteredTotal)*100);
              return (
                <div key={cat} style={{display:'grid',gridTemplateColumns:'140px 1fr 90px',gap:10,alignItems:'center'}}>
                  <span style={{fontSize:12.5,fontWeight:600}}>{CATEGORY_ICON[cat]} {cat}</span>
                  <div style={{background:'#f0f4f8',borderRadius:8,height:10,overflow:'hidden'}}>
                    <div style={{width:`${pct}%`,height:'100%',borderRadius:8,background:CATEGORY_COLOR[cat]}} />
                  </div>
                  <span style={{fontSize:12,fontWeight:700,textAlign:'right'}}>{currency(total)}</span>
                </div>
              );
            })}
            <div style={{display:'flex',justifyContent:'space-between',paddingTop:8,borderTop:'1px solid var(--border)',fontSize:13,fontWeight:700}}>
              <span>Total</span>
              <span style={{color:'var(--green)'}}>{currency(filteredTotal)}</span>
            </div>
          </div>
        </Card>
      )}

      {modal.open && (
        <IncomeModal initial={modal.record} onSave={handleSave} onClose={() => setModal({open:false})} />
      )}
    </AppShell>
  );
}