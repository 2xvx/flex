import { useState } from 'react';
import {
  UserPlus, MapPin, Target, Dumbbell, X, Heart,
  MessageSquare, RefreshCw, Users, BadgeCheck, Zap,
  ChevronRight,
} from 'lucide-react';
import { User } from '../types';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';

import { API } from '../../config';

interface BuddyMatch {
  uid: string;
  displayName: string;
  username: string;
  avatar: string | null;
  bio: string;
  fitnessGoal: string;
  fitnessLevel: string;
  gym: string;
  gender: string;
  verified: boolean;
  accountType: string;
}

const GENDER_SYMBOL: Record<string, { symbol: string; color: string }> = {
  male:       { symbol: '♂', color: 'text-blue-400' },
  female:     { symbol: '♀', color: 'text-pink-400' },
  'non-binary': { symbol: '⚧', color: 'text-[#c9a96e]' },
};

const LEVEL_STYLE: Record<string, string> = {
  beginner:     'bg-green-500/15 text-green-400 border-green-500/25',
  intermediate: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  advanced:     'bg-orange-500/15 text-orange-400 border-orange-500/25',
  expert:       'bg-red-500/15 text-red-400 border-red-500/25',
};

interface Props {
  currentUser: User | null;
  onNavigate: (view: string) => void;
}

