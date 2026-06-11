// LiveWorkoutPage.tsx — all 4 improvements combined
// A: Exercise queue reorder + muscle-group tags
// B: Enhanced quick-add with category tabs + search
// C: Session templates (localStorage)
// D: Pre-start preview (total sets, est. duration, est. calories)

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play, Pause, StopCircle, Plus, Minus, Check, X, Timer,
  ChevronDown, ChevronUp, Dumbbell, Zap, Trophy, RotateCcw,
  AlertCircle, ArrowUp, ArrowDown, Bookmark, BookmarkCheck, Clock, Flame, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../utils/authToken';
import { User } from '../types';
import { API } from '../../config';

interface Props { currentUser: User | null; }
interface SetEntry { reps: number; weight: number; done: boolean; doneAt?: number; }
interface Exercise { name: string; sets: SetEntry[]; collapsed: boolean; muscle?: string; }
interface Template { name: string; exercises: { name: string; sets: number; reps: number; muscle?: string }[]; defaultSets: number; defaultReps: number; targetRest: number; }

const REST_PRESETS = [30, 60, 90, 120, 180];

// Option B — categorised exercise library
const MUSCLE_CATEGORIES: Record<string, string[]> = {
  'All':       ['Squat', 'Bench Press', 'Deadlift', 'OHP', 'Barbell Row', 'Pull-Up', 'Dip',
                'Lat Pulldown', 'Leg Press', 'Romanian Deadlift', 'Incline Dumbbell Press',
                'Cable Row', 'Face Pull', 'Hip Thrust', 'Plank'],
  'Chest':     ['Bench Press', 'Incline Dumbbell Press', 'Cable Fly', 'Dip', 'Push-Up', 'Decline Press'],
  'Back':      ['Deadlift', 'Pull-Up', 'Barbell Row', 'Lat Pulldown', 'Cable Row', 'Face Pull', 'Shrug'],
  'Legs':      ['Squat', 'Leg Press', 'Romanian Deadlift', 'Hip Thrust', 'Leg Curl', 'Calf Raise', 'Bulgarian Split Squat'],
  'Shoulders': ['OHP', 'Lateral Raise', 'Front Raise', 'Face Pull', 'Arnold Press', 'Upright Row'],
  'Arms':      ['Bicep Curl', 'Tricep Pushdown', 'Hammer Curl', 'Skull Crusher', 'Dip', 'Preacher Curl'],
  'Core':      ['Plank', 'Sit-Up', 'Ab Rollout', 'Russian Twist', 'Hanging Leg Raise', 'Cable Crunch'],
  'Cardio':    ['Running', 'Cycling', 'Rowing', 'Jump Rope', 'Burpees', 'Sled Push'],
};

// Option C — template helpers
const loadTemplates = (): Template[] => {
  try { return JSON.parse(localStorage.getItem('flex_workout_templates') || '[]'); } catch { return []; }
};
const persistTemplates = (ts: Template[]) => {
  localStorage.setItem('flex_workout_templates', JSON.stringify(ts.slice(0, 10)));
};

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function playBeep(freq = 880, duration = 0.6) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(); osc.stop(ctx.currentTime + duration);
  } catch {}
}

