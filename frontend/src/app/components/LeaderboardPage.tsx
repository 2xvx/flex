// LeaderboardPage.tsx — Multi-category rankings + Hall of Fame

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Flame, Heart, Dumbbell, Users, Crown, Medal, Star } from 'lucide-react';
import { API } from '../../config';
import { User } from '../types';
import { getLeaderboard, getHallOfFame, LeaderboardCategory } from '../../services/leaderboardService';
import { toast } from 'sonner';
import { AnimatedNumber } from './ui/AnimatedNumber';

const CATEGORIES: { id: LeaderboardCategory; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
  { id: 'workouts', label: 'Workouts', icon: <Dumbbell className="w-4 h-4" />, color: 'violet', desc: 'Most workouts logged' },
  { id: 'likes',    label: 'Likes',    icon: <Heart    className="w-4 h-4" />, color: 'pink',   desc: 'Most likes received' },
  { id: 'prs',      label: 'PRs',      icon: <Flame    className="w-4 h-4" />, color: 'orange', desc: 'Most personal records' },
  { id: 'followers',label: 'Followers',icon: <Users    className="w-4 h-4" />, color: 'blue',   desc: 'Most followers' },
];

const COLOR_MAP: Record<string, string> = {
  violet: 'text-[#c9a96e] bg-[rgba(201,169,110,0.08)] border-[rgba(201,169,110,0.25)]',
  pink:   'text-pink-400   bg-pink-500/10   border-pink-500/30',
  orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  blue:   'text-blue-400   bg-blue-500/10   border-blue-500/30',
};

const BAR_COLOR: Record<string, string> = {
  violet: 'bg-[#c9a96e]',
  pink:   'bg-pink-500',
  orange: 'bg-orange-500',
  blue:   'bg-blue-400',
};

