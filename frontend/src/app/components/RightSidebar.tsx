// RightSidebar.tsx — Option C redesign
// Widgets:
//   1. Goals — SVG arc progress rings for "Post 10 workouts" + "7-day streak"
//   2. Challenge countdown — live timer to end of current month
//   3. Next workout — pulled from active program or last logged type
//   4. Leaderboard — compact top-3 ranked by likes

import { WorkoutPost, User } from '../types';
import { Trophy, Flame, Calendar, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';

interface RightSidebarProps {
  posts: WorkoutPost[];
  currentUser: User | null;
}

// ── SVG ring helper ────────────────────────────────────────────────────────────
// Renders a circular arc progress ring.
// pct: 0–100, r: radius, stroke: ring color, bg: track color
function Ring({
  pct, r = 28, stroke = '#c9a96e', bg = 'rgba(201,169,110,0.1)',
  children,
}: {
  pct: number; r?: number; stroke?: string; bg?: string; children?: React.ReactNode;
}) {
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const size = (r + 8) * 2;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={stroke} strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  );
}

// ── Streak helpers ─────────────────────────────────────────────────────────────
const calcStreak = (posts: WorkoutPost[], userId: string | undefined): number => {
  if (!userId) return 0;
  const postedDays = new Set(
    posts.filter(p => p.user?.id === userId)
      .map(p => new Date(p.createdAt || p.timestamp || '').toDateString())
  );
  let streak = 0;
  const date = new Date();
  while (postedDays.has(date.toDateString())) {
    streak++;
    date.setDate(date.getDate() - 1);
  }
  return streak;
};

// Days left in current month
const getDaysLeftInMonth = () => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

// Time remaining until end of month (hh:mm:ss)
const getTimeUntilEndOfMonth = () => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const diff = end.getTime() - now.getTime();
  const h = Math.floor(diff / 3_600_000) % 24;
  const m = Math.floor(diff / 60_000) % 60;
  const s = Math.floor(diff / 1000) % 60;
  return { h, m, s, totalDays: getDaysLeftInMonth() };
};

// Leaderboard
const buildLeaderboard = (posts: WorkoutPost[]) => {
  const map = new Map<string, { user: User; likes: number }>();
  posts.forEach(post => {
    if (!post.user?.id) return;
    const existing = map.get(post.user.id);
    if (existing) existing.likes += post.likes || 0;
    else map.set(post.user.id, { user: post.user, likes: post.likes || 0 });
  });
  return [...map.values()].sort((a, b) => b.likes - a.likes).slice(0, 3);
};

// ── Component ─────────────────────────────────────────────────────────────────

