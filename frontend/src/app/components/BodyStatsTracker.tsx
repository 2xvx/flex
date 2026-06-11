// BodyStatsTracker.tsx
// Log weight, body fat, and measurements over time. Shows a line chart.
import { useState, useEffect, useRef } from 'react';
import { Plus, TrendingUp, TrendingDown, Minus as Flat, Camera, X, ChevronLeft, ChevronRight, Images } from 'lucide-react';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';

import { API } from '../../config';

interface StatEntry {
  id?: string;
  date: string;
  weight?: number | null;
  bodyFat?: number | null;
  waist?: number | null;
  chest?: number | null;
  arms?: number | null;
  hips?: number | null;
}

interface ProgressPhoto { id: string; url: string; date: string; note?: string; }
interface Props { userId: string; }

const FIELDS: { key: keyof StatEntry; label: string; unit: string; color: string }[] = [
  { key: 'weight',  label: 'Weight',   unit: 'kg',  color: '#c9a96e' },
  { key: 'bodyFat', label: 'Body Fat', unit: '%',   color: '#f59e0b' },
  { key: 'waist',   label: 'Waist',    unit: 'cm',  color: '#06b6d4' },
  { key: 'chest',   label: 'Chest',    unit: 'cm',  color: '#10b981' },
  { key: 'arms',    label: 'Arms',     unit: 'cm',  color: '#f43f5e' },
  { key: 'hips',    label: 'Hips',     unit: 'cm',  color: '#e8c98a' },
];

