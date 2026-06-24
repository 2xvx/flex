// RecoveryScorePage.tsx — 5-factor recovery score + nutrition link bonus

import { useState, useEffect } from 'react';
import { Moon, Zap, TrendingUp, TrendingDown, Minus as MinusIcon, RefreshCw, Droplets, Brain, Activity, Salad } from 'lucide-react';
import { User } from '../types';
import { authFetch } from '../../utils/authToken';
import { API } from '../../config';

interface Props { currentUser: User | null; }

const STORAGE_KEY = 'flex_recovery_log';

const INTENSITY_LABELS = [
  { value: 0,  label: 'Rest day',   emoji: '😴', color: 'text-sky-300' },
  { value: 2,  label: 'Very light', emoji: '🚶', color: 'text-cyan-300' },
  { value: 4,  label: 'Light',      emoji: '🏃', color: 'text-teal-300' },
  { value: 6,  label: 'Moderate',   emoji: '💪', color: 'text-green-300' },
  { value: 8,  label: 'Hard',       emoji: '🔥', color: 'text-orange-300' },
  { value: 10, label: 'Maximum',    emoji: '💀', color: 'text-red-300' },
];

const SORENESS_LABELS = [
  { value: 0, label: 'None',       emoji: '✅' },
  { value: 3, label: 'Mild',       emoji: '😐' },
  { value: 6, label: 'Sore',       emoji: '😣' },
  { value: 9, label: 'Very sore',  emoji: '🤕' },
];

const HYDRATION_LABELS = [
  { value: 0,  label: 'Dehydrated', emoji: '🏜️' },
  { value: 4,  label: 'Low',        emoji: '😕' },
  { value: 7,  label: 'Good',       emoji: '👍' },
  { value: 10, label: 'Great',      emoji: '💧' },
];

const STRESS_LABELS = [
  { value: 0,  label: 'Very calm', emoji: '😌' },
  { value: 3,  label: 'Low',       emoji: '🙂' },
  { value: 6,  label: 'Moderate',  emoji: '😤' },
  { value: 9,  label: 'High',      emoji: '😰' },
];

function todayKey()     { return new Date().toISOString().slice(0, 10); }
function yesterdayKey() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

interface DayEntry {
  date: string;
  sleep: number;
  intensity: number;
  soreness: number;
  hydration: number;
  stress: number;
  nutritionBonus: number;
  score: number;
}

interface NutritionBonus { bonus: number; proteinHit: boolean; calorieDeficit: boolean; }

const NUTRITION_GOALS = { calories: 2200, protein: 150 };

function loadLog(): DayEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

/**
 * 5-factor weighted score (max 10):
 *   Sleep      35% (0–3.5 pts)  — optimal at 8h
 *   Intensity  25% (0–2.5 pts)  — lower intensity = higher score
 *   Soreness   20% (0–2.0 pts)  — 0=none, 10=extreme
 *   Hydration  10% (0–1.0 pts)  — 0=poor, 10=great
 *   Stress     10% (0–1.0 pts)  — 0=no stress, 10=extreme stress
 *
 * Nutrition bonus (Option C):
 *   +0.5 if yesterday's protein >= goal
 *   -0.5 if yesterday's calories < goal - 500 (severe under-eating)
 */
function computeScore(
  sleep: number, intensity: number, soreness: number, hydration: number, stress: number,
  nutritionBonus = 0
): number {
  const sleepScore     = Math.min(sleep / 8, 1) * 3.5;
  const intensityScore = ((10 - intensity) / 10) * 2.5;
  const sorenessScore  = ((10 - soreness)  / 10) * 2.0;
  const hydrationScore = (hydration / 10) * 1.0;
  const stressScore    = ((10 - stress)   / 10) * 1.0;
  const base = sleepScore + intensityScore + sorenessScore + hydrationScore + stressScore;
  return Math.round(Math.max(0, Math.min(10, base + nutritionBonus)) * 10) / 10;
}

function scoreConfig(score: number) {
  if (score >= 8) return { label: 'Push Hard 💥',      sub: "You're fully recovered — go for a PR today!",  color: 'from-green-500 to-emerald-400',  text: 'text-green-300',  ring: 'rgba(34,197,94,0.6)' };
  if (score >= 6) return { label: 'Good to Train 💪',  sub: 'Solid recovery — normal intensity is fine.',    color: 'from-teal-500 to-cyan-400',      text: 'text-teal-300',   ring: 'rgba(20,184,166,0.6)' };
  if (score >= 4) return { label: 'Go Moderate 🏃',    sub: 'Some fatigue — keep it controlled today.',      color: 'from-yellow-500 to-amber-400',   text: 'text-yellow-300', ring: 'rgba(234,179,8,0.6)' };
  if (score >= 2) return { label: 'Light Only 🚶',     sub: 'Your body needs more rest — mobility or walk.', color: 'from-orange-500 to-amber-500',   text: 'text-orange-300', ring: 'rgba(249,115,22,0.6)' };
  return           { label: 'Rest Day 😴',             sub: "You're depleted — sleep and nutrition first.",  color: 'from-red-500 to-rose-500',       text: 'text-red-300',    ring: 'rgba(239,68,68,0.6)' };
}