export function WorkoutBuddyPage({ currentUser, onNavigate }: Props) {
  const [matches, setMatches]       = useState<BuddyMatch[]>([]);
  const [index, setIndex]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [started, setStarted]       = useState(false);
  const [acting, setActing]         = useState(false);
  const [slide, setSlide]           = useState<'left' | 'right' | null>(null);
  const [matchedUser, setMatchedUser] = useState<BuddyMatch | null>(null);

  const current = matches[index] ?? null;
  const next    = matches[index + 1] ?? null;

  // ── Load matches from backend ──────────────────────────────────────────────
  const loadMatches = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API}/users/${currentUser.id}/buddy-matches`);
      if (!res.ok) throw new Error();
      const data: BuddyMatch[] = await res.json();
      setMatches(data);
      setIndex(0);
      setStarted(true);
    } catch {
      toast.error('Could not load matches — try again in a moment');
    } finally {
      setLoading(false);
    }
  };

  // ── Like / Skip ────────────────────────────────────────────────────────────
  const handleAction = async (action: 'like' | 'skip') => {
    if (!currentUser || !current || acting) return;
    setActing(true);
    setSlide(action === 'like' ? 'right' : 'left');

    try {
      const res = await authFetch(`${API}/users/${currentUser.id}/buddy-action`, {
        method: 'POST',
        body: JSON.stringify({ targetUid: current.uid, action }),
      });
      const data = await res.json();

      if (action === 'like' && data.matched) {
        // Show celebration before advancing
        setTimeout(() => {
          setMatchedUser(current);
          setSlide(null);
          setActing(false);
        }, 280);
      } else {
        setTimeout(() => {
          setIndex(i => i + 1);
          setSlide(null);
          setActing(false);
        }, 280);
      }
    } catch {
      toast.error('Action failed');
      setSlide(null);
      setActing(false);
    }
  };

  const dismissMatch = () => {
    setMatchedUser(null);
    setIndex(i => i + 1);
  };

  // ── Landing ────────────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="max-w-md mx-auto px-4 py-10 flex flex-col items-center text-center">
        {/* Hero icon */}
        <div className="relative mb-7">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[rgba(201,169,110,0.1)] to-[rgba(201,169,110,0.1)] border border-[rgba(201,169,110,0.15)] flex items-center justify-center">
            <UserPlus className="w-11 h-11 text-pink-400" />
          </div>
          <div className="absolute -top-2 -right-2 text-2xl">💪</div>
        </div>

        <h1 className="text-white font-black text-3xl mb-2 tracking-tight">Find Your Buddy</h1>
        <p className="text-white/45 text-sm mb-8 max-w-xs leading-relaxed">
          We match you with athletes who share your gym, goals, and fitness level. Connect and train together.
        </p>

        {/* Match criteria cards */}
        <div className="w-full bg-[#0d0b08] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5 mb-7 text-left space-y-3.5">
          <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-1">We consider</p>
          {[
            { icon: <MapPin className="w-4 h-4 text-pink-400" />,    text: 'Same gym or location' },
            { icon: <Target className="w-4 h-4 text-[#c9a96e]" />,  text: 'Similar fitness goals' },
            { icon: <Dumbbell className="w-4 h-4 text-blue-400" />,  text: 'Your workout level' },
            { icon: <Zap className="w-4 h-4 text-orange-400" />,     text: 'Profile completeness' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="shrink-0">{icon}</div>
              <span className="text-white/65 text-sm">{text}</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/20 ml-auto" />
            </div>
          ))}
        </div>

        <button
          onClick={loadMatches}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#c9a96e] to-[#a07840] text-white font-bold text-base  transition-all shadow-xl shadow-[rgba(201,169,110,0.15)] disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Finding matches…</>
            : '🔍  Start Matching'}
        </button>

        <p className="text-white/20 text-xs mt-4">
          Tip: fill in your gym and goal in Profile → Edit for better matches
        </p>
      </div>
    );
  }

  // ── Match celebration ──────────────────────────────────────────────────────
  if (matchedUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 flex flex-col items-center text-center">
        {/* Glow ring */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-pink-500/30 blur-2xl scale-150" />
          <div className="relative w-28 h-28 rounded-full border-4 border-pink-500 overflow-hidden shadow-xl shadow-pink-500/40">
            {matchedUser.avatar
              ? <img src={matchedUser.avatar} className="w-full h-full object-cover" alt={matchedUser.displayName} />
              : <div className="w-full h-full bg-[#a07840] flex items-center justify-center text-white text-3xl font-black">{matchedUser.displayName[0]}</div>
            }
          </div>
          <div className="absolute -top-3 -right-3 text-4xl">🎉</div>
        </div>

        <h2 className="text-white font-black text-4xl mb-1 tracking-tight">It's a Match!</h2>
        <p className="text-white/50 text-base mb-2">
          You and <span className="text-white font-semibold">{matchedUser.displayName}</span>
        </p>
        <p className="text-white/35 text-sm mb-8">both want to train together!</p>

        <div className="flex gap-3 w-full">
          <button
            onClick={() => { dismissMatch(); onNavigate('messages'); }}
            className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-[#c9a96e] to-[#a07840] text-white font-semibold  transition-all flex items-center justify-center gap-2 shadow-lg shadow-[rgba(201,169,110,0.15)]"
          >
            <MessageSquare className="w-4 h-4" />
            Send Message
          </button>
          <button
            onClick={dismissMatch}
            className="px-5 py-3.5 rounded-2xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/50 hover:bg-[rgba(201,169,110,0.06)] hover:text-white/70 transition-all text-sm font-medium"
          >
            Keep Going
          </button>
        </div>
      </div>
    );
  }

  // ── No more matches ────────────────────────────────────────────────────────
  if (!current) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.08)] flex items-center justify-center mb-5">
          <Users className="w-7 h-7 text-white/25" />
        </div>
        <h2 className="text-white font-bold text-xl mb-2">You've seen everyone!</h2>
        <p className="text-white/40 text-sm mb-6 max-w-xs leading-relaxed">
          No more new matches right now. Complete your profile (gym, goal, level) to attract more buddies.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => { setStarted(false); setMatches([]); setIndex(0); loadMatches(); }}
            className="px-5 py-3 rounded-2xl bg-[#c9a96e] hover:bg-[#c9a96e] text-white font-medium transition-all text-sm"
          >
            Refresh
          </button>
          <button
            onClick={() => onNavigate('profile')}
            className="px-5 py-3 rounded-2xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/50 hover:bg-[rgba(201,169,110,0.06)] transition-all text-sm"
          >
            Edit Profile
          </button>
        </div>
      </div>
    );
  }

  // ── Swipe card ─────────────────────────────────────────────────────────────
  const genderInfo = GENDER_SYMBOL[current.gender?.toLowerCase() ?? ''];
  const levelStyle = LEVEL_STYLE[current.fitnessLevel?.toLowerCase() ?? ''] ?? 'bg-[rgba(201,169,110,0.04)] text-white/40 border-[rgba(201,169,110,0.12)]';

  return (
    <div className="max-w-sm mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-white font-bold text-lg">Workout Buddy</h1>
          <p className="text-white/30 text-xs">{matches.length - index} people nearby</p>
        </div>
        <button
          onClick={() => { setStarted(false); setMatches([]); setIndex(0); }}
          className="text-white/25 hover:text-white/50 text-xs transition-colors"
        >
          Restart
        </button>
      </div>

      {/* Card stack */}
      <div className="relative mb-7" style={{ height: 500 }}>

        {/* Background peek card */}
        {next && (
          <div
            className="absolute inset-x-3 rounded-3xl bg-[#0d0b08] border border-[rgba(201,169,110,0.08)]"
            style={{ top: 12, bottom: -8, zIndex: 0 }}
          />
        )}

        {/* Main card */}
        <div
          className="absolute inset-0 rounded-3xl overflow-hidden border border-white/[0.09] shadow-2xl transition-all duration-[280ms]"
          style={{ zIndex: 1 }}
          data-slide={slide}
        >
          {/* CSS for slide animations via inline style */}
          <style>{`
            [data-slide="left"]  { transform: translateX(-110%) rotate(-10deg); opacity: 0; }
            [data-slide="right"] { transform: translateX(110%)  rotate(10deg);  opacity: 0; }
          `}</style>

          {/* Background layer */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d0b08] via-[#080608] to-[#080608]" />
          {current.avatar && (
            <img
              src={current.avatar}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-[0.12] blur-sm scale-110"
            />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/70" />

          {/* Content */}
          <div className="relative z-10 h-full flex flex-col p-6">

            {/* Avatar */}
            <div className="flex flex-col items-center pt-2 pb-4">
              <div className="relative mb-3">
                <div className="w-28 h-28 rounded-full border-2 border-[rgba(201,169,110,0.12)] overflow-hidden bg-gradient-to-br from-[#1a1508] to-[#0d0b08] flex items-center justify-center shadow-xl">
                  {current.avatar
                    ? <img src={current.avatar} className="w-full h-full object-cover" alt={current.displayName} />
                    : <span className="text-white text-4xl font-black">{current.displayName[0]}</span>
                  }
                </div>
                {current.verified && (
                  <div className="absolute bottom-0.5 right-0.5 w-7 h-7 rounded-full bg-blue-500 border-2 border-[#080608] flex items-center justify-center shadow-lg">
                    <BadgeCheck className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              {/* Name + gender */}
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-white font-bold text-xl leading-tight">{current.displayName}</h2>
                {genderInfo && (
                  <span className={`text-lg font-bold ${genderInfo.color}`}>{genderInfo.symbol}</span>
                )}
              </div>
              <p className="text-white/35 text-sm">@{current.username}</p>
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {current.fitnessLevel && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${levelStyle}`}>
                  {current.fitnessLevel}
                </span>
              )}
              {current.fitnessGoal && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-[#c9a96e]/15 text-[#e8c98a] border-[#c9a96e]/25 capitalize">
                  {current.fitnessGoal}
                </span>
              )}
              {current.accountType === 'trainer' && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-orange-500/15 text-orange-300 border-orange-500/25">
                  Trainer
                </span>
              )}
            </div>

            {/* Gym */}
            {current.gym ? (
              <div className="flex items-center justify-center gap-1.5 text-white/50 text-sm mb-4">
                <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                <span className="truncate">{current.gym}</span>
              </div>
            ) : (
              <div className="mb-4" />
            )}

            {/* Bio */}
            <div className="flex-1 flex items-start justify-center px-1">
              {current.bio ? (
                <p className="text-white/55 text-sm text-center leading-relaxed italic line-clamp-4">
                  "{current.bio}"
                </p>
              ) : (
                <p className="text-white/20 text-sm text-center italic">No bio added yet</p>
              )}
            </div>

            {/* Hint labels on hover - skip / connect indicators */}
            <div className="flex justify-between px-4 pt-4 pb-1 opacity-25">
              <span className="text-red-400 text-xs font-bold uppercase tracking-wider rotate-[-15deg] border border-red-400/50 px-2 py-0.5 rounded">SKIP</span>
              <span className="text-green-400 text-xs font-bold uppercase tracking-wider rotate-[15deg] border border-green-400/50 px-2 py-0.5 rounded">CONNECT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-6">
        {/* Skip */}
        <button
          onClick={() => handleAction('skip')}
          disabled={acting}
          className="group flex flex-col items-center gap-2 disabled:opacity-40"
        >
          <div className="w-16 h-16 rounded-full bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] flex items-center justify-center shadow-lg group-hover:bg-red-500/10 group-hover:border-red-500/20 transition-all duration-150">
            <X className="w-7 h-7 text-white/40 group-hover:text-red-400 transition-colors" />
          </div>
          <span className="text-white/25 text-xs group-hover:text-white/50 transition-colors">Skip</span>
        </button>

        {/* Connect */}
        <button
          onClick={() => handleAction('like')}
          disabled={acting}
          className="group flex flex-col items-center gap-2 disabled:opacity-40"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#c9a96e] to-[#a07840] flex items-center justify-center shadow-xl shadow-[rgba(201,169,110,0.2)]  transition-all duration-150 group-hover:scale-105">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <span className="text-white/40 text-xs group-hover:text-white/70 transition-colors font-medium">Connect 💪</span>
        </button>
      </div>
    </div>
  );
}
