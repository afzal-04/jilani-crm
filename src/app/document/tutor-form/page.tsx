'use client';
// src/app/document/tutor-form/page.tsx
//
// JHT Tutor Registration & Onboarding Form.
// Autofills tutor details from CRM via phone search.
// Live editable form with full-page A4 print optimization.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, canAccess } from '@/context/AuthContext';
import { getTutors, Tutor } from '@/lib/firestore';

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

const FORM_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Open+Sans:wght@400;600;700&display=swap');
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
  .jht-form .header { background: var(--teal-dark) !important; padding: 16px 24px 14px; display: flex; align-items: center; gap: 16px; }
  .jht-form .logo-circle { width: 70px; height: 70px; border-radius: 50%; background: #fff !important; border: 3px solid var(--gold-border); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
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
  
  .jht-form .gold-banner { background: var(--gold-light) !important; border-top: 2px solid var(--gold-border); border-bottom: 2px solid var(--gold-border); text-align: center; padding: 4px; font-family: 'Montserrat', sans-serif; font-size: 8.5px; font-weight: 700; color: var(--gold); letter-spacing: 4px; }
  .jht-form .form-title-bar { background: var(--teal) !important; text-align: center; padding: 6px; font-family: 'Montserrat', sans-serif; font-size: 11.5px; font-weight: 700; color: #fff; letter-spacing: 2px; }
  
  .jht-form .form-body { padding: 10px 22px 0; background: var(--bg) !important; flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
  .jht-form .enroll-row { display: flex; gap: 10px; margin-bottom: 6px; }
  .jht-form .enroll-box { flex: 1; border: 1.5px solid var(--teal); padding: 5px 12px; display: flex; align-items: center; gap: 8px; background: #fff !important; }
  .jht-form .enroll-box label { font-size: 9.5px; font-weight: 700; color: var(--teal); font-family: 'Montserrat', sans-serif; letter-spacing: 1px; white-space: nowrap; }
  .jht-form .enroll-box input { flex: 1; border: none; border-bottom: 1px solid var(--line); outline: none; font-size: 11px; color: var(--text-dark); font-family: 'Open Sans', sans-serif; background: transparent; padding: 1px 0; }
  
  .jht-form .section { margin-bottom: 6px; }
  .jht-form .sec-head { display: flex; align-items: center; gap: 8px; border-bottom: 1.5px solid var(--teal); padding-bottom: 3px; margin-bottom: 6px; }
  .jht-form .sec-icon { width: 22px; height: 22px; border-radius: 50%; background: var(--teal) !important; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
  .jht-form .sec-head h2 { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; color: var(--teal-dark); letter-spacing: 2px; }
  
  .jht-form .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .jht-form .span2 { grid-column: 1 / -1; }
  .jht-form .frow { display: flex; background: #fff !important; border: 1px solid var(--line); }
  .jht-form .flabel { background: var(--teal-light) !important; padding: 5px 10px; font-size: 9px; font-weight: 700; color: var(--teal-dark); font-family: 'Montserrat', sans-serif; min-width: 125px; max-width: 125px; border-right: 1px solid var(--line); display: flex; align-items: center; flex-shrink: 0; letter-spacing: 0.3px; }
  .jht-form .finput { flex: 1; padding: 5px 10px; display: flex; align-items: center; }
  .jht-form .finput input, .jht-form .finput select { width: 100%; border: none; outline: none; font-size: 11px; color: var(--text-dark); font-family: 'Open Sans', sans-serif; background: transparent; }
  .jht-form .finput.fixed { font-size: 11px; color: var(--teal-dark); font-weight: 700; }
  
  .jht-form .date-wrap { position: relative; display: flex; align-items: center; width: 100%; }
  .jht-form .date-wrap .date-fld { flex: 1; padding-right: 22px; }
  .jht-form .date-wrap .date-pick { position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; opacity: 0; cursor: pointer; padding: 0; margin: 0; border: none; }
  .jht-form .date-wrap::after { content: "📅"; position: absolute; right: 2px; top: 50%; transform: translateY(-50%); font-size: 11px; pointer-events: none; opacity: 0.75; }
  
  .jht-form .terms-box { background: var(--gold-light) !important; border: 1.5px solid var(--gold-border); padding: 7px 14px; margin-bottom: 6px; }
  .jht-form .terms-box li { font-size: 9.5px; color: var(--text-dark); padding: 2px 0; display: flex; gap: 7px; list-style: none; border-bottom: 1px dashed #E0C870; line-height: 1.35; }
  .jht-form .terms-box li:last-child { border-bottom: none; }
  .jht-form .terms-box li .n { color: var(--gold); font-weight: 700; font-family:'Montserrat',sans-serif; flex-shrink:0; }
  
  .jht-form .decl-box { background: var(--teal-light) !important; border: 1.5px solid var(--teal); padding: 7px 14px; margin-bottom: 6px; font-size: 9.5px; color: var(--text-dark); line-height: 1.45; }
  
  .jht-form .sig-row { display: flex; justify-content: space-between; gap: 36px; padding-bottom: 4px; }
  .jht-form .sig-block { flex: 1; }
  .jht-form .sig-title { font-family: 'Montserrat', sans-serif; font-size: 8.5px; font-weight: 700; color: var(--teal-dark); letter-spacing: 2px; border-bottom: 1.5px solid var(--teal); padding-bottom: 3px; margin-bottom: 6px; }
  .jht-form .sig-box-space { border: 1px dashed var(--line); height: 42px; margin-bottom: 5px; background: #fff !important; display: flex; align-items: center; justify-content: center; font-size: 8.5px; color: #aabbbb; font-style: italic; overflow: hidden; }
  .jht-form .sig-box-space img { max-height: 40px; max-width: 90%; object-fit: contain; }
  .jht-form .sig-line { font-size: 10px; display: flex; align-items: flex-end; gap: 6px; margin-bottom: 5px; }
  .jht-form .sig-line span { font-weight: 600; white-space: nowrap; color: var(--text-dark); }
  .jht-form .sig-line input { flex: 1; border: none; border-bottom: 1px solid var(--line); outline: none; font-size: 10.5px; font-family: 'Open Sans', sans-serif; background: transparent; padding: 1px 2px; color: var(--text-dark); }
  
  .jht-form .footer { background: var(--teal-dark) !important; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; border-top: 4px solid var(--gold-border); }
  .jht-form .footer-left { font-size: 10.5px; color: #A8C8EC; line-height: 1.6; }
  .jht-form .footer-left strong { color: var(--gold); font-size: 13px; display: block; margin-bottom: 2px; }
  .jht-form .footer-right { text-align: right; font-family: 'Montserrat', sans-serif; }
  .jht-form .footer-right .tb { font-size: 14px; font-weight: 800; color: #fff; letter-spacing: 1.5px; }
  .jht-form .footer-right .tb .g { color: var(--gold); }
  .jht-form .footer-right .ud { font-size: 9px; color: #A8C8EC; margin-top: 4px; letter-spacing: 1px; }
  
  .jht-print-btn { display: block; margin: 18px auto 8px; padding: 11px 36px; background: var(--teal-dark); color: #fff; border: none; border-bottom: 3px solid var(--gold-border); font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px; cursor: pointer; border-radius: 4px; transition: background 0.2s; }
  .jht-print-btn:hover { background: var(--teal); }

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
    .jht-form .form-body {
      padding: 10px 22px 0 !important;
      flex: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
    }
    .jht-form .date-wrap .date-pick, .jht-form .date-wrap::after { display: none !important; }
    .jht-form .date-wrap .date-fld { padding-right: 8px !important; }
    .jht-form .section { margin-bottom: 6px !important; }
    .jht-form .terms-box { padding: 7px 14px !important; margin-bottom: 6px !important; }
    .jht-form .terms-box li { padding: 2.5px 0 !important; font-size: 9.5px !important; line-height: 1.35 !important; }
    .jht-form .decl-box { padding: 7px 14px !important; margin-bottom: 6px !important; font-size: 9.5px !important; line-height: 1.4 !important; }
    .jht-form .sig-row { padding-bottom: 4px !important; gap: 36px !important; }
    .jht-form .sig-box-space { height: 44px !important; }
    .jht-form .sig-box-space img { max-height: 42px !important; }
    .jht-form, .section, .frow, .grid, .sig-row, .enroll-row, .terms-box, .decl-box { break-inside: avoid !important; page-break-inside: avoid !important; }
    @page { margin: 0; size: A4 portrait; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  }
`;

const EMPTY_FORM = {
  date: todayDMY(),
  tutorName: '',
  mobile: '',
  gender: '',
  area: 'Raipur, Chhattisgarh',
  registrationCharges: '₹ 500 /-',
  documentsSubmitted: 'Aadhaar Card',
  sigTutorName: '',
  sigTutorDate: '',
  sigJhtDate: todayDMY(),
};

export default function TutorRegistrationFormPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [searchPhone, setSearchPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [matches, setMatches] = useState<Tutor[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    if (!canAccess(role, '/document/tutor-form')) router.push('/dashboard');
  }, [user, role, loading, router]);

  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSearch() {
    const raw = searchPhone.trim();
    if (!raw) return;
    const cleanPhone = raw.replace(/\D/g, '');
    setSearching(true); setSearchError(''); setMatches([]);
    try {
      const tutors = await getTutors();
      const matching = tutors.filter(t => {
        const tPhone = (t.phone || '').replace(/\D/g, '');
        return tPhone === cleanPhone || (t.phone && t.phone.includes(raw));
      });
      if (matching.length === 0) {
        setSearchError('No tutor found with that phone number in the CRM.');
        setSearching(false);
        return;
      }
      setMatches(matching);
      if (matching.length === 1) applyMatch(matching[0]);
    } catch (err) {
      console.error(err);
      setSearchError('Something went wrong searching the CRM.');
    }
    setSearching(false);
  }

  function applyMatch(t: Tutor) {
    setForm(prev => {
      const g = (t.gender || '').trim();
      let matchedGender = '';
      if (/^m/i.test(g)) matchedGender = 'Male';
      else if (/^f/i.test(g)) matchedGender = 'Female';
      else if (g) matchedGender = 'Other';

      return {
        ...prev,
        tutorName: t.name || '',
        mobile: t.phone || searchPhone,
        gender: matchedGender || prev.gender,
        area: t.area ? `${t.area}, Raipur, Chhattisgarh` : (prev.area || 'Raipur, Chhattisgarh'),
        registrationCharges: prev.registrationCharges || '₹ 500 /-',
        documentsSubmitted: prev.documentsSubmitted || 'Aadhaar Card',
        sigTutorName: t.name || prev.sigTutorName,
      };
    });
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM, date: todayDMY(), sigJhtDate: todayDMY() });
    setMatches([]); setSearchPhone(''); setSearchError('');
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f4f7fb', fontFamily: 'sans-serif' }}>
        <div style={{ color: '#1B5FA8', fontWeight: 600, fontSize: 14 }}>Loading Tutor Registration Form…</div>
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
            onClick={() => router.push('/tutors')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#1f2937', fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            ← Back to Tutors
          </button>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, letterSpacing: '0.5px' }}>
            TUTOR REGISTRATION FORM
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
              placeholder="Enter tutor's phone number"
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
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>Multiple tutors found — pick one to prefill:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {matches.map((m, i) => (
                  <button key={i} onClick={() => applyMatch(m)} style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fafbfc', cursor: 'pointer', fontSize: 12.5 }}>
                    {m.name} — {m.phone} ({m.area || 'Raipur'})
                  </button>
                ))}
              </div>
            </div>
          )}
          {matches.length === 1 && (
            <p style={{ fontSize: 12, color: '#166534', marginTop: 8 }}>
              ✅ Found ({matches[0].name}) — fields below have been prefilled.{' '}
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
          <div className="form-title-bar">TUTOR REGISTRATION &amp; ONBOARDING FORM</div>

          <div className="form-body">
            {/* Date row */}
            <div className="enroll-row">
              <div className="enroll-box">
                <label>DATE</label>
                <DateField value={form.date} onChange={v => set('date', v)} />
              </div>
            </div>

            {/* 1. PERSONAL INFORMATION */}
            <div className="section">
              <div className="sec-head">
                <div className="sec-icon">🧑</div>
                <h2>1. &nbsp; PERSONAL INFORMATION</h2>
              </div>
              <div className="grid">
                <div className="frow">
                  <div className="flabel">Tutor Name</div>
                  <div className="finput"><input value={form.tutorName} onChange={e => set('tutorName', e.target.value)} placeholder="Full name" /></div>
                </div>
                <div className="frow">
                  <div className="flabel">Mobile Number</div>
                  <div className="finput"><input type="tel" value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+91 _____  _____" /></div>
                </div>
                <div className="frow">
                  <div className="flabel">Gender</div>
                  <div className="finput">
                    <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                      <option value="">Select</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div className="frow span2">
                  <div className="flabel">Area / Address</div>
                  <div className="finput"><input value={form.area} onChange={e => set('area', e.target.value)} placeholder="Raipur, Chhattisgarh" /></div>
                </div>
              </div>
            </div>

            {/* 2. REGISTRATION & DOCUMENTS */}
            <div className="section">
              <div className="sec-head">
                <div className="sec-icon">📄</div>
                <h2>2. &nbsp; REGISTRATION &amp; DOCUMENTS</h2>
              </div>
              <div className="grid">
                <div className="frow">
                  <div className="flabel">Registration Charges</div>
                  <div className="finput">
                    <input
                      value={form.registrationCharges}
                      onChange={e => set('registrationCharges', e.target.value)}
                      placeholder="₹ 500 /-"
                    />
                  </div>
                </div>
                <div className="frow span2">
                  <div className="flabel">Documents Submitted</div>
                  <div className="finput"><input value={form.documentsSubmitted} onChange={e => set('documentsSubmitted', e.target.value)} placeholder="Aadhaar Card" /></div>
                </div>
              </div>
            </div>

            {/* 3. BENEFITS */}
            <div className="section">
              <div className="sec-head">
                <div className="sec-icon">⭐</div>
                <h2>3. &nbsp; BENEFITS OF JOINING JHT</h2>
              </div>
              <div className="terms-box" style={{ background: 'var(--teal-light)', borderColor: 'var(--teal)' }}>
                <ol style={{ listStyle: 'none' }}>
                  <li><span className="n" style={{ color: 'var(--teal)' }}>✓</span> Consistent student leads delivered directly to you — zero marketing or cold-calling effort required.</li>
                  <li><span className="n" style={{ color: 'var(--teal)' }}>✓</span> Earn ₹8,000 to ₹25,000+ per month depending on subjects, classes, and number of sessions taken.</li>
                  <li><span className="n" style={{ color: 'var(--teal)' }}>✓</span> Complete flexibility — choose your own working days, timings, and preferred subjects.</li>
                  <li><span className="n" style={{ color: 'var(--teal)' }}>✓</span> Simple onboarding process — just a document check and one demo class to get started.</li>
                  <li><span className="n" style={{ color: 'var(--teal)' }}>✓</span> Be part of a growing, trusted tutoring network across all major localities of Raipur.</li>
                  <li><span className="n" style={{ color: 'var(--teal)' }}>✓</span> Dedicated support team to help resolve any scheduling or parent-related concerns quickly.</li>
                </ol>
              </div>
            </div>

            {/* 4. TERMS */}
            <div className="section">
              <div className="sec-head">
                <div className="sec-icon">📜</div>
                <h2>4. &nbsp; TERMS &amp; CONDITIONS</h2>
              </div>
              <div className="terms-box">
                <ol style={{ listStyle: 'none' }}>
                  <li><span className="n">1.</span> Tutor must inform the organisation at least 1 week in advance for any unavailability or leave.</li>
                  <li><span className="n">2.</span> Registration charges are strictly non-refundable once submitted.</li>
                  <li><span className="n">3.</span> Tutor must maintain punctuality, discipline, and professional conduct during all assigned classes.</li>
                  <li><span className="n">4.</span> Tutor is not permitted to directly discuss or negotiate fees with parents; all payments are routed through the organisation.</li>
                  <li><span className="n">5.</span> Sharing of personal contact details with students/parents outside official communication is strictly prohibited.</li>
                  <li><span className="n">6.</span> Jilani Home Tutor Services reserves the right to reassign or discontinue tuition based on performance and feedback.</li>
                  <li><span className="n">7.</span> Any dispute or concern must be reported to the Jilani Home Tutor team and will be resolved within 48 hours.</li>
                </ol>
              </div>
            </div>

            {/* 5. DECLARATION */}
            <div className="section">
              <div className="sec-head">
                <div className="sec-icon">✅</div>
                <h2>5. &nbsp; DECLARATION</h2>
              </div>
              <div className="decl-box">
                I/We hereby confirm that all information provided above is accurate and complete. I/We have read, understood, and agree to abide by all the terms and conditions mentioned in this agreement. I/We understand that this agreement is binding upon signing.
              </div>
            </div>

            {/* SIGNATURES */}
            <div className="sig-row">
              <div className="sig-block">
                <div className="sig-title">TUTOR SIGNATURE</div>
                <div className="sig-box-space">(sign here)</div>
                <div className="sig-line"><span>Name:</span><input value={form.sigTutorName} onChange={e => set('sigTutorName', e.target.value)} placeholder="________________________" /></div>
                <div className="sig-line"><span>Date:</span><DateField value={form.sigTutorDate} onChange={v => set('sigTutorDate', v)} /></div>
              </div>
              <div className="sig-block">
                <div className="sig-title">AUTHORISED SIGNATORY — JHT</div>
                <div className="sig-box-space"><img src="/jht-signature.png" alt="Authorised Signature" /></div>
                <div className="sig-line"><span>Name:</span><input defaultValue="Aashiya Belim" readOnly /></div>
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
