'use client';
// src/app/profit-shares/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import {
  StatsRow, StatCard, Card, CardHeader,
  TableWrap, Empty, BtnPrimary, BtnGold, BtnSecondary, ActionBtn,
  Modal, ModalForm, FormRow, FormGroup, ModalFooter,
  currency,
} from '@/components/UI';
import {
  getShareHolders, addShareHolder, updateShareHolder, deleteShareHolder,
  getProfitDistributions, addProfitDistribution, deleteProfitDistribution,
  ProfitShareHolder, ProfitDistribution,
} from '@/lib/firestore';

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#1A6FBF','#C8941A','#7B3DBF','#1A7A4A',
  '#C0392B','#E67E22','#16A085','#2C3E50','#E91E63',
];

const currentMonthLabel = () =>
  new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

function pct(n: number) { return `${n}%`; }

// ── Share Holder Modal ────────────────────────────────────────────────────────

const EMPTY_HOLDER: Omit<ProfitShareHolder,'id'|'createdAt'|'updatedAt'> = {
  name: '', role: 'Partner', percentage: 0, color: '#1A6FBF', notes: '', isCompany: false,
};

function HolderModal({ initial, onSave, onClose }: {
  initial?: ProfitShareHolder;
  onSave: (d: typeof EMPTY_HOLDER) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial ? { ...EMPTY_HOLDER, ...initial } : { ...EMPTY_HOLDER });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof typeof form, v: string | number | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  }

  return (
    <Modal title={initial ? '✏️ Edit Share Holder' : '➕ Add Share Holder'} onClose={onClose}>
      <ModalForm onSubmit={submit}>
        <FormRow>
          <FormGroup label="Name *">
            <input
              value={form.name}
              onChange={e => f('name', e.target.value)}
              placeholder="e.g. Ahmad Jilani"
              required
            />
          </FormGroup>
          <FormGroup label="Role *">
            <input
              value={form.role}
              onChange={e => f('role', e.target.value)}
              placeholder="e.g. Partner, Investor, Company"
              required
            />
          </FormGroup>
        </FormRow>

        <FormRow>
          <FormGroup label="Profit Share % *">
            <input
              type="number" min="0" max="100" step="0.01"
              value={form.percentage || ''}
              onChange={e => f('percentage', Number(e.target.value))}
              placeholder="e.g. 30"
              required
            />
          </FormGroup>
          <FormGroup label="Color">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => f('color', c)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', background: c,
                    border: form.color === c ? '3px solid #000' : '2px solid transparent',
                    cursor: 'pointer', flexShrink: 0,
                  }}
                />
              ))}
              <input
                type="color" value={form.color}
                onChange={e => f('color', e.target.value)}
                style={{ width: 28, height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }}
              />
            </div>
          </FormGroup>
        </FormRow>

        <FormGroup label="Notes">
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => f('notes', e.target.value)}
            placeholder="Optional notes about this share holder"
          />
        </FormGroup>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Update' : 'Add Holder'}
          </BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

// ── Distribution Modal ────────────────────────────────────────────────────────