export function BodyStatsTracker({ userId }: Props) {
  const [stats,      setStats]      = useState<StatEntry[]>([]);
  const [showForm,   setShowForm]   = useState(false);
  const [activeKey,  setActiveKey]  = useState<keyof StatEntry>('weight');
  const [form,       setForm]       = useState<StatEntry>({ date: new Date().toISOString().split('T')[0] });
  const [saving,     setSaving]     = useState(false);
  const [photos,     setPhotos]     = useState<ProgressPhoto[]>([]);
  const [showPhotos, setShowPhotos] = useState(false);
  const [compareA,   setCompareA]   = useState<ProgressPhoto | null>(null);
  const [compareB,   setCompareB]   = useState<ProgressPhoto | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchStats(); fetchPhotos(); }, [userId]);  // eslint-disable-line

  const fetchStats = async () => {
    try {
      const res = await authFetch(`${API}/users/${userId}/body-stats`);
      if (res.ok) {
        setStats((await res.json()).stats || []);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('body-stats GET failed', res.status, err);
        if (res.status !== 401) toast.error('Could not load stats');
      }
    } catch (e) { console.error('body-stats fetch error', e); }
  };

  const fetchPhotos = async () => {
    try {
      const res = await authFetch(`${API}/users/${userId}/progress-photos`);
      if (res.ok) { const d = await res.json(); setPhotos(d.photos || []); }
    } catch {}
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      // Convert to base64 for storage (same pattern as post images)
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        const res = await authFetch(`${API}/users/${userId}/progress-photos`, {
          method: 'POST',
          body: JSON.stringify({ photo: base64, date: new Date().toISOString().split('T')[0] }),
        });
        if (res.ok) {
          const d = await res.json();
          setPhotos(p => [d.photo, ...p]);
          toast.success('Progress photo saved!');
        } else { toast.error('Upload failed'); }
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch { toast.error('Upload failed'); setUploadingPhoto(false); }
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const deletePhoto = async (id: string) => {
    try {
      await authFetch(`${API}/users/${userId}/progress-photos/${id}`, { method: 'DELETE' });
      setPhotos(p => p.filter(ph => ph.id !== id));
      if (compareA?.id === id) setCompareA(null);
      if (compareB?.id === id) setCompareB(null);
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`${API}/users/${userId}/body-stats`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      toast.success('Stats logged!');
      setShowForm(false);
      setForm({ date: new Date().toISOString().split('T')[0] });
      fetchStats();
    } catch { toast.error('Could not save stats'); }
    finally { setSaving(false); }
  };

  const chartData = stats.map(s => ({
    date: new Date(s.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    value: s[activeKey] as number ?? null,
  })).filter(d => d.value !== null);

  const latest = stats.slice(-1)[0];
  const prev   = stats.slice(-2)[0];
  const field  = FIELDS.find(f => f.key === activeKey)!;

  const Trend = ({ curr, old }: { curr?: number | null; old?: number | null }) => {
    if (!curr || !old) return null;
    const diff = curr - old;
    if (Math.abs(diff) < 0.1) return <Flat className="w-3.5 h-3.5 text-white/30" />;
    return diff > 0
      ? <TrendingUp className="w-3.5 h-3.5 text-red-400" />
      : <TrendingDown className="w-3.5 h-3.5 text-green-400" />;
  };

  return (
    <div className="space-y-4">
      {/* Metric selector */}
      <div className="flex gap-1.5 flex-wrap">
        {FIELDS.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveKey(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              activeKey === f.key
                ? 'border-[rgba(201,169,110,0.5)] bg-[#c9a96e]/15 text-[#e8c98a]'
                : 'border-[rgba(201,169,110,0.07)] text-white/35 hover:text-white/60'
            }`}
          >{f.label}</button>
        ))}
      </div>

      {/* Current stat card */}
      {latest && latest[activeKey] != null && (
        <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 flex items-center gap-4">
          <div>
            <p className="text-white/35 text-xs">{field.label}</p>
            <p className="text-white font-bold text-3xl">{latest[activeKey]}<span className="text-white/30 text-base ml-1">{field.unit}</span></p>
            {prev && prev[activeKey] != null && (
              <p className="text-white/30 text-xs mt-0.5">
                prev: {prev[activeKey]}{field.unit}
              </p>
            )}
          </div>
          <div className="ml-auto">
            <Trend curr={latest[activeKey] as number} old={prev?.[activeKey] as number} />
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl p-4">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{ background: '#0d0b08', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                formatter={(v: number) => [`${v} ${field.unit}`, field.label]}
              />
              <Line type="monotone" dataKey="value" stroke={field.color} strokeWidth={2} dot={{ fill: field.color, r: 3 }} activeDot={{ r: 5 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Log button */}
      <button
        onClick={() => setShowForm(s => !s)}
        className="w-full py-2.5 rounded-xl bg-[#c9a96e]/15 border border-[rgba(201,169,110,0.18)] text-[#e8c98a] text-sm font-medium hover:bg-[#c9a96e]/25 flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> Log today's stats
      </button>

      {/* Log form */}
      {showForm && (
        <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 space-y-3">
          <input
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[rgba(201,169,110,0.5)]"
          />
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(f => (
              <div key={f.key}>
                <label className="text-white/40 text-xs">{f.label} ({f.unit})</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="—"
                  value={(form[f.key] as number) ?? ''}
                  onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value ? +e.target.value : null }))}
                  className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[rgba(201,169,110,0.5)] mt-0.5"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-[#c9a96e] hover:bg-[#a07840] text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >{saving ? 'Saving…' : 'Save Stats'}</button>
        </div>
      )}

      {/* History list */}
      {stats.length > 0 && (
        <div className="space-y-2">
          <p className="text-white/30 text-xs uppercase tracking-wider">History</p>
          {[...stats].reverse().slice(0, 10).map((s, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-[rgba(201,169,110,0.08)]">
              <span className="text-white/35 text-xs w-20 shrink-0">{new Date(s.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
              <div className="flex gap-3 flex-wrap">
                {FIELDS.filter(f => s[f.key] != null).map(f => (
                  <span key={f.key} className="text-white/60 text-xs">
                    <span className="text-white/30">{f.label}: </span>{s[f.key]}{f.unit}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Progress Photos ─────────────────────────────────────────── */}
      <div className="border-t border-[rgba(201,169,110,0.07)] pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowPhotos(s => !s)} className="flex items-center gap-2 text-white/60 hover:text-white text-sm font-medium transition-colors">
            <Images className="w-4 h-4" />
            Progress Photos
            <span className="text-white/25 text-xs">({photos.length})</span>
          </button>
          <div className="flex gap-2">
            {photos.length >= 2 && compareA && compareB && (
              <button onClick={() => { setCompareA(null); setCompareB(null); }}
                className="text-xs text-[#c9a96e] hover:text-[#e8c98a] transition-colors">Clear compare</button>
            )}
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] text-[#e8c98a] text-xs font-medium hover:bg-[rgba(201,169,110,0.12)] transition-all disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
              {uploadingPhoto ? 'Uploading…' : 'Add Photo'}
            </button>
          </div>
        </div>

        {/* Compare view */}
        {compareA && compareB && (
          <div className="bg-[#080608] border border-[rgba(201,169,110,0.18)] rounded-2xl p-3 space-y-2">
            <p className="text-white/40 text-xs text-center">Side-by-side comparison</p>
            <div className="grid grid-cols-2 gap-2">
              {[compareA, compareB].map((ph, i) => (
                <div key={ph.id} className="relative">
                  <img src={ph.url} alt="" className="w-full aspect-square object-cover rounded-xl" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white/70 text-[10px] text-center py-1 rounded-b-xl">
                    {new Date(ph.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photo grid */}
        {showPhotos && (
          <div className="grid grid-cols-3 gap-2">
            {photos.length === 0 ? (
              <div className="col-span-3 py-8 text-center">
                <Camera className="w-8 h-8 text-white/15 mx-auto mb-2" />
                <p className="text-white/25 text-xs">No progress photos yet</p>
              </div>
            ) : photos.map(ph => {
              const isA = compareA?.id === ph.id;
              const isB = compareB?.id === ph.id;
              return (
                <div key={ph.id} className="relative group aspect-square">
                  <img src={ph.url} alt="" className={`w-full h-full object-cover rounded-xl transition-all ${isA || isB ? 'ring-2 ring-[#c9a96e]' : ''}`} />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-xl transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => { if (isA) setCompareA(null); else if (isB) setCompareB(null); else if (!compareA) setCompareA(ph); else if (!compareB) setCompareB(ph); }}
                      className="w-7 h-7 rounded-lg bg-[#c9a96e] flex items-center justify-center text-white text-[10px] font-bold"
                      title={isA || isB ? 'Remove from compare' : 'Compare'}
                    >
                      {isA ? 'A' : isB ? 'B' : '+'}
                    </button>
                    <button onClick={() => deletePhoto(ph.id)} className="w-7 h-7 rounded-lg bg-red-500/80 flex items-center justify-center">
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white/60 text-[9px] text-center py-0.5 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity">
                    {new Date(ph.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
