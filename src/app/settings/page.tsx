'use client';
// src/app/settings/page.tsx
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { Card, CardHeader, BtnPrimary, BtnSecondary } from '@/components/UI';
import { getConfig, saveConfig, SiteConfig } from '@/lib/firestore';
import styles from './settings.module.css';

const EMPTY_CONFIG: SiteConfig = {
  offerBanner: '', whatsappNumber: '', heroSubtext: '', address: '',
};

export default function SettingsPage() {
  const [config, setConfig]   = useState<SiteConfig>(EMPTY_CONFIG);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    const c = await getConfig();
    if (c) setConfig(c);
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await saveConfig(config);
    setSaved(true); setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  }

  const f = (k: keyof SiteConfig, v: string) => setConfig(p => ({ ...p, [k]: v }));

  return (
    <AppShell title="Settings">
      <div className={styles.grid}>

        {/* Website Config */}
        <Card pad>
          <CardHeader title="🌐 Website Configuration" />
          <p className={styles.desc}>These settings are shared with your main website and reflect live immediately.</p>
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.group}>
              <label>🎉 Offer Banner Text</label>
              <input
                value={config.offerBanner}
                onChange={e=>f('offerBanner',e.target.value)}
                placeholder="e.g. 🎉 Special Offer: First 2 Demo Classes FREE this month!"
              />
              <span className={styles.hint}>Leave empty to hide the banner on the website.</span>
            </div>
            <div className={styles.group}>
              <label>📱 WhatsApp Number</label>
              <input
                value={config.whatsappNumber}
                onChange={e=>f('whatsappNumber',e.target.value)}
                placeholder="917999854628"
              />
              <span className={styles.hint}>Include country code, no + or spaces. e.g. 917999854628</span>
            </div>
            <div className={styles.group}>
              <label>📍 Business Address</label>
              <input
                value={config.address}
                onChange={e=>f('address',e.target.value)}
                placeholder="Shankar Nagar, Raipur, Chhattisgarh"
              />
            </div>
            <div className={styles.group}>
              <label>🏠 Hero Section Subtext</label>
              <input
                value={config.heroSubtext}
                onChange={e=>f('heroSubtext',e.target.value)}
                placeholder="Personalized 1-on-1 home tuition for Class 1–12 in Raipur."
              />
              <span className={styles.hint}>The subtitle shown under the main heading on your website.</span>
            </div>
            <div className={styles.btnRow}>
              <BtnPrimary type="submit" disabled={saving}>
                {saving ? 'Saving…' : '💾 Save Settings'}
              </BtnPrimary>
              {saved && <span className={styles.savedMsg}>✅ Settings saved! Live on website.</span>}
            </div>
          </form>
        </Card>

        {/* CRM Info */}
        <div className={styles.col}>
          <Card pad>
            <CardHeader title="📊 CRM Information" />
            <div className={styles.infoList}>
              <div className={styles.infoItem}>
                <span>CRM Version</span><strong>v1.0</strong>
              </div>
              <div className={styles.infoItem}>
                <span>Built with</span><strong>Next.js 14 + Firebase</strong>
              </div>
              <div className={styles.infoItem}>
                <span>Firebase Project</span>
                <strong style={{color:'var(--blue)'}}>jilani-home-tutor</strong>
              </div>
              <div className={styles.infoItem}>
                <span>Website</span>
                <a href="https://jilani-home-tutor.vercel.app" target="_blank" rel="noreferrer"
                  style={{color:'var(--blue)',fontWeight:700,fontSize:12}}>
                  jilani-home-tutor.vercel.app ↗
                </a>
              </div>
            </div>
          </Card>

          <Card pad>
            <CardHeader title="🔒 Security Tips" />
            <ul className={styles.tipsList}>
              <li>Never share your admin login credentials</li>
              <li>Change your Firebase password every 3 months</li>
              <li>Do not commit <code>.env.local</code> to GitHub</li>
              <li>Enable 2FA on your Firebase account</li>
              <li>Review staff access regularly</li>
              <li>Export your data monthly as backup</li>
            </ul>
          </Card>

          <Card pad>
            <CardHeader title="📋 Firestore Collections" />
            <div className={styles.collections}>
              {[
                { name:'parents',        icon:'👨‍👩‍👧', desc:'Parent lead registrations' },
                { name:'tutors',         icon:'👩‍🏫', desc:'Tutor lead registrations' },
                { name:'classes',        icon:'📋', desc:'Tutor-student assignments' },
                { name:'fees',           icon:'💰', desc:'Monthly fee records' },
                { name:'attendance',     icon:'📅', desc:'Daily session attendance' },
                { name:'communications', icon:'💬', desc:'Call & WhatsApp logs' },
                { name:'tasks',          icon:'✅', desc:'Follow-up tasks' },
                { name:'staff',          icon:'👥', desc:'CRM staff members' },
                { name:'config',         icon:'⚙️', desc:'Website configuration' },
              ].map(c => (
                <div key={c.name} className={styles.collectionItem}>
                  <span className={styles.collectionIcon}>{c.icon}</span>
                  <div>
                    <code className={styles.collectionName}>{c.name}</code>
                    <div className={styles.collectionDesc}>{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card pad>
            <CardHeader title="🚀 Quick Links" />
            <div className={styles.quickLinks}>
              <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className={styles.quickLink}>
                🔥 Firebase Console
              </a>
              <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className={styles.quickLink}>
                ▲ Vercel Dashboard
              </a>
              <a href="https://jilani-home-tutor.vercel.app" target="_blank" rel="noreferrer" className={styles.quickLink}>
                🌐 Live Website
              </a>
              <a href="https://jilani-home-tutor.vercel.app/admin" target="_blank" rel="noreferrer" className={styles.quickLink}>
                🔐 Website Admin
              </a>
              <a href="https://business.google.com" target="_blank" rel="noreferrer" className={styles.quickLink}>
                📍 Google Business
              </a>
              <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className={styles.quickLink}>
                🔍 Search Console
              </a>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
