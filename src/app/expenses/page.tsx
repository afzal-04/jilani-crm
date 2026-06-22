'use client';
// src/app/expenses/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader, FilterRow, FilterBtn,
  TableWrap, Empty, BtnPrimary, BtnGold, BtnSecondary, ActionBtn,
  Modal, ModalForm, FormRow, FormGroup, ModalFooter,
  currency,
} from '@/components/UI';
import {
  getExpenses, addExpense, updateExpense, deleteExpense,
  getBudget, setBudget,
  Expense, ExpenseCategory, MonthlyBudget,
} from '@/lib/firestore';

const CATEGORIES: ExpenseCategory[] = [
  'Rent', 'Marketing', 'Internet/Phone', 'Transport',
  'Stationery', 'Utilities', 'Maintenance', 'Salary/Staff', 'Other',
];

const CATEGORY_ICON: Record<ExpenseCategory, string> = {
  'Rent': '🏠', 'Marketing': '📢', 'Internet/Phone': '📱', 'Transport': '🚗',
  'Stationery': '📝', 'Utilities': '💡', 'Maintenance': '🔧',
  'Salary/Staff': '👥', 'Other': '📦',
};

const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  'Rent': '#1A6FBF', 'Marketing': '#C8941A', 'Internet/Phone': '#7B3DBF',
  'Transport': '#1A7A4A', 'Stationery': '#C0392B', 'Utilities': '#E67E22',
  'Maintenance': '#16A085', 'Salary/Staff': '#2C3E50', 'Other': '#888',
};

const today = () => new Date().toISOString().split('T')[0];
const currentMonthLabel = () => new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

// Get month label from a YYYY-MM-DD date string
function monthLabelOf(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

// Get year string from a YYYY-MM-DD date string
function yearOf(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).getFullYear().toString();
}

const EMPTY: Omit<Expense,'id'|'createdAt'> = {
  category: 'Other', amount: 0, date: today(), note: '', addedBy: '',
};

// ── Add/Edit Expense Modal ────────────────────────────────────────────────────

