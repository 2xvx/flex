import { useState } from 'react';
import { Check, Zap, BarChart2, Star, Shield, Crown, AlertCircle, X } from 'lucide-react';
import { User } from '../types';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';

import { API } from '../../config';

interface Props {
  currentUser: User | null;
  onUserUpdated?: (updates: Partial<User>) => void;
}

const PRO_FEATURES = [
  { icon: Shield,   label: 'Verified badge',             desc: 'Blue ✓ badge on your profile, posts and DMs' },
  { icon: BarChart2, label: 'Advanced analytics',        desc: 'Full booking stats, earnings & client insights' },
  { icon: Star,     label: 'Priority in search',         desc: 'Appear higher in trainer search results' },
  { icon: Crown,    label: 'Pro profile highlight',      desc: 'Gold border & "Pro Trainer" label on your card' },
  { icon: Zap,      label: 'Unlimited booking slots',    desc: 'Remove the default 20-slot cap per month' },
  { icon: Check,    label: 'My Clients dashboard',       desc: 'Track all booked clients and their progress' },
];

export function SubscriptionPage({ currentUser, onUserUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const sub = currentUser?.subscription;
  const isPro = sub?.active && sub.tier === 'pro';
  const isTrainer = currentUser?.accountType === 'trainer';

  const handleSubscribe = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API}/users/${currentUser.id}/subscription`, { method: 'POST' });
      if (!res.ok) throw new Error('Subscribe failed');
      const data = await res.json();
      onUserUpdated?.({ subscription: data.subscription });
      toast.success('Welcome to Flex Pro! 🎉');
    } catch {
      toast.error('Subscription failed — please try again');
    } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API}/users/${currentUser.id}/subscription`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Cancel failed');
      onUserUpdated?.({ subscription: { active: false, tier: 'free' } });
      toast.success('Subscription cancelled');
      setShowCancel(false);
    } catch {
      toast.error('Could not cancel — please try again');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-orange-500/30 mb-4">
          <Crown className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Flex Pro</h1>
        <p className="text-white/50 text-base max-w-md mx-auto">
          Everything you need to grow your training business and build client trust.
        </p>
      </div>

      {/* Non-trainer notice */}
      {!isTrainer && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 text-sm text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Flex Pro is for certified trainers. Switch your account type to Trainer in Settings to subscribe.</span>
        </div>
      )}

      {/* Active subscription banner */}
      {isPro && (
        <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/30 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              <span className="text-white font-semibold">Flex Pro — Active</span>
            </div>
            <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">$29 / mo</span>
          </div>
          <p className="text-white/50 text-xs">
            Renews on {sub?.renewsAt ? new Date(sub.renewsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
          </p>
          <button
            onClick={() => setShowCancel(true)}
            className="mt-3 text-xs text-red-400/70 hover:text-red-400 transition-colors"
          >
            Cancel subscription
          </button>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Free */}
        <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5">
          <div className="mb-4">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Free</p>
            <p className="text-3xl font-bold text-white">$0<span className="text-base font-normal text-white/30"> / mo</span></p>
          </div>
          <ul className="space-y-2.5 text-sm text-white/50">
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-white/25" /> Profile & booking page</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-white/25" /> Basic workout posts</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-white/25" /> Up to 20 bookings/month</li>
            <li className="flex items-center gap-2"><X className="w-4 h-4 text-white/15" /> <span className="opacity-40">Analytics dashboard</span></li>
            <li className="flex items-center gap-2"><X className="w-4 h-4 text-white/15" /> <span className="opacity-40">Verified badge</span></li>
          </ul>
          {!isPro && (
            <div className="mt-5 text-center text-xs text-white/30 py-2 border border-white/[0.06] rounded-xl">
              Current plan
            </div>
          )}
        </div>

        {/* Pro */}
        <div className={`relative bg-gradient-to-br from-amber-500/10 to-orange-600/5 border rounded-2xl p-5 ${isPro ? 'border-amber-500/40' : 'border-amber-500/20'}`}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-semibold px-3 py-1 rounded-full uppercase tracking-widest">
              Pro
            </span>
          </div>
          <div className="mb-4 mt-1">
            <p className="text-amber-400/70 text-xs uppercase tracking-widest mb-1">Pro Trainer</p>
            <p className="text-3xl font-bold text-white">$29<span className="text-base font-normal text-white/30"> / mo</span></p>
          </div>
          <ul className="space-y-2.5 text-sm">
            {PRO_FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-white/80">
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                {label}
              </li>
            ))}
          </ul>
          {!isPro && isTrainer && (
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-60 shadow-lg shadow-orange-500/20"
            >
              {loading ? 'Processing…' : 'Subscribe — $29/mo'}
            </button>
          )}
          {isPro && (
            <div className="mt-5 text-center text-xs text-amber-400/70 py-2 border border-amber-500/20 rounded-xl">
              ✓ Current plan
            </div>
          )}
        </div>
      </div>

      {/* Feature breakdown */}
      <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.08)] rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-5">What you get with Pro</h3>
        <div className="grid gap-4">
          {PRO_FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">{label}</p>
                <p className="text-white/40 text-xs mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-white/25 text-xs mt-6">
        Billed monthly. Cancel anytime. No contracts.
      </p>

      {/* Cancel confirm modal */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold mb-2">Cancel Flex Pro?</h3>
            <p className="text-white/50 text-sm mb-5">
              You'll lose your verified badge, analytics, and priority listing at the end of the current period.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancel(false)} className="flex-1 py-2.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/70 text-sm hover:bg-[rgba(201,169,110,0.04)] transition-all">
                Keep Pro
              </button>
              <button onClick={handleCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-all disabled:opacity-60">
                {loading ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
