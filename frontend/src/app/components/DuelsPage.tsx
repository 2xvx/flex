// DuelsPage.tsx
//
// Friend Duels + Badge Rewards -- the Challenges page.
//
// Sections:
//   1. Active duels    -- live head-to-head cards with dual progress bars
//   2. Pending duels   -- incoming requests (accept / decline)
//   3. Create duel     -- pick a friend by username, set exercise + goal
//   4. Badge showcase  -- badge grid with earned / locked states

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Swords, Trophy, Check, Clock, Target, Zap, Flame, Star } from 'lucide-react';
import { User, Duel, Badge } from '../types';
import {
  createDuel, getUserDuels, acceptDuel, declineDuel,
  updateDuelScore, searchUserByUsername,
} from '../../services/duelService';
import { getUserBadges } from '../../services/notificationService';
import { getFollowingList } from '../../services/followService';
import { toast } from 'sonner';

import { API } from '../../config';

const DUEL_EXERCISES = [
  'Push-ups', 'Pull-ups', 'Squats', 'Burpees', 'Sit-ups',
  'Bench Press', 'Deadlift', 'Overhead Press', 'Dips',
];

// Days-left color coding
function daysLeftColor(days: number): string {
  if (days <= 1) return 'text-red-400 bg-red-500/10 border-red-500/20';
  if (days <= 3) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
}

interface DuelCardProps {
  duel: Duel;
  currentUserId: string;
  onScoreUpdate: (duelId: string, score: number) => void;
}