function nearest<T extends { value: number }>(arr: T[], val: number): T {
  return arr.reduce((p, c) => Math.abs(c.value - val) < Math.abs(p.value - val) ? c : p);
}

// ── SVG score dial ────────────────────────────────────────────────────────────
function ScoreDial({ score, ringColor }: { score: number; ringColor: string }) {
  const size = 200, r = 80, circ = 2 * Math.PI * r, cx = size / 2;
  const offset = circ * (1 - score / 10);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={14} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={ringColor} strokeWidth={14} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
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

// ── Factor bar ────────────────────────────────────────────────────────────────
function FactorBar({ label, pct, color, icon }: { label: string; pct: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-white/40 shrink-0">{icon}</span>
      <span className="text-white/60 text-xs w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <span className="text-white/30 text-xs w-8 text-right">{Math.round(pct * 100)}%</span>
    </div>
  );
}

// ── Slider card ───────────────────────────────────────────────────────────────
function SliderCard({ icon, label, valueLabel, min, max, step, value, onChange }: {
  icon: React.ReactNode;
  label: string;
  valueLabel: React.ReactNode;
  min: number; max: number; step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-white/60 text-sm">{label}</span>
        </div>
        {valueLabel}
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#c9a96e] cursor-pointer"
      />
    </div>
  );
}

export function RecoveryScorePage({ currentUser }: Props) {
  const [sleep,     setSleep]     = useState(7.5);
  const [intensity, setIntensity] = useState(5);
  const [soreness,  setSoreness]  = useState(3);
  const [hydration, setHydration] = useState(7);
  const [stress,    setStress]    = useState(3);
  const [log,       setLog]       = useState<DayEntry[]>(() => loadLog());
  const [saved,     setSaved]     = useState(() => loadLog().some(e => e.date === todayKey()));

  // Nutrition bonus from yesterday
  const [nutBonus, setNutBonus] = useState<NutritionBonus>({ bonus: 0, proteinHit: false, calorieDeficit: false });
  const [nutLoading, setNutLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setNutLoading(true);
    const yKey = yesterdayKey();
    authFetch(`${API}/api/users/${currentUser.id}/nutrition/${yKey}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.meals) return;
        const totalCalories = (data.meals as any[]).reduce((s: number, m: any) => s + (m.calories || 0), 0);
        const totalProtein  = (data.meals as any[]).reduce((s: number, m: any) => s + (m.protein  || 0), 0);
        const proteinHit    = totalProtein >= NUTRITION_GOALS.protein;
        const calorieDeficit = totalCalories < NUTRITION_GOALS.calories - 500;
        const bonus = (proteinHit ? 0.5 : 0) - (calorieDeficit ? 0.5 : 0);
        setNutBonus({ bonus, proteinHit, calorieDeficit });
      })
      .catch(() => {})
      .finally(() => setNutLoading(false));
  }, [currentUser]);

  const score = computeScore(sleep, intensity, soreness, hydration, stress, nutBonus.bonus);
  const cfg   = scoreConfig(score);

  const todayEntry = log.find(e => e.date === todayKey());
  const displayScore = saved && todayEntry ? todayEntry.score : score;
  const displayCfg   = scoreConfig(displayScore);

  const saveToday = () => {
    const entry: DayEntry = {
      date: todayKey(), sleep, intensity, soreness, hydration, stress,
      nutritionBonus: nutBonus.bonus, score,
    };
    const newLog = [...log.filter(e => e.date !== todayKey()), entry].slice(-30);
    setLog(newLog);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLog));
    setSaved(true);
  };

  const resetToday = () => {
    setSaved(false);
    setLog(prev => prev.filter(e => e.date !== todayKey()));
  };

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, label: i === 6 ? 'Today' : d.toLocaleDateString('en', { weekday: 'short' }), entry: log.find(e => e.date === key) };
  });

  // Factor contribution percentages (for breakdown bar)
  const maxSleep = Math.min(sleep / 8, 1) * 3.5;
  const maxInt   = ((10 - intensity) / 10) * 2.5;
  const maxSore  = ((10 - soreness)  / 10) * 2.0;
  const maxHyd   = (hydration / 10) * 1.0;
  const maxStr   = ((10 - stress)   / 10) * 1.0;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

      <div>
        <h2 className="text-white font-bold text-xl">Recovery Score</h2>
        <p className="text-white/40 text-sm mt-0.5">5-factor score — log your body's state to get today's recommendation</p>
      </div>

      {/* Score dial */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <ScoreDial score={displayScore} ringColor={displayCfg.ring} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black text-white">{displayScore}</span>
            <span className="text-white/30 text-xs">/ 10</span>
          </div>
        </div>
        <div className="text-center space-y-0.5">
          <p className={`font-bold text-base ${displayCfg.text}`}>{displayCfg.label}</p>
          <p className="text-white/40 text-sm max-w-xs">{displayCfg.sub}</p>
        </div>
      </div>

      {/* Nutrition bonus badge */}
      {!nutLoading && (nutBonus.proteinHit || nutBonus.calorieDeficit) && (
        <div className="flex gap-2 justify-center flex-wrap">
          {nutBonus.proteinHit && (
            <span className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-xs px-3 py-1 rounded-full">
              <Salad className="w-3 h-3" /> Protein goal met yesterday +0.5
            </span>
          )}
          {nutBonus.calorieDeficit && (
            <span className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-1 rounded-full">
              ⚠️ 500+ kcal under goal −0.5
            </span>
          )}
        </div>
      )}

      {!saved ? (
        <div className="space-y-3">
          <SliderCard
            icon={<Moon className="w-4 h-4 text-[#c9a96e]" />}
            label="Last night's sleep"
            valueLabel={<span className="text-[#e8c98a] font-bold">{sleep}h</span>}
            min={2} max={12} step={0.5}
            value={sleep} onChange={setSleep}
          />
          <SliderCard
            icon={<Activity className="w-4 h-4 text-[#c9a96e]" />}
            label="Yesterday's intensity"
            valueLabel={<span className={`font-bold text-sm ${nearest(INTENSITY_LABELS, intensity).color}`}>{nearest(INTENSITY_LABELS, intensity).emoji} {nearest(INTENSITY_LABELS, intensity).label}</span>}
            min={0} max={10} step={1}
            value={intensity} onChange={setIntensity}
          />
          <SliderCard
            icon={<Brain className="w-4 h-4 text-[#c9a96e]" />}
            label="Muscle soreness"
            valueLabel={<span className="text-[#e8c98a] font-bold text-sm">{nearest(SORENESS_LABELS, soreness).emoji} {nearest(SORENESS_LABELS, soreness).label}</span>}
            min={0} max={9} step={1}
            value={soreness} onChange={setSoreness}
          />
          <SliderCard
            icon={<Droplets className="w-4 h-4 text-[#c9a96e]" />}
            label="Hydration today"
            valueLabel={<span className="text-[#e8c98a] font-bold text-sm">{nearest(HYDRATION_LABELS, hydration).emoji} {nearest(HYDRATION_LABELS, hydration).label}</span>}
            min={0} max={10} step={1}
            value={hydration} onChange={setHydration}
          />
          <SliderCard
            icon={<Zap className="w-4 h-4 text-[#c9a96e]" />}
            label="Stress level"
            valueLabel={<span className="text-[#e8c98a] font-bold text-sm">{nearest(STRESS_LABELS, stress).emoji} {nearest(STRESS_LABELS, stress).label}</span>}
            min={0} max={9} step={1}
            value={stress} onChange={setStress}
          />
          <button
            onClick={saveToday}
            className="w-full py-3 rounded-2xl bg-[#c9a96e] text-white font-semibold text-sm hover:bg-[#b8935a] transition-all"
          >
            Save Today's Score
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Factor breakdown */}
          <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5 space-y-3">
            <p className="text-white/60 text-xs uppercase tracking-wider">Factor Breakdown</p>
            <FactorBar label="Sleep"     pct={maxSleep / 3.5} color="bg-sky-500"    icon={<Moon      className="w-3.5 h-3.5" />} />
            <FactorBar label="Intensity" pct={maxInt   / 2.5} color="bg-orange-500" icon={<Activity  className="w-3.5 h-3.5" />} />
            <FactorBar label="Soreness"  pct={maxSore  / 2.0} color="bg-purple-500" icon={<Brain     className="w-3.5 h-3.5" />} />
            <FactorBar label="Hydration" pct={maxHyd   / 1.0} color="bg-cyan-500"   icon={<Droplets  className="w-3.5 h-3.5" />} />
            <FactorBar label="Stress"    pct={maxStr   / 1.0} color="bg-red-500"    icon={<Zap       className="w-3.5 h-3.5" />} />
          </div>

          {/* 7-day history */}
          <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5">
            <p className="text-white/60 text-xs uppercase tracking-wider mb-3">7-Day History</p>
            <div className="flex items-end gap-2 h-16">
              {last7.map(({ key, label, entry }) => {
                const s = entry?.score ?? null;
                const cfg = s !== null ? scoreConfig(s) : null;
                const heightPct = s !== null ? (s / 10) * 100 : 0;
                return (
                  <div key={key} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center" style={{ height: 48 }}>
                      {s !== null ? (
                        <div
                          className={`w-full rounded-t-md transition-all`}
                          style={{ height: heightPct + '%', background: cfg?.ring ?? '#c9a96e', opacity: 0.8 }}
                        />
                      ) : (
                        <div className="w-full rounded-t-md bg-white/5" style={{ height: '20%' }} />
                      )}
                    </div>
                    <span className="text-[9px] text-white/30">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={resetToday}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-[rgba(201,169,110,0.15)] text-white/50 text-sm hover:border-[rgba(201,169,110,0.3)] hover:text-white/70 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Re-log today
          </button>
        </div>
      )}
    </div>
  );
}
