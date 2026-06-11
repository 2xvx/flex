// WorkoutTimer.tsx
// Floating in-session workout timer with rest countdown, set logger, and session summary.
import { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Plus, Minus, Check, X, ChevronDown, ChevronUp, Dumbbell, Play, Pause, RotateCcw, StopCircle } from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { API } from '../../config';

interface SetLog { reps: number; weight: number; done: boolean; }
interface ExerciseLog { name: string; sets: SetLog[]; }

interface Props {
  onClose: () => void;
  onFinish: (session: { exercises: ExerciseLog[]; durationSeconds: number }) => void;
  userId?: string;
}

const REST_PRESETS = [30, 60, 90, 120, 180];

export function WorkoutTimer({ onClose, onFinish, userId }: Props) {
  useEffect(() => {
    if (!userId) return;
    authFetch(`${API}/users/${userId}/workout-status`, {
      method: 'PATCH', body: JSON.stringify({ workingOut: true }),
    }).catch(() => {});
    return () => {
      authFetch(`${API}/users/${userId}/workout-status`, {
        method: 'PATCH', body: JSON.stringify({ workingOut: false }),
      }).catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const [exercises,    setExercises]    = useState<ExerciseLog[]>([]);
  const [newExName,    setNewExName]    = useState('');
  const [elapsed,      setElapsed]      = useState(0);       // session seconds
  const [restSeconds,  setRestSeconds]  = useState(90);      // countdown target
  const [restLeft,     setRestLeft]     = useState<number | null>(null); // null = not running
  const [expanded,     setExpanded]     = useState(true);
  const sessionRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Session clock
  useEffect(() => {
    sessionRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => { if (sessionRef.current) clearInterval(sessionRef.current); };
  }, []);

  // Rest countdown
  useEffect(() => {
    if (restLeft === null) return;
    if (restLeft <= 0) {
      playBeep();
      setRestLeft(null);
      return;
    }
    restRef.current = setTimeout(() => setRestLeft(r => (r ?? 0) - 1), 1000);
    return () => { if (restRef.current) clearTimeout(restRef.current); };
  }, [restLeft]);

  const playBeep = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(); osc.stop(ctx.currentTime + 0.8);
    } catch {}
  };

  const startRest = () => setRestLeft(restSeconds);
  const stopRest  = () => { if (restRef.current) clearTimeout(restRef.current); setRestLeft(null); };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const addExercise = () => {
    if (!newExName.trim()) return;
    setExercises(prev => [...prev, { name: newExName.trim(), sets: [{ reps: 10, weight: 0, done: false }] }]);
    setNewExName('');
  };

  const addSet = (exIdx: number) =>
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: [...ex.sets, { reps: ex.sets.slice(-1)[0]?.reps ?? 10, weight: ex.sets.slice(-1)[0]?.weight ?? 0, done: false }] } : ex
    ));

  const updateSet = (exIdx: number, setIdx: number, field: 'reps' | 'weight' | 'done', val: number | boolean) =>
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: ex.sets.map((s, j) => j === setIdx ? { ...s, [field]: val } : s) } : ex
    ));

  const removeExercise = (exIdx: number) => setExercises(prev => prev.filter((_, i) => i !== exIdx));

  const handleFinish = () => {
    if (sessionRef.current) clearInterval(sessionRef.current);
    if (userId) {
      authFetch(`${API}/users/${userId}/workout-status`, {
        method: 'PATCH', body: JSON.stringify({ workingOut: false }),
      }).catch(() => {});
    }
    onFinish({ exercises, durationSeconds: elapsed });
  };

  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.done).length, 0);

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-40 w-80 bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(201,169,110,0.07)] bg-[#080608]">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <Dumbbell className="w-4 h-4 text-[#c9a96e]" />
        <span className="text-white font-semibold text-sm flex-1">In Session</span>
        <span className="text-[#e8c98a] font-mono text-sm font-bold">{fmt(elapsed)}</span>
        <button onClick={() => setExpanded(e => !e)} className="text-white/40 hover:text-white/70 ml-1">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        <button onClick={onClose} className="text-white/30 hover:text-white/60">
          <X className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Rest timer */}
          <div className="px-4 py-3 border-b border-[rgba(201,169,110,0.08)]">
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Rest Timer</p>
            {restLeft !== null ? (
              <div className="flex items-center gap-3">
                <div className={`text-3xl font-mono font-bold ${restLeft <= 10 ? 'text-red-400' : 'text-[#e8c98a]'}`}>{fmt(restLeft)}</div>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#c9a96e] rounded-full transition-all" style={{ width: `${(restLeft / restSeconds) * 100}%` }} />
                </div>
                <button onClick={stopRest} className="text-white/40 hover:text-red-400"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {REST_PRESETS.map(s => (
                    <button
                      key={s}
                      onClick={() => setRestSeconds(s)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${restSeconds === s ? 'bg-[#c9a96e] text-white' : 'bg-[rgba(201,169,110,0.04)] text-white/40 hover:bg-[rgba(201,169,110,0.08)]'}`}
                    >{s}s</button>
                  ))}
                </div>
                <button
                  onClick={startRest}
                  className="ml-auto flex items-center gap-1.5 bg-[#c9a96e] hover:bg-[#a07840] text-white px-3 py-1 rounded-lg text-xs font-medium"
                >
                  <Timer className="w-3 h-3" /> Start
                </button>
              </div>
            )}
          </div>

          {/* Exercises */}
          <div className="px-4 py-3 space-y-3">
            {exercises.map((ex, exIdx) => (
              <div key={exIdx} className="bg-[rgba(201,169,110,0.03)] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white text-sm font-medium flex-1">{ex.name}</span>
                  <span className="text-white/30 text-xs">{ex.sets.filter(s => s.done).length}/{ex.sets.length} sets</span>
                  <button onClick={() => removeExercise(exIdx)} className="text-white/20 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="space-y-1.5">
                  {ex.sets.map((set, setIdx) => (
                    <div key={setIdx} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${set.done ? 'bg-green-500/10' : 'bg-[rgba(201,169,110,0.03)]'}`}>
                      <span className="text-white/30 text-xs w-5">#{setIdx + 1}</span>
                      {/* Weight */}
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateSet(exIdx, setIdx, 'weight', Math.max(0, set.weight - 2.5))} className="text-white/30 hover:text-white"><Minus className="w-3 h-3" /></button>
                        <span className="text-white text-xs w-10 text-center">{set.weight}kg</span>
                        <button onClick={() => updateSet(exIdx, setIdx, 'weight', set.weight + 2.5)} className="text-white/30 hover:text-white"><Plus className="w-3 h-3" /></button>
                      </div>
                      <span className="text-white/20 text-xs">×</span>
                      {/* Reps */}
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateSet(exIdx, setIdx, 'reps', Math.max(1, set.reps - 1))} className="text-white/30 hover:text-white"><Minus className="w-3 h-3" /></button>
                        <span className="text-white text-xs w-6 text-center">{set.reps}</span>
                        <button onClick={() => updateSet(exIdx, setIdx, 'reps', set.reps + 1)} className="text-white/30 hover:text-white"><Plus className="w-3 h-3" /></button>
                      </div>
                      <button
                        onClick={() => { updateSet(exIdx, setIdx, 'done', !set.done); if (!set.done) startRest(); }}
                        className={`ml-auto w-6 h-6 rounded-full flex items-center justify-center transition-all ${set.done ? 'bg-green-500 text-white' : 'border border-[rgba(201,169,110,0.18)] text-white/20 hover:border-green-500 hover:text-green-400'}`}
                      ><Check className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <button onClick={() => addSet(exIdx)} className="w-full text-center text-white/25 hover:text-white/50 text-xs py-1">+ Add set</button>
                </div>
              </div>
            ))}

            {/* Add exercise */}
            <div className="flex gap-2">
              <input
                value={newExName}
                onChange={e => setNewExName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addExercise()}
                placeholder="Add exercise…"
                className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.07)] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/25 outline-none focus:border-[rgba(201,169,110,0.5)]"
              />
              <button onClick={addExercise} className="bg-[rgba(201,169,110,0.12)] hover:bg-[#c9a96e]/40 border border-[rgba(201,169,110,0.18)] text-[#e8c98a] px-3 rounded-xl">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[rgba(201,169,110,0.08)] flex items-center gap-2">
            <span className="text-white/30 text-xs flex-1">{totalSets} sets logged</span>
            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium"
            >
              <StopCircle className="w-4 h-4" /> Finish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
