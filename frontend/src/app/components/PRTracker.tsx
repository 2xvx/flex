// PRTracker.tsx
//
// "My Workouts" page — personal record tracker with a line chart.
//
// Features:
//   • Log a PR for any exercise (weight × reps, or bodyweight reps)
//   • Exercise selector — common exercises + custom entry
//   • SVG line chart showing weight progression over time per exercise
//   • PR list grouped by exercise with % improvement from first to last entry
//   • Delete individual PR entries

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Minus, Dumbbell } from 'lucide-react';
import { User, PersonalRecord } from '../types';
import { logPR, getUserPRs, deletePR } from '../../services/prService';
import { toast } from 'sonner';
import { Celebrate } from './Confetti';
import { fireXP, XP_EVENT } from '../../services/xpService';

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMON_EXERCISES = [
  'Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row',
  'Pull-ups', 'Push-ups', 'Dips', 'Bicep Curls', 'Tricep Pushdown',
  'Leg Press', 'Romanian Deadlift', 'Hip Thrust', 'Lat Pulldown',
  'Cable Row', 'Face Pull', 'Shoulder Press', 'Incline Bench Press',
];

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

interface ChartProps {
  prs: PersonalRecord[];
  exercise: string;
}

// Epley formula: estimated 1-rep max from weight + reps
// Handles bodyweight (weight=0) by using reps directly as the score
const oneRM = (weight: number, reps: number): number => {
  if (reps <= 0) return weight;
  if (weight <= 0) return reps; // bodyweight — score by reps
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
};