function Podium({ top3, color }: { top3: any[]; color: string }) {
  const [first, second, third] = [top3[0], top3[1], top3[2]];
  const barColor = BAR_COLOR[color] || 'bg-[#c9a96e]';

  const Avatar = ({ user, size = 'md' }: { user: any; size?: 'sm'|'md'|'lg' }) => {
    const sz = size === 'lg' ? 'w-14 h-14 text-lg' : size === 'md' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs';
    const initials = (user?.displayName || user?.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    return user?.avatar
      ? <img src={user.avatar} alt={user.displayName} className={`${sz} rounded-full object-cover border-2 border-[rgba(201,169,110,0.12)]`} />
      : <div className={`${sz} rounded-full ${barColor} flex items-center justify-center text-white font-bold`}>{initials}</div>;
  };

  if (!first) return null;
  return (
    <div className="flex items-end justify-center gap-2 mb-6 pt-4">
      {/* 2nd place */}
      <div className="flex flex-col items-center gap-1.5">
        <Avatar user={second} size="md" />
        <p className="text-white/70 text-xs font-medium text-center max-w-[64px] truncate">{second?.displayName || second?.name}</p>
        <div className={`w-16 h-16 ${barColor} opacity-70 rounded-t-lg flex items-end justify-center pb-1.5`}>
          <span className="text-white font-bold text-lg">2</span>
        </div>
      </div>
      {/* 1st place */}
      <div className="flex flex-col items-center gap-1.5 -mb-0">
        <Crown className="w-5 h-5 text-yellow-400 fill-yellow-400" />
        <Avatar user={first} size="lg" />
        <p className="text-white font-semibold text-xs text-center max-w-[72px] truncate">{first?.displayName || first?.name}</p>
        <div className={`w-16 h-24 ${barColor} rounded-t-lg flex items-end justify-center pb-1.5`}>
          <span className="text-white font-bold text-xl">1</span>
        </div>
      </div>
      {/* 3rd place */}
      <div className="flex flex-col items-center gap-1.5">
        <Avatar user={third} size="sm" />
        <p className="text-white/50 text-xs font-medium text-center max-w-[60px] truncate">{third?.displayName || third?.name}</p>
        <div className={`w-16 h-10 ${barColor} opacity-50 rounded-t-lg flex items-end justify-center pb-1.5`}>
          <span className="text-white font-bold text-base">3</span>
        </div>
      </div>
    </div>
  );
}

interface LeaderboardPageProps { currentUser: User | null; onViewProfile?: (uid: string) => void; }

export function LeaderboardPage({ currentUser, onViewProfile }: LeaderboardPageProps) {
  const [category, setCategory] = useState<LeaderboardCategory>('workouts');
  const [period, setPeriod]   = useState<'week'|'month'|'alltime'>('week');
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<any[]>([]);
  const [myRank,  setMyRank]  = useState<any>(null);
  const [hof,     setHof]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hofLoading, setHofLoading] = useState(true);

  // Fetch who the current user follows
  useEffect(() => {
    if (!currentUser?.id) return;
    import('../../utils/authToken').then(({ authFetch }) => {
      authFetch(`${API}/users/${currentUser.id}/following`)
        .then(r => r.json())
        .then((data: string[]) => setFollowing(new Set(data)))
        .catch(() => {});
    });
  }, [currentUser?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard(category, period, currentUser?.id);
      setEntries(data.leaderboard || []);
      setMyRank(data.myRank || null);
    } catch { toast.error('Could not load leaderboard'); }
    finally { setLoading(false); }
  }, [category, period, currentUser?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setHofLoading(true);
    getHallOfFame()
      .then(d => setHof(d.hallOfFame || []))
      .catch(() => {})
      .finally(() => setHofLoading(false));
  }, []);

  const cat = CATEGORIES.find(c => c.id === category)!;
  const filteredEntries = friendsOnly
    ? entries.filter(e => e.uid === currentUser?.id || following.has(e.uid))
    : entries;
  const top3 = filteredEntries.slice(0, 3);
  const rest = filteredEntries.slice(3);
  const max = Math.max(...filteredEntries.map(e => e.score), 1);

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-4 h-4 text-yellow-400 fill-yellow-400" />;
    if (rank === 2) return <Medal className="w-4 h-4 text-slate-300" />;
    if (rank === 3) return <Medal className="w-4 h-4 text-orange-400" />;
    return <span className="text-white/30 text-sm font-bold w-4 text-center">{rank}</span>;
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">
      <div>
        <h1 className="text-white font-semibold text-xl flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" /> Leaderboard
        </h1>
        <p className="text-white/40 text-sm mt-0.5">See how you stack up against the community</p>
      </div>

      {/* Category tabs */}
      <div className="grid grid-cols-4 gap-2">
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all
              ${category === c.id ? COLOR_MAP[c.color] : 'border-[rgba(201,169,110,0.08)] text-white/30 hover:text-white/50 hover:border-[rgba(201,169,110,0.12)]'}`}>
            {c.icon}
            {c.label}
          </button>
        ))}
      </div>

      {/* Period toggle + Friends filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-[rgba(201,169,110,0.04)] p-1 rounded-xl">
          {(['week','month','alltime'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/60'}`}>
              {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setFriendsOnly(f => !f)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            friendsOnly
              ? 'bg-[rgba(201,169,110,0.12)] border-[#c9a96e]/40 text-[#e8c98a]'
              : 'bg-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.12)] text-white/40 hover:text-white/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Friends only
        </button>
      </div>

      {/* My rank card */}
      {myRank && (
        <div className={`rounded-xl border p-3 flex items-center gap-3 ${COLOR_MAP[cat.color]}`}>
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            <span className="text-sm font-medium">Your rank</span>
          </div>
          <span className="ml-auto font-bold text-lg">#{myRank.rank}</span>
          <span className="text-sm opacity-70">{myRank.score} {category === 'workouts' ? 'workouts' : category === 'likes' ? 'likes' : category === 'prs' ? 'PRs' : 'followers'}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[72, 55, 80, 60, 48, 65].map((w, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
              <div className="skeleton w-7 h-7 rounded-full shrink-0" />
              <div className="skeleton w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3 rounded-lg" style={{ width: `${w}%` }} />
                <div className="skeleton h-2 w-16 rounded-md" />
              </div>
              <div className="skeleton h-4 w-14 rounded-md" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="w-8 h-8 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No data yet. Be the first to make it on the board!</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          {top3.length >= 2 && <Podium top3={top3} color={cat.color} />}

          {/* Full list */}
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const isMe = entry.uid === currentUser?.id;
              const initials = (entry.displayName || entry.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
              return (
                <div key={entry.uid}
                  onClick={() => onViewProfile?.(entry.uid)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                    ${isMe ? 'border-[rgba(201,169,110,0.25)] bg-[rgba(201,169,110,0.04)]' : 'border-[rgba(201,169,110,0.08)] bg-[#080608] hover:border-[rgba(201,169,110,0.12)]'}`}>
                  <div className="w-6 flex items-center justify-center shrink-0">
                    {rankIcon(i + 1)}
                  </div>
                  {entry.avatar
                    ? <img src={entry.avatar} alt={entry.displayName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    : <div className={`w-9 h-9 rounded-full ${BAR_COLOR[cat.color]} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>{initials}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isMe ? 'text-[#e8c98a]' : 'text-white'}`}>
                      {entry.displayName || entry.name} {isMe && <span className="text-[10px] text-[#c9a96e] ml-1">you</span>}
                    </p>
                    <div className="h-1.5 bg-[rgba(201,169,110,0.04)] rounded-full mt-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${BAR_COLOR[cat.color]} transition-all duration-700`}
                        style={{ width: `${Math.round((entry.score / max) * 100)}%` }} />
                    </div>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${isMe ? 'text-[#e8c98a]' : 'text-white/70'}`}><AnimatedNumber value={entry.score} duration={700} /></span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Hall of Fame */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <h2 className="text-white font-semibold text-base">Hall of Fame</h2>
          <span className="text-white/30 text-xs">All-time legends</span>
        </div>
        {hofLoading ? (
          <p className="text-white/30 text-sm text-center py-6">Loading…</p>
        ) : hof.length === 0 ? (
          <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-6 text-center">
            <Crown className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-white/30 text-sm">No hall of famers yet. Keep grinding!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hof.map((entry: any) => {
              const initials = (entry.displayName || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
              return (
                <div key={entry.uid}
                  onClick={() => onViewProfile?.(entry.uid)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 cursor-pointer hover:border-yellow-500/30 transition-all">
                  <Crown className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />
                  {entry.avatar
                    ? <img src={entry.avatar} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
                    : <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-300 text-xs font-semibold shrink-0">{initials}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-yellow-300 text-sm font-medium truncate">{entry.displayName}</p>
                    <p className="text-white/30 text-xs">{entry.reason}</p>
                  </div>
                  {entry.awardedAt && (
                    <span className="text-white/20 text-[10px] shrink-0">{new Date(entry.awardedAt).toLocaleDateString()}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
               