function DuelCard({ duel, currentUserId, onScoreUpdate }: DuelCardProps) {
  const isChallenger = duel.challengerId === currentUserId;
  const myName       = isChallenger ? duel.challengerName  : duel.challengedName;
  const myScore      = isChallenger ? duel.challengerScore : duel.challengedScore;
  const theirName    = isChallenger ? duel.challengedName  : duel.challengerName;
  const theirScore   = isChallenger ? duel.challengedScore : duel.challengerScore;
  const goal         = duel.goalTarget;

  const myPct    = Math.min(100, Math.round((myScore    / goal) * 100));
  const theirPct = Math.min(100, Math.round((theirScore / goal) * 100));

  const isWinner = duel.winnerId === currentUserId;

  const daysLeft = duel.endDate
    ? Math.max(0, Math.ceil((new Date(duel.endDate).getTime() - Date.now()) / 86400000))
    : duel.durationDays;

  // Inline score entry state
  const [inlineVal, setInlineVal] = useState('');
  const [showInline, setShowInline] = useState(false);

  const submitInline = () => {
    const n = Number(inlineVal);
    if (!isNaN(n) && n >= 0) {
      onScoreUpdate(duel.id, n);
      setInlineVal('');
      setShowInline(false);
    }
  };

  return (
    <div className={'bg-[#080608] border rounded-2xl p-5 space-y-4 ' + (
      duel.status === 'completed'
        ? isWinner ? 'border-yellow-500/30' : 'border-[rgba(201,169,110,0.08)]'
        : 'border-[rgba(201,169,110,0.08)]'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-[#c9a96e]" />
          <span className="text-white font-medium text-sm">{duel.exercise}</span>
          <span className="text-white/30 text-xs">&middot; {duel.goalType}</span>
        </div>
        <div className="flex items-center gap-2">
          {duel.status === 'active' && (
            <span className={'text-[10px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ' + daysLeftColor(daysLeft)}>
              <Clock className="w-2.5 h-2.5" />
              {daysLeft === 0 ? 'Ends today' : daysLeft + 'd left'}
            </span>
          )}
          {duel.status === 'completed' && (
            <span className={'text-xs px-2 py-0.5 rounded font-medium ' + (isWinner ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/10 text-white/40')}>
              {isWinner ? '🏆 You won!' : 'Completed'}
            </span>
          )}
        </div>
      </div>

      {/* VS scores */}
      <div className="grid grid-cols-3 items-center gap-3">
        <div className="text-center">
          <p className="text-white font-bold text-2xl">{myScore}</p>
          <p className="text-[#e8c98a] text-xs font-medium truncate">{myName} (you)</p>
        </div>
        <div className="text-center">
          <span className="text-white/20 font-bold text-lg">VS</span>
          <p className="text-white/30 text-xs mt-0.5">Goal: {goal}</p>
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-2xl">{theirScore}</p>
          <p className="text-white/60 text-xs truncate">{theirName}</p>
        </div>
      </div>

      {/* Progress bars */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>You</span><span>{myPct}%</span>
          </div>
          <div className="h-2 bg-[rgba(201,169,110,0.04)] rounded-full overflow-hidden">
            <div className="h-full bg-[#c9a96e] rounded-full transition-all duration-500" style={{ width: myPct + '%' }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>{theirName}</span><span>{theirPct}%</span>
          </div>
          <div className="h-2 bg-[rgba(201,169,110,0.04)] rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: theirPct + '%' }} />
          </div>
        </div>
      </div>

      {/* Score input row */}
      {duel.status === 'active' && (
        <div className="pt-1">
          {showInline ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={inlineVal}
                onChange={e => setInlineVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitInline(); if (e.key === 'Escape') setShowInline(false); }}
                placeholder={'New total ' + duel.goalType + '...'}
                autoFocus
                className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.25)] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[rgba(201,169,110,0.5)] placeholder:text-white/20"
              />
              <button
                onClick={submitInline}
                className="px-3 py-2 rounded-xl bg-[rgba(201,169,110,0.12)] border border-[rgba(201,169,110,0.25)] text-[#e8c98a] text-sm font-medium hover:bg-[rgba(201,169,110,0.18)] transition-all"
              >
                Save
              </button>
              <button onClick={() => setShowInline(false)} className="p-2 rounded-xl text-white/30 hover:text-white/60 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onScoreUpdate(duel.id, myScore + 1)}
                className="flex-1 py-2 rounded-xl bg-[rgba(201,169,110,0.12)] border border-[rgba(201,169,110,0.25)] text-[#e8c98a] text-sm font-medium hover:bg-[rgba(201,169,110,0.18)] transition-all"
              >
                + 1 {duel.goalType === 'reps' ? 'rep' : duel.goalType === 'workouts' ? 'workout' : 'kg'}
              </button>
              <button
                onClick={() => setShowInline(true)}
                className="px-4 py-2 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/50 text-sm hover:bg-[rgba(201,169,110,0.04)] transition-all"
              >
                Set score
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Badge grid card
function BadgeGridCard({ badge }: { badge: Badge }) {
  return (
    <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-[rgba(201,169,110,0.06)] to-[rgba(201,169,110,0.03)] rounded-2xl p-4 border border-[rgba(201,169,110,0.12)] hover:border-[rgba(201,169,110,0.25)] transition-all group">
      <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/15 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
        {(badge as any).icon || (badge as any).emoji || '🏅'}
      </div>
      <p className="text-white font-semibold text-xs text-center leading-tight">{(badge as any).name || (badge as any).title}</p>
      <p className="text-white/35 text-[10px] text-center leading-tight">{badge.description}</p>
      {(badge as any).earnedAt && (
        <p className="text-white/20 text-[10px]">{(badge as any).earnedAt.split('T')[0]}</p>
      )}
    </div>
  );
}

interface CreateDuelFormProps {
  currentUser: User;
  onCreated: (duel: Duel) => void;
  onClose: () => void;
}

function CreateDuelForm({ currentUser, onCreated, onClose }: CreateDuelFormProps) {
  const [username, setUsername]     = useState('');
  const [foundUser, setFoundUser]   = useState<any>(null);
  const [searching, setSearching]   = useState(false);
  const [exercise, setExercise]     = useState(DUEL_EXERCISES[0]);
  const [goalType, setGoalType]     = useState<'reps'|'weight'|'workouts'>('reps');
  const [goalTarget, setGoalTarget] = useState('100');
  const [duration, setDuration]     = useState('7');
  const [creating, setCreating]     = useState(false);
  const [followers, setFollowers]   = useState<any[]>([]);

  useEffect(() => {
    getFollowingList(currentUser.id).then(async (uids) => {
      if (!uids.length) return;
      try {
        const profiles = await Promise.all(
          uids.slice(0, 8).map(async (uid) => {
            const res = await fetch(`${API}/users/${uid}`);
            if (!res.ok) return null;
            return res.json();
          })
        );
        setFollowers(profiles.filter(Boolean));
      } catch {}
    });
  }, [currentUser.id]);

  const handleSearch = async () => {
    if (!username.trim()) return;
    setSearching(true);
    try {
      const user = await searchUserByUsername(username.trim().replace(/^@/, '').toLowerCase());
      if (user.uid === currentUser.id) { toast.error("You can't duel yourself!"); return; }
      setFoundUser(user);
    } catch {
      toast.error('User not found. Check the username.');
    } finally { setSearching(false); }
  };

  const handleCreate = async () => {
    if (!foundUser) return;
    setCreating(true);
    try {
      const duel = await createDuel({
        challengerId:   currentUser.id,
        challengerName: currentUser.name,
        challengedId:   foundUser.uid,
        challengedName: foundUser.displayName || foundUser.name || foundUser.username,
        exercise,
        goalType,
        goalTarget: parseInt(goalTarget) || 100,
        durationDays: parseInt(duration) || 7,
      });
      toast.success('Duel request sent to ' + (foundUser.displayName || foundUser.username) + '!');
      onCreated(duel);
      onClose();
    } catch { toast.error('Failed to create duel'); }
    finally { setCreating(false); }
  };

  return (
    <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-white font-medium text-sm">Challenge a friend</p>
        <button onClick={onClose} className="text-white/30 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        {followers.length > 0 && !foundUser && (
          <div className="mb-3">
            <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2 flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" /> Quick pick from your network
            </p>
            <div className="flex flex-wrap gap-2">
              {followers.map((u: any) => {
                const name = u.displayName || u.username || 'User';
                const avatarUrl = u.avatar ||
                  'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=7c3aed&color=fff';
                return (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => {
                      setUsername(u.username || name);
                      setFoundUser({ uid: u.uid, displayName: name, username: u.username || name });
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] hover:bg-[#c9a96e]/15 hover:border-[rgba(201,169,110,0.25)] transition-all group"
                  >
                    <img src={avatarUrl} alt={name} className="w-5 h-5 rounded-full object-cover" />
                    <span className="text-white/70 text-xs group-hover:text-white transition-colors">{name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <label className="text-white/40 text-xs block mb-1.5">Friend's username</label>
        <div className="flex gap-2">
          <input
            value={username}
            onChange={e => { setUsername(e.target.value); setFoundUser(null); }}
            placeholder="@username"
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 rounded-xl bg-[rgba(201,169,110,0.12)] border border-[rgba(201,169,110,0.25)] text-[#e8c98a] text-sm hover:bg-[rgba(201,169,110,0.18)] transition-all disabled:opacity-50"
          >
            {searching ? '...' : 'Find'}
          </button>
        </div>
        {foundUser && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded-xl">
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-green-300 text-sm">Found: {foundUser.displayName || foundUser.username}</span>
          </div>
        )}
      </div>

      <div>
        <label className="text-white/40 text-xs block mb-1.5">Exercise</label>
        <select
          value={exercise}
          onChange={e => setExercise(e.target.value)}
          className="w-full bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
        >
          {DUEL_EXERCISES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>
      </div>

      <div>
        <label className="text-white/40 text-xs block mb-1.5">What are you tracking?</label>
        <div className="flex gap-2">
          {(['reps', 'weight', 'workouts'] as const).map(t => (
            <button
              key={t}
              onClick={() => setGoalType(t)}
              className={'flex-1 py-2 rounded-xl text-xs font-medium border transition-all capitalize ' + (
                goalType === t
                  ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.45)] text-[#e8c98a]'
                  : 'border-[rgba(201,169,110,0.12)] text-white/50 hover:border-[rgba(201,169,110,0.18)]'
              )}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-white/40 text-xs block mb-1.5">Target ({goalType})</label>
          <input
            type="number"
            value={goalTarget}
            onChange={e => setGoalTarget(e.target.value)}
            className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
          />
        </div>
        <div>
          <label className="text-white/40 text-xs block mb-1.5">Duration (days)</label>
          <input
            type="number"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
          />
        </div>
      </div>

      <button
        disabled={!foundUser || creating}
        onClick={handleCreate}
        className="w-full py-2.5 rounded-xl bg-[#c9a96e] text-white text-sm font-medium hover:bg-[#c9a96e] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
      >
        <Swords className="w-4 h-4" />
        {creating ? 'Sending...' : 'Send duel request'}
      </button>
    </div>
  );
}

// Rich empty state
function DuelsEmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="py-8 space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] flex items-center justify-center mx-auto mb-4">
          <Swords className="w-7 h-7 text-white/20" />
        </div>
        <p className="text-white/60 font-semibold mb-1">No active duels yet</p>
        <p className="text-white/30 text-sm">Challenge a friend to a head-to-head workout competition</p>
      </div>

      {/* How it works */}
      <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.08)] rounded-2xl p-4 space-y-3">
        <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold">How it works</p>
        {[
          { icon: '1', label: 'Pick a friend', desc: 'Search by username or pick from who you follow' },
          { icon: '2', label: 'Set the stakes', desc: 'Choose an exercise, tracking type, goal, and duration' },
          { icon: '3', label: 'Compete!', desc: 'Log reps / workouts directly in the duel card' },
        ].map(step => (
          <div key={step.icon} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-[rgba(201,169,110,0.12)] flex items-center justify-center text-[#c9a96e] text-[10px] font-bold shrink-0 mt-0.5">
              {step.icon}
            </div>
            <div>
              <p className="text-white/70 text-xs font-medium">{step.label}</p>
              <p className="text-white/30 text-[10px]">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onNew}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#c9a96e] to-[#a07840] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-[rgba(201,169,110,0.15)] transition-all"
      >
        <Swords className="w-4 h-4" /> Start your first duel
      </button>
    </div>
  );
}

interface DuelsPageProps {
  currentUser: User | null;
}

export function DuelsPage({ currentUser }: DuelsPageProps) {
  const [duels, setDuels]       = useState<Duel[]>([]);
  const [badges, setBadges]     = useState<Badge[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab]           = useState<'duels'|'badges'>('duels');

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [d, b] = await Promise.all([
        getUserDuels(currentUser.id).catch(() => []),
        getUserBadges(currentUser.id).catch(() => []),
      ]);
      setDuels(d);
      setBadges(b);
    } finally { setLoading(false); }
  }, [currentUser]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (currentUser) {
        getUserDuels(currentUser.id).then(d => setDuels(d)).catch(() => {});
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [currentUser]);

  const handleAccept = async (duelId: string) => {
    try {
      await acceptDuel(duelId);
      setDuels(ds => ds.map(d => d.id === duelId ? { ...d, status: 'active' } : d));
      toast.success("Duel accepted! Let's go! 🔥");
    } catch { toast.error('Failed to accept duel'); }
  };

  const handleDecline = async (duelId: string) => {
    try {
      await declineDuel(duelId);
      setDuels(ds => ds.filter(d => d.id !== duelId));
    } catch { toast.error('Failed to decline duel'); }
  };

  const handleScoreUpdate = async (duelId: string, score: number) => {
    if (!currentUser) return;
    try {
      await updateDuelScore(duelId, currentUser.id, score);
      setDuels(ds => ds.map(d => {
        if (d.id !== duelId) return d;
        const isChallenger = d.challengerId === currentUser.id;
        return {
          ...d,
          challengerScore: isChallenger ? score : d.challengerScore,
          challengedScore: isChallenger ? d.challengedScore : score,
          status: score >= d.goalTarget ? 'completed' : d.status,
          winnerId: score >= d.goalTarget ? currentUser.id : d.winnerId,
        };
      }));
      if (score >= (duels.find(d => d.id === duelId)?.goalTarget ?? Infinity)) {
        toast.success('You hit the goal! 🏆 You won the duel!');
      }
    } catch { toast.error('Failed to update score'); }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[rgba(201,169,110,0.25)] border-t-[#c9a96e] animate-spin" />
        <p className="text-white/30 text-sm">Loading...</p>
      </div>
    );
  }

  const pending   = duels.filter(d => d.status === 'pending' && d.challengedId === currentUser?.id);
  const active    = duels.filter(d => d.status === 'active');
  const completed = duels.filter(d => d.status === 'completed');
  const noDuels   = duels.filter(d => d.status !== 'declined').length === 0;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold text-xl">Challenges</h1>
          <p className="text-white/40 text-sm mt-0.5">Duels · badges · rewards</p>
        </div>
        {tab === 'duels' && (
          <button
            onClick={() => setShowForm(f => !f)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#c9a96e] to-[#a07840] text-white text-sm font-medium transition-all shadow-lg shadow-[rgba(201,169,110,0.15)]"
          >
            <Plus className="w-4 h-4" />
            New duel
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[rgba(201,169,110,0.04)] p-1 rounded-xl">
        {(['duels', 'badges'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={'flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ' + (
              tab === t ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'
            )}>
            {t === 'duels'
              ? 'Duels (' + duels.filter(d => d.status !== 'declined').length + ')'
              : 'Badges (' + badges.length + ')'}
          </button>
        ))}
      </div>

      {tab === 'duels' && (
        <div className="space-y-4">
          {showForm && currentUser && (
            <CreateDuelForm
              currentUser={currentUser}
              onCreated={d => setDuels(prev => [d, ...prev])}
              onClose={() => setShowForm(false)}
            />
          )}

          {/* Pending requests */}
          {pending.length > 0 && (
            <div>
              <p className="text-white/50 text-xs font-medium uppercase tracking-widest mb-3">
                Incoming challenges ({pending.length})
              </p>
              {pending.map(duel => (
                <div key={duel.id} className="bg-[#080608] border border-yellow-500/20 rounded-2xl p-5 mb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Swords className="w-4 h-4 text-yellow-400" />
                    <p className="text-white font-medium text-sm">{duel.challengerName} challenged you!</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <span className="text-xs bg-[rgba(201,169,110,0.08)] text-[#e8c98a] px-2.5 py-1 rounded-full">{duel.exercise}</span>
                    <span className="text-xs bg-[rgba(201,169,110,0.04)] text-white/50 px-2.5 py-1 rounded-full">
                      <Target className="w-3 h-3 inline mr-1" />{duel.goalTarget} {duel.goalType}
                    </span>
                    <span className="text-xs bg-[rgba(201,169,110,0.04)] text-white/50 px-2.5 py-1 rounded-full">
                      <Clock className="w-3 h-3 inline mr-1" />{duel.durationDays} days
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecline(duel.id)}
                      className="flex-1 py-2 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/50 text-sm hover:bg-[rgba(201,169,110,0.04)] transition-all"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleAccept(duel.id)}
                      className="flex-1 py-2 rounded-xl bg-[#c9a96e] text-white text-sm font-medium transition-all flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active duels */}
          {active.length > 0 && (
            <div>
              <p className="text-white/50 text-xs font-medium uppercase tracking-widest mb-3">Active</p>
              <div className="space-y-3">
                {active.map(duel => (
                  <DuelCard key={duel.id} duel={duel} currentUserId={currentUser?.id ?? ''} onScoreUpdate={handleScoreUpdate} />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <p className="text-white/50 text-xs font-medium uppercase tracking-widest mb-3">Completed</p>
              <div className="space-y-3">
                {completed.map(duel => (
                  <DuelCard key={duel.id} duel={duel} currentUserId={currentUser?.id ?? ''} onScoreUpdate={handleScoreUpdate} />
                ))}
              </div>
            </div>
          )}

          {noDuels && !showForm && (
            <DuelsEmptyState onNew={() => setShowForm(true)} />
          )}
        </div>
      )}

      {/* Badges tab -- grid layout */}
      {tab === 'badges' && (
        <div>
          {badges.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] flex items-center justify-center mx-auto">
                <Trophy className="w-7 h-7 text-white/20" />
              </div>
              <div>
                <p className="text-white/40 text-sm font-medium">No badges yet</p>
                <p className="text-white/25 text-xs mt-1">Complete duels and challenges to earn badges</p>
              </div>
              {/* Sample locked badges */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { icon: '🏆', name: 'First Win', desc: 'Win your first duel' },
                  { icon: '🔥', name: 'On Fire', desc: '3-day workout streak' },
                  { icon: '💪', name: 'Iron Will', desc: 'Complete 10 workouts' },
                  { icon: '⚡', name: 'Speedster', desc: 'Log in 5 days in a row' },
                  { icon: '🦁', name: 'Beast Mode', desc: 'Burn 5000 kcal in a week' },
                  { icon: '🎯', name: 'Sharp Shot', desc: 'Hit a weekly goal exactly' },
                ].map((b, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 rounded-2xl p-3 border border-[rgba(201,169,110,0.06)] bg-[rgba(201,169,110,0.02)] opacity-40">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl grayscale">{b.icon}</div>
                    <p className="text-white/50 text-[10px] font-medium text-center">{b.name}</p>
                    <p className="text-white/20 text-[9px] text-center leading-tight">{b.desc}</p>
                    <span className="text-[9px] text-white/20 border border-white/10 px-1.5 py-0.5 rounded-full">Locked</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Earned badges</p>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                  <Star className="w-3 h-3 text-yellow-400" />
                  <span className="text-yellow-300 text-xs font-bold">{badges.length}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {badges.map((badge: any) => (
                  <BadgeGridCard key={badge.id} badge={badge} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
