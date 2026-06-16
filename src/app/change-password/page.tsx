
'use client';
// src/app/change-password/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { changeCurrentUserPassword } from '@/lib/firebase';
import styles from './change-password.module.css';

export default function ChangePasswordPage() {
  const { user, loading, passwordChanged, markPasswordChanged } = useAuth();
  const router = useRouter();

  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [saving,      setSaving]      = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [error,       setError]       = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isFirstLogin = !passwordChanged; // true = came here because of temp password

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  function getStrength(pwd: string): { score: number; label: string; color: string } {
    let score = 0;
    if (pwd.length >= 8)           score++;
    if (pwd.length >= 12)          score++;
    if (/[A-Z]/.test(pwd))         score++;
    if (/[0-9]/.test(pwd))         score++;
    if (/[^A-Za-z0-9]/.test(pwd))  score++;
    if (score <= 1) return { score, label: 'Very Weak',  color: '#ef4444' };
    if (score === 2) return { score, label: 'Weak',      color: '#f97316' };
    if (score === 3) return { score, label: 'Fair',      color: '#eab308' };
    if (score === 4) return { score, label: 'Strong',    color: '#22c55e' };
    return              { score, label: 'Very Strong', color: '#16a34a' };
  }

  const strength        = getStrength(newPwd);
  const passwordsMatch  = newPwd && confirmPwd && newPwd === confirmPwd;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPwd.length < 8)       { setError('Password must be at least 8 characters.'); return; }
    if (newPwd !== confirmPwd)    { setError('New passwords do not match.'); return; }
    if (newPwd === currentPwd)    { setError('New password must be different from current password.'); return; }
    if (strength.score < 2)      { setError('Password too weak. Add numbers or special characters.'); return; }

    setSaving(true);
    try {
      await changeCurrentUserPassword(currentPwd, newPwd);

      // Mark password as changed in Firestore (clears the first-login redirect)
      await markPasswordChanged();

      setSuccess(true);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');

      // Redirect to dashboard after 2.5 seconds
      setTimeout(() => router.push('/dashboard'), 2500);

    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Current password is incorrect.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Wait a few minutes and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
    setSaving(false);
  }

  if (loading) return <div className={styles.loading}>Loading…</div>;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.icon}>🔐</div>
          <h1>{isFirstLogin ? 'Set Your Password' : 'Change Password'}</h1>
          <p>
            {isFirstLogin
              ? 'Welcome! Please set a new password before continuing.'
              : 'Update your CRM login password'}
          </p>
          {user?.email && <div className={styles.emailBadge}>📧 {user.email}</div>}
        </div>

        {/* First login warning banner */}
        {isFirstLogin && !success && (
          <div className={styles.firstLoginBanner}>
            ⚠️ You are using a <strong>temporary password</strong>. Please set a permanent password to continue.
          </div>
        )}

        {success ? (
          <div className={styles.successBox}>
            <div className={styles.successIcon}>✅</div>
            <h2>Password {isFirstLogin ? 'Set' : 'Changed'}!</h2>
            <p>Your password has been updated successfully.</p>
            <p style={{fontSize:12,color:'#888',marginTop:8}}>
              Redirecting to dashboard…
            </p>
            <button onClick={() => router.push('/dashboard')} className={styles.btnPrimary} style={{marginTop:16}}>
              Go to Dashboard →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>

            {/* Current / Temp password */}
            <div className={styles.group}>
              <label>{isFirstLogin ? 'Temporary Password *' : 'Current Password *'}</label>
              <div className={styles.inputWrap}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPwd}
                  onChange={e => setCurrentPwd(e.target.value)}
                  placeholder={isFirstLogin ? 'Enter the temporary password you received' : 'Enter your current password'}
                  required
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowCurrent(!showCurrent)}>
                  {showCurrent ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className={styles.divider} />

            {/* New password */}
            <div className={styles.group}>
              <label>New Password *</label>
              <div className={styles.inputWrap}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowNew(!showNew)}>
                  {showNew ? '🙈' : '👁️'}
                </button>
              </div>

              {newPwd && (
                <div className={styles.strengthWrap}>
                  <div className={styles.strengthBar}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={styles.strengthSegment}
                        style={{background: i <= strength.score ? strength.color : '#e5e7eb'}} />
                    ))}
                  </div>
                  <span className={styles.strengthLabel} style={{color: strength.color}}>
                    {strength.label}
                  </span>
                </div>
              )}

              <div className={styles.tips}>
                <div className={`${styles.tip} ${newPwd.length >= 8 ? styles.tipDone : ''}`}>
                  {newPwd.length >= 8 ? '✅' : '○'} At least 8 characters
                </div>
                <div className={`${styles.tip} ${/[A-Z]/.test(newPwd) ? styles.tipDone : ''}`}>
                  {/[A-Z]/.test(newPwd) ? '✅' : '○'} One uppercase letter
                </div>
                <div className={`${styles.tip} ${/[0-9]/.test(newPwd) ? styles.tipDone : ''}`}>
                  {/[0-9]/.test(newPwd) ? '✅' : '○'} One number
                </div>
                <div className={`${styles.tip} ${/[^A-Za-z0-9]/.test(newPwd) ? styles.tipDone : ''}`}>
                  {/[^A-Za-z0-9]/.test(newPwd) ? '✅' : '○'} One special character
                </div>
              </div>
            </div>

            {/* Confirm password */}
            <div className={styles.group}>
              <label>Confirm New Password *</label>
              <div className={styles.inputWrap}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  style={{borderColor: confirmPwd ? (passwordsMatch ? '#22c55e' : '#ef4444') : undefined}}
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
              {confirmPwd && (
                <span style={{fontSize:12, color: passwordsMatch ? '#22c55e' : '#ef4444', fontWeight:600}}>
                  {passwordsMatch ? '✅ Passwords match' : '❌ Passwords do not match'}
                </span>
              )}
            </div>

            {error && <div className={styles.errorBox}>❌ {error}</div>}

            <div className={styles.btnRow}>
              {/* Only show cancel if NOT a forced first-login redirect */}
              {!isFirstLogin && (
                <button type="button" className={styles.btnSecondary} onClick={() => router.push('/dashboard')}>
                  Cancel
                </button>
              )}
              <button type="submit" className={styles.btnPrimary} disabled={saving}
                style={{flex: isFirstLogin ? 1 : undefined}}>
                {saving ? 'Saving…' : isFirstLogin ? '🔐 Set My Password' : '🔐 Update Password'}
              </button>
            </div>
          </form>
        )}

        {!isFirstLogin && (
          <div className={styles.back}>
            <button onClick={() => router.push('/dashboard')} className={styles.backLink}>
              ← Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
