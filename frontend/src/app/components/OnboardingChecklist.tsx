// OnboardingChecklist.tsx
// First-time user onboarding — a slide-up card shown once after signup.
// Three steps guide the user to complete their profile, follow someone, and log their first workout.
// Dismissed state is stored in localStorage keyed by uid so it shows per-account.

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, X, ChevronRight, User, UserPlus, Dumbbell } from 'lucide-react';

interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  action: string;
}

const STEPS: Step[] = [
  {
    id: 'profile',
    icon: <User className="w-4 h-4" />,
    title: 'Complete your profile',
    desc: 'Add a bio, fitness goal and profile photo so others can find you.',
    action: 'Go to Settings',
  },
  {
    id: 'follow',
    icon: <UserPlus className="w-4 h-4" />,
    title: 'Follow someone',
    desc: 'Search for friends or trainers and follow them to see their workouts.',
    action: 'Open Search',
  },
  {
    id: 'post',
    icon: <Dumbbell className="w-4 h-4" />,
    title: 'Log your first workout',
    desc: 'Tap the + button to record your first session and share it with the community.',
    action: 'Post a workout',
  },
];

interface OnboardingChecklistProps {
  userId: string;
  onNavigate: (view: string) => void;
  onNewPost: () => void;
}

function storageKey(uid: string) { return `fc-onboarding-${uid}`; }

export function OnboardingChecklist({ userId, onNavigate, onNewPost }: OnboardingChecklistProps) {
  const [visible,   setVisible]   = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [done,      setDone]      = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(userId));
      if (!raw) {
        // First time for this user — show after a short delay
        const t = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(t);
      }
      const saved = JSON.parse(raw);
      if (saved.dismissed) return; // already permanently closed
      setDone(new Set(saved.done || []));
      setVisible(true);
    } catch {}
  }, [userId]);

  const save = (newDone: Set<string>, newDismissed: boolean) => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify({
        dismissed: newDismissed,
        done: [...newDone],
      }));
    } catch {}
  };

  const markDone = (id: string) => {
    setDone(prev => {
      const next = new Set([...prev, id]);
      save(next, dismissed);
      return next;
    });
  };

  const dismiss = () => {
    setDismissed(true);
    setVisible(false);
    save(done, true);
  };

  const handleAction = (step: Step) => {
    markDone(step.id);
    if (step.id === 'profile') onNavigate('settings');
    else if (step.id === 'follow') onNavigate('search');
    else if (step.id === 'post') { onNewPost(); }
  };

  const allDone = STEPS.every(s => done.has(s.id));

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl border border-[rgba(201,169,110,0.18)] bg-[#0d0b08] shadow-2xl shadow-black/50 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[rgba(201,169,110,0.1)] to-[rgba(201,169,110,0.06)] border-b border-[rgba(201,169,110,0.08)]">
        <div>
          <p className="text-white font-semibold text-sm">
            {allDone ? '🎉 You\'re all set!' : 'Get started with Flex 🔥'}
          </p>
          <p className="text-white/40 text-xs mt-0.5">
            {done.size}/{STEPS.length} steps complete
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="w-7 h-7 rounded-full text-white/40 hover:text-white hover:bg-[rgba(201,169,110,0.08)] flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[rgba(201,169,110,0.04)]">
        <div
          className="h-full bg-gradient-to-r from-[#c9a96e] to-[#a07840] transition-all duration-700"
          style={{ width: `${(done.size / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="p-3 space-y-1">
        {STEPS.map(step => {
          const isDone = done.has(step.id);
          return (
            <div
              key={step.id}
              className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors ${
                isDone ? 'opacity-50' : 'hover:bg-[rgba(201,169,110,0.04)]'
              }`}
            >
              {/* Checkbox */}
              <div className="shrink-0 mt-0.5">
                {isDone
                  ? <CheckCircle2 className="w-5 h-5 text-[#c9a96e]" />
                  : <Circle       className="w-5 h-5 text-white/20" />}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isDone ? 'line-through text-white/40' : 'text-white/85'}`}>
                  {step.title}
                </p>
                {!isDone && (
                  <p className="text-white/35 text-xs mt-0.5 leading-relaxed">{step.desc}</p>
                )}
              </div>

              {/* Action */}
              {!isDone && (
                <button
                  type="button"
                  onClick={() => handleAction(step)}
                  className="shrink-0 flex items-center gap-0.5 text-[#c9a96e] hover:text-[#e8c98a] text-xs font-medium transition-colors"
                >
                  {step.action} <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-2 rounded-xl bg-[#c9a96e]/25 border border-[rgba(201,169,110,0.25)] text-[#e8c98a] text-sm font-medium hover:bg-[#c9a96e]/35 transition-colors"
          >
            Close — I\'m ready!
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helper: mark a step done from outside (e.g. after posting) ────────────────
export function markOnboardingStep(userId: string, stepId: string) {
  try {
    const key = storageKey(userId);
    const raw = localStorage.getItem(key);
    const saved = raw ? JSON.parse(raw) : { dismissed: false, done: [] };
    if (!saved.done.includes(stepId)) {
      saved.done.push(stepId);
      localStorage.setItem(key, JSON.stringify(saved));
    }
  } catch {}
}
