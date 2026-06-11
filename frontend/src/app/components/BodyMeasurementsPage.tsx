// BodyMeasurementsPage.tsx — Track body measurements over time with charts

import { useState, useEffect, useCallback } from 'react';
import {
  Ruler, Plus, X, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, Loader2, Trash2,
} from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';
import { API } from '../../config';

// ── Types ────────────────────────────────────────────────────────────────────
interface MeasurementEntry {
  id: string;
  date: string;        // ISO date string
  unit: 'cm' | 'in';
  chest?: number;
  waist?: number;
  hips?: number;
  shoulders?: number;
  leftArm?: number;
  rightArm?: number;
  leftThigh?: number;
  rightThigh?: number;
  neck?: number;
  notes?: string;
}

const FIELDS: { key: keyof Omit<MeasurementEntry, 'id' | 'date' | 'unit' | 'notes'>; label: string; emoji: string }[] = [
  { key: 'chest',      label: 'Chest',       emoji: '🫁' },
  { key: 'waist',      label: 'Waist',       emoji: '⌛' },
  { key: 'hips',       label: 'Hips',        emoji: '🔵' },
  { key: 'shoulders',  label: 'Shoulders',   emoji: '🏋️' },
  { key: 'neck',       label: 'Neck',        emoji: '🔺' },
  { key: 'leftArm',    label: 'Left Arm',    emoji: '💪' },
  { key: 'rightArm',   label: 'Right Arm',   emoji: '💪' },
  { key: 'leftThigh',  label: 'Left Thigh',  emoji: '🦵' },
  { key: 'rightThigh', label: 'Right Thigh', emoji: '🦵' },
];

interface Props {
  userId: string;
  currentUser?: { id: string } | null;
  readOnly?: boolean;
}

// ── Mini sparkline chart ──────────────────────────────────────────────────────
function Sparkline({ values, color = '#c9a96e' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 32;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={parseFloat(pts.split(' ').slice(-1)[0].split(',')[0])}
        cy={parseFloat(pts.split(' ').slice(-1)[0].split(',')[1])}
        r="2.5" fill={color} />
    </svg>
  );
}

