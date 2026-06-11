// OnboardingPoll.tsx
// Post-signup fitness goal questionnaire with evidence-based tips.
// Shows once for new users immediately after account creation.
import { useState } from 'react';
import { ChevronRight, Dumbbell, Flame, Heart, Target, Zap, Trophy, Check } from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { User } from '../types';

import { API } from '../../config';

interface Props {
  currentUser: User;
  onComplete: (updates: Partial<User>) => void;
}

// ── Step data ─────────────────────────────────────────────────────────────────
const GOALS = [
  { id: 'Lose Weight',       icon: Flame,    color: 'from-orange-500 to-red-500',     tip: 'Combine 150–300 min/week of moderate cardio with a mild calorie deficit (–300–500 kcal/day). Strength training preserves muscle mass during fat loss. (ACSM Guidelines, 2022)' },
  { id: 'Build Muscle',      icon: Dumbbell, color: 'from-[#c9a96e] to-[#a07840]',  tip: 'Progressive overload is the #1 driver of hypertrophy. Aim for 10–20 sets per muscle group per week at 60–85% 1RM, with 1.6–2.2 g of protein per kg of bodyweight. (Schoenfeld, J Strength Cond Res 2017)' },
  { id: 'Improve Endurance', icon: Heart,    color: 'from-pink-500 to-rose-600',      tip: 'WHO recommends 150–300 min of moderate aerobic activity per week. Add 1–2 high-intensity interval sessions to boost VO₂max faster than steady-state cardio alone.' },
  { id: 'General Fitness',   icon: Zap,      color: 'from-cyan-500 to-blue-600',      tip: 'A balanced routine of cardio (3×/week), resistance training (2–3×/week), and flexibility work covers all five health-related fitness components (ACSM). Consistency beats intensity.' },
  { id: 'Sport Performance', icon: Trophy,   color: 'from-yellow-500 to-amber-600',   tip: 'Periodisation (base → build → peak → taper) maximises competition-day output. Strength training 2×/week has been shown to improve power, speed, and injury resilience in all sports.' },
  { id: 'Stress Relief',     icon: Target,   color: 'from-teal-500 to-green-600',     tip: 'Even 20–30 min of moderate exercise reduces cortisol and boosts endorphins. Mind-body activities like yoga and tai chi show measurable reductions in anxiety and depression symptoms. (Harvard Health, 2021)' },
];

const LEVELS = [
  { id: 'Beginner',     desc: 'Less than 6 months of consistent training' },
  { id: 'Intermediate', desc: '6 months – 2 years of consistent training' },
  { id: 'Advanced',     desc: '2+ years of structured training' },
];

const FREQUENCIES = [
  { id: '2–3×/week', label: '2–3 days', sub: 'Great for beginners or busy schedules' },
  { id: '4–5×/week', label: '4–5 days', sub: 'Ideal for steady progress' },
  { id: '6–7×/week', label: '6–7 days', sub: 'Advanced athletes with periodisation' },
];

