// HabitTrackerPage.tsx — Daily supplements and habit tracking with streaks

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, CheckCircle2, Circle, Flame, Trash2, Loader2,
  Pill, Dumbbell, Moon, Footprints, Brain, Droplets, Apple,
  Coffee, Zap, Heart,
} from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { Celebrate } from './Confetti';
import { toast } from 'sonner';
import { API } from '../../config';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Habit {
  id: string;
  name: string;
  icon: string;
  type: 'supplement' | 'habit';
  color: string;
  targetDays: number[];        // 0=Sun … 6=Sat, empty=every day
  streak: number;
  longestStreak: number;
  completedToday: boolean;
  lastCheckin?: string;        // ISO date
  checkins: string[];          // array of ISO dates (last 30 kept server-side)
  createdAt: string;
}

const PRESET_SUPPLEMENTS = [
  { name: 'Creatine',    icon: '⚡', color: 'violet' },
  { name: 'Protein',     icon: '🥛', color: 'blue'   },
  { name: 'Vitamin D',   icon: '☀️', color: 'amber'  },
  { name: 'Omega-3',     icon: '🐟', color: 'cyan'   },
  { name: 'Magnesium',   icon: '🔵', color: 'indigo' },
  { name: 'Caffeine',    icon: '☕', color: 'orange'  },
  { name: 'Zinc',        icon: '🧡', color: 'orange'  },
  { name: 'Melatonin',   icon: '🌙', color: 'purple' },
];

