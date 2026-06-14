'use client';
// src/components/UI.tsx — shared UI primitives used across all CRM pages
import { ReactNode } from 'react';
import styles from './UI.module.css';

// ─── Stat Card ────────────────────────────────────────────────────────────────

export function StatCard({ icon, num, label, sub, color }: { icon: string; num: string | number; label: string; sub: string; color: 'blue'|'gold'|'green'|'red' }) {
  return (
    <div className={`${styles.statCard} ${styles[color]}`}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statNum}>{num}</div>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statSub}>{sub}</div>
    </div>
  );
}

export function StatsRow({ children }: { children: ReactNode }) {
  return <div className={styles.statsRow}>{children}</div>;
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export function Badge({ status }: { status: string }) {
  const key = `badge_${status.replace(/ /g, '_')}`;
  const cls = (styles as any)[key] || '';
  return <span className={`${styles.badge} ${cls}`}>{status.replace(/_/g, ' ')}</span>;
}

// ─── Card / Table wrappers ────────────────────────────────────────────────────

export function Card({ children, pad }: { children: ReactNode; pad?: boolean }) {
  return <div className={`${styles.card} ${pad ? styles.cardPad : ''}`}>{children}</div>;
}

export function CardHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.cardHeader}>
      <h3>{title}</h3>
      {children && <div className={styles.headerActions}>{children}</div>}
    </div>
  );
}

export function FilterRow({ children }: { children: ReactNode }) {
  return <div className={styles.filterRow}>{children}</div>;
}

export function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button className={`${styles.filterBtn} ${active ? styles.filterActive : ''}`} onClick={onClick}>{children}</button>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className={styles.tableOverflow}>{children}</div>;
}

export function Empty({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td colSpan={colSpan} className={styles.empty}>{text}</td></tr>;
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className={styles.searchInput} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || '🔍 Search…'} />;
}

export function PhoneLink({ phone }: { phone: string }) {
  if (!phone) return <span>—</span>;
  return <a href={`tel:${phone}`} className={styles.phoneLink}>{phone}</a>;
}

export function StatusSelect<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <select className={styles.statusSel} value={value} onChange={e => onChange(e.target.value as T)}>
      {options.map(o => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
    </select>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

export function BtnPrimary({ onClick, disabled, children, type }: { onClick?: () => void; disabled?: boolean; children: ReactNode; type?: 'button'|'submit' }) {
  return <button type={type || 'button'} className={styles.btnPrimary} onClick={onClick} disabled={disabled}>{children}</button>;
}
export function BtnGold({ onClick, disabled, children, type }: { onClick?: () => void; disabled?: boolean; children: ReactNode; type?: 'button'|'submit' }) {
  return <button type={type || 'button'} className={styles.btnGold} onClick={onClick} disabled={disabled}>{children}</button>;
}
export function BtnSecondary({ onClick, children, type }: { onClick?: () => void; children: ReactNode; type?: 'button'|'submit' }) {
  return <button type={type || 'button'} className={styles.btnSecondary} onClick={onClick}>{children}</button>;
}
export function ActionBtn({ onClick, children, variant }: { onClick: () => void; children: ReactNode; variant?: 'edit'|'delete'|'green' }) {
  const cls = variant === 'delete' ? styles.actionBtnDel : variant === 'green' ? styles.actionBtnGreen : styles.actionBtn;
  return <button className={cls} onClick={onClick}>{children}</button>;
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export function AlertBox({ children }: { children: ReactNode }) {
  return <div className={styles.alertBox}>{children}</div>;
}
export function AlertLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button className={styles.alertLink} onClick={onClick}>{children}</button>;
}

// ─── Finance Strip ────────────────────────────────────────────────────────────

export function FinanceStrip({ children }: { children: ReactNode }) {
  return <div className={styles.financeStrip}>{children}</div>;
}
export function FinItem({ label, value, positive, sub }: { label: string; value: string; positive?: boolean; sub?: string }) {
  return (
    <div className={styles.finItem}>
      <span>{label}</span>
      <strong style={{ color: positive === undefined ? undefined : positive ? 'var(--green)' : 'var(--red)' }}>{value}</strong>
      {sub && <small style={{ color: '#aaa', fontSize: 11 }}>{sub}</small>}
    </div>
  );
}
export function FinDivider() {
  return <div className={styles.finDivider} />;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{title}</h3>
          <button onClick={onClose} className={styles.modalClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function ModalForm({ onSubmit, children }: { onSubmit: (e: React.FormEvent) => void; children: ReactNode }) {
  return <form onSubmit={onSubmit} className={styles.modalForm}>{children}</form>;
}
export function FormRow({ children }: { children: ReactNode }) {
  return <div className={styles.formRow}>{children}</div>;
}
export function FormGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div className={styles.formGroup}><label>{label}</label>{children}</div>;
}
export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className={styles.modalFooter}>{children}</div>;
}
export function ProfitBox({ profit }: { profit: number }) {
  return (
    <div className={`${styles.profitBox} ${profit >= 0 ? styles.profitPos : styles.profitNeg}`}>
      <span>Profit:</span><strong>{currency(profit)}</strong>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const currency = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');
export const fmtDate = (item: { createdAt?: { seconds: number } }) =>
  item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('en-IN') : '—';
export const today = () => new Date().toISOString().split('T')[0];
