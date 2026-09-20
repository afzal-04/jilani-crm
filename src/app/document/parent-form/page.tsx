'use client';
// src/app/documents/parent-form/page.tsx
//
// Recreates the JHT Parent Enrollment Form template as a live CRM page.
// Search by phone autofills whatever is available from Firestore (parents +
// classes); everything else stays manually editable. Print via the button
// at the bottom, same as the original static HTML file.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, canAccess } from '@/context/AuthContext';
import { getParents, getAssignments, Parent, Assignment } from '@/lib/firestore';

// ── Date field: types DD/MM/YYYY as you go, or pick from calendar icon ──────

function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function handleType(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
    let out = v;
    if (v.length > 4) out = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4);
    else if (v.length > 2) out = v.slice(0, 2) + '/' + v.slice(2);
    onChange(out);
  }
  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return;
    const [yyyy, mm, dd] = e.target.value.split('-');
    onChange(`${dd}/${mm}/${yyyy}`);
  }
  return (
    <span className="date-wrap">
      <input type="text" placeholder="DD/MM/YYYY" maxLength={10} className="date-fld" value={value} onChange={handleType} />
      <input type="date" className="date-pick" tabIndex={-1} onChange={handlePick} />
    </span>
  );
}

function todayDMY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function isoToDMY(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : '';
}