// ── Delta badge ───────────────────────────────────────────────────────────────
function Delta({ current, previous, unit }: { current: number; previous: number; unit: string }) {
  const diff = +(current - previous).toFixed(1);
  if (diff === 0) return <span className="text-white/30 text-[10px] flex items-center gap-0.5"><Minus className="w-2.5 h-2.5" /> 0</span>;
  const up = diff > 0;
  return (
    <span className={`text-[10px] flex items-center gap-0.5 ${up ? 'text-amber-400' : 'text-green-400'}`}>
      {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {up ? '+' : ''}{diff} {unit}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function BodyMeasurementsPage({ userId, currentUser, readOnly = false }: Props) {
  const [entries, setEntries]       = useState<MeasurementEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showLog, setShowLog]       = useState(false);
  const [expandedField, setExpanded] = useState<string | null>(null);
  const [unit, setUnit]             = useState<'cm' | 'in'>('cm');

  // Form state
  const [form, setForm] = useState<Partial<MeasurementEntry>>({ date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await authFetch(`${API}/users/${userId}/measurements`);
      const data = await res.json();
      const sorted = (data.measurements || []).sort(
        (a: MeasurementEntry, b: MeasurementEntry) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setEntries(sorted);
      if (sorted[0]?.unit) setUnit(sorted[0].unit);
    } catch { toast.error('Could not load measurements'); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const hasValue = FIELDS.some(f => form[f.key] != null && (form[f.key] as number) > 0);
    if (!hasValue) return toast.error('Enter at least one measurement');
    setSaving(true);
    try {
      await authFetch(`${API}/users/${userId}/measurements`, {
        method: 'POST',
        body: JSON.stringify({ ...form, unit }),
      });
      toast.success('Measurements saved!');
      setShowLog(false);
      setForm({ date: new Date().toISOString().slice(0, 10) });
      await load();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await authFetch(`${API}/users/${userId}/measurements/${id}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Entry deleted');
    } catch { toast.error('Failed to delete'); }
  };

  // Build per-field history: [{ date, value }]
  const fieldHistory = (key: keyof MeasurementEntry) =>
    entries
      .map(e => ({ date: e.date, value: e[key] as number | undefined }))
      .filter(x => x.value != null)
      .reverse() as { date: string; value: number }[];

  const latest  = entries[0];
  const prev    = entries[1];

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Ruler className="w-4 h-4 text-[#c9a96e]" /> Body Measurements
          </h2>
          <p className="text-white/35 text-xs mt-0.5">Track your body composition over time</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Unit toggle */}
          <div className="flex bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg overflow-hidden text-xs">
            {(['cm', 'in'] as const).map(u => (
              <button key={u} onClick={() => setUnit(u)}
                className={`px-2.5 py-1.5 transition-all ${unit === u ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'}`}>
                {u}
              </button>
            ))}
          </div>
          {!readOnly && (
            <button onClick={() => setShowLog(true)}
              className="flex items-center gap-1.5 bg-[#c9a96e] hover:bg-[#c9a96e] text-white text-xs font-medium px-3 py-1.5 rounded-xl transition-all">
              <Plus className="w-3.5 h-3.5" /> Log
            </button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 border border-[rgba(201,169,110,0.07)] rounded-2xl">
          <Ruler className="w-8 h-8 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No measurements yet</p>
          {!readOnly && <p className="text-white/20 text-xs mt-1">Tap "Log" to record your first entry</p>}
        </div>
      ) : (
        <>
          {/* Measurement cards grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FIELDS.map(({ key, label, emoji }) => {
              const hist = fieldHistory(key);
              if (hist.length === 0) return null;
              const cur  = hist[hist.length - 1].value;
              const prv  = hist.length > 1 ? hist[hist.length - 2].value : null;
              const isExpanded = expandedField === key;
              return (
                <div key={key}
                  className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl p-3.5 cursor-pointer hover:border-[rgba(201,169,110,0.25)] transition-all"
                  onClick={() => setExpanded(isExpanded ? null : key)}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-white/40">{emoji} {label}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-white text-lg font-bold">{cur}</span>
                      <span className="text-white/30 text-xs ml-1">{unit}</span>
                      {prv != null && <div className="mt-0.5"><Delta current={cur} previous={prv} unit={unit} /></div>}
                    </div>
                    <Sparkline values={hist.map(h => h.value)} />
                  </div>
                  {/* Expanded: full history list */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[rgba(201,169,110,0.07)] space-y-1">
                      {[...hist].reverse().map((h, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-white/30">{new Date(h.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                          <span className="text-white/70">{h.value} {unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Entry history list */}
          <div className="space-y-2">
            <p className="text-white/30 text-[10px] uppercase tracking-wider">All entries</p>
            {entries.map(e => (
              <div key={e.id} className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white/60 text-xs font-medium">
                    {new Date(e.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {FIELDS.filter(f => e[f.key] != null).map(f => (
                      <span key={f.key} className="text-white/45 text-[10px]">
                        {f.label}: <span className="text-white/70">{e[f.key]} {e.unit}</span>
                      </span>
                    ))}
                  </div>
                  {e.notes && <p className="text-white/25 text-[10px] mt-1 italic">{e.notes}</p>}
                </div>
                {!readOnly && (
                  <button onClick={() => handleDelete(e.id)}
                    className="shrink-0 p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Log modal ── */}
      {showLog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,169,110,0.07)] sticky top-0 bg-[#0d0b08]">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Ruler className="w-4 h-4 text-[#c9a96e]" /> Log Measurements
              </h2>
              <button onClick={() => setShowLog(false)} className="text-white/40 hover:text-white/70">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Date */}
              <div>
                <label className="text-white/50 text-xs block mb-1.5">Date</label>
                <input type="date" value={form.date || ''}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]" />
              </div>
              {/* Unit */}
              <div>
                <label className="text-white/50 text-xs block mb-1.5">Unit</label>
                <div className="flex gap-2">
                  {(['cm', 'in'] as const).map(u => (
                    <button key={u} onClick={() => setUnit(u)}
                      className={`flex-1 py-2 rounded-xl border text-sm transition-all ${unit === u ? 'bg-[rgba(201,169,110,0.12)] border-[#c9a96e]/40 text-[#e8c98a]' : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:border-[rgba(201,169,110,0.18)]'}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              {/* Measurement fields */}
              <div className="grid grid-cols-2 gap-3">
                {FIELDS.map(({ key, label, emoji }) => (
                  <div key={key}>
                    <label className="text-white/40 text-[11px] block mb-1">{emoji} {label}</label>
                    <div className="relative">
                      <input
                        type="number" min="0" step="0.1"
                        value={(form[key] as number) ?? ''}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value === '' ? undefined : +e.target.value }))}
                        placeholder="—"
                        className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.5)] pr-8"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 text-[10px]">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Notes */}
              <div>
                <label className="text-white/50 text-xs block mb-1.5">Notes (optional)</label>
                <input
                  value={form.notes || ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. morning, post-workout…"
                  className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
                />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setShowLog(false)}
                className="flex-1 py-2.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/60 text-sm hover:bg-[rgba(201,169,110,0.04)] transition-all">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#c9a96e] hover:bg-[#c9a96e] text-white text-sm font-medium transition-all disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