function ExpenseModal({ initial, onSave, onClose }: {
  initial?: Expense;
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
    <Modal title={initial ? 'Edit Expense' : 'Add Expense'} onClose={onClose}>
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
            <input type="number" min="0" value={form.amount||''} onChange={e=>f('amount',Number(e.target.value))} placeholder="5000" required />
          </FormGroup>
          <FormGroup label="Date *">
            <input type="date" value={form.date} onChange={e=>f('date',e.target.value)} required />
          </FormGroup>
        </FormRow>
        <FormGroup label="Note">
          <textarea rows={2} value={form.note} onChange={e=>f('note',e.target.value)} placeholder="e.g. June office rent payment" />
        </FormGroup>
        <FormGroup label="Added By">
          <input value={form.addedBy} onChange={e=>f('addedBy',e.target.value)} placeholder="Your name" />
        </FormGroup>
        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Update' : 'Add Expense'}</BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

// ── Set Budget Modal ──────────────────────────────────────────────────────────

function BudgetModal({ month, currentAmount, onSave, onClose }: {
  month: string; currentAmount: number;
  onSave: (amount: number) => Promise<void>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(currentAmount || 0);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await onSave(amount); setSaving(false); onClose();
  }

  return (
    <Modal title={`🎯 Set Budget — ${month}`} onClose={onClose}>
      <ModalForm onSubmit={submit}>
        <FormGroup label="Monthly Budget (₹) *">
          <input type="number" min="0" value={amount||''} onChange={e=>setAmount(Number(e.target.value))} placeholder="50000" required autoFocus />
        </FormGroup>
        <p style={{fontSize:12,color:'var(--text-muted)'}}>
          This sets the spending limit for <strong>{month}</strong>.
        </p>
        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Budget'}</BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [expenses, setExpenses]       = useState<Expense[]>([]);
  const [budget, setBudgetState]      = useState<MonthlyBudget | null>(null);
  const [yearFilter, setYearFilter]   = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>(currentMonthLabel());
  const [catFilter, setCatFilter]     = useState<ExpenseCategory|'all'>('all');
  const [modal, setModal]             = useState<{open:boolean; record?:Expense}>({open:false});
  const [budgetModal, setBudgetModal] = useState(false);

  const loadAll = useCallback(async () => {
    const [exp, bud] = await Promise.all([
      getExpenses(),
      getBudget(monthFilter === 'all' ? currentMonthLabel() : monthFilter),
    ]);
    setExpenses(exp);
    setBudgetState(bud);
  }, [monthFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Derive available years and months from actual data ──────────────────────
  const allYears = Array.from(new Set(
    expenses.map(e => yearOf(e.date)).filter(Boolean)
  )).sort((a,b) => Number(b) - Number(a)); // newest first

  // Months that actually have expense data (optionally filtered by year)
  const availableMonths = Array.from(new Set(
    expenses
      .filter(e => yearFilter === 'all' || yearOf(e.date) === yearFilter)
      .map(e => monthLabelOf(e.date))
      .filter(Boolean)
  )).sort((a,b) => {
    // Sort newest first
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateB.getTime() - dateA.getTime();
  });

  // ── Apply filters ───────────────────────────────────────────────────────────
  const filtered = expenses
    .filter(e => {
      if (yearFilter === 'all' && monthFilter === 'all') return true;
      if (monthFilter !== 'all') return monthLabelOf(e.date) === monthFilter;
      if (yearFilter !== 'all') return yearOf(e.date) === yearFilter;
      return true;
    })
    .filter(e => catFilter === 'all' || e.category === catFilter);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const filteredTotal  = filtered.reduce((s,e) => s + (e.amount||0), 0);
  const budgetAmount   = budget?.amount || 0;

  // For budget bar — only meaningful when viewing a single month
  const isSingleMonth  = monthFilter !== 'all';
  const remaining      = budgetAmount - filteredTotal;
  const budgetPct      = budgetAmount > 0 ? Math.min(Math.round((filteredTotal/budgetAmount)*100), 999) : 0;
  const overBudget     = budgetAmount > 0 && filteredTotal > budgetAmount;

  // Yearly total (current calendar year)
  const currentYear    = new Date().getFullYear().toString();
  const yearlyTotal    = expenses
    .filter(e => yearOf(e.date) === currentYear)
    .reduce((s,e) => s + (e.amount||0), 0);

  // All-time total
  const allTimeTotal   = expenses.reduce((s,e) => s + (e.amount||0), 0);

  // Top category in current filter
  const catTotals = CATEGORIES.map(c => ({
    cat: c,
    total: filtered.filter(e => e.category === c).reduce((s,e) => s+(e.amount||0), 0),
  })).filter(c => c.total > 0).sort((a,b) => b.total - a.total);

  async function handleSave(data: typeof EMPTY) {
    if (modal.record?.id) {
      await updateExpense(modal.record.id, data);
      setExpenses(p => p.map(x => x.id===modal.record!.id ? {...x,...data} : x));
    } else {
      const ref = await addExpense(data);
      setExpenses(p => [{id:ref.id,...data,createdAt:{seconds:Date.now()/1000}},...p]);
    }
  }

  async function handleSaveBudget(amount: number) {
    const targetMonth = monthFilter === 'all' ? currentMonthLabel() : monthFilter;
    await setBudget(targetMonth, amount);
    setBudgetState({ month: targetMonth, amount });
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return;
    await deleteExpense(id);
    setExpenses(p => p.filter(x => x.id !== id));
  }

  // When year changes, reset month to 'all'
  function handleYearChange(year: string) {
    setYearFilter(year);
    setMonthFilter('all');
  }

  const viewLabel = monthFilter !== 'all'
    ? monthFilter
    : yearFilter !== 'all' ? `Year ${yearFilter}` : 'All Time';

  return (
    <AppShell title="Business Expenses" onRefresh={loadAll}>

      <StatsRow>
        <StatCard icon="💸" num={currency(filteredTotal)}  label={`Spent — ${viewLabel}`}     sub={`${filtered.length} expenses`}          color="red"   />
        <StatCard icon="📅" num={currency(yearlyTotal)}    label={`Total ${currentYear}`}      sub="this calendar year"                     color="blue"  />
        <StatCard icon="🗂️" num={currency(allTimeTotal)}   label="All-Time Total"              sub={`across ${allYears.length} year(s)`}    color="gold"  />
        <StatCard icon="🎯" num={budgetAmount ? currency(budgetAmount) : 'Not set'} label={isSingleMonth ? 'Monthly Budget' : 'Budget'} sub={budgetAmount ? `${budgetPct}% used` : 'click Set Budget'} color={overBudget?'red':'green'} />
      </StatsRow>

      {/* Budget progress bar — only for single month view */}
      {isSingleMonth && budgetAmount > 0 && (
        <Card pad>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:13}}>
            <span style={{fontWeight:700}}>Budget — {monthFilter}</span>
            <span style={{color: overBudget ? 'var(--red)' : 'var(--text-muted)', fontWeight:700}}>
              {currency(filteredTotal)} / {currency(budgetAmount)} ({budgetPct}%)
            </span>
          </div>
          <div style={{background:'#f0f4f8',borderRadius:10,height:14,overflow:'hidden'}}>
            <div style={{
              width:`${Math.min(budgetPct,100)}%`, height:'100%', borderRadius:10,
              background: overBudget ? 'var(--red)' : budgetPct > 80 ? 'var(--gold)' : 'var(--green)',
              transition:'width .4s',
            }} />
          </div>
          {overBudget && (
            <p style={{color:'var(--red)',fontSize:12,marginTop:8,fontWeight:600}}>
              ⚠️ Over budget by {currency(Math.abs(remaining))}!
            </p>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title={`💰 Expenses — ${viewLabel} (${filtered.length})`}>
          <BtnGold onClick={() => setBudgetModal(true)}>🎯 Set Budget</BtnGold>
          <BtnPrimary onClick={() => setModal({open:true})}>+ Add Expense</BtnPrimary>
        </CardHeader>

        {/* ── Year filter ── */}
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

        {/* ── Month filter — dynamic from actual data ── */}
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

        {/* ── Category filter ── */}
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
                <Empty colSpan={6} text={expenses.length === 0 ? 'No expenses recorded yet.' : `No expenses found for ${viewLabel}.`} />
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
                  <td style={{color:'var(--red)',fontWeight:700}}>{currency(e.amount)}</td>
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

      {/* Category breakdown */}
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
              <span style={{color:'var(--red)'}}>{currency(filteredTotal)}</span>
            </div>
          </div>
        </Card>
      )}

      {modal.open && (
        <ExpenseModal initial={modal.record} onSave={handleSave} onClose={() => setModal({open:false})} />
      )}
      {budgetModal && (
        <BudgetModal
          month={monthFilter !== 'all' ? monthFilter : currentMonthLabel()}
          currentAmount={budgetAmount}
          onSave={handleSaveBudget}
          onClose={() => setBudgetModal(false)}
        />
      )}
    </AppShell>
  );
}