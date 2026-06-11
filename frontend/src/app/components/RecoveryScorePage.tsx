// RecoveryScorePage.tsx — daily recovery score based on sleep + yesterday's workout intensity

import { useState, useEffect } from 'react';
import { Moon, Zap, TrendingUp, TrendingDown, Minus as MinusIcon, RefreshCw } from 'lucide-react';
import { User } from '../types';

interface Props { currentUser: User | null; }

const STORAGE_KEY = 'flex_recovery_log';
const INTENSITY_LABELS = [
  { value: 0,  label: 'Rest day',  emoji: '😴', color: 'text-sky-300' },
  { value: 2,  label: 'Very light', emoji: '🚶', color: 'text-cyan-300' },
  { value: 4,  label: 'Light',     emoji: '🏃', color: 'text-teal-300' },
  { value: 6,  label: 'Moderate',  emoji: '💪', color: 'text-green-300' },
  { value: 8,  label: 'Hard',      emoji: '🔥', color: 'text-orange-300' },
  { value: 10, label: 'Maximum',   emoji: '💀', color: 'text-red-300' },
];

function todayKey() { return new Date().toISOString().slice(0, 10); }

interface DayEntry { date: string; sleep: number; intensity: number; score: number; }

function loadLog(): DayEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function computeScore(sleep: number, intensity: number): number {
  // Sleep: 0–5 pts (8h = full, 6h = 3.75, 4h = 2.5)
  const sleepScore = Math.min(sleep / 8, 1) * 5;
  // Recovery: 0–5 pts (intensity 0 = 5pts, intensity 10 = 0pts)
  const recoveryScore = ((10 - intensity) / 10) * 5;
  return Math.round((sleepScore + recoveryScore) * 10) / 10;
}

function scoreConfig(score: number) {
  if (score >= 8) return { label: 'Push Hard 💥',     sub: 'You\'re fully recovered — go for a PR today!',  color: 'from-green-500 to-emerald-400',  text: 'text-green-300',  ring: 'rgba(34,197,94,0.6)' };
  if (score >= 6) return { label: 'Good to Train 💪', sub: 'Solid recovery — normal intensity is fine.',     color: 'from-teal-500 to-cyan-400',      text: 'text-teal-300',   ring: 'rgba(20,184,166,0.6)' };
  if (score >= 4) return { label: 'Go Moderate 🏃',   sub: 'Some fatigue — keep it controlled today.',       color: 'from-yellow-500 to-amber-400',   text: 'text-yellow-300', ring: 'rgba(234,179,8,0.6)' };
  if (score >= 2) return { label: 'Light Only 🚶',    sub: 'Your body needs more rest — mobility or walk.', color: 'from-orange-500 to-amber-500',   text: 'text-orange-300', ring: 'rgba(249,115,22,0.6)' };
  return           { label: 'Rest Day 😴',            sub: 'You\'re depleted — sleep and nutrition first.',  color: 'from-red-500 to-rose-500',       text: 'text-red-300',    ring: 'rgba(239,68,68,0.6)' };
}

// ── SVG score dial ────────────────────────────────────────────────────────────
function ScoreDial({ score, ringColor }: { score: number; ringColor: string }) {
  const size = 200;
  const r    = 80;
  const circ = 2 * Math.PI * r;
  const pct  = score / 10;
  const offset = circ * (1 - pct);
  const cx = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={14} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={ringColor}
        strokeWidth={14} strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        filter="url(#glow)"
      />
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
    </svg>
  );
}

