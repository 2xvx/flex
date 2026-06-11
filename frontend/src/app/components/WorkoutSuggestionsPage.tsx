// WorkoutSuggestionsPage.tsx — all 4 improvements
// A: Start session button per day + log completed day
// B: Swap exercise with alternatives
// C: Adherence tracking heatmap (localStorage)
// D: AI chat refinement (inline tweak prompt)

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles, RefreshCw, Dumbbell, ChevronDown, ChevronUp,
  Zap, Clock, Play, CheckCircle2, ArrowLeftRight, MessageSquare,
  Send, X, Flame,
} from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { User } from '../types';
import { API } from '../../config';
import { toast } from 'sonner';

interface WorkoutSuggestionsPageProps { currentUser: User | null; }

const DAY_COLORS = [
  'from-[rgba(201,169,110,0.08)] to-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.18)]',
  'from-blue-600/20 to-blue-900/10 border-blue-500/20',
  'from-orange-600/20 to-orange-900/10 border-orange-500/20',
  'from-pink-600/20 to-pink-900/10 border-[rgba(201,169,110,0.15)]',
  'from-teal-600/20 to-teal-900/10 border-teal-500/20',
];
const DAY_ACCENT = ['text-[#c9a96e]','text-blue-400','text-orange-400','text-pink-400','text-teal-400'];
const LEVEL_CFG: Record<string, { color: string; bg: string; label: string }> = {
  beginner:     { color: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/25',  label: 'Beginner'     },
  intermediate: { color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/25',label: 'Intermediate' },
  advanced:     { color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/25',      label: 'Advanced'     },
  expert:       { color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/25',      label: 'Expert'       },
};

// Option B — swap alternatives per muscle group keywords
const SWAP_ALTERNATIVES: Record<string, string[]> = {
  'squat':          ['Goblet Squat', 'Leg Press', 'Bulgarian Split Squat', 'Hack Squat'],
  'deadlift':       ['Romanian Deadlift', 'Trap Bar Deadlift', 'Sumo Deadlift', 'Cable Pull-through'],
  'bench':          ['Dumbbell Press', 'Machine Chest Press', 'Push-Up', 'Cable Fly'],
  'pull':           ['Lat Pulldown', 'Cable Row', 'Machine Row', 'Dumbbell Row'],
  'row':            ['Cable Row', 'Dumbbell Row', 'T-Bar Row', 'Chest-Supported Row'],
  'ohp':            ['Dumbbell Press', 'Arnold Press', 'Machine Press', 'Landmine Press'],
  'press':          ['Dumbbell Press', 'Machine Press', 'Push-Up', 'Cable Press'],
  'curl':           ['Hammer Curl', 'Cable Curl', 'Preacher Curl', 'EZ-Bar Curl'],
  'default':        ['Dumbbell variation', 'Machine variation', 'Bodyweight variation', 'Cable variation'],
};

function getAlternatives(exercise: string): string[] {
  const lower = exercise.toLowerCase();
  for (const [key, alts] of Object.entries(SWAP_ALTERNATIVES)) {
    if (key !== 'default' && lower.includes(key)) return alts;
  }
  return SWAP_ALTERNATIVES.default;
}

// Option C — adherence stored in localStorage
const ADHERENCE_KEY = 'flex_plan_adherence';
function loadAdherence(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(ADHERENCE_KEY) || '{}'); } catch { return {}; }
}
function logAdherenceDay(planGoal: string, day: string) {
  const data = loadAdherence();
  const key = planGoal || 'plan';
  const week = getWeekKey();
  const fullKey = `${key}_${week}`;
  if (!data[fullKey]) data[fullKey] = [];
  if (!data[fullKey].includes(day)) data[fullKey].push(day);
  localStorage.setItem(ADHERENCE_KEY, JSON.stringify(data));
}
function getWeekKey() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}
function getAdherenceDays(planGoal: string): string[] {
  const data = loadAdherence();
  const key = `${planGoal || 'plan'}_${getWeekKey()}`;
  return data[key] || [];
}

export function WorkoutSuggestionsPage({ currentUser }: WorkoutSuggestionsPageProps) {
  const [plan, setPlan]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>('Monday');

  // Option B — swap state
  const [swapTarget, setSwapTarget]   = useState<{ day: string; exIdx: number } | null>(null);
  const [swappedExs, setSwappedExs]   = useState<Record<string, Record<number, string>>>({});

  // Option C — adherence
  const [adherenceDays, setAdherenceDays] = useState<string[]>([]);

  // Option D — AI chat
  const [showChat, setShowChat] = useState(false);
  const [chatMsg, setChatMsg]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  const load = useCallback(async (tweak?: string) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const url = tweak
        ? `${API}/users/${currentUser.id}/workout-suggestions?tweak=${encodeURIComponent(tweak)}`
        : `${API}/users/${currentUser.id}/workout-suggestions`;
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
        setAdherenceDays(getAdherenceDays(data?.goal || 'plan'));
        setSwappedExs({});
      }
    } catch {} finally { setLoading(false); }
  }, [currentUser]);

  useEffect(() => { load(); }, [load]);

  // Option D — send chat tweak
  const sendTweak = async () => {
    if (!chatMsg.trim()) return;
    const msg = chatMsg;
    setChatMsg(''); setChatLoading(true); setShowChat(false);
    toast.info(`Tweaking plan: "${msg}"…`);
    await load(msg);
    setChatLoading(false);
    toast.success('Plan updated!');
  };

  if (!currentUser) return null;

  const workoutDays: Set<string> = new Set(plan?.weekPlan?.map((d: any) => d.day) || []);
  const lvl = LEVEL_CFG[plan?.level] || LEVEL_CFG.beginner;

  // Option C — adherence stats
  const totalWorkoutDays = workoutDays.size;
  const completedDays    = adherenceDays.length;
  const adherencePct     = totalWorkoutDays > 0 ? Math.round((completedDays / totalWorkoutDays) * 100) : 0;

  const handleStartDay = (day: string) => {
    logAdherenceDay(plan?.goal || 'plan', day);
    setAdherenceDays(getAdherenceDays(plan?.goal || 'plan'));
    toast.success(`${day} logged as completed! 💪`);
  };

  return (
    <div className="max-w-xl mx-auto py-6 px-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-black text-2xl tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#c9a96e]" /> AI Plan
          </h1>
          <p className="text-white/35 text-sm mt-0.5">Personalised for your goals</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Option D — AI chat button */}
          <button onClick={() => setShowChat(v => !v)} disabled={!plan}
            className={`p-2 rounded-xl border text-xs transition-all ${showChat ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.35)] text-[#e8c98a]' : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:text-white/70 bg-[rgba(201,169,110,0.04)]'}`}
            title="Tweak your plan">
            <MessageSquare className="w-4 h-4" />
          </button>
          <button onClick={() => load()} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[rgba(201,169,110,0.04)] hover:bg-[rgba(201,169,110,0.08)] text-white/50 hover:text-white text-sm transition-all disabled:opacity-40 border border-white/[0.06]">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Option D — AI chat input */}
      {showChat && (
        <div className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.15)] rounded-2xl p-4 space-y-3">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#c9a96e]" /> Tweak your plan
          </p>
          <div className="flex gap-2 flex-wrap">
            {["Make it harder", "Add more cardio", "Bodyweight only", "Shorter sessions"].map(s => (
              <button key={s} onClick={() => setChatMsg(s)}
                className="px-2.5 py-1 rounded-lg bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.15)] text-[#e8c98a] text-xs hover:bg-[rgba(201,169,110,0.12)] transition-all">
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendTweak()}
              placeholder="e.g. Swap squats for lunges…"
              className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.45)]" />
            <button onClick={sendTweak} disabled={!chatMsg.trim() || chatLoading}
              className="px-3 py-2 rounded-xl bg-[#c9a96e] text-white text-sm hover:bg-[#a07840] disabled:opacity-40 transition-all">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 pt-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : !plan ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(201,169,110,0.04)] flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="w-7 h-7 text-white/25" />
          </div>
          <p className="text-white/50 text-sm mb-1">No plan yet</p>
          <p className="text-white/25 text-xs">Fill in your profile (goal + level) to generate your plan</p>
        </div>
      ) : (
        <>
          {/* Hero summary */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d0b08] via-[#080608] to-[#080608] border border-[rgba(201,169,110,0.18)] p-5">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-[rgba(201,169,110,0.08)] rounded-full blur-2xl pointer-events-none" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Your plan</p>
                <h2 className="text-white font-black text-xl mb-3 capitalize">{plan.goal?.replace(/-/g,' ') || 'Custom Plan'}</h2>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize ${lvl.bg} ${lvl.color}`}>{lvl.label}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full border bg-blue-500/15 text-blue-300 border-blue-500/25">{plan.frequency}×/week</span>
                  <span className="text-xs px-2.5 py-1 rounded-full border bg-[rgba(201,169,110,0.06)] text-white/50 border-[rgba(201,169,110,0.12)]">{plan.weekPlan?.length || 0} workouts</span>
                </div>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[rgba(201,169,110,0.12)] flex items-center justify-center shrink-0">
                <Sparkles className="w-7 h-7 text-[#c9a96e]" />
              </div>
            </div>
          </div>

          {/* Option C — Adherence tracker */}
          {workoutDays.size > 0 && (
            <div className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.10)] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">This week</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${completedDays === totalWorkoutDays && totalWorkoutDays > 0 ? 'text-green-300 bg-green-500/15' : 'text-[#e8c98a] bg-[rgba(201,169,110,0.12)]'}`}>
                  {completedDays}/{totalWorkoutDays} done · {adherencePct}%
                </span>
              </div>
              <div className="flex gap-2">
                {allDays.map(day => {
                  const isWorkout  = workoutDays.has(day);
                  const isComplete = adherenceDays.includes(day);
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-medium transition-all ${
                        !isWorkout ? 'bg-[rgba(201,169,110,0.03)] text-white/15'
                        : isComplete ? 'bg-green-500 text-white'
                        : 'bg-[rgba(201,169,110,0.10)] border border-[rgba(201,169,110,0.20)] text-[#c9a96e]'
                      }`}>
                        {isComplete ? '✓' : day.slice(0,1)}
                      </div>
                      <span className="text-[9px] text-white/20">{day.slice(0,3)}</span>
                    </div>
                  );
                })}
              </div>
              {completedDays === totalWorkoutDays && totalWorkoutDays > 0 && (
                <div className="mt-3 flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
                  <Flame className="w-4 h-4 text-green-400" />
                  <p className="text-green-300 text-xs font-medium">Perfect week! All workouts completed 🔥</p>
                </div>
              )}
            </div>
          )}

          {/* Weekly schedule */}
          <div className="space-y-2.5">
            <p className="text-white/35 text-xs font-semibold uppercase tracking-widest px-1">Weekly Schedule</p>
            {allDays.map((day) => {
              const dayPlan = plan.weekPlan?.find((d: any) => d.day === day);
              const isRest  = !dayPlan;
              const isOpen  = expanded === day;
              const isCompleted = adherenceDays.includes(day);
              const colorIdx = plan.weekPlan?.findIndex((d: any) => d.day === day) ?? -1;
              const grad     = colorIdx >= 0 ? DAY_COLORS[colorIdx % DAY_COLORS.length] : '';
              const accent   = colorIdx >= 0 ? DAY_ACCENT[colorIdx % DAY_ACCENT.length] : 'text-white/25';

              // Get exercises for this day (with swaps applied)
              const dayExercises: string[] = (dayPlan?.exercises || []).map((ex: string, idx: number) =>
                swappedExs[day]?.[idx] ?? ex
              );

              return (
                <div key={day} className={`rounded-2xl border overflow-hidden transition-all ${
                  isRest ? 'bg-white/[0.02] border-white/[0.05] opacity-50' : `bg-gradient-to-br ${grad}`
                }`}>
                  <button disabled={isRest} onClick={() => !isRest && setExpanded(isOpen ? null : day)}
                    className="w-full flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                        isRest ? 'bg-[rgba(201,169,110,0.04)] text-white/20' : isCompleted ? 'bg-green-500 text-white' : 'bg-white/10 ' + accent
                      }`}>
                        {isRest ? 'R' : isCompleted ? '✓' : day.slice(0,2)}
                      </div>
                      <div className="text-left">
                        <p className={`font-semibold text-sm ${isRest ? 'text-white/30' : 'text-white'}`}>{day}</p>
                        <p className={`text-xs ${isRest ? 'text-white/20' : 'text-white/45'}`}>{isRest ? 'Rest & Recovery' : dayPlan.focus}</p>
                      </div>
                    </div>
                    {!isRest && (
                      <div className="flex items-center gap-2">
                        {isCompleted && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                        <span className="text-white/25 text-xs">{dayPlan.exercises?.length} exercises</span>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                      </div>
                    )}
                  </button>

                  {!isRest && isOpen && (
                    <div className="border-t border-[rgba(201,169,110,0.08)] px-4 pb-4 pt-3 space-y-2">
                      {dayExercises.map((ex: string, j: number) => (
                        <div key={j} className="flex items-center gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
                          <div className={`w-6 h-6 rounded-full bg-[rgba(201,169,110,0.06)] flex items-center justify-center text-[10px] font-bold ${accent} shrink-0`}>{j + 1}</div>
                          <p className="text-white/75 text-sm flex-1">{ex}</p>
                          {/* Option B — swap button */}
                          <button
                            onClick={() => setSwapTarget(swapTarget?.day === day && swapTarget?.exIdx === j ? null : { day, exIdx: j })}
                            className="text-white/20 hover:text-[#c9a96e] transition-colors p-1"
                            title="Swap exercise">
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Option B — Swap panel */}
                      {swapTarget?.day === day && swapTarget !== null && (
                        <div className="bg-black/20 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-white/40 text-[10px] uppercase tracking-wider">Swap with</p>
                            <button onClick={() => setSwapTarget(null)} className="text-white/20 hover:text-white/50"><X className="w-3.5 h-3.5" /></button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {getAlternatives(dayExercises[swapTarget.exIdx]).map(alt => (
                              <button key={alt} onClick={() => {
                                setSwappedExs(prev => ({ ...prev, [day]: { ...(prev[day] || {}), [swapTarget.exIdx]: alt } }));
                                setSwapTarget(null);
                                toast.success(`Swapped to ${alt}`);
                              }}
                                className="px-2.5 py-1 rounded-lg bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] text-[#e8c98a] text-xs hover:bg-[rgba(201,169,110,0.15)] transition-all">
                                {alt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Option A — Start session button */}
                      <button
                        onClick={() => handleStartDay(day)}
                        disabled={isCompleted}
                        className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all mt-2 ${
                          isCompleted
                            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                            : 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-lg shadow-orange-900/20'
                        }`}>
                        {isCompleted ? <><CheckCircle2 className="w-4 h-4" /> Completed</> : <><Play className="w-4 h-4 fill-white" /> Start Session</>}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {plan.tips?.length > 0 && (
            <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Coach Tips</p>
              <div className="space-y-2.5">
                {plan.tips.map((tip: string, i: number) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Zap className="w-3.5 h-3.5 text-[#c9a96e] mt-0.5 shrink-0" />
                    <p className="text-white/60 text-sm leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-white/15 text-xs text-center pb-2">
            Use the chat icon above to tweak your plan, or update your profile goal to regenerate.
          </p>
        </>
      )}
    </div>
  );
}
