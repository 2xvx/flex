// WeeklyChallengePage.tsx — auto-generated weekly challenge per community with live leaderboard

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Flame, Timer, Dumbbell, Zap, Loader2, Crown, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';
import { User } from '../types';

import { API } from '../../config';

interface Props { currentUser: User | null; }
interface Community { id: string; name: string; emoji: string; members: string[]; }
interface Leaderboard { uid: string; name: string; avatar: string; score: number; }
interface Challenge { type: string; label: string; unit: string; emoji: string; }

const CHALLENGE_ICONS: Record<string, React.ReactNode> = {
  workouts: <Dumbbell className="w-5 h-5 text-[#c9a96e]" />,
  duration: <Timer className="w-5 h-5 text-blue-400" />,
  calories: <Flame className="w-5 h-5 text-orange-400" />,
  streak:   <Zap className="w-5 h-5 text-yellow-400" />,
};

const CHALLENGE_COLORS: Record<string, string> = {
  workouts: 'from-[rgba(201,169,110,0.06)] to-[rgba(201,169,110,0.03)] border-[#c9a96e]/25',
  duration: 'from-blue-500/15 to-cyan-500/8 border-blue-500/25',
  calories: 'from-orange-500/15 to-amber-500/8 border-orange-500/25',
  streak:   'from-yellow-500/15 to-amber-500/8 border-yellow-500/25',
};