function DistributionModal({ holders, onSave, onClose }: {
  holders: ProfitShareHolder[];
  onSave: (d: Omit<ProfitDistribution,'id'|'createdAt'>) => Promise<void>;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(currentMonthLabel());
  const [totalProfit, setTotalProfit] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const totalPct = holders.reduce((s, h) => s + (h.percentage || 0), 0);

  const shares = holders.map(h => ({
    holderId: h.id!,
    holderName: h.name,
    percentage: h.percentage,
    amount: Math.round((totalProfit * h.percentage) / 100),
  }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ month, totalProfit, notes, shares });
    setSaving(false);
    onClose();
  }

  return (
    <Modal title="💰 Record Profit Distribution" onClose={onClose}>
      <ModalForm onSubmit={submit}>
        <FormRow>
          <FormGroup label="Month *">
            <input
              value={month}
              onChange={e => setMonth(e.target.value)}
              placeholder="e.g. November 2026"
              required
            />
          </FormGroup>
          <FormGroup label="Total Profit (₹) *">
            <input
              type="number" min="0"
              value={totalProfit || ''}
              onChange={e => setTotalProfit(Number(e.target.value))}
              placeholder="e.g. 10000"
              required
            />
          </FormGroup>
        </FormRow>

        {/* Live breakdown */}
        {totalProfit > 0 && holders.length > 0 && (
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 10 }}>
              Distribution Preview
            </div>
            {shares.map(s => (
              <div key={s.holderId} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 13,
              }}>
                <span style={{ fontWeight: 600 }}>{s.holderName}</span>
                <span>
                  <span style={{ color: '#888', marginRight: 8 }}>{pct(s.percentage)}</span>
                  <span style={{ fontWeight: 700, color: '#1A6FBF' }}>{currency(s.amount)}</span>
                </span>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between', paddingTop: 8,
              fontSize: 13, fontWeight: 700,
            }}>
              <span>Total</span>
              <span style={{ color: totalPct === 100 ? 'var(--green)' : 'var(--red)' }}>
                {pct(totalPct)} = {currency(shares.reduce((s, x) => s + x.amount, 0))}
              </span>
            </div>
            {totalPct !== 100 && (
              <p style={{ color: 'var(--red)', fontSize: 11, marginTop: 6, fontWeight: 600 }}>
                ⚠️ Shares don&apos;t add up to 100%. Please fix percentages first.
              </p>
            )}
          </div>
        )}

        <FormGroup label="Notes">
          <textarea
            rows={2} value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes for this month's distribution"
          />
        </FormGroup>

        <ModalFooter>
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary type="submit" disabled={saving || holders.length === 0}>
            {saving ? 'Saving…' : 'Record Distribution'}
          </BtnPrimary>
        </ModalFooter>
      </ModalForm>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProfitSharesPage() {
  const [holders, setHolders]           = useState<ProfitShareHolder[]>([]);
  const [distributions, setDists]       = useState<ProfitDistribution[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState<{ open: boolean; record?: ProfitShareHolder }>({ open: false });
  const [distModal, setDistModal]       = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [h, d] = await Promise.all([getShareHolders(), getProfitDistributions()]);
    setHolders(h);
    setDists(d);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Derived Stats ──────────────────────────────────────────────────────────
  const totalPct     = holders.reduce((s, h) => s + (h.percentage || 0), 0);
  const unallocated  = 100 - totalPct;
  const latestDist   = distributions[0] ?? null;
  const totalDistributed = distributions.reduce((s, d) => s + (d.totalProfit || 0), 0);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleSaveHolder(data: typeof EMPTY_HOLDER) {
    if (modal.record?.id) {
      await updateShareHolder(modal.record.id, data);
      setHolders(p => p.map(x => x.id === modal.record!.id ? { ...x, ...data } : x));
    } else {
      const ref = await addShareHolder(data);
      setHolders(p => [...p, { id: ref.id, ...data, createdAt: { seconds: Date.now() / 1000 } }]);
    }
  }

  async function handleDeleteHolder(id: string) {
    if (!confirm('Remove this share holder? This cannot be undone.')) return;
    await deleteShareHolder(id);
    setHolders(p => p.filter(x => x.id !== id));
  }

  async function handleSaveDist(data: Omit<ProfitDistribution,'id'|'createdAt'>) {
    const ref = await addProfitDistribution(data);
    setDists(p => [{ id: ref.id, ...data, createdAt: { seconds: Date.now() / 1000 } }, ...p]);
  }

  async function handleDeleteDist(id: string) {
    if (!confirm('Delete this distribution record?')) return;
    await deleteProfitDistribution(id);
    setDists(p => p.filter(x => x.id !== id));
  }

  return (
    <AppShell title="Profit Shares" onRefresh={loadAll}>

      {/* ── Stats Row ── */}
      <StatsRow>
        <StatCard
          icon="👥" num={holders.length}
          label="Share Holders"
          sub={`${totalPct}% allocated`}
          color={totalPct === 100 ? 'green' : totalPct > 100 ? 'red' : 'gold'}
        />
        <StatCard
          icon="📊" num={pct(totalPct)}
          label="Total Allocated"
          sub={unallocated >= 0 ? `${pct(unallocated)} remaining` : `${pct(Math.abs(unallocated))} over-allocated`}
          color={totalPct === 100 ? 'green' : totalPct > 100 ? 'red' : 'blue'}
        />
        <StatCard
          icon="📅" num={distributions.length}
          label="Months Recorded"
          sub={latestDist ? `Latest: ${latestDist.month}` : 'No records yet'}
          color="blue"
        />
        <StatCard
          icon="💰" num={currency(totalDistributed)}
          label="Total Profit Distributed"
          sub="all time"
          color="gold"
        />
      </StatsRow>

      {/* ── Allocation bar ── */}
      <Card pad>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>📊 Profit Allocation Overview</span>
          <span style={{ color: totalPct === 100 ? 'var(--green)' : totalPct > 100 ? 'var(--red)' : 'var(--text-muted)', fontWeight: 700 }}>
            {totalPct}% / 100%
          </span>
        </div>

        {/* Stacked bar */}
        <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', height: 22, background: '#f0f4f8', marginBottom: 12 }}>
          {holders.map(h => (
            <div
              key={h.id}
              title={`${h.name}: ${h.percentage}%`}
              style={{
                width: `${Math.min(h.percentage, 100)}%`,
                background: h.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#fff',
                transition: 'width .4s',
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}
            >
              {h.percentage >= 8 ? `${h.percentage}%` : ''}
            </div>
          ))}
          {unallocated > 0 && (
            <div style={{
              width: `${unallocated}%`, background: '#dde4ee',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#999', fontWeight: 600,
            }}>
              {unallocated >= 8 ? `${unallocated}% free` : ''}
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {holders.map(h => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: h.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{h.name}</span>
              <span style={{ color: '#888' }}>({h.role})</span>
              <span style={{ fontWeight: 700 }}>{h.percentage}%</span>
            </div>
          ))}
          {unallocated > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#dde4ee', border: '1px solid #ccc', flexShrink: 0 }} />
              <span style={{ color: '#999', fontWeight: 600 }}>Unallocated</span>
              <span style={{ color: '#999' }}>{unallocated}%</span>
            </div>
          )}
        </div>

        {totalPct > 100 && (
          <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 10, fontWeight: 600 }}>
            ⚠️ Total allocation exceeds 100%! Please reduce percentages.
          </p>
        )}
      </Card>

      {/* ── Share Holders Table ── */}
      <Card>
        <CardHeader title={`👥 Share Holders (${holders.length})`}>
          <BtnPrimary onClick={() => setModal({ open: true })}>+ Add Holder</BtnPrimary>
        </CardHeader>

        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Share %</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#888' }}>Loading…</td></tr>
              )}
              {!loading && holders.length === 0 && (
                <Empty colSpan={5} text="No share holders yet. Add your first one!" />
              )}
              {holders.map(h => (
                <tr key={h.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: h.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700 }}>{h.name}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 100,
                      fontSize: 11, fontWeight: 700,
                      background: h.color + '20', color: h.color,
                    }}>
                      {h.role}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, background: '#f0f4f8', borderRadius: 6, height: 8, overflow: 'hidden', minWidth: 60 }}>
                        <div style={{ width: `${Math.min(h.percentage, 100)}%`, height: '100%', background: h.color, borderRadius: 6 }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 14, color: h.color, minWidth: 40 }}>
                        {h.percentage}%
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: '#666', maxWidth: 200 }}>{h.notes || '—'}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <ActionBtn onClick={() => setModal({ open: true, record: h })}>✏️</ActionBtn>
                    <ActionBtn variant="delete" onClick={() => handleDeleteHolder(h.id!)}>🗑️</ActionBtn>
                  </td>
                </tr>
              ))}

              {/* Totals row */}
              {holders.length > 0 && (
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td colSpan={2} style={{ fontSize: 13 }}>Total</td>
                  <td>
                    <span style={{ fontSize: 14, fontWeight: 800, color: totalPct === 100 ? 'var(--green)' : 'var(--red)' }}>
                      {totalPct}%
                    </span>
                  </td>
                  <td colSpan={2} style={{ fontSize: 11, color: '#888' }}>
                    {totalPct === 100
                      ? '✅ Shares balanced perfectly'
                      : totalPct > 100
                        ? `⚠️ Over by ${totalPct - 100}%`
                        : `ℹ️ ${100 - totalPct}% unallocated`
                    }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {/* ── Distribution History ── */}
      <Card>
        <CardHeader title={`📅 Distribution History (${distributions.length})`}>
          <BtnGold
            onClick={() => setDistModal(true)}
            disabled={holders.length === 0}
          >
            💰 Record Month
          </BtnGold>
        </CardHeader>

        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Total Profit</th>
                <th>Breakdown</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {distributions.length === 0 && (
                <Empty colSpan={5} text="No distribution records yet. Record your first month!" />
              )}
              {distributions.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{d.month}</td>
                  <td style={{ fontWeight: 700, color: 'var(--green)' }}>{currency(d.totalProfit)}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {d.shares.map(s => (
                        <div key={s.holderId} style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ color: '#888' }}>{s.holderName}:</span>
                          <span style={{ fontWeight: 600 }}>{currency(s.amount)}</span>
                          <span style={{ color: '#aaa' }}>({s.percentage}%)</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: '#666', maxWidth: 180 }}>{d.notes || '—'}</td>
                  <td>
                    <ActionBtn variant="delete" onClick={() => handleDeleteDist(d.id!)}>🗑️</ActionBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {/* ── Modals ── */}
      {modal.open && (
        <HolderModal
          initial={modal.record}
          onSave={handleSaveHolder}
          onClose={() => setModal({ open: false })}
        />
      )}
      {distModal && (
        <DistributionModal
          holders={holders}
          onSave={handleSaveDist}
          onClose={() => setDistModal(false)}
        />
      )}
    </AppShell>
  );
}