export function RightSidebar({ posts, currentUser }: RightSidebarProps) {
  const [streak, setStreak] = useState(0);
  const [countdown, setCountdown] = useState(getTimeUntilEndOfMonth());

  // Fetch authoritative streak from backend
  useEffect(() => {
    if (!currentUser?.id) return;
    const token = localStorage.getItem('fitconnect_id_token');
    fetch(`http://192.168.1.102:5000/api/users/${currentUser.id}/update-streak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (typeof d.streakDays === 'number') setStreak(d.streakDays); })
      .catch(() => setStreak(calcStreak(posts, currentUser?.id)));
  }, [currentUser?.id, posts.length]);

  // Live countdown — ticks every second
  useEffect(() => {
    const id = setInterval(() => setCountdown(getTimeUntilEndOfMonth()), 1000);
    return () => clearInterval(id);
  }, []);

  const myPosts      = posts.filter(p => p.user?.id === currentUser?.id);
  const totalMyPosts = myPosts.length;
  const targetPosts  = 10;
  const streakTarget = 7;
  const postPct      = Math.min(100, Math.round((totalMyPosts / targetPosts) * 100));
  const streakPct    = Math.min(100, Math.round((streak / streakTarget) * 100));
  const leaderboard  = buildLeaderboard(posts);

  // Guess next workout from most recent post type
  const lastPost     = myPosts[0];
  const lastType     = (lastPost as any)?.workoutType || lastPost?.type || 'Workout';
  const nextWorkout  = lastType === 'Upper' ? 'Lower Body' :
                       lastType === 'Lower' ? 'Push Day' :
                       lastType === 'Push'  ? 'Pull Day'  :
                       lastType === 'Pull'  ? 'Legs Day'  :
                       'Full Body';

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="w-[260px] shrink-0 h-screen sticky top-0 overflow-y-auto flex flex-col gap-3 p-4"
      style={{ background: '#080608', borderLeft: '1px solid rgba(201,169,110,0.08)' }}>

      {/* ══ 1. GOALS — SVG PROGRESS RINGS ══════════════════════════════════════ */}
      <div className="rounded-2xl border border-[rgba(201,169,110,0.08)] p-4"
        style={{ background: '#0d0b08' }}>
        <p className="text-white/35 text-[10px] uppercase tracking-widest font-medium mb-4">
          This month's goals
        </p>

        {/* Ring 1 — Post 10 workouts */}
        <div className="flex items-center gap-3 mb-4">
          <Ring pct={postPct} r={26} stroke="#c9a96e" bg="rgba(201,169,110,0.08)">
            <span style={{ fontSize: 11, fontWeight: 700, color: '#c9a96e' }}>{postPct}%</span>
          </Ring>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span style={{ fontSize: 13 }}>💪</span>
              <p className="text-white/80 text-xs font-medium">Post 10 workouts</p>
            </div>
            <p className="text-white/30 text-[10px]">{totalMyPosts} of {targetPosts} done</p>
            {postPct >= 100 && (
              <span className="inline-block mt-1 text-[9px] bg-[rgba(201,169,110,0.15)] text-[#c9a96e] border border-[rgba(201,169,110,0.2)] rounded-full px-2 py-0.5">
                ✓ Complete!
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-[rgba(201,169,110,0.05)] mb-4" />

        {/* Ring 2 — 7-day streak */}
        <div className="flex items-center gap-3">
          <Ring pct={streakPct} r={26} stroke="#f97316" bg="rgba(249,115,22,0.08)">
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>{streakPct}%</span>
          </Ring>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Flame className="w-3 h-3 text-orange-400 shrink-0" />
              <p className="text-white/80 text-xs font-medium">7-day streak</p>
            </div>
            <p className="text-white/30 text-[10px]">{Math.min(streak, streakTarget)} of {streakTarget} days</p>
            {streak === 0 && (
              <p className="text-white/20 text-[9px] mt-0.5">Post today to start!</p>
            )}
          </div>
        </div>
      </div>

      {/* ══ 2. CHALLENGE COUNTDOWN ══════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-[rgba(201,169,110,0.08)] p-4"
        style={{ background: '#0d0b08' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/35 text-[10px] uppercase tracking-widest font-medium">
            May challenge
          </p>
          <span className="text-[9px] text-[#c9a96e] bg-[rgba(201,169,110,0.1)] border border-[rgba(201,169,110,0.18)] rounded-full px-2 py-0.5">
            {countdown.totalDays}d left
          </span>
        </div>

        {/* Countdown digits */}
        <div className="flex items-center justify-center gap-2 py-1">
          {/* Days */}
          <div className="text-center">
            <div className="bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.1)] rounded-xl px-3 py-2 min-w-[44px]">
              <span className="text-2xl font-bold text-[#c9a96e] tabular-nums">{pad(countdown.totalDays)}</span>
            </div>
            <p className="text-white/25 text-[9px] mt-1 text-center">days</p>
          </div>
          <span className="text-[#c9a96e]/40 text-xl font-bold pb-4">:</span>
          {/* Hours */}
          <div className="text-center">
            <div className="bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.1)] rounded-xl px-3 py-2 min-w-[44px]">
              <span className="text-2xl font-bold text-[#c9a96e] tabular-nums">{pad(countdown.h)}</span>
            </div>
            <p className="text-white/25 text-[9px] mt-1 text-center">hrs</p>
          </div>
          <span className="text-[#c9a96e]/40 text-xl font-bold pb-4">:</span>
          {/* Minutes */}
          <div className="text-center">
            <div className="bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.1)] rounded-xl px-3 py-2 min-w-[44px]">
              <span className="text-2xl font-bold text-[#c9a96e] tabular-nums">{pad(countdown.m)}</span>
            </div>
            <p className="text-white/25 text-[9px] mt-1 text-center">min</p>
          </div>
        </div>

        <p className="text-white/20 text-[10px] text-center mt-2">
          Until the challenge ends — keep pushing!
        </p>
      </div>

      {/* ══ 3. NEXT WORKOUT ═════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-[rgba(201,169,110,0.08)] p-4"
        style={{ background: '#0d0b08' }}>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-3 h-3 text-[#c9a96e]" />
          <p className="text-white/35 text-[10px] uppercase tracking-widest font-medium">
            Next session
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.12)' }}>
            🏋️
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/85 text-sm font-medium truncate">{nextWorkout}</p>
            <p className="text-white/30 text-[10px]">Suggested · tomorrow</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-white/20 shrink-0" />
        </div>

        {/* Quick muscle tags */}
        <div className="flex flex-wrap gap-1 mt-3">
          {(nextWorkout.toLowerCase().includes('push') ? ['Chest','Shoulders','Triceps'] :
            nextWorkout.toLowerCase().includes('pull') ? ['Back','Biceps','Rear Delt'] :
            nextWorkout.toLowerCase().includes('leg')  ? ['Quads','Hamstrings','Glutes'] :
            nextWorkout.toLowerCase().includes('lower')? ['Quads','Hamstrings','Calves'] :
            ['Chest','Back','Shoulders']).map(m => (
            <span key={m} className="text-[9px] px-2 py-0.5 rounded-full border border-[rgba(201,169,110,0.12)] text-white/35">
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* ══ 4. LEADERBOARD — compact ════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-[rgba(201,169,110,0.08)] p-4"
        style={{ background: '#0d0b08' }}>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-3 h-3 text-yellow-400" />
          <p className="text-white/35 text-[10px] uppercase tracking-widest font-medium">
            Top this week
          </p>
        </div>

        {leaderboard.length === 0 ? (
          <p className="text-white/20 text-xs text-center py-2">No posts yet</p>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, i) => {
              const isMe = entry.user.id === currentUser?.id;
              const medal = ['🥇','🥈','🥉'][i] || `${i+1}`;
              return (
                <div key={entry.user.id}
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-colors ${
                    isMe ? 'bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.12)]' : ''
                  }`}>
                  <span className="text-sm shrink-0">{medal}</span>
                  {entry.user.avatar ? (
                    <img src={entry.user.avatar} alt={entry.user.name}
                      className="w-6 h-6 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#c9a96e] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                      {entry.user.name?.[0] || '?'}
                    </div>
                  )}
                  <span className={`flex-1 text-xs truncate ${isMe ? 'text-[#e8c98a] font-medium' : 'text-white/55'}`}>
                    {isMe ? 'You' : entry.user.name}
                  </span>
                  <span className="text-[10px] text-white/25 shrink-0">{entry.likes} ♥</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
