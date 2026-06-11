// WaterTrackerPage.tsx — daily water intake tracker with cup icons and progress ring

import { useState, useEffect } from 'react';
import { Droplets, Plus, Minus, Target, Check } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../types';

interface Props { currentUser: User | null; }

const STORAGE_KEY = 'flex_water_log';
const GOALS = [6, 8, 10, 12];

interface DayLog { date: string; cups: number; }

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadLog(): DayLog[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveLog(log: DayLog[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log.slice(-30)));
}

function getToday(log: DayLog[]): number {
  return log.find(d => d.date === todayKey())?.cups ?? 0;
}

function setToday(log: DayLog[], cups: number): DayLog[] {
  const today = todayKey();
  const without = log.filter(d => d.date !== today);
  return [...without, { date: today, cups: Math.max(0, cups) }];
}

// ── SVG Ring ─────────────────────────────────────────────────────────────────
function ProgressRing({ value, max, size = 160 }: { value: number; max: number; size?: number }) {
  const r = (size - 24) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const offset = circ * (1 - pct);
  const cx = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      {/* Track */}
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={12} />
      {/* Progress */}
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke="url(#waterGrad)"
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <defs>
        <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#c9a96e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function WaterTrackerPage({ currentUser }: Props) {
  const [log, setLog]       = useState<DayLog[]>(() => loadLog());
  const [goal, setGoal]     = useState<number>(() => {
    try { return Number(localStorage.getItem('flex_water_goal') || '8'); } catch { return 8; }
  });
  const [animate, setAnimate] = useState(false);

  const cups = getToday(log);
  const pct  = Math.min(cups / goal, 1);
  const done = cups >= goal;

  const updateCups = (n: number) => {
    const newLog = setToday(log, n);
    setLog(newLog);
    saveLog(newLog);
  };

  const addCup = () => {
    setAnimate(true);
    setTimeout(() => setAnimate(false), 500);
    updateCups(cups + 1);
    if (cups + 1 === goal) toast.success('Daily water goal hit! 💧');
  };

  const removeCup = () => {
    if (cups <= 0) return;
    updateCups(cups - 1);
  };

  useEffect(() => {
    localStorage.setItem('flex_water_goal', String(goal));
  }, [goal]);

  // Last 7 days
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const dayLog = log.find(l => l.date === key);
    const label = i === 6 ? 'Today' : d.toLocaleDateString('en', { weekday: 'short' });
    return { key, label, cups: dayLog?.cups ?? 0 };
  });
  const maxCups = Math.max(goal, ...last7.map(d => d.cups));

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-white font-bold text-xl">Water Tracker 💧</h2>
        <p className="text-white/40 text-sm mt-0.5">Stay hydrated — tap the cup to log</p>
      </div>

      {/* Ring + counter */}
      <div className="flex flex-col items-center gap-0 pt-2">
        <div className="relative">
          <ProgressRing value={cups} max={goal} size={180} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-4xl font-black transition-transform ${animate ? 'scale-125' : 'scale-100'} ${done ? 'text-sky-300' : 'text-white'}`}>
              {cups}
            </span>
            <span className="text-white/30 text-xs">/ {goal} cups</span>
            {done && <span className="text-sky-400 text-xs font-semibold mt-0.5">Goal reached! ✓</span>}
          </div>
        </div>

        {/* ml estimate */}
        <p className="text-white/30 text-sm">{(cups * 250).toLocaleString()} ml · {(cups * 8.45).toFixed(0)} fl oz</p>
      </div>

      {/* Cup grid — tap to add/remove */}
      <div>
        <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Today's cups</p>
        <div className="flex flex-wrap gap-3 justify-center">
          {Array.from({ length: goal }).map((_, i) => (
            <button
              key={i}
              onClick={() => updateCups(i < cups ? i : i + 1)}
              className={`flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all ${
                i < cups
                  ? 'bg-sky-500/20 border-sky-500/40 shadow-lg shadow-sky-900/20'
                  : 'bg-white/4 border-[rgba(201,169,110,0.07)] opacity-40 hover:opacity-70'
              }`}
            >
              <Droplets className={`w-7 h-7 ${i < cups ? 'text-sky-300' : 'text-white/30'}`} />
              <span className={`text-[10px] font-semibold ${i < cups ? 'text-sky-300' : 'text-white/25'}`}>
                {(i + 1) * 250}ml
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Add / Remove buttons */}
      <div className="flex gap-3">
        <button
          onClick={removeCup}
          disabled={cups <= 0}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/50 hover:text-white disabled:opacity-25 transition-all text-sm font-medium"
        >
          <Minus className="w-4 h-4" /> Remove
        </button>
        <button
          onClick={addCup}
          className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm transition-all shadow-lg shadow-sky-900/30"
        >
          <Plus className="w-4 h-4" /> Add Cup (+250ml)
        </button>
      </div>

      {/* Goal selector */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-white/40" />
          <p className="text-white/40 text-xs uppercase tracking-wider">Daily goal</p>
        </div>
        <div className="flex gap-2">
          {GOALS.map(g => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                goal === g
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                  : 'bg-white/4 border-[rgba(201,169,110,0.07)] text-white/40 hover:text-white/70'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* 7-day chart */}
      <div>
        <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Past 7 days</p>
        <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.06)] rounded-2xl p-4">
          <div className="flex items-end gap-2 h-24">
            {last7.map(({ key, label, cups: c }) => {
              const h = maxCups > 0 ? (c / maxCups) * 100 : 0;
              const isToday = key === todayKey();
              const met = c >= goal;
              return (
                <div key={key} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-white/30">{c > 0 ? c : ''}</span>
                  <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.max(h, c > 0 ? 8 : 0)}%`, background: met ? 'rgba(56,189,248,0.6)' : isToday ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)' }} />
                  <span className={`text-[9px] font-medium ${isToday ? 'text-sky-300' : 'text-white/25'}`}>{label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[rgba(201,169,110,0.08)]">
            <div className="w-2.5 h-2.5 rounded-sm bg-sky-400/60" />
            <span className="text-white/30 text-[10px]">Goal met</span>
            <div className="w-2.5 h-2.5 rounded-sm bg-[#c9a96e]/50 ml-3" />
            <span className="text-white/30 text-[10px]">Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