export function OnboardingPoll({ currentUser, onComplete }: Props) {
  const [step,      setStep]      = useState(0); // 0=goal, 1=level, 2=freq, 3=tips
  const [goal,      setGoal]      = useState('');
  const [level,     setLevel]     = useState('');
  const [freq,      setFreq]      = useState('');
  const [saving,    setSaving]    = useState(false);

  const tip = GOALS.find(g => g.id === goal)?.tip || '';

  const next = () => setStep(s => s + 1);

  const finish = async () => {
    setSaving(true);
    try {
      await authFetch(`${API}/users/${currentUser.id}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({ fitnessGoal: goal, fitnessLevel: level, workoutFrequency: freq }),
      });
    } catch {}
    setSaving(false);
    onComplete({ fitnessGoal: goal, fitnessLevel: level });
  };

  // Progress dots
  const TOTAL = 4;
  const Dots = () => (
    <div className="flex gap-1.5 justify-center mb-8">
      {Array.from({ length: TOTAL }).map((_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-[#c9a96e]' : i < step ? 'w-3 bg-[#c9a96e]' : 'w-3 bg-white/10'}`} />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080608] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
            <span className="text-white text-xl font-black">FX</span>
          </div>
          <h1 className="text-white font-bold text-2xl">Let's personalise your journey</h1>
          <p className="text-white/40 text-sm mt-1">3 quick questions, then you're in.</p>
        </div>

        <Dots />

        {/* ── Step 0: Goal ── */}
        {step === 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <p className="text-white font-semibold text-base mb-4">What's your primary goal?</p>
            {GOALS.map(({ id, icon: Icon, color }) => (
              <button
                key={id}
                onClick={() => { setGoal(id); setTimeout(next, 180); }}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all duration-150 ${
                  goal === id
                    ? 'border-[rgba(201,169,110,0.5)] bg-[rgba(201,169,110,0.08)] text-white'
                    : 'border-[rgba(201,169,110,0.07)] bg-white/2 text-white/60 hover:border-[rgba(201,169,110,0.18)] hover:text-white hover:bg-[rgba(201,169,110,0.04)]'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium text-sm">{id}</span>
                {goal === id && <Check className="w-4 h-4 text-[#c9a96e] ml-auto" />}
              </button>
            ))}
          </div>
        )}

        {/* ── Step 1: Level ── */}
        {step === 1 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <p className="text-white font-semibold text-base mb-4">What's your current fitness level?</p>
            {LEVELS.map(({ id, desc }) => (
              <button
                key={id}
                onClick={() => { setLevel(id); setTimeout(next, 180); }}
                className={`w-full flex flex-col gap-0.5 px-4 py-3.5 rounded-2xl border text-left transition-all duration-150 ${
                  level === id
                    ? 'border-[rgba(201,169,110,0.5)] bg-[rgba(201,169,110,0.08)]'
                    : 'border-[rgba(201,169,110,0.07)] bg-white/2 hover:border-[rgba(201,169,110,0.18)] hover:bg-[rgba(201,169,110,0.04)]'
                }`}
              >
                <span className={`font-semibold text-sm ${level === id ? 'text-white' : 'text-white/70'}`}>{id}</span>
                <span className="text-white/35 text-xs">{desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Step 2: Frequency ── */}
        {step === 2 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <p className="text-white font-semibold text-base mb-4">How many days per week do you plan to train?</p>
            {FREQUENCIES.map(({ id, label, sub }) => (
              <button
                key={id}
                onClick={() => { setFreq(id); setTimeout(next, 180); }}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all duration-150 ${
                  freq === id
                    ? 'border-[rgba(201,169,110,0.5)] bg-[rgba(201,169,110,0.08)]'
                    : 'border-[rgba(201,169,110,0.07)] bg-white/2 hover:border-[rgba(201,169,110,0.18)] hover:bg-[rgba(201,169,110,0.04)]'
                }`}
              >
                <div className="text-left">
                  <p className={`font-semibold text-sm ${freq === id ? 'text-white' : 'text-white/70'}`}>{label}</p>
                  <p className="text-white/35 text-xs">{sub}</p>
                </div>
                {freq === id && <Check className="w-4 h-4 text-[#c9a96e]" />}
              </button>
            ))}
          </div>
        )}

        {/* ── Step 3: Personalised tip + finish ── */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-5">
            <div className="bg-[#c9a96e]/8 border border-[rgba(201,169,110,0.18)] rounded-2xl p-5">
              <p className="text-[#e8c98a] font-semibold text-sm mb-2">💡 Your personalised tip for <span className="text-white">{goal}</span></p>
              <p className="text-white/70 text-sm leading-relaxed">{tip}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Goal', value: goal },
                { label: 'Level', value: level },
                { label: 'Frequency', value: freq },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-xl p-3 text-center">
                  <p className="text-white/30 text-[10px] uppercase tracking-wider">{label}</p>
                  <p className="text-white text-xs font-semibold mt-1 leading-tight">{value}</p>
                </div>
              ))}
            </div>

            <button
              onClick={finish}
              disabled={saving}
              className="w-full py-3.5 rounded-2xl bg-[#c9a96e] text-white font-semibold text-sm  transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-[rgba(201,169,110,0.15)]"
            >
              {saving ? 'Saving…' : <>Let's go! <ChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
        )}

        {/* Back button */}
        {step > 0 && step < 3 && (
          <button onClick={() => setStep(s => s - 1)} className="mt-6 w-full text-white/30 text-sm hover:text-white/60 transition-colors">
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