function daysLeft(weekEnd: string): number {
  return Math.max(0, Math.ceil((new Date(weekEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function WeeklyChallengePage({ currentUser }: Props) {
  const [communities,    setCommunities]    = useState<Community[]>([]);
  const [selectedComm,   setSelectedComm]   = useState<Community | null>(null);
  const [challenge,      setChallenge]      = useState<Challenge | null>(null);
  const [leaderboard,    setLeaderboard]    = useState<Leaderboard[]>([]);
  const [weekEnd,        setWeekEnd]        = useState('');
  const [loading,        setLoading]        = useState(false);
  const [showCommPicker, setShowCommPicker] = useState(false);

  // Load communities
  useEffect(() => {
    if (!currentUser) return;
    authFetch(`${API}/communities`)
      .then(r => r.json())
      .then(d => {
        const joined = (d.communities || []).filter((c: Community) => c.members?.includes(currentUser.id));
        setCommunities(joined);
        if (joined.length > 0) setSelectedComm(joined[0]);
      })
      .catch(() => {});
  }, [currentUser]);

  const loadChallenge = useCallback(async () => {
    if (!selectedComm) return;
    setLoading(true);
    try {
      const res  = await authFetch(`${API}/communities/${selectedComm.id}/weekly-challenge`);
      const data = await res.json();
      setChallenge(data.challenge || null);
      setLeaderboard(data.leaderboard || []);
      setWeekEnd(data.weekEnd || '');
    } catch { toast.error('Failed to load challenge'); }
    finally { setLoading(false); }
  }, [selectedComm]);

  useEffect(() => { loadChallenge(); }, [loadChallenge]);

  const myRank = leaderboard.findIndex(e => e.uid === currentUser?.id);
  const myEntry = myRank >= 0 ? leaderboard[myRank] : null;
  const maxScore = leaderboard[0]?.score || 1;

  if (!currentUser) {
    return <div className="py-20 text-center text-white/30 text-sm">Log in to join weekly challenges</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <div>
        <h2 className="text-white font-bold text-xl">Weekly Challenge 🏆</h2>
        <p className="text-white/40 text-sm mt-0.5">Auto-generated each Monday — compete with your community</p>
      </div>

      {communities.length === 0 && (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <Trophy className="w-10 h-10 text-white/15" />
          <p className="text-white/30 text-sm">Join a community to compete in weekly challenges</p>
        </div>
      )}

      {communities.length > 0 && (
        <>
          {/* Community selector */}
          {communities.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowCommPicker(v => !v)}
                className="flex items-center gap-2 px-3 py-2 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl text-white/70 text-sm hover:bg-[rgba(201,169,110,0.06)] transition-all"
              >
                <span>{selectedComm?.emoji}</span>
                <span>{selectedComm?.name}</span>
                <ChevronDown className="w-4 h-4 ml-1" />
              </button>
              {showCommPicker && (
                <div className="absolute top-full mt-1 left-0 z-20 bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-xl overflow-hidden shadow-xl w-56">
                  {communities.map(c => (
                    <button key={c.id} onClick={() => { setSelectedComm(c); setShowCommPicker(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-[rgba(201,169,110,0.04)] transition-all ${c.id === selectedComm?.id ? 'text-[#e8c98a]' : 'text-white/70'}`}>
                      <span>{c.emoji}</span><span>{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" /></div>}

          {!loading && challenge && (
            <>
              {/* Challenge header card */}
              <div className={`bg-gradient-to-br ${CHALLENGE_COLORS[challenge.type]} border rounded-2xl p-5 space-y-3`}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[rgba(201,169,110,0.06)] flex items-center justify-center">
                    {CHALLENGE_ICONS[challenge.type] || <Trophy className="w-5 h-5 text-white/40" />}
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">{challenge.emoji} {challenge.label}</p>
                    <p className="text-white/40 text-xs">This week · {daysLeft(weekEnd)} day{daysLeft(weekEnd) !== 1 ? 's' : ''} left</p>
                  </div>
                </div>

                {/* Your position */}
                {myEntry && (
                  <div className="bg-black/20 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-2xl font-black text-white">#{myRank + 1}</span>
                    <div>
                      <p className="text-white/60 text-xs">Your score</p>
                      <p className="text-white font-bold">{myEntry.score.toLocaleString()} {challenge.unit}</p>
                    </div>
                    {myRank === 0 && <Crown className="w-5 h-5 text-yellow-400 ml-auto" />}
                  </div>
                )}

                {!myEntry && (
                  <p className="text-white/35 text-xs text-center">Log workouts this week to appear on the leaderboard</p>
                )}
              </div>

              {/* Leaderboard */}
              {leaderboard.length > 0 && (
                <div className="space-y-3">
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Leaderboard</p>
                  <div className="space-y-2">
                    {leaderboard.map((entry, i) => {
                      const isMe = entry.uid === currentUser.id;
                      const barWidth = maxScore > 0 ? (entry.score / maxScore) * 100 : 0;
                      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                      return (
                        <div
                          key={entry.uid}
                          className={`relative border rounded-xl px-4 py-3 overflow-hidden transition-all ${
                            isMe ? 'bg-[rgba(201,169,110,0.08)] border-[rgba(201,169,110,0.25)]' : 'bg-[rgba(201,169,110,0.03)] border-[rgba(201,169,110,0.06)]'
                          }`}
                        >
                          {/* Progress bar behind */}
                          <div
                            className="absolute left-0 top-0 bottom-0 rounded-xl transition-all duration-700"
                            style={{ width: `${barWidth}%`, background: isMe ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)' }}
                          />
                          <div className="relative flex items-center gap-3">
                            <span className={`text-sm font-bold w-8 shrink-0 ${i < 3 ? 'text-base' : 'text-white/30'}`}>
                              {medal || `#${i + 1}`}
                            </span>
                            <Avatar className="w-8 h-8 shrink-0">
                              <AvatarImage src={entry.avatar} />
                              <AvatarFallback className="bg-[#c9a96e] text-white text-xs">{entry.name?.[0]}</AvatarFallback>
                            </Avatar>
                            <span className={`flex-1 text-sm font-medium truncate ${isMe ? 'text-[#e8c98a]' : 'text-white/80'}`}>
                              {entry.name}{isMe && ' (you)'}
                            </span>
                            <span className={`text-sm font-bold shrink-0 ${isMe ? 'text-[#e8c98a]' : 'text-white/60'}`}>
                              {entry.score.toLocaleString()}
                              <span className="text-white/25 text-[10px] font-normal ml-1">{challenge.unit}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Refresh */}
              <button
                onClick={loadChallenge}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/4 border border-[rgba(201,169,110,0.07)] text-white/40 hover:text-white/70 text-sm transition-all"
              >
                <Loader2 className="w-3.5 h-3.5" /> Refresh standings
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