const PRESET_HABITS = [
  { name: 'Sleep 8h',     icon: '😴', color: 'indigo' },
  { name: '10k Steps',    icon: '👟', color: 'green'  },
  { name: 'Meditation',   icon: '🧘', color: 'violet' },
  { name: 'Drink 3L',     icon: '💧', color: 'cyan'   },
  { name: 'No alcohol',   icon: '🚫', color: 'red'    },
  { name: 'Cold shower',  icon: '🚿', color: 'blue'   },
  { name: 'Read 30m',     icon: '📚', color: 'amber'  },
  { name: 'Stretch',      icon: '🤸', color: 'green'  },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  violet: { bg: 'bg-[rgba(201,169,110,0.12)]', border: 'border-[#c9a96e]/40', text: 'text-[#e8c98a]', glow: 'shadow-[rgba(201,169,110,0.15)]' },
  blue:   { bg: 'bg-blue-500/20',   border: 'border-blue-500/40',   text: 'text-blue-300',   glow: 'shadow-blue-500/20'   },
  amber:  { bg: 'bg-amber-500/20',  border: 'border-amber-500/40',  text: 'text-amber-300',  glow: 'shadow-amber-500/20'  },
  green:  { bg: 'bg-green-500/20',  border: 'border-green-500/40',  text: 'text-green-300',  glow: 'shadow-green-500/20'  },
  cyan:   { bg: 'bg-cyan-500/20',   border: 'border-cyan-500/40',   text: 'text-cyan-300',   glow: 'shadow-cyan-500/20'   },
  indigo: { bg: 'bg-[rgba(201,169,110,0.12)]', border: 'border-[#c9a96e]/40', text: 'text-[#e8c98a]', glow: 'shadow-[rgba(201,169,110,0.15)]' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-300', glow: 'shadow-orange-500/20' },
  red:    { bg: 'bg-red-500/20',    border: 'border-red-500/40',    text: 'text-red-300',    glow: 'shadow-red-500/20'    },
  purple: { bg: 'bg-[rgba(201,169,110,0.12)]', border: 'border-[#c9a96e]/40', text: 'text-[#e8c98a]', glow: 'shadow-[rgba(201,169,110,0.15)]' },
};

// ── Streak flame ─────────────────────────────────────────────────────────────
function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return null;
  const color = streak >= 30 ? 'text-amber-400' : streak >= 7 ? 'text-orange-400' : 'text-red-400';
  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-bold ${color}`}>
      <Flame className="w-3 h-3" /> {streak}
    </span>
  );
}

// ── Last 7-day dots ───────────────────────────────────────────────────────────
function WeekDots({ checkins, color }: { checkins: string[]; color: string }) {
  const col = COLOR_MAP[color] || COLOR_MAP.violet;
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  return (
    <div className="flex gap-1">
      {days.map(day => {
        const done = checkins.includes(day);
        return (
          <div key={day}
            className={`w-4 h-4 rounded-full border transition-all ${done ? `${col.bg} ${col.border}` : 'border-[rgba(201,169,110,0.12)] bg-[rgba(201,169,110,0.03)]'}`}
            title={day} />
        );
      })}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function HabitTrackerPage({ userId }: { userId: string }) {
  const [habits, setHabits]         = useState<Habit[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showAdd, setShowAdd]       = useState(false);
  const [addType, setAddType]       = useState<'supplement' | 'habit'>('supplement');
  const [checkinId, setCheckinId]   = useState<string | null>(null);

  // New habit form
  const [newName, setNewName]   = useState('');
  const [newIcon, setNewIcon]   = useState('⚡');
  const [newColor, setNewColor] = useState('violet');
  const [creating, setCreating] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await authFetch(`${API}/users/${userId}/habits`);
      const data = await res.json();
      setHabits(data.habits || []);
    } catch { toast.error('Could not load habits'); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const checkin = async (habitId: string) => {
    setCheckinId(habitId);
    // Optimistic
    setHabits(prev => prev.map(h =>
      h.id === habitId
        ? { ...h, completedToday: true, streak: h.streak + 1, checkins: [...(h.checkins || []), today] }
        : h
    ));
    try {
      await authFetch(`${API}/users/${userId}/habits/${habitId}/checkin`, { method: 'POST' });
      // Fire confetti for streak milestones
      const updated = habits.find(h => h.id === habitId);
      const newStreak = (updated?.streak ?? 0) + 1;
      if      (newStreak === 100) Celebrate.streak100();
      else if (newStreak === 30)  Celebrate.streak30();
      else if (newStreak === 7)   Celebrate.streak7();
      // Fire "all done today" celebration when last habit is checked off
      const doneTomorrow = habits.filter(h => h.completedToday || h.id === habitId).length;
      if (doneTomorrow === habits.length) setTimeout(() => Celebrate.allHabitsToday(), 300);
    } catch {
      toast.error('Failed to check in');
      await load(); // revert
    }
    finally { setCheckinId(null); }
  };

  const uncheckin = async (habitId: string) => {
    setHabits(prev => prev.map(h =>
      h.id === habitId
        ? { ...h, completedToday: false, streak: Math.max(0, h.streak - 1), checkins: h.checkins.filter(d => d !== today) }
        : h
    ));
    try {
      await authFetch(`${API}/users/${userId}/habits/${habitId}/checkin`, { method: 'DELETE' });
    } catch { await load(); }
  };

  const deleteHabit = async (habitId: string) => {
    setHabits(prev => prev.filter(h => h.id !== habitId));
    try {
      await authFetch(`${API}/users/${userId}/habits/${habitId}`, { method: 'DELETE' });
    } catch { await load(); }
  };

  const postHabit = async (payload: object): Promise<Habit> => {
    const res = await authFetch(`${API}/users/${userId}/habits`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    let data: any;
    try { data = await res.json(); } catch { throw new Error(`Server error ${res.status}`); }
    if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
    if (!data?.habit) throw new Error('Unexpected response from server');
    return data.habit as Habit;
  };

  const addPreset = async (preset: { name: string; icon: string; color: string }, type: 'supplement' | 'habit') => {
    try {
      const habit = await postHabit({ name: preset.name, icon: preset.icon, color: preset.color, type });
      setHabits(prev => [habit, ...prev]);
      toast.success(`"${preset.name}" added!`);
    } catch (e: any) {
      console.error('[addPreset]', e);
      toast.error(e?.message || 'Failed to add');
    }
  };

  const addCustom = async () => {
    if (!newName.trim()) return toast.error('Enter a name');
    setCreating(true);
    try {
      const habit = await postHabit({ name: newName.trim(), icon: newIcon, color: newColor, type: addType });
      setHabits(prev => [habit, ...prev]);
      setShowAdd(false);
      setNewName('');
      toast.success('Habit added!');
    } catch (e: any) {
      console.error('[addCustom]', e);
      toast.error(e?.message || 'Failed to add');
    } finally { setCreating(false); }
  };

  const supplements = habits.filter(h => h.type === 'supplement');
  const dailyHabits = habits.filter(h => h.type === 'habit');
  const doneToday   = habits.filter(h => h.completedToday).length;
  const totalToday  = habits.length;

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" /> Habits & Supplements
          </h1>
          <p className="text-white/40 text-sm mt-0.5">Build consistency one day at a time</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-[#c9a96e] hover:bg-[#c9a96e] text-white text-sm font-medium px-3 py-2 rounded-xl transition-all">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Today's progress ring */}
      {habits.length > 0 && (
        <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle cx="32" cy="32" r="26" fill="none" stroke="#c9a96e" strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - doneToday / Math.max(1, totalToday))}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{doneToday}/{totalToday}</span>
            </div>
          </div>
          <div>
            <p className="text-white font-semibold">
              {doneToday === totalToday && totalToday > 0
                ? '🎉 All done today!'
                : doneToday === 0
                  ? 'Nothing checked yet'
                  : `${totalToday - doneToday} left today`}
            </p>
            <p className="text-white/40 text-xs mt-0.5">
              {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      {/* Supplements */}
      {supplements.length > 0 && (
        <section>
          <p className="text-white/40 text-[11px] uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
            <Pill className="w-3.5 h-3.5" /> Supplements
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {supplements.map(h => <HabitCard key={h.id} habit={h} today={today} onCheckin={checkin} onUncheckin={uncheckin} onDelete={deleteHabit} loading={checkinId === h.id} />)}
          </div>
        </section>
      )}

      {/* Daily habits */}
      {dailyHabits.length > 0 && (
        <section>
          <p className="text-white/40 text-[11px] uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Daily Habits
          </p>
          <div className="space-y-2">
            {dailyHabits.map(h => <HabitRow key={h.id} habit={h} today={today} onCheckin={checkin} onUncheckin={uncheckin} onDelete={deleteHabit} loading={checkinId === h.id} />)}
          </div>
        </section>
      )}

      {habits.length === 0 && (
        <div className="text-center py-16 border border-[rgba(201,169,110,0.07)] rounded-2xl">
          <Flame className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No habits yet</p>
          <p className="text-white/20 text-xs mt-1">Add supplements or daily habits to start your streak</p>
        </div>
      )}

      {/* ── Add modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,169,110,0.07)] sticky top-0 bg-[#0d0b08]">
              <h2 className="text-white font-semibold">Add Supplement or Habit</h2>
              <button onClick={() => setShowAdd(false)} className="text-white/40 hover:text-white/70"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-5">
              {/* Type tabs */}
              <div className="flex gap-2">
                {(['supplement', 'habit'] as const).map(t => (
                  <button key={t} onClick={() => setAddType(t)}
                    className={`flex-1 py-2 rounded-xl border text-sm capitalize transition-all
                      ${addType === t ? 'bg-[rgba(201,169,110,0.12)] border-[#c9a96e]/40 text-[#e8c98a]' : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:border-[rgba(201,169,110,0.18)]'}`}>
                    {t === 'supplement' ? '💊 Supplement' : '✅ Habit'}
                  </button>
                ))}
              </div>

              {/* Quick presets */}
              <div>
                <p className="text-white/40 text-xs mb-2">Quick add</p>
                <div className="flex flex-wrap gap-1.5">
                  {(addType === 'supplement' ? PRESET_SUPPLEMENTS : PRESET_HABITS)
                    .filter(p => !habits.some(h => h.name === p.name))
                    .map(p => (
                      <button key={p.name} onClick={() => addPreset(p, addType)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] hover:border-[rgba(201,169,110,0.25)] hover:bg-[rgba(201,169,110,0.08)] text-white/70 hover:text-[#e8c98a] text-xs transition-all">
                        {p.icon} {p.name}
                      </button>
                    ))}
                </div>
              </div>

              <div className="border-t border-[rgba(201,169,110,0.07)] pt-4 space-y-3">
                <p className="text-white/40 text-xs">Or create custom</p>
                <div className="flex gap-2">
                  <input value={newIcon} onChange={e => setNewIcon(e.target.value)}
                    className="w-12 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl text-center text-xl py-2 focus:outline-none focus:border-[rgba(201,169,110,0.5)]" />
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder={addType === 'supplement' ? 'e.g. Vitamin C' : 'e.g. Journal 10m'}
                    className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]" />
                </div>
                {/* Color picker */}
                <div className="flex gap-1.5 flex-wrap">
                  {Object.keys(COLOR_MAP).map(c => (
                    <button key={c} onClick={() => setNewColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${COLOR_MAP[c].bg} ${newColor === c ? 'border-white scale-110' : 'border-transparent'}`} />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/60 text-sm hover:bg-[rgba(201,169,110,0.04)] transition-all">
                Cancel
              </button>
              <button onClick={addCustom} disabled={creating || !newName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#c9a96e] hover:bg-[#c9a96e] text-white text-sm font-medium disabled:opacity-50 transition-all">
                {creating ? 'Adding…' : 'Add Custom'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Supplement card (grid view) ───────────────────────────────────────────────
function HabitCard({ habit: h, today, onCheckin, onUncheckin, onDelete, loading }: {
  habit: Habit; today: string;
  onCheckin: (id: string) => void;
  onUncheckin: (id: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}) {
  const col = COLOR_MAP[h.color] || COLOR_MAP.violet;
  const [glowing, setGlowing] = useState(false);

  const handleCheckin = () => {
    if (!h.completedToday) {
      setGlowing(true);
      setTimeout(() => setGlowing(false), 700);
    }
    h.completedToday ? onUncheckin(h.id) : onCheckin(h.id);
  };

  return (
    <div className={`relative bg-[rgba(201,169,110,0.03)] border rounded-2xl p-3.5 transition-all duration-500
      ${h.completedToday ? `${col.border} ${col.bg} shadow-lg ${col.glow}` : 'border-[rgba(201,169,110,0.07)]'}
      ${glowing ? 'scale-[1.04] brightness-125' : ''}`}>
      <button onClick={() => onDelete(h.id)}
        className="absolute top-2 right-2 p-1 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all">
        <Trash2 className="w-3 h-3" />
      </button>
      <div className="text-2xl mb-2">{h.icon}</div>
      <p className="text-white text-sm font-medium leading-tight">{h.name}</p>
      <div className="flex items-center justify-between mt-2">
        <StreakBadge streak={h.streak} />
        <button
          onClick={handleCheckin}
          disabled={loading}
          className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all
            ${h.completedToday ? `${col.bg} ${col.border} ${col.text}` : 'border-[rgba(201,169,110,0.18)] text-white/30 hover:border-white/40'}`}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
            h.completedToday ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Habit row (list view) ─────────────────────────────────────────────────────
function HabitRow({ habit: h, today, onCheckin, onUncheckin, onDelete, loading }: {
  habit: Habit; today: string;
  onCheckin: (id: string) => void;
  onUncheckin: (id: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}) {
  const col = COLOR_MAP[h.color] || COLOR_MAP.violet;
  return (
    <div className={`flex items-center gap-3 bg-[rgba(201,169,110,0.03)] border rounded-2xl px-4 py-3 transition-all
      ${h.completedToday ? `${col.border} ${col.bg}` : 'border-[rgba(201,169,110,0.07)]'}`}>
      <span className="text-xl shrink-0">{h.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium">{h.name}</p>
          <StreakBadge streak={h.streak} />
        </div>
        <div className="mt-1.5">
          <WeekDots checkins={h.checkins || []} color={h.color} />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => onDelete(h.id)}
          className="p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => h.completedToday ? onUncheckin(h.id) : onCheckin(h.id)}
          disabled={loading}
          className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all
            ${h.completedToday ? `${col.bg} ${col.border} ${col.text}` : 'border-[rgba(201,169,110,0.12)] text-white/30 hover:border-white/40'}`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> :
            h.completedToday ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