function LineChart({ prs, exercise }: ChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const data = useMemo(() => {
    return prs
      .filter(p => p.exercise === exercise && (p.weight > 0 || p.reps > 0))
      .sort((a, b) => (a.date || a.createdAt || '').localeCompare(b.date || b.createdAt || ''));
  }, [prs, exercise]);

  if (data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-36 text-center">
        <TrendingUp className="w-8 h-8 text-white/10 mb-2" />
        <p className="text-white/30 text-xs">
          {data.length === 0 ? 'No data yet' : 'Log at least 2 entries to see the graph'}
        </p>
      </div>
    );
  }

  const W = 560, H = 160, PAD = { top: 24, right: 16, bottom: 28, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const weights = data.map(d => oneRM(d.weight, d.reps));
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const baseEst = weights[0];

  const xStep = chartW / Math.max(data.length - 1, 1);
  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (est1rm: number) => PAD.top + chartH - ((est1rm - minW) / range) * chartH;

  const points = data.map((d, i) => ({
    x: toX(i), y: toY(oneRM(d.weight, d.reps)), d, est: oneRM(d.weight, d.reps),
  }));
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  const yTicks = [minW, minW + range / 2, maxW].map(v => Math.round(v));
  const xLabels = [0, Math.floor(data.length / 2), data.length - 1]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map(i => ({ i, label: data[i].date?.slice(5) ?? '' }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 160, overflow: 'visible' }}
    >
      {/* Grid lines */}
      {yTicks.map((_, ti) => {
        const y = PAD.top + (chartH / 2) * ti;
        return <line key={ti} x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
          stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;
      })}

      {/* Y axis labels */}
      {[
        { v: maxW, y: PAD.top },
        { v: Math.round(minW + range / 2), y: PAD.top + chartH / 2 },
        { v: minW, y: PAD.top + chartH },
      ].map(({ v, y }) => (
        <text key={y} x={PAD.left - 6} y={y + 4} textAnchor="end"
          fontSize="10" fill="rgba(255,255,255,0.3)">{v}</text>
      ))}

      {/* X axis labels */}
      {xLabels.map(({ i, label }) => (
        <text key={i} x={toX(i)} y={H - 4} textAnchor="middle"
          fontSize="10" fill="rgba(255,255,255,0.3)">{label}</text>
      ))}

      {/* Y-axis rotated label */}
      <text x={8} y={PAD.top + chartH / 2} textAnchor="middle" fontSize="9"
        fill="rgba(255,255,255,0.25)"
        transform={`rotate(-90, 8, ${PAD.top + chartH / 2})`}>Est. 1RM (kg)</text>

      {/* Gradient fill */}
      <defs>
        <linearGradient id="prGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9a96e" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#c9a96e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`${PAD.left},${PAD.top + chartH} ${polyline} ${W - PAD.right},${PAD.top + chartH}`}
        fill="url(#prGrad)"
      />

      {/* Line */}
      <polyline points={polyline} fill="none" stroke="#c9a96e" strokeWidth="2" strokeLinejoin="round" />

      {/* Data points — with hover tooltip */}
      {points.map((p, i) => {
        const pctChange = i === 0 ? 0 : Math.round(((p.est - baseEst) / baseEst) * 100);
        const isHovered = hovered === i;

        // Clamp tooltip so it doesn't go off left/right edge
        const tipW = 108;
        const tipX = Math.max(PAD.left, Math.min(p.x - tipW / 2, W - PAD.right - tipW));
        const tipY = p.y - 60;

        return (
          <g key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Invisible large hit area */}
            <circle cx={p.x} cy={p.y} r="14" fill="transparent" />

            {/* Outer glow ring on hover */}
            {isHovered && (
              <circle cx={p.x} cy={p.y} r="9" fill="none"
                stroke="rgba(201,169,110,0.35)" strokeWidth="1.5" />
            )}

            {/* Main dot */}
            <circle cx={p.x} cy={p.y} r={isHovered ? 6 : 5} fill="#c9a96e" />
            <circle cx={p.x} cy={p.y} r="2.5" fill="white" />

            {/* Always-visible est label (dim when not hovered) */}
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9"
              fill={isHovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)'}>
              {`~${p.est}`}
            </text>

            {/* Hover tooltip card */}
            {isHovered && (
              <g>
                {/* Drop shadow rect */}
                <rect x={tipX + 1} y={tipY + 1} width={tipW} height={44}
                  rx={7} fill="rgba(0,0,0,0.4)" />
                {/* Card bg */}
                <rect x={tipX} y={tipY} width={tipW} height={44}
                  rx={7} fill="#1c1710"
                  stroke="rgba(201,169,110,0.35)" strokeWidth={0.8} />

                {/* % progress — big and gold */}
                <text x={tipX + tipW / 2} y={tipY + 16} textAnchor="middle"
                  fontSize="13" fontWeight="700"
                  fill={pctChange > 0 ? '#4ade80' : pctChange < 0 ? '#f87171' : '#c9a96e'}>
                  {i === 0 ? 'Baseline' : (pctChange > 0 ? `+${pctChange}%` : `${pctChange}%`)}
                </text>

                {/* Weight × reps detail */}
                <text x={tipX + tipW / 2} y={tipY + 30} textAnchor="middle"
                  fontSize="9.5" fill="rgba(255,255,255,0.55)">
                  {p.d.weight > 0 ? `${p.d.weight} kg` : ''}{p.d.reps > 0 ? ` x ${p.d.reps} reps` : ''}
                </text>

                {/* Date */}
                <text x={tipX + tipW / 2} y={tipY + 42} textAnchor="middle"
                  fontSize="8.5" fill="rgba(255,255,255,0.3)">
                  {p.d.date ?? p.d.createdAt?.slice(0, 10) ?? ''}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PRTrackerProps {
  currentUser: User | null;
}

export function PRTracker({ currentUser }: PRTrackerProps) {
  const [prs, setPRs]                     = useState<PersonalRecord[]>([]);
  const [loading, setLoading]             = useState(true);
  const [selectedExercise, setSelectedEx] = useState(COMMON_EXERCISES[0]);
  const [customExercise, setCustomEx]     = useState('');
  const [showCustom, setShowCustom]       = useState(false);
  const [weight, setWeight]               = useState('');
  const [reps, setReps]                   = useState('');
  const [notes, setNotes]                 = useState('');
  const [saving, setSaving]               = useState(false);
  const [showForm, setShowForm]           = useState(false);
  const [newPRExercise, setNewPRExercise] = useState<string | null>(null);

  const exercise = showCustom ? customExercise : selectedExercise;

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await getUserPRs(currentUser.id);
      setPRs(data);
    } catch {
      toast.error('Could not load PRs');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { load(); }, [load]);

  const handleLog = async () => {
    if (!currentUser || !exercise.trim()) return;
    setSaving(true);
    try {
      const exName = exercise.trim();
      const newWeight = parseFloat(weight) || 0;
      const newReps   = parseInt(reps) || 0;
      const newScore  = oneRM(newWeight, newReps);

      // Check if this beats the current best for this exercise
      const existingBest = prs
        .filter(p => p.exercise === exName)
        .reduce((best, e) => {
          const s = oneRM(e.weight, e.reps);
          return s > best ? s : best;
        }, 0);

      const isNewPR = newScore > existingBest && newScore > 0;

      const newPR = await logPR({
        userId:   currentUser.id,
        exercise: exName,
        weight:   newWeight,
        reps:     newReps,
        notes,
      });
      setPRs(prev => [newPR, ...prev]);
      setWeight(''); setReps(''); setNotes('');
      setShowForm(false);

      // Award XP for logging a PR
      fireXP(currentUser.id, XP_EVENT.PR_LOGGED);

      if (isNewPR) {
        Celebrate.newPR();
        setNewPRExercise(exName);
        toast.success(`🏆 New PR on ${exName}!`, { duration: 4000 });
        setTimeout(() => setNewPRExercise(null), 4000);
      } else {
        toast.success('PR logged!');
      }
    } catch {
      toast.error('Failed to log PR');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this PR entry?')) return;
    try {
      await deletePR(id);
      setPRs(prev => prev.filter(p => p.id !== id));
    } catch {
      toast.error('Failed to delete');
    }
  };

  // Build exercise list from logged PRs + common list (deduplicated)
  const loggedExercises = [...new Set(prs.map(p => p.exercise))];
  const allExercises    = [...new Set([...loggedExercises, ...COMMON_EXERCISES])];

  // Group PRs by exercise
  const grouped = useMemo(() => {
    const map: Record<string, PersonalRecord[]> = {};
    prs.forEach(pr => {
      if (!map[pr.exercise]) map[pr.exercise] = [];
      map[pr.exercise].push(pr);
    });
    // Sort each group by date
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
    });
    return map;
  }, [prs]);

  // Improvement % for an exercise (first → latest by weight)
  const improvement = (ex: string) => {
    const entries = grouped[ex] ?? [];
    if (entries.length < 2) return null;
    const sorted = [...entries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const first = oneRM(sorted[0].weight, sorted[0].reps);
    const last  = oneRM(sorted[sorted.length - 1].weight, sorted[sorted.length - 1].reps);
    if (!first) return null;
    return Math.round(((last - first) / first) * 100);
  };

  // Find the all-time PR entry for an exercise (highest estimated 1RM)
  const bestEntry = (ex: string) => {
    const entries = grouped[ex] ?? [];
    if (!entries.length) return null;
    return entries.reduce((best, e) =>
      oneRM(e.weight, e.reps) > oneRM(best.weight, best.reps) ? e : best
    );
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[rgba(201,169,110,0.25)] border-t-[#c9a96e] animate-spin" />
        <p className="text-white/30 text-sm">Loading PRs…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">

      {/* PR Celebration Banner */}
      {newPRExercise && (
        <div className="bg-gradient-to-r from-yellow-500/20 via-orange-500/15 to-yellow-500/20 border border-yellow-500/30 rounded-2xl px-5 py-4 flex items-center gap-3 animate-pulse">
          <div className="text-3xl">🏆</div>
          <div>
            <div className="text-yellow-300 font-bold text-sm">New Personal Record!</div>
            <div className="text-yellow-200/70 text-xs mt-0.5">{newPRExercise} — you just hit a new all-time best!</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold text-xl">My Workouts</h1>
          <p className="text-white/40 text-sm mt-0.5">Track your personal records</p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#c9a96e] text-white text-sm font-medium hover:bg-[#c9a96e] transition-all"
        >
          <Plus className="w-4 h-4" />
          Log PR
        </button>
      </div>

      {/* Log PR form */}
      {showForm && (
        <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5 space-y-4">
          <p className="text-white font-medium text-sm">Log a new PR</p>

          {/* Exercise selector */}
          <div className="space-y-2">
            <label className="text-white/40 text-xs">Exercise</label>
            <div className="flex gap-2">
              <select
                value={showCustom ? '__custom__' : selectedExercise}
                onChange={e => {
                  if (e.target.value === '__custom__') { setShowCustom(true); }
                  else { setShowCustom(false); setSelectedEx(e.target.value); }
                }}
                className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
                style={{ colorScheme: 'dark', background: '#110e09', color: '#f0ebe3' }}
              >
                {allExercises.map(ex => (
                  <option key={ex} value={ex} style={{ background: '#110e09', color: '#f0ebe3' }}>{ex}</option>
                ))}
                <option value="__custom__" style={{ background: '#110e09', color: '#c9a96e' }}>+ Custom exercise…</option>
              </select>
            </div>
            {showCustom && (
              <input
                value={customExercise}
                onChange={e => setCustomEx(e.target.value)}
                placeholder="Exercise name…"
                className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
              />
            )}
          </div>

          {/* Weight + reps */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/40 text-xs block mb-1.5">Weight (kg)</label>
              <input
                type="number"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="0"
                className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs block mb-1.5">Reps</label>
              <input
                type="number"
                value={reps}
                onChange={e => setReps(e.target.value)}
                placeholder="0"
                className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-white/40 text-xs block mb-1.5">Notes (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. felt great, paused reps…"
              className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/50 text-sm hover:bg-[rgba(201,169,110,0.04)] transition-all"
            >
              Cancel
            </button>
            <button
              disabled={saving || (!weight && !reps) || !exercise.trim()}
              onClick={handleLog}
              className="flex-1 py-2.5 rounded-xl bg-[#c9a96e] text-white text-sm font-medium hover:bg-[#c9a96e] transition-all disabled:opacity-40"
            >
              {saving ? 'Logging…' : 'Save PR'}
            </button>
          </div>
        </div>
      )}

      {/* Chart section */}
      {prs.length > 0 && (
        <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-medium text-sm">Est. 1RM progress</p>
            <select
              value={selectedExercise}
              onChange={e => { setSelectedEx(e.target.value); setShowCustom(false); }}
              className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
              style={{ colorScheme: 'dark', background: '#110e09', color: '#f0ebe3' }}
            >
              {allExercises.map(ex => (
                <option key={ex} value={ex} style={{ background: '#110e09', color: '#f0ebe3' }}>{ex}</option>
              ))}
            </select>
          </div>
          <LineChart prs={prs} exercise={selectedExercise} />
        </div>
      )}

      {/* PR list by exercise */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="w-7 h-7 text-white/20" />
          </div>
          <p className="text-white/40 text-sm">No PRs logged yet.</p>
          <p className="text-white/25 text-xs mt-1">Tap "Log PR" to record your first personal record.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([ex, entries]) => {
          const pct = improvement(ex);
          return (
            <div key={ex} className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl overflow-hidden">
              {/* Exercise header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(201,169,110,0.08)]">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-[#c9a96e]" />
                  <span className="text-white font-medium text-sm">{ex}</span>
                  <span className="text-white/30 text-xs">{entries.length} entries</span>
                </div>
                {pct !== null && (
                  <div className={`flex items-center gap-1 text-xs font-medium ${
                    pct > 0 ? 'text-green-400' : pct < 0 ? 'text-red-400' : 'text-white/40'
                  }`}>
                    {pct > 0 ? <TrendingUp className="w-3 h-3" /> :
                     pct < 0 ? <TrendingDown className="w-3 h-3" /> :
                               <Minus className="w-3 h-3" />}
                    {pct > 0 ? '+' : ''}{pct}%
                  </div>
                )}
              </div>

              {/* Entries */}
              {entries.slice(0, 5).map((pr, idx) => {
                const est = oneRM(pr.weight, pr.reps);
                const best = bestEntry(ex);
                const isBest = best?.id === pr.id;
                return (
                <div
                  key={pr.id}
                  className={`flex items-center justify-between px-5 py-3 ${
                    idx < entries.length - 1 ? 'border-b border-[rgba(201,169,110,0.08)]' : ''
                  } ${isBest ? 'bg-yellow-500/5' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {isBest && (
                      <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-medium shrink-0">
                        🏆 PR
                      </span>
                    )}
                    {!isBest && idx === 0 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/40 font-medium shrink-0">
                        Latest
                      </span>
                    )}
                    <div>
                      <p className="text-white text-sm font-medium">
                        {pr.weight > 0 ? `${pr.weight} kg` : '—'}
                        {pr.reps  > 0 ? ` × ${pr.reps} reps` : ''}
                      </p>
                      <p className="text-white/35 text-xs mt-0.5">
                        {pr.weight > 0 && pr.reps > 1
                          ? `Est. 1RM: ~${est} kg`
                          : pr.weight > 0 ? `1 rep max` : `${pr.reps} reps`}
                        {pr.notes ? ` · ${pr.notes}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white/30 text-xs">
                      {pr.date ?? pr.createdAt?.split('T')[0]}
                    </span>
                    <button
                      onClick={() => handleDelete(pr.id)}
                      className="text-white/20 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                );
              })}
              {entries.length > 5 && (
                <div className="px-5 py-2 text-center text-white/30 text-xs border-t border-[rgba(201,169,110,0.08)]">
                  +{entries.length - 5} more entries
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
