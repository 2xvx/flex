// EmailVerificationBanner.tsx
// Shown at the top of the app when the user's email isn't verified yet.
// Auto-polls every 8 seconds so the banner dismisses itself once verified.
import { useState, useEffect } from 'react';
import { MailCheck, X, RefreshCw } from 'lucide-react';
import { resendVerificationEmail, checkEmailVerified } from '../../services/authService';
import { toast } from 'sonner';

interface Props {
  onVerified: () => void;
}

export function EmailVerificationBanner({ onVerified }: Props) {
  const [resending, setResending]   = useState(false);
  const [checking,  setChecking]    = useState(false);
  const [dismissed, setDismissed]   = useState(false);

  // Auto-poll every 8 s — dismisses itself once Firebase confirms verified
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const verified = await checkEmailVerified();
        if (verified) {
          clearInterval(interval);
          onVerified();
        }
      } catch {
        // silently ignore poll errors
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [onVerified]);

  if (dismissed) return null;

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      toast.success('Verification email sent — check your inbox!');
    } catch (e: any) {
      toast.error(e.message || 'Could not send email');
    } finally {
      setResending(false);
    }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const verified = await checkEmailVerified();
      if (verified) {
        toast.success('Email verified! 🎉');
        onVerified();
      } else {
        toast.error('Not verified yet — check your inbox and click the link.');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center gap-3">
      <MailCheck className="w-4 h-4 text-amber-400 shrink-0" />
      <p className="text-amber-200/90 text-xs flex-1">
        Please verify your email to unlock all features.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={handleResend}
          disabled={resending}
          className="text-xs text-amber-300 hover:text-amber-100 underline underline-offset-2 disabled:opacity-50"
        >
          {resending ? 'Sending…' : 'Resend'}
        </button>
        <button
          onClick={handleCheckNow}
          disabled={checking}
          className="flex items-center gap-1 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
          I verified it
        </button>
        <button onClick={() => setDismissed(true)} className="text-white/30 hover:text-white/60 ml-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
