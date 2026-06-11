// SettingsPage.tsx — Account · Privacy · Notifications · Fitness · Apps · Export
// Mini-page UX: home screen shows categories, tapping one opens a sub-page.

import { useState, useEffect, useRef } from 'react';
import {
  User, Bell, Dumbbell, Eye, EyeOff, AlertCircle,
  Shield, Sun, Moon, Check, ChevronRight, ArrowLeft, Lock, Trash2,
  Link2, Download, Globe, Users, Lock as LockIcon, Loader2,
  CheckCircle2, XCircle, MailCheck, RefreshCw, Send,
} from 'lucide-react';
import { User as UserType } from '../types';
import {
  getUserSettings, saveUserSettings,
  changePassword, changeEmail, updateAccount
} from '../../services/settingsService';
import { checkEmailVerified } from '../../services/authService';
import { authFetch } from '../../utils/authToken';
import { useTheme } from '../ThemeContext';
import { toast } from 'sonner';

import { API } from '../../config';

type Page = null | 'account' | 'privacy' | 'notifications' | 'fitness' | 'apps' | 'export';

const FITNESS_GOALS = ['Lose Weight','Build Muscle','Increase Endurance','Improve Flexibility','General Fitness','Train for Sport','Stress Relief'];
const ACTIVITY_LEVELS = ['Sedentary','Lightly Active','Moderately Active','Very Active','Athlete'];
const UNITS = ['kg / km','lbs / miles'];

interface SettingsPageProps { currentUser: UserType | null; }