export function LiveWorkoutPage({ currentUser }: Props) {
  const [phase, setPhase] = useState<'plan' | 'active' | 'done'>('plan');

  // Plan phase
  const [exercises, setExercises]     = useState<Exercise[]>([]);
  const [newName, setNewName]         = useState('');
  const [defaultSets, setDefaultSets] = useState(3);
  const [defaultReps, setDefaultReps] = useState(10);
  const [targetRest, setTargetRest]   = useState(90);

  // Option B
  const [activeCat, setActiveCat]     = useState('All');
  const [libSearch, setLibSearch]     = useState('');
  const [showLib, setShowLib]         = useState(false);

  // Option C — templates
  const [templates, setTemplates]     = useState<Template[]>(loadTemplates);
  const [showTemplates, setShowTemplates] = useState(false);
  const [tmplName, setTmplName]       = useState('');

  // Active phase
  const [elapsed, setElapsed]         = useState(0);
  const [running, setRunning]         = useState(true);
  const [restLeft, setRestLeft]       = useState<number | null>(null);
  const [restOvertime, setRestOvertime] = useState(0);

  // Summary
  const [saved, setSaved] = useState(false);

  const sessionRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const overtimeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Option D — pre-start stats
  const totalSetsInPlan = useMemo(() => exercises.reduce((a, ex) => a + ex.sets.length, 0), [exercises]);
  const estDurationMin  = useMemo(() => Math.round(totalSetsInPlan * (targetRest + 45) / 60), [totalSetsInPlan, targetRest]);
  const estCalories     = useMemo(() => Math.round(estDurationMin * 6), [estDurationMin]);

  // Filtered library entries
  const libEntries = useMemo(() => {
    const base = MUSCLE_CATEGORIES[activeCat] || MUSCLE_CATEGORIES['All'];
    const q = libSearch.trim().toLowerCase();
    return (q ? base.filter(e => e.toLowerCase().includes(q)) : base)
      .filter(q => !exercises.find(e => e.name === q));
  }, [activeCat, libSearch, exercises]);

  // ── Session clock ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return;
    if (running) {
      sessionRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    }
    return () => { if (sessionRef.current) clearInterval(sessionRef.current); };
  }, [phase, running]);

  // ── Rest countdown ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (restLeft === null) { setRestOvertime(0); clearOvertimeTimer(); return; }
    if (restLeft <= 0) { playBeep(); setRestLeft(null); startOvertimeTimer(); return; }
    restRef.current = setTimeout(() => setRestLeft(r => (r ?? 0) - 1), 1000);
    return () => { if (restRef.current) clearTimeout(restRef.current); };
  }, [restLeft]);

  const startOvertimeTimer = () => {
    clearOvertimeTimer(); setRestOvertime(0);
    overtimeRef.current = setInterval(() => setRestOvertime(s => s + 1), 1000);
  };
  const clearOvertimeTimer = () => {
    if (overtimeRef.current) { clearInterval(overtimeRef.current); overtimeRef.current = null; }
    setRestOvertime(0);
  };
  const startRest = useCallback(() => { clearOvertimeTimer(); setRestLeft(targetRest); }, [targetRest]);
  const stopRest  = () => { if (restRef.current) clearTimeout(restRef.current); setRestLeft(null); clearOvertimeTimer(); };

  // ── Plan helpers ───────────────────────────────────────────────────────────
  const addExercise = (name: string, muscle?: string) => {
    if (!name.trim()) return;
    setExercises(prev => [...prev, {
      name: name.trim(), muscle,
      sets: Array.from({ length: defaultSets }, () => ({ reps: defaultReps, weight: 0, done: false })),
      collapsed: false,
    }]);
    setNewName(''); setShowLib(false);
  };

  const removeExercise = (i: number) => setExercises(prev => prev.filter((_, j) => j !== i));
  const toggleCollapse  = (i: number) => setExercises(prev => prev.map((ex, j) => j === i ? { ...ex, collapsed: !ex.collapsed } : ex));

  // Option A — reorder
  const moveUp   = (i: number) => setExercises(prev => { const a = [...prev]; if (i === 0) return a; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; });
  const moveDown = (i: number) => setExercises(prev => { const a = [...prev]; if (i === a.length - 1) return a; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; });

  const addSet    = (i: number) => setExercises(prev => prev.map((ex, j) => j === i ? { ...ex, sets: [...ex.sets, { reps: ex.sets.slice(-1)[0]?.reps ?? defaultReps, weight: ex.sets.slice(-1)[0]?.weight ?? 0, done: false }] } : ex));
  const removeSet = (ei: number, si: number) => setExercises(prev => prev.map((ex, j) => j === ei ? { ...ex, sets: ex.sets.filter((_, k) => k !== si) } : ex));
  const updateSet = (ei: number, si: number, field: 'reps' | 'weight' | 'done', val: number | boolean) =>
    setExercises(prev => prev.map((ex, j) => j === ei ? { ...ex, sets: ex.sets.map((s, k) => k === si ? { ...s, [field]: val, ...(field === 'done' && val ? { doneAt: Date.now() } : {}) } : s) } : ex));

  // Option C — template save/load
  const saveTemplate = () => {
    if (!tmplName.trim()) return toast.error('Give the template a name');
    const tmpl: Template = {
      name: tmplName.trim(),
      exercises: exercises.map(ex => ({ name: ex.name, sets: ex.sets.length, reps: ex.sets[0]?.reps ?? defaultReps, muscle: ex.muscle })),
      defaultSets, defaultReps, targetRest,
    };
    const updated = [tmpl, ...templates.filter(t => t.name !== tmpl.name)];
    setTemplates(updated); persistTemplates(updated);
    setTmplName(''); setShowTemplates(false);
    toast.success(`Template "${tmpl.name}" saved!`);
  };
  const loadTemplate = (tmpl: Template) => {
    setDefaultSets(tmpl.defaultSets); setDefaultReps(tmpl.defaultReps); setTargetRest(tmpl.targetRest);
    setExercises(tmpl.exercises.map(ex => ({
      name: ex.name, muscle: ex.muscle, collapsed: false,
      sets: Array.from({ length: ex.sets }, () => ({ reps: ex.reps, weight: 0, done: false })),
    })));
    setShowTemplates(false);
    toast.success(`Loaded "${tmpl.name}"`);
  };
  const deleteTemplate = (name: string) => {
    const updated = templates.filter(t => t.name !== name);
    setTemplates(updated); persistTemplates(updated);
  };

  // ── Tick a set ─────────────────────────────────────────────────────────────
  const tickSet = (ei: number, si: number) => {
    const set = exercises[ei].sets[si];
    updateSet(ei, si, 'done', !set.done);
    if (!set.done) startRest();
    else clearOvertimeTimer();
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalSets = exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const doneSets  = exercises.reduce((a, ex) => a + ex.sets.filter(s => s.done).length, 0);
  const progress  = totalSets > 0 ? doneSets / totalSets : 0;
  const allDone   = totalSets > 0 && doneSets === totalSets;

  const startWorkout = () => {
    if (exercises.length === 0) { toast.error('Add at least one exercise'); return; }
    setPhase('active'); setElapsed(0); setRunning(true);
  };

  const finishWorkout = () => {
    if (sessionRef.current) clearInterval(sessionRef.current);
    stopRest(); setPhase('done');
  };

  const saveToFeed = async () => {
    if (!currentUser || saved) return;
    try {
      const totalVol = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.done).reduce((a, s) => a + s.weight * s.reps, 0), 0);
      await authFetch(`${API}/posts`, {
        method: 'POST',
        body: JSON.stringify({
          user: currentUser, workoutType: 'Live Workout',
          duration: Math.round(elapsed / 60), calories: Math.round(elapsed / 60 * 6),
          caption: `Crushed ${exercises.length} exercises, ${doneSets} sets in ${fmt(elapsed)} 💪`,
          exercises: exercises.map(ex => ({ name: ex.name, sets: ex.sets.length })),
          totalVolume: Math.round(totalVol),
        }),
      });
      setSaved(true); toast.success('Workout posted to feed! 🎉');
    } catch { toast.error('Failed to save'); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PLAN PHASE
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'plan') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-white font-bold text-xl">Live Workout Mode</h2>
            <p className="text-white/40 text-sm mt-0.5">Plan your session then go — tick each set as you do it</p>
          </div>
          {/* Option C — templates button */}
          <button
            onClick={() => setShowTemplates(v => !v)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
              templates.length > 0
                ? 'border-[rgba(201,169,110,0.25)] bg-[rgba(201,169,110,0.08)] text-[#e8c98a] hover:bg-[rgba(201,169,110,0.12)]'
                : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:text-white/70'
            }`}
          >
            {exercises.length > 0 ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
            Templates
          </button>
        </div>

        {/* Option C — Templates panel */}
        {showTemplates && (
          <div className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-2xl p-4 space-y-3">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Saved Templates</p>
            {templates.length === 0 ? (
              <p className="text-white/25 text-xs">No templates yet — build a session and save it below.</p>
            ) : (
              <div className="space-y-2">
                {templates.map(t => (
                  <div key={t.name} className="flex items-center gap-2">
                    <button onClick={() => loadTemplate(t)}
                      className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.10)] hover:border-[rgba(201,169,110,0.25)] text-left transition-all group">
                      <Bookmark className="w-3.5 h-3.5 text-[#c9a96e] shrink-0" />
                      <span className="text-white text-sm flex-1 truncate">{t.name}</span>
                      <span className="text-white/30 text-xs">{t.exercises.length} ex</span>
                    </button>
                    <button onClick={() => deleteTemplate(t.name)} className="text-white/20 hover:text-red-400 transition-colors p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {exercises.length > 0 && (
              <div className="flex gap-2 pt-2 border-t border-[rgba(201,169,110,0.08)]">
                <input value={tmplName} onChange={e => setTmplName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveTemplate()}
                  placeholder="Template name…"
                  className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-1.5 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.45)]" />
                <button onClick={saveTemplate}
                  className="px-3 py-1.5 rounded-xl bg-[#c9a96e] text-white text-xs font-medium hover:bg-[#a07840] transition-all">
                  Save
                </button>
              </div>
            )}
          </div>
        )}

        {/* Settings row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Default sets', value: defaultSets, set: setDefaultSets, min: 1, max: 10 },
            { label: 'Default reps', value: defaultReps, set: setDefaultReps, min: 1, max: 30 },
            { label: 'Rest (sec)',   value: targetRest,  set: setTargetRest,  min: 15, max: 300, step: 15 },
          ].map(({ label, value, set, min, max, step = 1 }) => (
            <div key={label} className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.07)] rounded-xl p-3 space-y-1.5">
              <p className="text-white/40 text-[10px] uppercase tracking-wider">{label}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => set(v => Math.max(min, v - step))} className="w-6 h-6 rounded-full bg-[rgba(201,169,110,0.06)] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-white font-bold text-sm flex-1 text-center">{value}</span>
                <button onClick={() => set(v => Math.min(max, v + step))} className="w-6 h-6 rounded-full bg-[rgba(201,169,110,0.06)] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Option A — Exercise queue with reorder */}
        {exercises.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider px-1">Your Queue</p>
            {exercises.map((ex, ei) => (
              <div key={ei} className="flex items-center gap-2 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.07)] rounded-xl px-3 py-2.5">
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => moveUp(ei)} disabled={ei === 0}
                    className="text-white/20 hover:text-[#c9a96e] disabled:opacity-20 transition-colors">
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => moveDown(ei)} disabled={ei === exercises.length - 1}
                    className="text-white/20 hover:text-[#c9a96e] disabled:opacity-20 transition-colors">
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
                <Dumbbell className="w-3.5 h-3.5 text-[#c9a96e] shrink-0" />
                <span className="text-white text-sm flex-1 truncate">{ex.name}</span>
                {ex.muscle && (
                  <span className="text-[10px] text-[#c9a96e]/70 bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.15)] rounded-full px-2 py-0.5 shrink-0">{ex.muscle}</span>
                )}
                <span className="text-white/30 text-xs shrink-0">{ex.sets.length}×{ex.sets[0]?.reps}</span>
                <button onClick={() => addSet(ei)} className="text-[#c9a96e]/60 hover:text-[#e8c98a] transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => removeExercise(ei)} className="text-white/20 hover:text-red-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Option B — Enhanced quick-add */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addExercise(newName)}
              onFocus={() => setShowLib(true)}
              placeholder="Exercise name…"
              className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
            />
            <button onClick={() => addExercise(newName)}
              className="px-4 py-2.5 bg-[#c9a96e] hover:bg-[#a07840] text-white rounded-xl text-sm font-medium transition-all">
              Add
            </button>
          </div>

          {showLib && (
            <div className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.10)] rounded-2xl overflow-hidden">
              {/* Category tabs */}
              <div className="flex gap-0 overflow-x-auto border-b border-[rgba(201,169,110,0.08)] scrollbar-hide">
                {Object.keys(MUSCLE_CATEGORIES).map(cat => (
                  <button key={cat} onClick={() => setActiveCat(cat)}
                    className={`shrink-0 px-3 py-2 text-xs font-medium transition-all ${
                      activeCat === cat
                        ? 'text-[#e8c98a] border-b-2 border-[#c9a96e] bg-[rgba(201,169,110,0.06)]'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >{cat}</button>
                ))}
              </div>
              {/* Search */}
              <div className="px-3 py-2 border-b border-[rgba(201,169,110,0.06)] flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-white/25" />
                <input value={libSearch} onChange={e => setLibSearch(e.target.value)}
                  placeholder="Filter exercises…"
                  className="flex-1 bg-transparent text-white text-xs placeholder:text-white/25 outline-none" />
                {libSearch && <button onClick={() => setLibSearch('')} className="text-white/25 hover:text-white"><X className="w-3 h-3" /></button>}
              </div>
              {/* Exercise list */}
              <div className="flex flex-wrap gap-1.5 p-3 max-h-40 overflow-y-auto">
                {libEntries.length === 0 ? (
                  <p className="text-white/25 text-xs w-full text-center py-4">No matching exercises</p>
                ) : libEntries.map(q => (
                  <button key={q} onClick={() => addExercise(q, activeCat !== 'All' ? activeCat : undefined)}
                    className="px-2.5 py-1 bg-[rgba(201,169,110,0.04)] hover:bg-[#c9a96e]/15 border border-[rgba(201,169,110,0.07)] hover:border-[rgba(201,169,110,0.25)] text-white/60 hover:text-[#e8c98a] rounded-lg text-xs transition-all">
                    {q}
                  </button>
                ))}
              </div>
              <div className="px-3 pb-2 flex justify-end">
                <button onClick={() => setShowLib(false)} className="text-white/25 hover:text-white/50 text-xs transition-colors">Close</button>
              </div>
            </div>
          )}
        </div>

        {/* Option D — Pre-start preview */}
        {exercises.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <Dumbbell className="w-3.5 h-3.5" />, label: 'Total sets', value: String(totalSetsInPlan), color: 'text-[#c9a96e]' },
              { icon: <Clock className="w-3.5 h-3.5" />, label: 'Est. duration', value: `~${estDurationMin}m`, color: 'text-blue-400' },
              { icon: <Flame className="w-3.5 h-3.5" />, label: 'Est. calories', value: `~${estCalories}`, color: 'text-orange-400' },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.07)] rounded-xl p-3 text-center">
                <div className={`flex justify-center mb-1 ${color}`}>{icon}</div>
                <p className={`font-bold text-sm ${color}`}>{value}</p>
                <p className="text-white/30 text-[10px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={startWorkout}
          disabled={exercises.length === 0}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 disabled:opacity-40 text-white font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-900/30"
        >
          <Play className="w-5 h-5 fill-white" /> Start Workout
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DONE PHASE
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const totalVol = exercises.reduce((acc, ex) =>
      acc + ex.sets.filter(s => s.done).reduce((a, s) => a + s.weight * s.reps, 0), 0);
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#c9a96e] to-[#a07840] flex items-center justify-center shadow-2xl shadow-[rgba(201,169,110,0.2)]">
          <Trophy className="w-9 h-9 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-2xl mb-1">Session Complete!</p>
          <p className="text-white/40 text-sm">You crushed it 💪</p>
        </div>
        <div className="grid grid-cols-3 gap-4 w-full">
          {[
            { label: 'Duration', value: fmt(elapsed), sub: '' },
            { label: 'Sets', value: `${doneSets}`, sub: `of ${totalSets}` },
            { label: 'Volume', value: `${Math.round(totalVol).toLocaleString()}`, sub: 'kg total' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.07)] rounded-2xl p-4">
              <p className="text-white/40 text-xs mb-1">{label}</p>
              <p className="text-white font-bold text-xl">{value}</p>
              {sub && <p className="text-white/30 text-[10px]">{sub}</p>}
            </div>
          ))}
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={saveToFeed} disabled={saved}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              saved ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}>
            {saved ? <><Check className="w-4 h-4" /> Posted!</> : <><Zap className="w-4 h-4" /> Share to Feed</>}
          </button>
          <button onClick={() => { setPhase('plan'); setElapsed(0); setExercises([]); setSaved(false); }}
            className="flex-1 py-3 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/60 hover:text-white text-sm font-medium transition-all">
            New Session
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIVE PHASE
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/60 text-xs uppercase tracking-wider">Live Session</span>
          <span className="ml-auto text-white font-mono font-bold text-xl">{fmt(elapsed)}</span>
          <button onClick={() => setRunning(r => !r)} className="w-8 h-8 rounded-full bg-[rgba(201,169,110,0.06)] flex items-center justify-center text-white/50 hover:text-white">
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button onClick={finishWorkout} className="w-8 h-8 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/25">
            <StopCircle className="w-4 h-4" />
          </button>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-white/30 mb-1">
            <span>{doneSets} / {totalSets} sets</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 bg-[rgba(201,169,110,0.06)] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#c9a96e] to-[#a07840] rounded-full transition-all duration-500" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        {restLeft !== null ? (
          <div className="flex items-center gap-3 bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] rounded-xl px-3 py-2">
            <Timer className="w-4 h-4 text-[#c9a96e] shrink-0" />
            <span className="text-white/60 text-xs">Rest</span>
            <span className={`text-lg font-mono font-bold ml-auto ${restLeft <= 10 ? 'text-red-400' : 'text-[#e8c98a]'}`}>{fmt(restLeft)}</span>
            <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#c9a96e] rounded-full transition-all" style={{ width: `${(restLeft / targetRest) * 100}%` }} />
            </div>
            <button onClick={stopRest} className="text-white/30 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : restOvertime >= 30 ? (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span className="text-amber-200 text-xs flex-1">Rest has been {fmt(restOvertime)} — ready for the next set?</span>
            <button onClick={() => clearOvertimeTimer()} className="text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {exercises.map((ex, ei) => {
          const exDone = ex.sets.every(s => s.done);
          return (
            <div key={ei} className={`border rounded-2xl overflow-hidden transition-all ${exDone ? 'bg-green-500/5 border-green-500/25' : 'bg-white/4 border-[rgba(201,169,110,0.07)]'}`}>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => toggleCollapse(ei)}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${exDone ? 'bg-green-500 border-green-500' : 'border-[rgba(201,169,110,0.18)]'}`}>
                  {exDone && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className={`font-semibold text-sm flex-1 ${exDone ? 'text-green-300' : 'text-white'}`}>{ex.name}</span>
                {ex.muscle && <span className="text-[10px] text-[#c9a96e]/60 bg-[rgba(201,169,110,0.08)] rounded-full px-2 py-0.5">{ex.muscle}</span>}
                <span className="text-white/30 text-xs mr-2">{ex.sets.filter(s => s.done).length}/{ex.sets.length}</span>
                {ex.collapsed ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronUp className="w-4 h-4 text-white/30" />}
              </button>
              {!ex.collapsed && (
                <div className="px-4 pb-3 space-y-2">
                  {ex.sets.map((set, si) => (
                    <div key={si} className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-all ${set.done ? 'bg-green-500/15' : 'bg-white/4'}`}>
                      <span className="text-white/30 text-xs w-5 shrink-0">#{si + 1}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateSet(ei, si, 'weight', Math.max(0, set.weight - 2.5))} className="text-white/25 hover:text-white"><Minus className="w-3 h-3" /></button>
                        <span className="text-white text-xs w-12 text-center">{set.weight}kg</span>
                        <button onClick={() => updateSet(ei, si, 'weight', set.weight + 2.5)} className="text-white/25 hover:text-white"><Plus className="w-3 h-3" /></button>
                      </div>
                      <span className="text-white/20 text-xs">×</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateSet(ei, si, 'reps', Math.max(1, set.reps - 1))} className="text-white/25 hover:text-white"><Minus className="w-3 h-3" /></button>
                        <span className="text-white text-xs w-7 text-center">{set.reps}</span>
                        <button onClick={() => updateSet(ei, si, 'reps', set.reps + 1)} className="text-white/25 hover:text-white"><Plus className="w-3 h-3" /></button>
                      </div>
                      <button onClick={() => tickSet(ei, si)}
                        className={`ml-auto w-8 h-8 rounded-full flex items-center justify-center transition-all font-bold ${set.done ? 'bg-green-500 text-white' : 'border-2 border-[rgba(201,169,110,0.18)] text-white/20 hover:border-orange-500 hover:text-orange-400'}`}>
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addSet(ei)} className="text-white/25 hover:text-white/50 text-xs py-1 w-full text-center">+ Add set</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <button onClick={finishWorkout}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-green-900/30 transition-all animate-pulse">
          <Trophy className="w-5 h-5" /> Complete Workout!
        </button>
      )}
    </div>
  );
}
