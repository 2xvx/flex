// OTPVerifyScreen.tsx — 6-digit email verification after signup
import { useState, useEffect, useRef } from 'react';
import { authFetch } from '../../../utils/authToken';
import { API } from '../../../config';
import { toast } from 'sonner';

interface Props {
  email: string;          // masked email shown to user
  onVerified: () => void; // called when code checks out
  onSkip?: () => void;    // escape hatch (optional)
}

export function OTPVerifyScreen({ email, onVerified, onSkip }: Props) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-send OTP on mount
  useEffect(() => { sendOtp(); }, []);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function sendOtp() {
    setSending(true);
    setError('');
    try {
      const res = await authFetch(`${API}/auth/send-otp`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      setCooldown(60);
      toast.success('Code sent! Check your inbox.');
    } catch (e: any) {
      setError(e.message || 'Could not send code');
    } finally {
      setSending(false);
    }
  }

  function handleChange(i: number, val: string) {
    const char = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    setError('');
    if (char && i < 5) inputs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputs.current[5]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < 6) { setError('Enter all 6 digits'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      toast.success('Email verified!');
      onVerified();
    } catch (e: any) {
      setError(e.message || 'Incorrect code');
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  const G1 = '#a78bfa';
  const full = digits.every(d => d !== '');

  return (
    <div style={{
      minHeight: '100vh', background: '#080608',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: 28, padding: '40px 32px', textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'rgba(167,139,250,0.12)', border: '0.5px solid rgba(167,139,250,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: 28,
        }}>📧</div>

        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
          Verify your email
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.6, margin: '0 0 32px' }}>
          We sent a 6-digit code to<br />
          <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{email}</span>
        </p>

        <form onSubmit={handleSubmit}>
          {/* 6 digit inputs */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}
               onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                style={{
                  width: 48, height: 56, textAlign: 'center',
                  fontSize: 22, fontWeight: 700, color: '#fff',
                  background: error ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)',
                  border: error
                    ? '1.5px solid rgba(239,68,68,0.5)'
                    : d
                    ? `1.5px solid ${G1}`
                    : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 14, outline: 'none',
                  transition: 'border 0.15s',
                }}
                autoFocus={i === 0}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <p style={{ color: 'rgba(239,68,68,0.85)', fontSize: 12, margin: '-8px 0 16px' }}>
              {error}
            </p>
          )}

          {/* Verify button */}
          <button
            type="submit"
            disabled={loading || !full}
            style={{
              width: '100%', padding: '14px', borderRadius: 14,
              background: full ? `linear-gradient(135deg, ${G1}, #7c3aed)` : 'rgba(255,255,255,0.08)',
              color: full ? '#fff' : 'rgba(255,255,255,0.3)',
              fontSize: 15, fontWeight: 600, border: 'none', cursor: full ? 'pointer' : 'default',
              transition: 'all 0.2s', marginBottom: 16,
            }}
          >
            {loading
              ? <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : 'Verify email'}
          </button>

          {/* Resend */}
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>
            Didn't get it?{' '}
            {cooldown > 0 ? (
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>Resend in {cooldown}s</span>
            ) : (
              <button
                type="button"
                onClick={sendOtp}
                disabled={sending}
                style={{ background: 'none', border: 'none', color: G1, cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0 }}
              >
                {sending ? 'Sending…' : 'Resend code'}
              </button>
            )}
          </p>
        </form>

        {/* Skip link for edge cases */}
        {onSkip && (
          <button
            onClick={onSkip}
            style={{ marginTop: 24, background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 12, cursor: 'pointer' }}
          >
            Skip for now
          </button>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
