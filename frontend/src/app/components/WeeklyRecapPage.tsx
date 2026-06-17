import { useState, useEffect, useRef, useMemo } from 'react';
import { Flame, Dumbbell, Clock, Zap, Trophy, Share2, RefreshCw, Calendar, Star, Award, Target } from 'lucide-react';
import { User } from '../types';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';

import { API } from '../../config';

interface LastWeek {
  totalWorkouts: number;
  totalMinutes: number;
  totalCaloriesBurned: number;
  totalCaloriesLogged: number;
  workoutDays: number;
}

interface RecapData {
  week: { start: string; end: string };
  totalWorkouts: number;
  totalMinutes: number;
  totalCaloriesBurned: number;
  totalCaloriesLogged: number;
  workoutDays: number;
  topExercise: string | null;
  streak: number;
  fitnessGoal: string;
  displayName: string;
  avatar: string | null;
  lastWeek?: LastWeek;
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const GOAL_EMOJIS: Record<string, string> = {
  'lose weight': '🔥', 'build muscle': '💪', 'improve endurance': '🏃',
  'increase strength': '🏋️', 'stay active': '⚡', 'flexibility': '🧘',
};

const STAR_MESSAGES = [
  'Absolutely crushed it this week! 🔥',
  'Another week, another W 💪',
  'Consistency is your superpower ⚡',
  'Your future self says thank you 🙏',
  'Beast mode: activated 🦁',
];

// Performance tier based on workouts + minutes
function getPerfTier(workouts: number, minutes: number): { label: string; color: string; icon: string } {
  const score = workouts * 20 + minutes;
  if (score >= 300) return { label: 'Elite',       color: 'text-yellow-400',  icon: '💎' };
  if (score >= 180) return { label: 'On Fire',      color: 'text-orange-400', icon: '🔥' };
  if (score >= 80)  return { label: 'Consistent',   color: 'text-emerald-400', icon: '✅' };
  return              { label: 'Getting Started', color: 'text-blue-400',    icon: '🌱' };
}

// Milestones
interface Milestone { icon: string; label: string; achieved: boolean; }
function getMilestones(recap: RecapData): Milestone[] {
  return [
    { icon: '🏋️', label: '1+ workout',        achieved: recap.totalWorkouts >= 1 },
    { icon: '💪', label: '3+ workouts',        achieved: recap.totalWorkouts >= 3 },
    { icon: '🔥', label: '5+ day streak',      achieved: recap.streak >= 5 },
    { icon: '⏱',  label: '60+ active min',    achieved: recap.totalMinutes >= 60 },
    { icon: '⚡', label: '300+ kcal logged',   achieved: recap.totalCaloriesLogged >= 300 },
    { icon: '🏆', label: '500+ kcal burned',   achieved: recap.totalCaloriesBurned >= 500 },
  ];
}

interface Props {
  currentUser: User | null;
}

export function WeeklyRecapPage({ currentUser }: Props) {
  const [recap, setRecap]     = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser) loadRecap();
  }, [currentUser]);

  const loadRecap = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API}/users/${currentUser.id}/weekly-recap`);
      const data = await res.json();
      if (!res.ok || !data.week) throw new Error(data.error || 'Invalid recap data');
      setRecap(data);
    } catch {
      toast.error('Failed to load recap');
    } finally { setLoading(false); }
  };

  const handleShare = async () => {
    if (!recap) return;
    setSharing(true);
    try {
      const tier = getPerfTier(recap.totalWorkouts, recap.totalMinutes);
      const text =
        '💪 My week on Flex [' + tier.icon + ' ' + tier.label + ']:\n' +
        '🏋️ ' + recap.totalWorkouts + ' workouts (' + recap.workoutDays + ' days active)\n' +
        '⏱ ' + recap.totalMinutes + ' minutes active\n' +
        '🔥 ' + recap.totalCaloriesBurned + ' kcal burned\n' +
        (recap.totalCaloriesLogged > 0 ? '⚡ ' + recap.totalCaloriesLogged + ' kcal logged\n' : '') +
        (recap.streak > 0 ? '🔥 ' + recap.streak + '-day streak\n' : '') +
        (recap.topExercise ? '🏆 Top exercise: ' + recap.topExercise + '\n' : '') +
        '\n#FlexApp #FitnessJourney';
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Recap copied to clipboard! Paste it anywhere 📋');
      }
    } catch {
      toast.error('Sharing failed');
    } finally { setSharing(false); }
  };

  const starMsg = useMemo(() => STAR_MESSAGES[Math.floor(Math.random() * STAR_MESSAGES.length)], []);
  const goalEmoji = recap ? (GOAL_EMOJIS[recap.fitnessGoal?.toLowerCase() || ''] || '⚡') : '⚡';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <RefreshCw className="w-8 h-8 text-[#c9a96e] animate-spin" />
        <p className="text-white/40 text-sm">Compiling your week...</p>
      </div>
    );
  }

  if (!recap) return null;

  const hasActivity = recap.totalWorkouts > 0 || recap.totalCaloriesLogged > 0;
  const tier = getPerfTier(recap.totalWorkouts, recap.totalMinutes);
  const milestones = getMilestones(recap);
  const achievedCount = milestones.filter(m => m.achieved).length;

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-bold text-xl">Weekly Recap</h1>
          <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {fmt(recap.week.start)} — {fmt(recap.week.end)}
          </p>
        </div>
        <button
          onClick={loadRecap}
          className="p-2 rounded-xl bg-[rgba(201,169,110,0.04)] hover:bg-[rgba(201,169,110,0.08)] transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-white/40" />
        </button>
      </div>

      {/* Main card */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d0b08] via-[#080608] to-[#080608] border border-[rgba(201,169,110,0.18)] p-6 mb-5 shadow-2xl shadow-[rgba(201,169,110,0.2)]"
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[rgba(201,169,110,0.08)] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {recap.avatar
            ? <img src={recap.avatar} className="w-10 h-10 rounded-full object-cover border border-[rgba(201,169,110,0.12)]" alt="" />
            : <div className="w-10 h-10 rounded-full bg-[#c9a96e] flex items-center justify-center text-white font-semibold">{recap.displayName[0]}</div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">{recap.displayName}</p>
            <p className="text-white/40 text-xs">{hasActivity ? starMsg : 'Start logging workouts to see your recap!'}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-lg">{tier.icon}</span>
            <span className={'text-xs font-semibold ' + tier.color}>{tier.label}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <StatBox
            icon={<Dumbbell className="w-4 h-4 text-[#c9a96e]" />}
            label="Workouts"
            value={recap.totalWorkouts}
            sub={recap.workoutDays + ' day' + (recap.workoutDays !== 1 ? 's' : '') + ' active'}
            color="violet"
            delta={recap.lastWeek ? recap.totalWorkouts - recap.lastWeek.totalWorkouts : undefined}
          />
          <StatBox
            icon={<Clock className="w-4 h-4 text-blue-400" />}
            label="Minutes active"
            value={recap.totalMinutes}
            sub={'~' + (Math.round(recap.totalMinutes / 60 * 10) / 10) + 'h total'}
            color="blue"
            delta={recap.lastWeek ? recap.totalMinutes - recap.lastWeek.totalMinutes : undefined}
          />
          <StatBox
            icon={<Flame className="w-4 h-4 text-orange-400" />}
            label="Calories burned"
            value={recap.totalCaloriesBurned.toLocaleString()}
            sub="estimated"
            color="orange"
            delta={recap.lastWeek ? recap.totalCaloriesBurned - recap.lastWeek.totalCaloriesBurned : undefined}
          />
          <StatBox
            icon={<Zap className="w-4 h-4 text-emerald-400" />}
            label="Cal logged"
            value={recap.totalCaloriesLogged.toLocaleString()}
            sub="from nutrition"
            color="emerald"
            delta={recap.lastWeek ? recap.totalCaloriesLogged - recap.lastWeek.totalCaloriesLogged : undefined}
          />
        </div>

        {/* Week-over-week bar chart */}
        {recap.lastWeek && (recap.totalWorkouts > 0 || recap.lastWeek.totalWorkouts > 0) && (
          <div className="mb-5 bg-white/[0.04] rounded-2xl p-4">
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-3">vs last week</p>
            {[
              { label: 'Workouts', cur: recap.totalWorkouts, prev: recap.lastWeek.totalWorkouts, max: Math.max(recap.totalWorkouts, recap.lastWeek.totalWorkouts, 1) },
              { label: 'Minutes',  cur: recap.totalMinutes,  prev: recap.lastWeek.totalMinutes,  max: Math.max(recap.totalMinutes, recap.lastWeek.totalMinutes, 1) },
            ].map(({ label, cur, prev, max }) => {
              const diff = cur - prev;
              const diffPct = prev > 0 ? Math.round((diff / prev) * 100) : 0;
              return (
                <div key={label} className="mb-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/40 text-[10px]">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/30 text-[10px]">{prev} &rarr; <span className="text-white/70 font-medium">{cur}</span></span>
                      {diff !== 0 && (
                        <span className={'text-[9px] font-bold px-1 py-0.5 rounded ' + (diff > 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10')}>
                          {diff > 0 ? '+' : ''}{diffPct}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white/20 w-10">Last</span>
                      <div className="flex-1 h-1.5 bg-[rgba(201,169,110,0.04)] rounded-full overflow-hidden">
                        <div className="h-full bg-white/20 rounded-full transition-all" style={{ width: ((prev / max) * 100) + '%' }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-[#c9a96e]/70 w-10">This</span>
                      <div className="flex-1 h-1.5 bg-[rgba(201,169,110,0.04)] rounded-full overflow-hidden">
                        <div className="h-full bg-[#c9a96e] rounded-full transition-all" style={{ width: ((cur / max) * 100) + '%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Streak + top exercise */}
        <div className="flex gap-3">
          {recap.streak > 0 && (
            <div className="flex-1 flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <div>
                <p className="text-white text-sm font-bold">{recap.streak} days</p>
                <p className="text-white/40 text-[10px]">current streak</p>
              </div>
            </div>
          )}
          {recap.topExercise && (
            <div className="flex-1 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <div>
                <p className="text-white text-sm font-bold truncate">{recap.topExercise}</p>
                <p className="text-white/40 text-[10px]">top exercise</p>
              </div>
            </div>
          )}
        </div>

        {/* Activity dots */}
        {recap.totalWorkouts > 0 && (
          <div className="mt-4 pt-4 border-t border-[rgba(201,169,110,0.08)]">
            <p className="text-white/30 text-xs mb-2">Activity this week</p>
            <WeekDots workoutDays={recap.workoutDays} weekStart={recap.week.start} />
          </div>
        )}

        {/* Flex watermark */}
        <div className="absolute bottom-4 right-5 flex items-center gap-1 opacity-25">
          <span className="text-white text-xs font-bold">Flex</span>
          <span className="text-orange-400 text-xs">🔥</span>
        </div>
      </div>

      {/* Milestones this week */}
      {hasActivity && (
        <div className="mb-5 bg-[#0d0b08] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#c9a96e]" />
              <p className="text-white font-semibold text-sm">This Week's Milestones</p>
            </div>
            <span className="text-[10px] text-[#c9a96e] bg-[rgba(201,169,110,0.08)] px-2 py-0.5 rounded-full border border-[rgba(201,169,110,0.18)]">
              {achievedCount}/{milestones.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {milestones.map((m, i) => (
              <div
                key={i}
                className={'flex flex-col items-center gap-1.5 rounded-xl p-2.5 border transition-all ' + (
                  m.achieved
                    ? 'bg-[rgba(201,169,110,0.06)] border-[rgba(201,169,110,0.18)]'
                    : 'bg-[rgba(201,169,110,0.02)] border-[rgba(201,169,110,0.05)] opacity-40'
                )}
              >
                <span className={'text-lg ' + (m.achieved ? '' : 'grayscale opacity-50')}>{m.icon}</span>
                <p className={'text-[10px] text-center leading-tight ' + (m.achieved ? 'text-white/70' : 'text-white/30')}>{m.label}</p>
                {m.achieved && <span className="text-[8px] text-emerald-400 font-bold">Done</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No activity nudge */}
      {!hasActivity && (
        <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5 mb-4 text-center">
          <p className="text-white/60 text-sm mb-1">Nothing logged this week yet</p>
          <p className="text-white/30 text-xs">Head to My Workouts and log a session to see your stats here.</p>
        </div>
      )}

      {/* Share button */}
      <button
        onClick={handleShare}
        disabled={sharing || !hasActivity}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-[#c9a96e] to-[#a07840] text-white font-semibold transition-all disabled:opacity-50 shadow-lg shadow-[rgba(201,169,110,0.15)]"
      >
        <Share2 className="w-4 h-4" />
        {sharing ? 'Sharing...' : 'Share Recap'}
      </button>
      <p className="text-center text-white/25 text-xs mt-3">
        Copies a summary to share anywhere
      </p>
    </div>
  );
}

function StatBox({ icon, label, value, sub, color, delta }: {
  icon: React.ReactNode; label: string; value: number | string; sub: string; color: string; delta?: number;
}) {
  const bg: Record<string, string> = {
    violet:  'bg-[rgba(201,169,110,0.08)] border-[#c9a96e]/15',
    blue:    'bg-blue-500/10 border-blue-500/15',
    orange:  'bg-orange-500/10 border-orange-500/15',
    emerald: 'bg-emerald-500/10 border-emerald-500/15',
  };
  return (
    <div className={'rounded-2xl border p-3.5 ' + (bg[color] || bg.violet)}>
      <div className="mb-2">{icon}</div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <p className="text-white text-xl font-bold leading-none">{value}</p>
        {delta !== undefined && delta !== 0 && (
          <span className={'text-[10px] font-semibold px-1 py-0.5 rounded-md ' + (delta > 0 ? 'text-emerald-400 bg-emerald-500/15' : 'text-red-400 bg-red-500/15')}>
            {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}
          </span>
        )}
        {delta === 0 && (
          <span className="text-[10px] text-white/25 px-1 py-0.5 rounded-md bg-[rgba(201,169,110,0.04)]">—</span>
        )}
      </div>
      <p className="text-white/50 text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-white/25 text-[10px] mt-0.5">{sub}</p>
    </div>
  );
}

function WeekDots({ workoutDays, weekStart }: { workoutDays: number; weekStart: string }) {
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // Get actual day-of-week labels starting from weekStart
  const startDate = new Date(weekStart);
  const days = dayLabels.map((_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-US', { weekday: 'narrow' });
  });
  return (
    <div className="flex gap-2">
      {days.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className={'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium transition-all ' + (
            i < workoutDays ? 'bg-[#c9a96e] text-white' : 'bg-[rgba(201,169,110,0.04)] text-white/20'
          )}>
            {i <