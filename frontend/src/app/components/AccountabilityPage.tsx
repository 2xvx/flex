// AccountabilityPage.tsx — accountability pairs: matched on fitness goal, mutual nudge system

import { useState, useEffect, useCallback } from 'react';
import {
  UserCheck, UserPlus, Bell, LogOut, Loader2, Clock, Flame,
  CheckCircle2, AlertCircle, Dumbbell, RefreshCw,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { toast } from 'sonner';
import { authFetch } from '../../utils/authToken';
import { User } from '../types';

import { API } from '../../config';

interface Props { currentUser: User | null; }

interface Partner {
  uid: string;
  name: string;
  avatar: string;
  username: string;
  fitnessGoal: string;
  lastWorkout: string | null;
}

interface Pair {
  id: string;
  members: string[];
  fitnessGoal: string;
  createdAt: string;
  lastNudge: Record<string, string>;
  partner?: Partner;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = typeof iso === 'string' ? new Date(iso).getTime() : 0;
  if (!ms) return null;
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

function lastWorkoutLabel(iso: string | null): { text: string; urgent: boolean } {
  const d = daysSince(iso);
  if (d === null) return { text: 'No workouts logged yet', urgent: true };
  if (d === 0) return { text: 'Logged today ✓', urgent: false };
  if (d === 1) return { text: 'Yesterday', urgent: false };
  if (d <= 3) return { text: `${d} days ago`, urgent: false };
  return { text: `${d} days ago — needs a nudge!`, urgent: true };
}

export function AccountabilityPage({ currentUser }: Props) {
  const [pair,      setPair]      = useState<Pair | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [matching,  setMatching]  = useState(false);
  const [waiting,   setWaiting]   = useState(false);
  const [nudging,   setNudging]   = useState(false);
  const [leaving,   setLeaving]   = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser) { setLoading(false); return; }
    setLoading(true);
    try {
      const res  = await authFetch(`${API}/accountability/my-pair`);
      const data = await res.json();
      setPair(data.pair || null);
      setWaiting(false);
    } catch { toast.error('Failed to load accountability data'); }
    finally { setLoading(false); }
  }, [currentUser]);

  useEffect(() => { load(); }, [load]);

  const handleMatch = async () => {
    setMatching(true);
    try {
      const res  = await authFetch(`${API}/accountability/find-match`, { method: 'POST' });
      const data = await res.json();
      if (data.paired) {
        toast.success('Accountability pair found! 🤝');
        await load();
      } else if (data.waiting) {
        setWaiting(true);
        toast.success("You're on the waiting list — we'll match you soon!");
      } else {
        toast.error(data.error || 'Could not find a match right now');
      }
    } catch { toast.error('Failed to find match'); }
    finally { setMatching(false); }
  };

  const handleNudge = async () => {
    setNudging(true);
    try {
      await authFetch(`${API}/accountability/nudge`, { method: 'POST' });
      setNudgeSent(true);
      toast.success('Nudge sent! 👀');
    } catch { toast.error('Failed to send nudge'); }
    finally { setNudging(false); }
  };

  const handleLeave = async () => {
    if (!window.confirm('Leave your accountability pair?')) return;
    setLeaving(true);
    try {
      await authFetch(`${API}/accountability/leave`, { method: 'DELETE' });
      setPair(null);
      setWaiting(false);
      setNudgeSent(false);
      toast.success('You left your pair');
    } catch { toast.error('Failed to leave'); }
    finally { setLeaving(false); }
  };

  if (!currentUser) {
    return <div className="py-20 text-center text-white/30 text-sm">Log in to use accountability pairs</div>;
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" /></div>;
  }

  const partner   = pair?.partner;
  const lwLabel   = partner ? lastWorkoutLabel(partner.lastWorkout) : null;
  const daysSincePartnerWorkout = partner ? daysSince(partner.lastWorkout) : null;
  const canNudge  = daysSincePartnerWorkout !== null && daysSincePartnerWorkout >= 3 && !nudgeSent;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-white font-bold text-xl">Accountability Pairs 🤝</h2>
        <p className="text-white/40 text-sm mt-0.5">Get matched with someone chasing the same goal</p>
      </div>

      {/* How it works */}
      {!pair && !waiting && (
        <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.06)] rounded-2xl p-4 space-y-3">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">How it works</p>
          <div className="space-y-2">
            {[
              { icon: <UserPlus className="w-4 h-4 text-[#c9a96e]" />, text: 'Get matched with someone who shares your fitness goal' },
              { icon: <Bell className="w-4 h-4 text-amber-400" />, text: "You'll both get a ping if the other hasn't logged a workout in 3+ days" },
              { icon: <Flame className="w-4 h-4 text-orange-400" />, text: 'Keep each other accountable and build a streak together' },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[rgba(201,169,110,0.04)] flex items-center justify-center shrink-0">{step.icon}</div>
                <p className="text-white/50 text-sm leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waiting state */}
      {waiting && !pair && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-5 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto">
            <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <p className="text-amber-200 font-semibold">Looking for a match…</p>
            <p className="text-white/40 text-sm mt-1">We'll notify you as soon as we find someone with the same goal</p>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 mx-auto text-white/30 hover:text-white/60 text-xs transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Check for match
          </button>
        </div>
      )}

      {/* No pair yet */}
      {!pair && !waiting && (
        <button
          onClick={handleMatch}
          disabled={matching}
          className="w-full py-3.5 rounded-2xl bg-[#c9a96e] hover:bg-[#b8945a] disabled:opacity-60 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-[rgba(201,169,110,0.2)] transition-all"
        >
          {matching ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
          {matching ? 'Finding your match…' : 'Find My Accountability Partner'}
        </button>
      )}

      {/* Active pair */}
      {pair && partner && (
        <div className="space-y-4">
          {/* Partner card */}
          <div className="bg-gradient-to-br from-[rgba(201,169,110,0.06)] to-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.18)] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-14 h-14 ring-2 ring-[rgba(201,169,110,0.35)]">
                <AvatarImage src={partner.avatar} />
                <AvatarFallback className="bg-[#c9a96e] text-white font-bold">{partner.name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-bold">{partner.name}</p>
                  <UserCheck className="w-4 h-4 text-[#c9a96e]" />
                </div>
                <p className="text-white/40 text-xs">@{partner.username}</p>
                {partner.fitnessGoal && (
                  <span className="inline-block mt-1 text-[10px] bg-[#c9a96e]/15 text-[#e8c98a] border border-[#c9a96e]/25 px-2 py-0.5 rounded-full">
                    🎯 {partner.fitnessGoal}
                  </span>
                )}
              </div>
            </div>

            {/* Partner workout status */}
            <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${lwLabel!.urgent ? 'bg-red-500/10 border border-red-500/20' : 'bg-green-500/10 border border-green-500/20'}`}>
              {lwLabel!.urgent
                ? <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                : <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
              <div>
                <p className="text-white/70 text-xs font-medium">Last workout</p>
                <p className={`text-xs font-semibold ${lwLabel!.urgent ? 'text-red-300' : 'text-green-300'}`}>{lwLabel!.text}</p>
              </div>
            </div>

            {/* Nudge button */}
            <button
              onClick={handleNudge}
              disabled={nudging || nudgeSent || !lwLabel!.urgent}
              className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                nudgeSent
                  ? 'bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/30'
                  : canNudge
                    ? 'bg-amber-500/80 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20'
                    : 'bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.07)] text-white/25'
              }`}
            >
              {nudging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              {nudgeSent ? 'Nudge sent ✓' : !canNudge ? 'No nudge needed yet' : 'Send a nudge 👀'}
            </button>
          </div>

          {/* Your own status */}
          <div className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 space-y-2">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Your activity</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#c9a96e]/15 flex items-center justify-center">
                <Dumbbell className="w-4 h-4 text-[#c9a96e]" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Keep logging your workouts</p>
                <p className="text-white/35 text-xs">Your partner can see your activity status</p>
              </div>
            </div>
          </div>

          {/* Pair info + leave */}
          <div className="flex items-center justify-between text-xs text-white/25">
            <span>Paired {new Date(pair.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
            <button
              onClick={handleLeave}
              disabled={leaving}
              className="flex items-center gap-1 text-white/25 hover:text-red-400 transition-colors"
            >
              {leaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
              Leave pair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
