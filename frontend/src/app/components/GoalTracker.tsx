// GoalTracker.tsx
// Personal goal setting with check-ins, progress bars, and milestone celebrations.
import { useState, useEffect } from 'react';
import { Plus, Target, Trophy, Trash2, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';

import { API } from '../../config';

interface CheckIn  { value: number; note: string; date: string; }
interface Goal {
  id?: string;
  title: string;
  targetValue?: number | null;
  unit?: string;
  deadline?: string | null;
  category: string;
  currentValue: number;
  checkIns: CheckIn[];
  completed: boolean;
  createdAt?: string;
}

const CATEGORIES = ['general', 'strength', 'cardio', 'weight', 'body', 'habit'];
const CATEGORY_COLORS: Record<string, string> = {
  general:  'bg-[rgba(201,169,110,0.12)] text-[#e8c98a]',
  strength: 'bg-orange-500/20 text-orange-300',
  cardio:   'bg-cyan-500/20 text-cyan-300',
  weight:   'bg-yellow-500/20 text-yellow-300',
  body:     'bg-pink-500/20 text-pink-300',
  habit:    'bg-green-500/20 text-green-300',
};

interface Props { userId: string; }

export function GoalTracker({ userId }: Props) {
  const [goals,       setGoals]       = useState<Goal[]>([]);
  const [showNew,     setShowNew]     = useState(false);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [checkinVal,  setCheckinVal]  = useState<Record<string, string>>({});
  const [checkinNote, setCheckinNote] = useState<Record<string, string>>({});
  const [newGoal,     setNewGoal]     = useState<Partial<Goal>>({ category: 'general', currentValue: 0 });
  const [saving,      setSaving]      = useState(false);

  useEffect(() => { fetchGoals(); }, [userId]);

  const fetchGoals = async () => {
    try {
      const res = await authFetch(`${API}/users/${userId}/goals`);
      if (res.ok) setGoals((await res.json()).goals || []);
      else console.error('goals GET failed', res.status);
    } catch (e) { console.error('goals fetch error', e); }
  };

  const handleCreate = async () => {
    if (!newGoal.title?.trim()) { toast.error('Goal needs a title'); return; }
    setSaving(true);
    try {
      const res = await authFetch(`${API}/users/${userId}/goals`, {
        method: 'POST',
        body: JSON.stringify(newGoal),
      });
      if (!res.ok) throw new Error();
      toast.success('Goal created! 🎯');
      setShowNew(false);
      setNewGoal({ category: 'general', currentValue: 0 });
      fetchGoals();
    } catch { toast.error('Could not create goal'); }
    finally { setSaving(false); }
  };

  const handleCheckin = async (goalId: string) => {
    const val = parseFloat(checkinVal[goalId]);
    if (isNaN(val)) { toast.error('Enter a number'); return; }
    try {
      const res = await authFetch(`${API}/users/${userId}/goals/${goalId}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ value: val, note: checkinNote[goalId] || '' }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.completed) toast.success('Goal completed! 🏆');
      else toast.success('Check-in logged!');
      setCheckinVal(v => ({ ...v, [goalId]: '' }));
      setCheckinNote(n => ({ ...n, [goalId]: '' }));
      fetchGoals();
    } catch { toast.error('Check-in failed'); }
  };

  const handleDelete = async (goalId: string) => {
    if (!confirm('Delete this goal?')) return;
    await authFetch(`${API}/users/${userId}/goals/${goalId}`, { method: 'DELETE' });
    fetchGoals();
  };

  const getProgress = (goal: Goal) => {
    if (!goal.targetValue) return null;
    return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
  };

  const milestoneLabel = (pct: number) => {
    if (pct >= 100) return '🏆 Complete!';
    if (pct >= 75)  return '🔥 Almost there!';
    if (pct >= 50)  return '💪 Halfway!';
    if (pct >= 25)  return '🌱 Building momentum';
    return null;
  };

  const active    = goals.filter(g => !g.completed);
  const completed = goals.filter(g => g.completed);

  return (
    <div className="space-y-4">
      {/* New goal button */}
      <button
        onClick={() => setShowNew(s => !s)}
        className="w-full py-2.5 rounded-xl bg-[#c9a96e]/15 border border-[rgba(201,169,110,0.18)] text-[#e8c98a] text-sm font-medium hover:bg-[#c9a96e]/25 flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> Set a new goal
      </button>

      {/* New goal form */}
      {showNew && (
        <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 space-y-3">
          <input
            placeholder="Goal title (e.g. Bench press 100kg)"
            value={newGoal.title || ''}
            onChange={e => setNewGoal(g => ({ ...g, title: e.target.value }))}
            className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-white placeholder:text-white/25 outline-none focus:border-[rgba(201,169,110,0.5)] text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/35 text-xs">Target value</label>
              <input
                type="number"
                placeholder="e.g. 100"
                value={newGoal.targetValue ?? ''}
                onChange={e => setNewGoal(g => ({ ...g, targetValue: e.target.value ? +e.target.value : null }))}
                className="w-full mt-0.5 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[rgba(201,169,110,0.5)]"
              />
            </div>
            <div>
              <label className="text-white/35 text-xs">Unit</label>
              <input
                placeholder="kg, km, lbs…"
                value={newGoal.unit || ''}
                onChange={e => setNewGoal(g => ({ ...g, unit: e.target.value }))}
                className="w-full mt-0.5 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[rgba(201,169,110,0.5)]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/35 text-xs">Deadline (optional)</label>
              <input
                type="date"
                value={newGoal.deadline || ''}
                onChange={e => setNewGoal(g => ({ ...g, deadline: e.target.value || null }))}
                className="w-full mt-0.5 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[rgba(201,169,110,0.5)]"
              />
            </div>
            <div>
              <label className="text-white/35 text-xs">Category</label>
              <select
                value={newGoal.category}
                onChange={e => setNewGoal(g => ({ ...g, category: e.target.value }))}
                className="w-full mt-0.5 bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[rgba(201,169,110,0.5)]"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full py-2.5 bg-[#c9a96e] hover:bg-[#a07840] text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >{saving ? 'Saving…' : 'Create Goal'}</button>
        </div>
      )}

      {/* Active goals */}
      {active.length === 0 && !showNew && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="w-8 h-8 text-white/20 mb-3" />
          <p className="text-white/40 text-sm">No active goals yet</p>
          <p className="text-white/25 text-xs mt-1">Set a goal and track your progress</p>
        </div>
      )}

      {active.map(goal => {
        const pct = getProgress(goal);
        const isExpanded = expanded === goal.id;
        return (
          <div key={goal.id} className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[goal.category] || 'bg-white/10 text-white/40'}`}>
                      {goal.category}
                    </span>
                    {goal.deadline && (
                      <span className={`text-[10px] text-white/30 ${new Date(goal.deadline) < new Date() ? 'text-red-400/70' : ''}`}>
                        by {new Date(goal.deadline).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <p className="text-white font-medium text-sm mt-1">{goal.title}</p>
                  {goal.targetValue != null && (
                    <p className="text-white/40 text-xs mt-0.5">
                      {goal.currentValue}{goal.unit} / {goal.targetValue}{goal.unit}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setExpanded(isExpanded ? null : goal.id!)} className="text-white/25 hover:text-white/60">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleDelete(goal.id!)} className="text-white/20 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {pct !== null && (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-white/30 mb-1">
                    <span>{milestoneLabel(pct) || 'In progress'}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-[rgba(201,169,110,0.04)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 100 ? '#22c55e' : pct >= 50 ? '#c9a96e' : '#b8945a',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Check-in panel */}
            {isExpanded && (
              <div className="border-t border-[rgba(201,169,110,0.08)] p-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder={`Current ${goal.unit || 'value'}`}
                    value={checkinVal[goal.id!] || ''}
                    onChange={e => setCheckinVal(v => ({ ...v, [goal.id!]: e.target.value }))}
                    className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[rgba(201,169,110,0.5)]"
                  />
                  <button
                    onClick={() => handleCheckin(goal.id!)}
                    className="bg-[#c9a96e] hover:bg-[#a07840] text-white px-4 py-2 rounded-xl text-sm font-medium"
                  >Log</button>
                </div>
                <input
                  placeholder="Note (optional)"
                  value={checkinNote[goal.id!] || ''}
                  onChange={e => setCheckinNote(n => ({ ...n, [goal.id!]: e.target.value }))}
                  className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[rgba(201,169,110,0.5)]"
                />
                {/* Check-in history */}
                {goal.checkIns?.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {[...goal.checkIns].reverse().map((ci, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-white/25 w-20 shrink-0">{new Date(ci.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                        <span className="text-white/70">{ci.value}{goal.unit}</span>
                        {ci.note && <span className="text-white/30 truncate">{ci.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Completed goals */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-white/25 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Trophy className="w-3 h-3" /> Completed ({completed.length})
          </p>
          {completed.map(goal => (
            <div key={goal.id} className="flex items-center gap-3 px-4 py-3 bg-green-500/5 border border-green-500/15 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-white/60 text-sm line-through">{goal.title}</span>
              <button onClick={() => handleDelete(goal.id!)} className="ml-auto text-white/15 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