export function RecoveryScorePage({ currentUser }: Props) {
  const [sleep,     setSleep]     = useState(7.5);
  const [intensity, setIntensity] = useState(5);
  const [log,       setLog]       = useState<DayEntry[]>(() => loadLog());
  const [saved,     setSaved]     = useState(() => {
    const l = loadLog();
    return l.some(e => e.date === todayKey());
  });

  const score  = computeScore(sleep, intensity);
  const cfg    = scoreConfig(score);

  const saveToday = () => {
    const entry: DayEntry = { date: todayKey(), sleep, intensity, score };
    const newLog = [...log.filter(e => e.date !== todayKey()), entry].slice(-30);
    setLog(newLog);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLog));
    setSaved(true);
  };

  const resetToday = () => {
    setSaved(false);
    setLog(prev => prev.filter(e => e.date !== todayKey()));
  };

  const todayEntry = log.find(e => e.date === todayKey());
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, label: i === 6 ? 'Today' : d.toLocaleDateString('en', { weekday: 'short' }), entry: log.find(e => e.date === key) };
  });

  const nearest = INTENSITY_LABELS.reduce((prev, cur) =>
    Math.abs(cur.value - intensity) < Math.abs(prev.value - intensity) ? cur : prev
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

      <div>
        <h2 className="text-white font-bold text-xl">Recovery Score</h2>
        <p className="text-white/40 text-sm mt-0.5">Log your sleep + yesterday's effort to get today's recommendation</p>
      </div>

      {/* Score dial */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <ScoreDial score={saved && todayEntry ? todayEntry.score : score} ringColor={cfg.ring} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black text-white">{saved && todayEntry ? todayEntry.score : score}</span>
            <span className="text-white/30 text-xs">/ 10</span>
          </div>
        </div>
        <div className="text-center space-y-0.5">
          <p className={`font-bold text-base ${cfg.text}`}>{cfg.label}</p>
          <p className="text-white/40 text-sm max-w-xs">{cfg.sub}</p>
        </div>
      </div>

      {!saved ? (
        <>
          {/* Sleep slider */}
          <div className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-[#c9a96e]" />
              <span className="text-white font-medium text-sm">Last night's sleep</span>
              <span className="ml-auto text-[#e8c98a] font-bold">{sleep}h</span>
            </div>
            <input
              type="range" min={2} max={12} step={0.5}
              value={sleep}
              onChange={e => setSleep(Number(e.target.value))}
              className="w-full accent-[#c9a96e]"
            />
            <div className="flex justify-between text-[10px] text-white/25">
              <span>2h</span><span>5h</span><span>8h</span><span>12h</span>
            </div>
          </div>

          {/* Intensity selector */}
          <div className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-400" />
              <span className="text-white font-medium text-sm">Yesterday's workout intensity</span>
              <span className={`ml-auto font-bold text-sm ${nearest.color}`}>{nearest.emoji} {nearest.label}</span>
            </div>
            <input
              type="range" min={0} max={10} step={1}
              value={intensity}
              onChange={e => setIntensity(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-[10px] text-white/25">
              <span>Rest</span><span>Light</span><span>Hard</span><span>Max</span>
            </div>
          </div>

          <button
            onClick={saveToday}
            className={`w-full py-3 rounded-2xl bg-gradient-to-r ${cfg.color} text-white font-bold text-sm transition-all shadow-lg`}
          >
            Log Today's Recovery
          </button>
        </>
      ) : (
        <div className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-xl px-4 py-3 flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${cfg.text.replace('text-', 'bg-')}`} />
          <span className="text-white/60 text-sm flex-1">Today logged — sleep {todayEntry?.sleep}h, intensity {todayEntry?.intensity}/10</span>
          <button onClick={resetToday} className="text-white/30 hover:text-white/60">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tips */}
      <div className="space-y-2">
        <p className="text-white/40 text-xs uppercase tracking-wider">Today's tips</p>
        {score >= 8 && [
          'Great time to attempt a new PR or hit a heavy compound session.',
          'Your CNS is fresh — try a max-effort set early in the workout.',
        ].map((tip, i) => <TipRow key={i} tip={tip} icon={<TrendingUp className="w-3.5 h-3.5 text-green-400" />} />)}
        {score >= 6 && score < 8 && [
          'Stick to your planned weights — no need to go above.',
          'Prioritise sleep tonight to stack recovery for tomorrow.',
        ].map((tip, i) => <TipRow key={i} tip={tip} icon={<MinusIcon className="w-3.5 h-3.5 text-teal-400" />} />)}
        {score >= 4 && score < 6 && [
          'Reduce volume by ~20% — fewer sets, same effort.',
          'Foam roll and stretch between sets to manage soreness.',
        ].map((tip, i) => <TipRow key={i} tip={tip} icon={<MinusIcon className="w-3.5 h-3.5 text-yellow-400" />} />)}
        {score < 4 && [
          'Active recovery only — a walk, light yoga, or mobility work.',
          'Aim for 8–9 hours tonight and eat a protein-rich dinner.',
        ].map((tip, i) => <TipRow key={i} tip={tip} icon={<TrendingDown className="w-3.5 h-3.5 text-red-400" />} />)}
      </div>

      {/* 7-day history */}
      {log.length > 0 && (
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Past 7 days</p>
          <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.06)] rounded-2xl p-4">
            <div className="flex items-end gap-2 h-20">
              {last7.map(({ key, label, entry }) => {
                const h = entry ? (entry.score / 10) * 100 : 0;
                const cfg2 = entry ? scoreConfig(entry.score) : null;
                return (
                  <div key={key} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-white/30">{entry ? entry.score : ''}</span>
                    <div
                      className="w-full rounded-t-lg transition-all"
                      style={{ height: `${Math.max(h, entry ? 8 : 0)}%`, background: entry ? cfg2!.ring : 'rgba(255,255,255,0.05)' }}
                    />
                    <span className={`text-[9px] ${key === todayKey() ? 'text-white/60' : 'text-white/25'}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TipRow({ tip, icon }: { tip: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.06)] rounded-xl px-3 py-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="text-white/60 text-xs leading-relaxed">{tip}</p>
    </div>
  );
}