// ── Inline email verification card (used inside Account settings) ────────────
function EmailVerificationSection() {
  const [verified,   setVerified]   = useState<boolean | null>(null);
  const [codeSent,   setCodeSent]   = useState(false);
  const [digits,     setDigits]     = useState(['', '', '', '', '', '']);
  const [sending,    setSending]    = useState(false);
  const [verifying,  setVerifying]  = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    checkEmailVerified().then(v => setVerified(v));
  }, []);

  const handleSendCode = async () => {
    setSending(true);
    try {
      const res = await authFetch(`${API}/auth/send-otp`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send code');
      }
      setCodeSent(true);
      setDigits(['', '', '', '', '', '']);
      toast.success('Code sent — check your email!');
      // Focus first box after a short tick
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (e: any) {
      toast.error(e.message || 'Could not send code');
    } finally { setSending(false); }
  };

  const handleDigitChange = (index: number, value: string) => {
    // Allow only a single digit
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all 6 filled
    if (char && index === 5 && next.every(d => d !== '')) {
      handleVerify(next.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
    if (pasted.length === 6) handleVerify(pasted);
  };

  const handleVerify = async (code?: string) => {
    const otp = code ?? digits.join('');
    if (otp.length < 6) { toast.error('Enter all 6 digits'); return; }
    setVerifying(true);
    try {
      const res = await authFetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otp }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Invalid code');
      }
      setVerified(true);
      setCodeSent(false);
      toast.success('Email verified! 🎉');
    } catch (e: any) {
      toast.error(e.message || 'Verification failed');
      // Clear digits so user can retry
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally { setVerifying(false); }
  };

  if (verified === null) return null; // still loading

  // ── Verified state ──────────────────────────────────────────────────────────
  if (verified) {
    return (
      <div className="rounded-2xl border bg-emerald-500/5 border-emerald-500/20 p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-emerald-300">Email verified</p>
          <p className="text-white/35 text-xs mt-0.5">Your email address has been confirmed.</p>
        </div>
      </div>
    );
  }

  // ── Not verified — send code prompt ────────────────────────────────────────
  if (!codeSent) {
    return (
      <div className="rounded-2xl border bg-amber-500/5 border-amber-500/20 p-4">
        <div className="flex items-start gap-3">
          <MailCheck className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300">Email not verified</p>
            <p className="text-white/35 text-xs mt-0.5">
              Verify your email to secure your account and unlock all features.
            </p>
            <button
              onClick={handleSendCode}
              disabled={sending}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-200 text-sm font-medium hover:bg-amber-500/30 disabled:opacity-50 transition-all"
            >
              {sending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              {sending ? 'Sending…' : 'Send verification code'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Code sent — digit input ─────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border bg-amber-500/5 border-amber-500/20 p-5">
      <div className="flex items-center gap-2 mb-1">
        <MailCheck className="w-4 h-4 text-amber-400" />
        <p className="text-sm font-semibold text-amber-300">Enter verification code</p>
      </div>
      <p className="text-white/40 text-xs mb-5">
        We sent a 6-digit code to your email. It expires in 15 minutes.
      </p>

      {/* Digit boxes */}
      <div className="flex items-center gap-2 justify-center mb-5" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleDigitChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className="w-11 h-14 text-center text-xl font-bold rounded-xl border-2 bg-[rgba(201,169,110,0.04)] text-white outline-none transition-all
              border-[rgba(201,169,110,0.12)] focus:border-amber-400 focus:bg-amber-500/10 focus:shadow-[0_0_0_3px_rgba(251,191,36,0.15)]
              caret-transparent select-none"
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleVerify()}
          disabled={verifying || digits.some(d => d === '')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm disabled:opacity-40 transition-all"
        >
          {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {verifying ? 'Verifying…' : 'Verify'}
        </button>
        <button
          onClick={handleSendCode}
          disabled={sending}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/50 text-xs font-medium hover:bg-[rgba(201,169,110,0.08)] disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${sending ? 'animate-spin' : ''}`} />
          {sending ? 'Sending…' : 'Resend'}
        </button>
        <button
          onClick={() => setCodeSent(false)}
          className="px-3 py-2.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/30 text-xs hover:text-white/60 hover:bg-[rgba(201,169,110,0.08)] transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SettingsPage({ currentUser }: SettingsPageProps) {
  const [page, setPage] = useState<Page>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Account form
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');

  // Password form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Email form
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Delete account
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!currentUser) return;
    setDisplayName(currentUser.name || '');
    // If stored username looks like an email (from early signup), leave blank
    const rawUsername = currentUser.username || '';
    setUsername(rawUsername.includes('@') ? '' : rawUsername);
    getUserSettings(currentUser.id)
      .then(d => setSettings(d || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentUser]);

  const set = (key: string, value: any) => setSettings(prev => ({ ...prev, [key]: value }));

  const saveSettings = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      await saveUserSettings(currentUser.id, settings);
      toast.success('Settings saved');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleSaveAccount = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      await updateAccount(currentUser.id, { displayName, username });
      toast.success('Account updated');
    } catch { toast.error('Failed to update account'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error('Passwords do not match'); return;
    }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setPwLoading(true);
    try {
      await changePassword(currentUser!.id, newPassword);
      toast.success('Password changed');
      setNewPassword(''); setConfirmPassword('');
    } catch { toast.error('Failed to change password'); }
    finally { setPwLoading(false); }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) { toast.error('Enter a valid email'); return; }
    setEmailLoading(true);
    try {
      await changeEmail(currentUser!.id, newEmail);
      toast.success('Email updated');
      setNewEmail('');
    } catch { toast.error('Failed to update email'); }
    finally { setEmailLoading(false); }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    setDeletingAccount(true);
    try {
      const res = await fetch(`http://192.168.1.102:5000/api/users/${currentUser.id}/account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('fitconnect_id_token')}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      // Clear local storage and reload to sign out
      localStorage.clear();
      window.location.href = '/';
    } catch {
      toast.error('Failed to delete account. Try again.');
      setDeletingAccount(false);
      setConfirmDelete(false);
    }
  };

  // ── Reusable micro-components ───────────────────────────────────────────────

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)}
      className={`relative shrink-0 rounded-full transition-all`}
      style={{ height: '22px', width: '40px', background: value ? '#c9a96e' : 'rgba(255,255,255,0.1)' }}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  );

  const Row = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[rgba(201,169,110,0.08)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm">{label}</p>
        {desc && <p className="text-white/35 text-xs mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-4 space-y-0">
      <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  );

  const Input = ({ label, value, onChange, type = 'text', placeholder = '' }: any) => (
    <div className="space-y-1.5">
      <label className="text-white/50 text-xs">{label}</label>
      <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]" />
    </div>
  );

  const SubPageHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="flex items-center gap-3 mb-6">
      <button onClick={() => setPage(null)}
        className="w-9 h-9 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] flex items-center justify-center text-white/60 hover:bg-[rgba(201,169,110,0.08)] transition-all shrink-0">
        <ArrowLeft className="w-4 h-4" />
      </button>
      <div>
        <h1 className="text-white font-semibold">{title}</h1>
        {subtitle && <p className="text-white/40 text-xs mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-3 animate-pulse">
      <div className="h-5 w-24 rounded-lg bg-[rgba(201,169,110,0.06)]" />
      <div className="h-3 w-40 rounded-lg bg-[rgba(201,169,110,0.04)]" />
      {[1,2,3,4].map(i => (
        <div key={i} className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[rgba(201,169,110,0.06)]" />
            <div className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-[rgba(201,169,110,0.06)]" />
              <div className="h-2 w-36 rounded bg-[rgba(201,169,110,0.04)]" />
            </div>
          </div>
          <div className="w-5 h-5 rounded bg-[rgba(201,169,110,0.06)]" />
        </div>
      ))}
    </div>
  );

  // ── Home screen ─────────────────────────────────────────────────────────────
  if (page === null) {
    const categories = [
      {
        id: 'account' as Page,
        icon: <User className="w-5 h-5 text-[#c9a96e]" />,
        label: 'Account',
        desc: 'Name, username, password, email',
        bg: 'bg-[rgba(201,169,110,0.08)]',
      },
      {
        id: 'privacy' as Page,
        icon: <Shield className="w-5 h-5 text-blue-400" />,
        label: 'Privacy',
        desc: 'Visibility, workout data, interactions',
        bg: 'bg-blue-500/10',
      },
      {
        id: 'notifications' as Page,
        icon: <Bell className="w-5 h-5 text-yellow-400" />,
        label: 'Notifications',
        desc: 'Likes, comments, streaks, bookings',
        bg: 'bg-yellow-500/10',
      },
      {
        id: 'fitness' as Page,
        icon: <Dumbbell className="w-5 h-5 text-green-400" />,
        label: 'Fitness Preferences',
        desc: 'Goals, activity level, units, targets',
        bg: 'bg-green-500/10',
      },
      {
        id: 'apps' as Page,
        icon: <Link2 className="w-5 h-5 text-cyan-400" />,
        label: 'Connected Apps',
        desc: 'Strava, Apple Health, Garmin',
        bg: 'bg-cyan-500/10',
      },
      {
        id: 'export' as Page,
        icon: <Download className="w-5 h-5 text-orange-400" />,
        label: 'Data & Export',
        desc: 'Post privacy defaults, download your data',
        bg: 'bg-orange-500/10',
      },
    ];

    return (
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">
        <div>
          <h1 className="text-white font-semibold text-xl">Settings</h1>
          <p className="text-white/40 text-sm mt-0.5">Manage your account and preferences</p>
        </div>

        {/* Category cards */}
        <div className="space-y-2">
          {categories.map(cat => (
            <button
              key={String(cat.id)}
              onClick={() => setPage(cat.id)}
              className="w-full bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-4 flex items-center gap-3 hover:bg-[rgba(201,169,110,0.03)] transition-all group text-left"
            >
              <div className={`w-10 h-10 rounded-xl ${cat.bg} flex items-center justify-center shrink-0`}>
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{cat.label}</p>
                <p className="text-white/40 text-xs mt-0.5 truncate">{cat.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors shrink-0" />
            </button>
          ))}
        </div>

        {/* Danger zone */}
        <div className="bg-[#080608] border border-red-500/10 rounded-2xl p-4">
          <p className="text-red-400/60 text-xs font-medium uppercase tracking-wider mb-3">Danger Zone</p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full py-2.5 rounded-xl border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Delete account
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-red-300 text-xs text-center font-medium">This will permanently delete your account and all posts. This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/50 text-sm hover:bg-[rgba(201,169,110,0.04)] transition-all">Cancel</button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-all disabled:opacity-50"
                >
                  {deletingAccount ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            </div>
          )}
          <p className="text-white/20 text-xs text-center mt-2">This action is permanent and cannot be undone.</p>
        </div>
      </div>
    );
  }

  // ── ACCOUNT sub-page ────────────────────────────────────────────────────────
  if (page === 'account') {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
        <SubPageHeader title="Account" subtitle="Profile info, password, and email" />

        <Section title="Profile Info">
          <div className="space-y-3 pt-1">
            <Input label="Display name" value={displayName} onChange={setDisplayName} placeholder="Your name" />
            <Input label="Username" value={username} onChange={setUsername} placeholder="@handle (no email)" />
            <button onClick={handleSaveAccount} disabled={saving}
              className="w-full py-2.5 rounded-xl bg-[#c9a96e] text-white text-sm font-medium hover:bg-[#c9a96e] disabled:opacity-50 transition-all">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Section>

        <Section title="Change Password">
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-white/50 text-xs">New password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]" />
                <button onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Input label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="••••••••" />
            {newPassword && newPassword !== confirmPassword && (
              <p className="text-red-400 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Passwords don't match</p>
            )}
            <button onClick={handleChangePassword} disabled={pwLoading}
              className="w-full py-2.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white text-sm font-medium hover:bg-[rgba(201,169,110,0.08)] disabled:opacity-50 transition-all">
              {pwLoading ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </Section>

        <Section title="Change Email">
          <div className="space-y-3 pt-1">
            <p className="text-white/30 text-xs">Current: {currentUser?.email || '—'}</p>
            <Input label="New email address" value={newEmail} onChange={setNewEmail} type="email" placeholder="new@email.com" />
            <button onClick={handleChangeEmail} disabled={emailLoading}
              className="w-full py-2.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white text-sm font-medium hover:bg-[rgba(201,169,110,0.08)] disabled:opacity-50 transition-all">
              {emailLoading ? 'Updating…' : 'Update email'}
            </button>
          </div>
        </Section>

        <EmailVerificationSection />
      </div>
    );
  }

  // ── PRIVACY sub-page ────────────────────────────────────────────────────────
  if (page === 'privacy') {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
        <SubPageHeader title="Privacy" subtitle="Control who can see your content" />

        <Section title="Profile Visibility">
          <Row label="Private account" desc="Only approved followers can see your posts">
            <Toggle value={!!settings.privateAccount} onChange={v => set('privateAccount', v)} />
          </Row>
          <Row label="Show in search" desc="Allow others to find you by name or username">
            <Toggle value={settings.showInSearch !== false} onChange={v => set('showInSearch', v)} />
          </Row>
          <Row label="Show online status" desc="Let others see when you're active">
            <Toggle value={!!settings.showOnline} onChange={v => set('showOnline', v)} />
          </Row>
        </Section>

        <Section title="Workout Data">
          <Row label="Show PRs on profile" desc="Display personal records publicly">
            <Toggle value={settings.showPRs !== false} onChange={v => set('showPRs', v)} />
          </Row>
          <Row label="Show workout stats" desc="Calories, duration visible on your posts">
            <Toggle value={settings.showStats !== false} onChange={v => set('showStats', v)} />
          </Row>
          <Row label="Allow trainer contact" desc="Trainers can message you with offers">
            <Toggle value={!!settings.allowTrainerContact} onChange={v => set('allowTrainerContact', v)} />
          </Row>
        </Section>

        <Section title="Interactions">
          <Row label="Allow duel challenges" desc="Friends can challenge you to duels">
            <Toggle value={settings.allowDuels !== false} onChange={v => set('allowDuels', v)} />
          </Row>
          <Row label="Show likes publicly" desc="Anyone can see who liked your posts">
            <Toggle value={settings.publicLikes !== false} onChange={v => set('publicLikes', v)} />
          </Row>
        </Section>

        <button onClick={saveSettings} disabled={saving}
          className="w-full py-3 rounded-xl bg-[#c9a96e] text-white text-sm font-medium hover:bg-[#c9a96e] disabled:opacity-50 transition-all">
          {saving ? 'Saving…' : 'Save privacy settings'}
        </button>
      </div>
    );
  }

  // ── NOTIFICATIONS sub-page ──────────────────────────────────────────────────
  if (page === 'notifications') {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
        <SubPageHeader title="Notifications" subtitle="Choose what you want to be notified about" />

        <Section title="Activity">
          <Row label="Likes on my posts" desc="When someone likes your workout post">
            <Toggle value={settings.notifLikes !== false} onChange={v => set('notifLikes', v)} />
          </Row>
          <Row label="Comments" desc="When someone comments on your post">
            <Toggle value={settings.notifComments !== false} onChange={v => set('notifComments', v)} />
          </Row>
          <Row label="New followers" desc="When someone starts following you">
            <Toggle value={settings.notifFollowers !== false} onChange={v => set('notifFollowers', v)} />
          </Row>
          <Row label="Hype alerts 🔥" desc="When your post gets a lot of likes fast">
            <Toggle value={settings.notifHype !== false} onChange={v => set('notifHype', v)} />
          </Row>
        </Section>

        <Section title="Fitness">
          <Row label="Streak reminders" desc="Reminder if you haven't posted by 8pm">
            <Toggle value={settings.notifStreak !== false} onChange={v => set('notifStreak', v)} />
          </Row>
          <Row label="Duel updates" desc="When your duel score changes or ends">
            <Toggle value={settings.notifDuels !== false} onChange={v => set('notifDuels', v)} />
          </Row>
          <Row label="Badge earned" desc="When you unlock a new achievement">
            <Toggle value={settings.notifBadges !== false} onChange={v => set('notifBadges', v)} />
          </Row>
          <Row label="Trainer shoutouts ⭐" desc="When a verified trainer comments on your post">
            <Toggle value={settings.notifTrainer !== false} onChange={v => set('notifTrainer', v)} />
          </Row>
        </Section>

        <Section title="Bookings">
          <Row label="Booking confirmations" desc="When a trainer confirms your session">
            <Toggle value={settings.notifBookings !== false} onChange={v => set('notifBookings', v)} />
          </Row>
          <Row label="Session reminders" desc="24h before a booked session">
            <Toggle value={settings.notifSessionReminder !== false} onChange={v => set('notifSessionReminder', v)} />
          </Row>
        </Section>

        <button onClick={saveSettings} disabled={saving}
          className="w-full py-3 rounded-xl bg-[#c9a96e] text-white text-sm font-medium hover:bg-[#c9a96e] disabled:opacity-50 transition-all">
          {saving ? 'Saving…' : 'Save notification preferences'}
        </button>
      </div>
    );
  }

  // ── FITNESS PREFERENCES sub-page ────────────────────────────────────────────
  if (page === 'fitness') {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
        <SubPageHeader title="Fitness Preferences" subtitle="Customize your fitness experience" />

        <Section title="Goals">
          <div className="pt-1 flex flex-wrap gap-2">
            {FITNESS_GOALS.map(g => (
              <button key={g} onClick={() => set('fitnessGoal', g)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${settings.fitnessGoal === g ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.45)] text-[#e8c98a]' : 'border-[rgba(201,169,110,0.12)] text-white/50 hover:border-[rgba(201,169,110,0.18)]'}`}>
                {g}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Activity Level">
          <div className="pt-1 space-y-1.5">
            {ACTIVITY_LEVELS.map(a => (
              <button key={a} onClick={() => set('activityLevel', a)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all
                  ${settings.activityLevel === a ? 'bg-[rgba(201,169,110,0.08)] border-[rgba(201,169,110,0.25)] text-[#e8c98a]' : 'border-[rgba(201,169,110,0.08)] text-white/50 hover:border-[rgba(201,169,110,0.12)]'}`}>
                {a}
                {settings.activityLevel === a && <Check className="w-4 h-4 text-[#c9a96e]" />}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Units">
          <div className="pt-1 flex gap-2">
            {UNITS.map(u => (
              <button key={u} onClick={() => set('units', u)}
                className={`flex-1 py-2.5 rounded-xl border text-sm transition-all ${settings.units === u ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.45)] text-[#e8c98a]' : 'border-[rgba(201,169,110,0.12)] text-white/50 hover:border-[rgba(201,169,110,0.18)]'}`}>
                {u}
              </button>
            ))}
          </div>
        </Section>

        <div className="pt-2 pb-8">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-[#c9a96e] text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60 transition-all shadow-lg shadow-[rgba(201,169,110,0.15)]"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    );
  }

  // ── CONNECTED APPS sub-page ──────────────────────────────────────────────────
  if (page === 'apps') {
    const APPS = [
      {
        id: 'strava',
        name: 'Strava',
        desc: 'Auto-import runs, rides and swims',
        icon: '🚴',
        color: 'border-orange-500/30 text-orange-300',
        bg: 'bg-orange-500/10',
        available: true,
      },
      {
        id: 'apple_health',
        name: 'Apple Health',
        desc: 'Sync steps, heart rate and workouts',
        icon: '❤️',
        color: 'border-red-500/30 text-red-300',
        bg: 'bg-red-500/10',
        available: false,
        soon: 'iOS only — coming soon',
      },
      {
        id: 'garmin',
        name: 'Garmin Connect',
        desc: 'Import activity data from your Garmin device',
        icon: '⌚',
        color: 'border-blue-500/30 text-blue-300',
        bg: 'bg-blue-500/10',
        available: false,
        soon: 'Coming soon',
      },
      {
        id: 'google_fit',
        name: 'Google Fit',
        desc: 'Sync daily activity and workouts',
        icon: '🏃',
        color: 'border-green-500/30 text-green-300',
        bg: 'bg-green-500/10',
        available: false,
        soon: 'Coming soon',
      },
    ];

    const connected = (settings.connectedApps || []) as string[];

    const toggleApp = async (appId: string) => {
      const isConnected = connected.includes(appId);
      if (!isConnected) {
        // Simulate OAuth redirect for Strava
        if (appId === 'strava') {
          toast.success('Redirecting to Strava… (demo: auto-connected)');
        }
        const newApps = [...connected, appId];
        set('connectedApps', newApps);
        await saveUserSettings(currentUser!.id, { ...settings, connectedApps: newApps });
        toast.success(`${APPS.find(a => a.id === appId)?.name} connected!`);
      } else {
        const newApps = connected.filter(a => a !== appId);
        set('connectedApps', newApps);
        await saveUserSettings(currentUser!.id, { ...settings, connectedApps: newApps });
        toast.success('Disconnected');
      }
    };

    return (
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
        <SubPageHeader title="Connected Apps" subtitle="Link your fitness apps to auto-import workouts" />

        <div className="space-y-3">
          {APPS.map(app => {
            const isConnected = connected.includes(app.id);
            return (
              <div key={app.id} className={`bg-[#080608] border rounded-2xl p-4 flex items-center gap-4 ${isConnected ? 'border-[rgba(201,169,110,0.12)]' : 'border-[rgba(201,169,110,0.08)]'}`}>
                <div className={`w-11 h-11 rounded-xl ${app.bg} flex items-center justify-center text-xl shrink-0`}>
                  {app.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium text-sm">{app.name}</p>
                    {isConnected && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                  </div>
                  <p className="text-white/35 text-xs mt-0.5">
                    {app.available ? app.desc : (app.soon || app.desc)}
                  </p>
                </div>
                {app.available ? (
                  <button
                    onClick={() => toggleApp(app.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
                      isConnected
                        ? 'bg-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.12)] text-white/40 hover:text-red-400 hover:border-red-500/20'
                        : `${app.color} ${app.bg} border hover:opacity-80`
                    }`}
                  >
                    {isConnected ? 'Disconnect' : 'Connect'}
                  </button>
                ) : (
                  <span className="text-white/20 text-[10px] shrink-0">Soon</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.06)] rounded-xl p-3">
          <p className="text-white/30 text-xs leading-relaxed">
            When connected, workouts from these apps are automatically imported as posts. You can review them before they go public.
          </p>
        </div>
      </div>
    );
  }

  // ── DATA & EXPORT sub-page ────────────────────────────────────────────────────
  if (page === 'export') {
    const PRIVACY_OPTIONS: { value: string; label: string; desc: string; Icon: any }[] = [
      { value: 'public',    label: 'Public',          desc: 'Anyone can see your posts', Icon: Globe },
      { value: 'followers', label: 'Followers only',  desc: 'Only people who follow you', Icon: Users },
      { value: 'private',   label: 'Only me',         desc: 'Completely private',         Icon: LockIcon },
    ];

    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
      if (!currentUser) return;
      setExporting(true);
      try {
        const res  = await authFetch(`${API}/users/${currentUser.id}/export`);
        if (!res.ok) throw new Error('Export failed');
        const data = await res.json();

        // Convert to CSV sections
        const toCSV = (rows: Record<string, any>[], headers: string[]) => {
          if (!rows.length) return headers.join(',') + '\n(no data)';
          return [
            headers.join(','),
            ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
          ].join('\n');
        };

        const workoutCSV  = toCSV(data.workouts,  ['date','type','duration_min','calories','exercises','caption']);
        const bodyCSV     = toCSV(data.bodyStats,  ['date','weight_kg','body_fat_pct','muscle_mass_kg','notes']);
        const nutritionCSV = toCSV(data.nutrition, ['date','calories','protein_g','carbs_g','fat_g']);

        const full = [
          `# Flex Data Export — ${data.username}`,
          `# Exported: ${new Date().toLocaleDateString()}`,
          '',
          '## WORKOUTS',
          workoutCSV,
          '',
          '## BODY STATS',
          bodyCSV,
          '',
          '## NUTRITION',
          nutritionCSV,
        ].join('\n');

        const blob = new Blob([full], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `flex-export-${data.username}-${new Date().toISOString().slice(0,10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
        toast.success('Export downloaded!');
      } catch { toast.error('Export failed — try again'); }
      finally { setExporting(false); }
    };

    return (
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
        <SubPageHeader title="Data & Export" subtitle="Post defaults and your personal data" />

        {/* Post privacy defaults */}
        <Section title="Default post visibility">
          <div className="pt-1 space-y-1.5">
            {PRIVACY_OPTIONS.map(({ value, label, desc, Icon }) => (
              <button
                key={value}
                onClick={() => set('defaultPostVisibility', value)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-sm transition-all ${
                  (settings.defaultPostVisibility || 'public') === value
                    ? 'bg-[rgba(201,169,110,0.08)] border-[rgba(201,169,110,0.25)]'
                    : 'border-[rgba(201,169,110,0.08)] hover:border-[rgba(201,169,110,0.12)]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  (settings.defaultPostVisibility || 'public') === value ? 'bg-[rgba(201,169,110,0.12)]' : 'bg-[rgba(201,169,110,0.04)]'
                }`}>
                  <Icon className={`w-4 h-4 ${(settings.defaultPostVisibility || 'public') === value ? 'text-[#e8c98a]' : 'text-white/30'}`} />
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium text-sm ${(settings.defaultPostVisibility || 'public') === value ? 'text-[#e8c98a]' : 'text-white/60'}`}>{label}</p>
                  <p className="text-white/30 text-xs">{desc}</p>
                </div>
                {(settings.defaultPostVisibility || 'public') === value && (
                  <Check className="w-4 h-4 text-[#c9a96e] shrink-0" />
                )}
              </button>
            ))}
          </div>
        </Section>

        <button onClick={saveSettings} disabled={saving}
          className="w-full py-2.5 rounded-xl bg-[#c9a96e] text-white text-sm font-medium hover:bg-[#c9a96e] disabled:opacity-50 transition-all">
          {saving ? 'Saving…' : 'Save default visibility'}
        </button>

        {/* Export */}
        <Section title="Export your data">
          <div className="pt-2 space-y-3">
            <p className="text-white/40 text-xs leading-relaxed">
              Download all your workouts, body stats, and nutrition logs as a CSV file. Includes the last 200 nutrition entries and all workout history.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {['Workouts', 'Body stats', 'Nutrition'].map(label => (
                <div key={label} className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-xl px-3 py-2 text-center">
                  <p className="text-white/60 text-xs font-medium">{label}</p>
                  <p className="text-white/25 text-[10px]">included</p>
                </div>
              ))}
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600/80 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-sm transition-all"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'Preparing export…' : 'Download CSV export'}
            </button>
          </div>
        </Section>
      </div>
    );
  }

  return null;
}