const FORM_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Open+Sans:wght@400;600&display=swap');
  .jht-form * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .jht-form-wrap {
    --teal: #1B5FA8; --teal-dark: #0E3A6B; --teal-light: #E2EBF7;
    --gold: #C8960A; --gold-light: #FEF8E7; --gold-border:#D4A017;
    --text-dark: #1A2A2A; --line: #B0C4DC; --white: #FFFFFF; --bg: #F4F7FB;
    font-family: 'Open Sans', sans-serif;
    background: #d0dada; display: flex; flex-direction: column; align-items: center; padding: 20px 16px;
  }
  .jht-form {
    width: 794px;
    min-height: 1123px;
    background: var(--white);
    box-shadow: 0 4px 32px rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .jht-form .header { background: var(--teal-dark) !important; padding: 16px 22px 14px; display: flex; align-items: center; gap: 16px; }
  .jht-form .logo-circle { width: 68px; height: 68px; border-radius: 50%; background: #fff !important; border: 3px solid var(--gold-border); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
  .jht-form .logo-circle img { width: 86%; height: 86%; object-fit: contain; }
  .jht-form .header-center { flex: 1; }
  .jht-form .header-center h1 { font-family: 'Montserrat', sans-serif; font-size: 28px; font-weight: 800; letter-spacing: 1px; line-height: 1; }
  .jht-form .header-center h1 .w { color: #fff; }
  .jht-form .header-center h1 .g { color: var(--gold); }
  .jht-form .header-center .tagline { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 600; color: #9DB8DC; letter-spacing: 3px; margin-top: 4px; }
  .jht-form .header-center .contact { font-size: 11px; color: #9DB8DC; margin-top: 6px; }
  .jht-form .header-center .contact span { color: var(--gold); }
  .jht-form .msme-box { border: 1.5px solid var(--gold-border); padding: 6px 10px; text-align: center; border-radius: 3px; }
  .jht-form .msme-box .ml { font-size: 8px; color: #9DB8DC; letter-spacing: 2px; font-family:'Montserrat',sans-serif; font-weight:600; }
  .jht-form .msme-box .mn { font-size: 9.5px; color: var(--gold); font-weight:700; font-family:'Montserrat',sans-serif; margin-top:3px; }
  .jht-form .gold-banner { background: var(--gold-light) !important; border-top: 2px solid var(--gold-border); border-bottom: 2px solid var(--gold-border); text-align: center; padding: 3px; font-family: 'Montserrat', sans-serif; font-size: 8.5px; font-weight: 700; color: var(--gold); letter-spacing: 4px; }
  .jht-form .form-title-bar { background: var(--teal) !important; text-align: center; padding: 5px; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: #fff; letter-spacing: 2px; }
  .jht-form .form-body { padding: 8px 20px 0; background: var(--bg) !important; flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
  .jht-form .enroll-row { display: flex; gap: 10px; margin-bottom: 6px; }
  .jht-form .enroll-box { flex: 1; border: 1.5px solid var(--teal); padding: 4px 10px; display: flex; align-items: center; gap: 8px; background: #fff !important; }
  .jht-form .enroll-box label { font-size: 9px; font-weight: 700; color: var(--teal); font-family: 'Montserrat', sans-serif; letter-spacing: 1px; white-space: nowrap; }
  .jht-form .enroll-box input { flex: 1; border: none; border-bottom: 1px solid var(--line); outline: none; font-size: 11px; color: var(--text-dark); font-family: 'Open Sans', sans-serif; background: transparent; padding: 1px 0; }
  .jht-form .section { margin-bottom: 5px; }
  .jht-form .sec-head { display: flex; align-items: center; gap: 8px; border-bottom: 1.5px solid var(--teal); padding-bottom: 3px; margin-bottom: 6px; }
  .jht-form .sec-icon { width: 20px; height: 20px; border-radius: 50%; background: var(--teal) !important; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; }
  .jht-form .sec-head h2 { font-family: 'Montserrat', sans-serif; font-size: 9.5px; font-weight: 700; color: var(--teal-dark); letter-spacing: 2px; }
  .jht-form .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
  .jht-form .span2 { grid-column: 1 / -1; }
  .jht-form .frow { display: flex; background: #fff !important; border: 1px solid var(--line); }
  .jht-form .flabel { background: var(--teal-light) !important; padding: 4px 8px; font-size: 8.5px; font-weight: 700; color: var(--teal-dark); font-family: 'Montserrat', sans-serif; min-width: 118px; max-width: 118px; border-right: 1px solid var(--line); display: flex; align-items: center; flex-shrink: 0; letter-spacing: 0.3px; }
  .jht-form .finput { flex: 1; padding: 4px 8px; }
  .jht-form .finput input, .jht-form .finput select { width: 100%; border: none; outline: none; font-size: 10.5px; color: var(--text-dark); font-family: 'Open Sans', sans-serif; background: transparent; }
  .jht-form .finput.fixed { font-size: 10.5px; color: var(--teal-dark); font-weight: 700; display: flex; align-items: center; }
  .jht-form .date-wrap { position: relative; display: flex; align-items: center; width: 100%; }
  .jht-form .date-wrap .date-fld { flex: 1; padding-right: 20px; }
  .jht-form .date-wrap .date-pick { position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; opacity: 0; cursor: pointer; padding: 0; margin: 0; border: none; }
  .jht-form .date-wrap::after { content: "📅"; position: absolute; right: 1px; top: 50%; transform: translateY(-50%); font-size: 10px; pointer-events: none; opacity: 0.7; }
  .jht-form .terms-box { background: var(--gold-light) !important; border: 1.5px solid var(--gold-border); padding: 5px 12px; margin-bottom: 6px; }
  .jht-form .terms-box li { font-size: 9px; color: var(--text-dark); padding: 1.5px 0; display: flex; gap: 6px; list-style: none; border-bottom: 1px dashed #E0C870; }
  .jht-form .terms-box li:last-child { border-bottom: none; }
  .jht-form .terms-box li .n { color: var(--gold); font-weight: 700; font-family:'Montserrat',sans-serif; flex-shrink:0; }
  .jht-form .decl-box { background: var(--teal-light) !important; border: 1.5px solid var(--teal); padding: 5px 12px; margin-bottom: 6px; font-size: 9px; color: var(--text-dark); line-height: 1.45; }
  .jht-form .sig-row { display: flex; justify-content: space-between; gap: 30px; padding-bottom: 4px; }
  .jht-form .sig-block { flex: 1; }
  .jht-form .sig-title { font-family: 'Montserrat', sans-serif; font-size: 8px; font-weight: 700; color: var(--teal-dark); letter-spacing: 2px; border-bottom: 1.5px solid var(--teal); padding-bottom: 3px; margin-bottom: 6px; }
  .jht-form .sig-box-space { border: 1px dashed var(--line); height: 34px; margin-bottom: 5px; background: #fff !important; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #aabbbb; font-style: italic; overflow: hidden; }
  .jht-form .sig-box-space img { max-height: 38px; max-width: 90%; object-fit: contain; }
  .jht-form .sig-line { font-size: 10px; display: flex; align-items: flex-end; gap: 6px; margin-bottom: 5px; }
  .jht-form .sig-line span { font-weight: 600; white-space: nowrap; color: var(--text-dark); }
  .jht-form .sig-line input { flex: 1; border: none; border-bottom: 1px solid var(--line); outline: none; font-size: 10.5px; font-family: 'Open Sans', sans-serif; background: transparent; padding: 1px 2px; color: var(--text-dark); }
  .jht-form .footer { background: var(--teal-dark) !important; padding: 14px 22px; display: flex; justify-content: space-between; align-items: center; border-top: 4px solid var(--gold-border); }
  .jht-form .footer-left { font-size: 10.5px; color: #A8C8EC; line-height: 1.6; }
  .jht-form .footer-left strong { color: var(--gold); font-size: 13px; display: block; margin-bottom: 2px; }
  .jht-form .footer-right { text-align: right; font-family: 'Montserrat', sans-serif; }
  .jht-form .footer-right .tb { font-size: 14px; font-weight: 800; color: #fff; letter-spacing: 1.5px; }
  .jht-form .footer-right .tb .g { color: var(--gold); }
  .jht-form .footer-right .ud { font-size: 9px; color: #A8C8EC; margin-top: 4px; letter-spacing: 1px; }
  .jht-print-btn { display: block; margin: 18px auto 8px; padding: 11px 36px; background: var(--teal-dark); color: #fff; border: none; border-bottom: 3px solid var(--gold-border); font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px; cursor: pointer; border-radius: 4px; }
  
  /* ── PRINT MEDIA OPTIMIZATION (FULL A4 PAGE FILL) ── */
  @media print {
    .jht-search-bar, .jht-print-btn, .jht-hint { display: none !important; }
    html, body { background: none !important; margin: 0 !important; padding: 0 !important; height: 100% !important; }
    .jht-form-wrap { background: none !important; padding: 0 !important; height: 100% !important; }
    .jht-form {
      box-shadow: none !important;
      width: 100% !important;
      height: 297mm !important;
      max-height: 297mm !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .jht-form .header { padding: 13px 22px 11px !important; }
    .jht-form .form-body {
      padding: 6px 20px 0 !important;
      flex: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
    }
    .jht-form .date-wrap .date-pick, .jht-form .date-wrap::after { display: none !important; }
    .jht-form .date-wrap .date-fld { padding-right: 8px !important; }
    .jht-form .section { margin-bottom: 4px !important; }
    .jht-form .sec-head { padding-bottom: 2px !important; margin-bottom: 4px !important; }
    .jht-form .frow { padding: 0 !important; }
    .jht-form .flabel { padding: 3px 8px !important; }
    .jht-form .finput { padding: 3px 8px !important; }
    .jht-form .terms-box { padding: 4px 12px !important; margin-bottom: 4px !important; }
    .jht-form .terms-box li { padding: 1px 0 !important; font-size: 8.5px !important; line-height: 1.3 !important; }
    .jht-form .decl-box { padding: 4px 12px !important; margin-bottom: 4px !important; font-size: 8.5px !important; line-height: 1.35 !important; }
    .jht-form .sig-row { padding-bottom: 2px !important; gap: 24px !important; }
    .jht-form .sig-box-space { height: 32px !important; margin-bottom: 3px !important; }
    .jht-form .sig-box-space img { max-height: 30px !important; }
    .jht-form .footer { padding: 10px 22px !important; }
    .jht-form, .section, .frow, .grid, .sig-row, .enroll-row, .terms-box, .decl-box { break-inside: avoid !important; page-break-inside: avoid !important; }
    @page { margin: 0; size: A4 portrait; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  }
`;

const EMPTY_FORM = {
  enrollmentId: '', date: todayDMY(),
  studentName: '', classLevel: '', board: '', subjects: '',
  parentName: '', mobile: '', area: '', note: '',
  tutorName: '', demoDate: '', startDate: '', timing: '',
  monthlyFee: '', registrationCharge: '₹ 1,000', advancePaid: '', dueDate: '', paymentMode: '',
  sigParentName: '', sigParentDate: '', sigJhtDate: todayDMY(),
};

export default function ParentEnrollmentFormPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [searchPhone, setSearchPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [matches, setMatches] = useState<{ parent: Parent; assignment?: Assignment }[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    if (!canAccess(role, '/document/parent-form')) router.push('/dashboard');
  }, [user, role, loading, router]);

  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSearch() {
    const phone = searchPhone.trim();
    if (!phone) return;
    setSearching(true); setSearchError(''); setMatches([]);
    try {
      const [parents, assignments] = await Promise.all([getParents(), getAssignments()]);
      const matchingParents = parents.filter(p => p.phone === phone);
      if (matchingParents.length === 0) {
        setSearchError('No parent found with that phone number in the CRM.');
        setSearching(false);
        return;
      }
      const activeAssignments = assignments.filter(a => a.parentPhone === phone && a.status === 'active');
      let resolvedMatches: { parent: Parent; assignment?: Assignment }[];
      if (activeAssignments.length === 0) {
        resolvedMatches = matchingParents.map(p => ({ parent: p }));
      } else {
        resolvedMatches = activeAssignments.map(a => ({ parent: matchingParents[0], assignment: a }));
      }
      setMatches(resolvedMatches);
      if (resolvedMatches.length === 1) applyMatch(resolvedMatches[0]); // only one option — fill it in right away
    } catch (err) {
      console.error(err);
      setSearchError('Something went wrong searching the CRM.');
    }
    setSearching(false);
  }

  function applyMatch(m: { parent: Parent; assignment?: Assignment }) {
    const { parent: p, assignment: a } = m;
    setForm(prev => ({
      ...prev,
      enrollmentId: prev.enrollmentId || `JHT-${new Date().getFullYear()}-${(p.id || '').slice(-4).toUpperCase()}`,
      studentName: a?.parentName || p.studentName || p.name || '',
      classLevel: a?.classLevel || '',
      board: p.board || '',
      subjects: a?.subject || p.subject || '',
      parentName: p.name || '',
      mobile: p.phone || searchPhone,
      area: p.area || p.address || '',
      note: p.specialNote || '',
      tutorName: a?.tutorName || '',
      startDate: a?.startDate ? isoToDMY(a.startDate) : prev.startDate,
      timing: (a as any)?.timeSlot || p.timeSlot || '',
      monthlyFee: a?.monthlyFeeParent ? `₹ ${a.monthlyFeeParent.toLocaleString('en-IN')}` : prev.monthlyFee,
      sigParentName: p.name || prev.sigParentName,
    }));
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM, date: todayDMY(), sigJhtDate: todayDMY() });
    setMatches([]); setSearchPhone(''); setSearchError('');
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f4f7fb', fontFamily: 'sans-serif' }}>
        <div style={{ color: '#1B5FA8', fontWeight: 600, fontSize: 14 }}>Loading Parent Registration Form…</div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FORM_CSS }} />

      {/* Back navigation header — hidden when printing */}
      <div className="jht-search-bar" style={{ maxWidth: 794, margin: '16px auto 0', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px', marginBottom: 6 }}>
          <button
            onClick={() => router.push('/parents')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#1f2937', fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            ← Back to Parents
          </button>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, letterSpacing: '0.5px' }}>
            PARENT REGISTRATION FORM
          </span>
        </div>
      </div>

      {/* Search bar — hidden when printing */}
      <div className="jht-search-bar" style={{ maxWidth: 794, margin: '8px auto 0', padding: '0 16px' }}>
        <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🔍 Autofill from CRM</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="tel"
              value={searchPhone}
              onChange={e => setSearchPhone(e.target.value)}
              placeholder="Enter parent's phone number"
              style={{ flex: 1, minWidth: 200, padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13.5 }}
            />
            <button onClick={handleSearch} disabled={searching} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#1B5FA8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {searching ? 'Searching…' : 'Search'}
            </button>
            <button onClick={resetForm} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Clear Form
            </button>
          </div>
          {searchError && <p style={{ color: '#C0392B', fontSize: 12.5, marginTop: 8 }}>{searchError}</p>}
          {matches.length > 1 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>This family has multiple enrollments — pick one to prefill:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {matches.map((m, i) => (
                  <button key={i} onClick={() => applyMatch(m)} style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fafbfc', cursor: 'pointer', fontSize: 12.5 }}>
                    {m.assignment ? `${m.assignment.parentName} — ${m.assignment.subject} (${m.assignment.classLevel}) with ${m.assignment.tutorName}` : `${m.parent.name} — no active class yet`}
                  </button>
                ))}
              </div>
            </div>
          )}
          {matches.length === 1 && (
            <p style={{ fontSize: 12, color: '#166534', marginTop: 8 }}>
              ✅ Found — fields below have been prefilled.{' '}
              <button onClick={() => applyMatch(matches[0])} style={{ color: '#1B5FA8', fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>Reapply</button>
            </p>
          )}
        </div>
      </div>

      <div className="jht-form-wrap">
        <div className="jht-form">
          {/* HEADER */}
          <div className="header">
            <div className="logo-circle"><img src="/jht-logo.png" alt="JHT Logo" /></div>
            <div className="header-center">
              <h1><span className="w">JILANI </span><span className="g">HOME TUTOR</span></h1>
              <div className="tagline">— RIGHT TUTOR &nbsp;•&nbsp; BRIGHT FUTURE —</div>
              <div className="contact">
                📞 <span>+91 79998 54628</span> &nbsp;|&nbsp;
                ✉ <span>jilanihometutor6@gmail.com</span> &nbsp;|&nbsp;
                Raipur, Chhattisgarh
              </div>
            </div>
            <div className="msme-box">
              <div className="ml">MSME REGISTERED</div>
              <div className="mn">UDYAM-CG-14-0143271</div>
            </div>
          </div>

          <div className="gold-banner">✦ &nbsp; QUALITY EDUCATION AT YOUR DOORSTEP &nbsp; ✦</div>
          <div className="form-title-bar">PARENT SERVICE AGREEMENT &amp; TUITION ENROLLMENT FORM</div>

          <div className="form-body">
            {/* Enrollment row */}
            <div className="enroll-row">
              <div className="enroll-box">
                <label>ENROLLMENT ID</label>
                <input value={form.enrollmentId} onChange={e => set('enrollmentId', e.target.value)} placeholder="JHT-2025-____" />
              </div>
              <div className="enroll-box">
                <label>DATE</label>
                <DateField value={form.date} onChange={v => set('date', v)} />
              </div>
            </div>

            {/* 1. STUDENT */}
            <div className="section">
              <div className="sec-head"><div className="sec-icon" style={{ fontSize: 9 }}>🎓</div><h2>1. &nbsp; STUDENT INFORMATION</h2></div>
              <div className="grid">
                <div className="frow"><div className="flabel">Student Name</div><div className="finput"><input value={form.studentName} onChange={e => set('studentName', e.target.value)} placeholder="Full name of student" /></div></div>
                <div className="frow"><div className="flabel">Class / Standard</div><div className="finput"><input value={form.classLevel} onChange={e => set('classLevel', e.target.value)} placeholder="e.g. Class 5, UKG, JEE Prep" /></div></div>
                <div className="frow"><div className="flabel">Board</div><div className="finput">
                  <select value={form.board} onChange={e => set('board', e.target.value)}>
                    <option value="">Select Board</option><option>CBSE</option><option>CGBSE (State)</option><option>ICSE</option><option>Other</option>
                  </select></div></div>
                <div className="frow"><div className="flabel">Subjects Required</div><div className="finput"><input value={form.subjects} onChange={e => set('subjects', e.target.value)} placeholder="e.g. Maths, Science, English" /></div></div>
              </div>
            </div>

            {/* 2. PARENT */}
            <div className="section">
              <div className="sec-head"><div className="sec-icon" style={{ fontSize: 9 }}>👨‍👩‍👦</div><h2>2. &nbsp; PARENT / GUARDIAN INFORMATION</h2></div>
              <div className="grid">
                <div className="frow"><div className="flabel">Parent / Guardian Name</div><div className="finput"><input value={form.parentName} onChange={e => set('parentName', e.target.value)} placeholder="Full name" /></div></div>
                <div className="frow"><div className="flabel">Mobile Number</div><div className="finput"><input value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+91 _____  _____" /></div></div>
                <div className="frow span2"><div className="flabel">Area / Address</div><div className="finput"><input value={form.area} onChange={e => set('area', e.target.value)} placeholder="Locality, Area — Raipur, Chhattisgarh" /></div></div>
                <div className="frow span2"><div className="flabel">Note</div><div className="finput"><input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Any special instruction or remark (optional)" /></div></div>
              </div>
            </div>

            {/* 3. TUTOR */}
            <div className="section">
              <div className="sec-head"><div className="sec-icon">📋</div><h2>3. &nbsp; TUTOR ASSIGNMENT DETAILS</h2></div>
              <div className="grid">
                <div className="frow"><div className="flabel">Assigned Tutor Name</div><div className="finput"><input value={form.tutorName} onChange={e => set('tutorName', e.target.value)} placeholder="Tutor's full name" /></div></div>
                <div className="frow"><div className="flabel">Demo Class Date</div><div className="finput"><DateField value={form.demoDate} onChange={v => set('demoDate', v)} /></div></div>
                <div className="frow"><div className="flabel">Tuition Start Date</div><div className="finput"><DateField value={form.startDate} onChange={v => set('startDate', v)} /></div></div>
                <div className="frow"><div className="flabel">Class Timing</div><div className="finput"><input value={form.timing} onChange={e => set('timing', e.target.value)} placeholder="e.g. Mon–Fri  5:00–6:00 PM" /></div></div>
              </div>
            </div>

            {/* 4. FEES */}
            <div className="section">
              <div className="sec-head"><div className="sec-icon">💰</div><h2>4. &nbsp; FEE DETAILS</h2></div>
              <div className="grid">
                <div className="frow"><div className="flabel">Monthly Tuition Fees</div><div className="finput"><input value={form.monthlyFee} onChange={e => set('monthlyFee', e.target.value)} placeholder="₹ ____" /></div></div>
                <div className="frow"><div className="flabel">Registration Charges</div><div className="finput"><input value={form.registrationCharge} onChange={e => set('registrationCharge', e.target.value)} placeholder="₹ 1,000 /-" /></div></div>
                <div className="frow"><div className="flabel">Advance Paid</div><div className="finput"><input value={form.advancePaid} onChange={e => set('advancePaid', e.target.value)} placeholder="₹ ____" /></div></div>
                <div className="frow"><div className="flabel">Payment Due Date</div><div className="finput"><input value={form.dueDate} onChange={e => set('dueDate', e.target.value)} placeholder="e.g. 5th of every month" /></div></div>
                <div className="frow span2"><div className="flabel">Payment Mode</div><div className="finput">
                  <select value={form.paymentMode} onChange={e => set('paymentMode', e.target.value)}>
                    <option value="">Select Mode</option><option>Cash</option><option>UPI / GPay</option><option>PhonePe</option><option>Bank Transfer</option><option>Paytm</option>
                  </select></div></div>
              </div>
            </div>

            {/* 5. TERMS */}
            <div className="section">
              <div className="sec-head"><div className="sec-icon">📜</div><h2>5. &nbsp; TERMS &amp; CONDITIONS</h2></div>
              <div className="terms-box">
                <ol style={{ listStyle: 'none' }}>
                  <li><span className="n">1.</span> Tuition fees must be cleared within 5 days of the due date to ensure uninterrupted service.</li>
                  <li><span className="n">2.</span> Registration charges and service fees are strictly non-refundable once tutor allocation is completed.</li>
                  <li><span className="n">3.</span> Parents must inform the organisation at least 24 hours in advance for any class cancellation or timing change.</li>
                  <li><span className="n">4.</span> Tutor replacement assistance may be provided by the organisation if genuinely required.</li>
                  <li><span className="n">5.</span> Parents are not permitted to directly discuss or interfere in the tutor's salary, fees, or personal information.</li>
                  <li><span className="n">6.</span> Jilani Home Tutor Services acts solely as a service provider connecting parents and tutors for educational purposes.</li>
                  <li><span className="n">7.</span> Any dispute or concern must be reported to the Jilani Home Tutor team and will be resolved within 48 hours.</li>
                </ol>
              </div>
            </div>

            {/* 6. DECLARATION */}
            <div className="section">
              <div className="sec-head"><div className="sec-icon">✅</div><h2>6. &nbsp; DECLARATION</h2></div>
              <div className="decl-box">
                I/We hereby confirm that all information provided above is accurate and complete. I/We have read, understood, and agree to abide by all the terms and conditions mentioned in this agreement. I/We understand that this agreement is binding upon signing.
              </div>
            </div>

            {/* SIGNATURES */}
            <div className="sig-row">
              <div className="sig-block">
                <div className="sig-title">PARENT / GUARDIAN SIGNATURE</div>
                <div className="sig-box-space">(sign here)</div>
                <div className="sig-line"><span>Name:</span><input value={form.sigParentName} onChange={e => set('sigParentName', e.target.value)} placeholder="________________________" /></div>
                <div className="sig-line"><span>Date:</span><DateField value={form.sigParentDate} onChange={v => set('sigParentDate', v)} /></div>
              </div>
              <div className="sig-block">
                <div className="sig-title">AUTHORISED SIGNATORY — JHT</div>
                <div className="sig-box-space"><img src="/jht-signature.png" alt="Authorised Signature" /></div>
                <div className="sig-line"><span>Name:</span><input defaultValue="Aashiya" readOnly /></div>
                <div className="sig-line"><span>Date:</span><DateField value={form.sigJhtDate} onChange={v => set('sigJhtDate', v)} /></div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="footer">
            <div className="footer-left">
              <strong>Jilani Home Tutor Services</strong><br />
              Raipur, Chhattisgarh &nbsp;|&nbsp; 📞 +91 79998 54628 &nbsp;|&nbsp; jilanihometutor6@gmail.com
            </div>
            <div className="footer-right">
              <div className="tb">RIGHT TUTOR &nbsp;<span className="g">BRIGHT FUTURE</span></div>
              <div className="ud">UDYAM-CG-14-0143271</div>
            </div>
          </div>
        </div>
      </div>

      <button className="jht-print-btn" onClick={() => window.print()}>🖨️ &nbsp; PRINT / SAVE AS PDF</button>
      <p className="jht-hint" style={{ textAlign: 'center', fontSize: 10.5, color: '#556', marginBottom: 24 }}>
        Click above → <strong>Ctrl+P</strong> → Destination: <strong>"Save as PDF"</strong><br />
        ✅ &nbsp; Margins: <strong>None</strong> &nbsp;|&nbsp; Scale: <strong>100%</strong> &nbsp;|&nbsp; Paper: <strong>A4</strong><br />
        ⚠️ &nbsp; <strong>Turn on "Background graphics" in print settings</strong>
      </p>
    </>
  );
}