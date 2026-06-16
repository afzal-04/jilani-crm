'use client';
// src/components/ExportButton.tsx
import { useState } from 'react';

interface Props {
  label?: string;
  onExport: () => void;
}

export default function ExportButton({ label = 'Export Excel', onExport }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try { onExport(); }
    finally { setTimeout(() => setLoading(false), 800); }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '9px 16px', borderRadius: 8,
        border: '1.5px solid #1a7a4a',
        background: loading ? '#f0fdf4' : '#fff',
        color: '#1a7a4a', cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
        transition: 'all .15s', whiteSpace: 'nowrap',
      }}
    >
      {loading ? '⏳' : '📥'} {loading ? 'Exporting…' : label}
    </button>
  );
}
