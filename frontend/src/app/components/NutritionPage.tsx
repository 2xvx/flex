// NutritionPage.tsx
import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, X, Flame, Zap, Droplets, Target, Settings, Search, Loader2 } from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';
import { User } from '../types';

interface NutritionPageProps { currentUser: User | null; }
interface FoodEntry {
  id: string; name: string; calories: number;
  protein: number; carbs: number; fat: number;
  grams?: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

import { API } from '../../config';
const toISO = (d: Date) => d.toISOString().split('T')[0];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_CFG: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  breakfast: { emoji: '🌅', label: 'Breakfast', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  lunch:     { emoji: '☀️', label: 'Lunch',     color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/20' },
  dinner:    { emoji: '🌙', label: 'Dinner',    color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
  snack:     { emoji: '🍎', label: 'Snack',     color: 'text-green-400',   bg: 'bg-green-500/10 border-green-500/20' },
};
const QUICK_FOODS = [
  { name: 'Chicken Breast (100g)', calories: 165, protein: 31, carbs: 0,  fat: 3.6 },
  { name: 'Brown Rice (100g)',     calories: 216, protein: 5,  carbs: 45, fat: 1.8 },
  { name: 'Egg (1 large)',         calories: 78,  protein: 6,  carbs: 0.6,fat: 5   },
  { name: 'Banana',               calories: 89,  protein: 1.1,carbs: 23, fat: 0.3 },
  { name: 'Whey Protein (1 scoop)',calories: 120, protein: 24, carbs: 3,  fat: 2   },
  { name: 'Greek Yogurt (150g)',   calories: 100, protein: 17, carbs: 6,  fat: 0.7 },
  { name: 'Oats (50g)',            calories: 190, protein: 6.5,carbs: 34, fat: 3.5 },
  { name: 'Almonds (30g)',         calories: 173, protein: 6,  carbs: 6,  fat: 15  },
];

function CalRing({ value, goal, size = 140 }: { value: number; goal: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, value / goal);
  const over = value > goal;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={over ? '#ef4444' : '#22c55e'}
        strokeWidth="10" strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

export function NutritionPage({ currentUser }: NutritionPageProps) {
  const [date,    setDate]    = useState(toISO(new Date()));
  const [meals,   setMeals]   = useState<FoodEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [mealType,setMealType]= useState<FoodEntry['mealType']>('breakfast');
  const [form,    setForm]    = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [showGoals, setShowGoals] = useState(false);
  const [goals,   setGoals]   = useState({ calories: 2200, protein: 150, carbs: 250, fat: 70 });
  const [addTab,  setAddTab]  = useState<'search'|'quick'|'custom'|'scan'>('search');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const videoRef2 = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopScan = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
    setScanError('');
  };

  const startBarcodeScan = async () => {
    setScanError('');
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef2.current) {
        videoRef2.current.srcObject = stream;
        await videoRef2.current.play();
      }
      // Try BarcodeDetector API (Chrome/Android)
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128'] });
        const scan = async () => {
          if (!videoRef2.current || !streamRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef2.current);
            if (barcodes.length > 0) {
              const barcode = barcodes[0].rawValue;
              stopScan();
              await lookupBarcode(barcode);
              return;
            }
          } catch (_) {}
          if (streamRef.current) requestAnimationFrame(scan);
        };
        requestAnimationFrame(scan);
      } else {
        setScanError('Barcode scanning not supported on this browser. Try Chrome on Android.');
        setTimeout(stopScan, 3000);
      }
    } catch (e: any) {
      setScanError('Camera access denied. Please allow camera permissions.');
      setScanning(false);
    }
  };

  const lookupBarcode = async (barcode: string) => {
    toast.loading('Looking up product…', { id: 'barcode' });
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.status !== 1) { toast.error('Product not found in database', { id: 'barcode' }); return; }
      const p = data.product;
      const n = p.nutriments || {};
      const entry: FoodEntry = {
        id: Date.now().toString(),
        name: p.product_name || p.generic_name || 'Unknown product',
        calories: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
        protein:  Math.round(n.proteins_100g || 0),
        carbs:    Math.round(n.carbohydrates_100g || 0),
        fat:      Math.round(n.fat_100g || 0),
        grams: 100,
        mealType,
      };
      toast.success(`${entry.name} added!`, { id: 'barcode' });
      const updated = [...meals, entry];
      setMeals(updated);
      await save(updated);
      setShowAdd(false);
    } catch {
      toast.error('Failed to fetch product info', { id: 'barcode' });
    }
  };
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch(`${API}/users/${currentUser.id}/nutrition/${date}`);
      if (res.ok) { const d = await res.json(); setMeals(d.meals || []); }
    } catch {}
  };
  useEffect(() => { load(); }, [date, currentUser]);

  const save = async (m: FoodEntry[]) => {
    if (!currentUser) return;
    await authFetch(`${API}/users/${currentUser.id}/nutrition`, {
      method: 'POST', body: JSON.stringify({ date, meals: m }),
    });
  };

  const addEntry = async () => {
    if (!form.name.trim() || !form.calories) return;
    const entry: FoodEntry = {
      id: Date.now().toString(), name: form.name.trim(),
      calories: Number(form.calories), protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0, fat: Number(form.fat) || 0, mealType,
    };
    const updated = [...meals, entry];
    setMeals(updated); await save(updated);
    setForm({ name: '', calories: '', protein: '', carbs: '', fat: '' });
    setShowAdd(false); toast.success('Logged!');
  };

  const removeEntry = async (id: string) => {
    const updated = meals.filter(m => m.id !== id);
    setMeals(updated); await save(updated);
  };

  const searchFood = async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&action=process&json=1&page_size=10&fields=product_name,nutriments,serving_size,quantity`;
      const res = await fetch(url);
      const data = await res.json();
      const products = (data.products || [])
        .filter((p: any) => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
        .map((p: any) => ({
          name:     p.product_name,
          calories: Math.round(p.nutriments['energy-kcal_100g']   || 0),
          protein:  Math.round((p.nutriments['proteins_100g']      || 0) * 10) / 10,
          carbs:    Math.round((p.nutriments['carbohydrates_100g'] || 0) * 10) / 10,
          fat:      Math.round((p.nutriments['fat_100g']           || 0) * 10) / 10,
        }));
      setResults(products.slice(0, 8));
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  const addFromSearch = async (item: typeof results[0], grams = 100) => {
    const scale = grams / 100;
    const entry: FoodEntry = {
      id: Date.now().toString(),
      name: `${item.name} (${grams}g)`,
      calories: Math.round(item.calories * scale),
      protein:  Math.round(item.protein  * scale * 10) / 10,
      carbs:    Math.round(item.carbs    * scale * 10) / 10,
      fat:      Math.round(item.fat      * scale * 10) / 10,
      mealType,
    };
    const updated = [...meals, entry];
    setMeals(updated); await save(updated);
    toast.success(`${item.name} added!`);
    setShowAdd(false); setQuery(''); setResults([]);
  };

  const quickAdd = async (food: typeof QUICK_FOODS[0]) => {
    const entry: FoodEntry = { id: Date.now().toString(), ...food, mealType };
    const updated = [...meals, entry];
    setMeals(updated); await save(updated);
    toast.success(`${food.name} added!`);
  };

  const totals = meals.reduce((a, m) => ({
    calories: a.calories + m.calories, protein: a.protein + m.protein,
    carbs: a.carbs + m.carbs, fat: a.fat + m.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const shiftDate = (d: number) => {
    const dt = new Date(date + 'T12:00:00'); dt.setDate(dt.getDate() + d); setDate(toISO(dt));
  };

  const isToday = date === toISO(new Date());
  const dateLabel = isToday ? 'Today' : new Date(date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });

  if (!currentUser) return null;

  return (
    <div className="max-w-xl mx-auto py-6 px-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-black text-2xl tracking-tight">Nutrition</h1>
          <p className="text-white/35 text-sm mt-0.5">Track your daily intake</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowGoals(true)} className="p-2 rounded-xl bg-[rgba(201,169,110,0.04)] hover:bg-[rgba(201,169,110,0.08)] text-white/40 hover:text-white/70 transition-all">
            <Settings className="w-4 h-4" />
          </button>
          <div className="flex items-center bg-[#0d0b08] border border-white/[0.08] rounded-xl overflow-hidden">
            <button onClick={() => shiftDate(-1)} className="px-2.5 py-2 text-white/40 hover:text-white hover:bg-[rgba(201,169,110,0.04)] transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white/70 text-sm px-1 min-w-[72px] text-center">{dateLabel}</span>
            <button onClick={() => shiftDate(1)} disabled={isToday} className="px-2.5 py-2 text-white/40 hover:text-white hover:bg-[rgba(201,169,110,0.04)] disabled:opacity-20 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calorie ring card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d0b08] via-[#080608] to-[#080608] border border-white/[0.08] p-6">
        <div className="absolute top-0 right-0 w-48 h-48 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="flex items-center gap-6">
          <div className="relative shrink-0">
            <CalRing value={totals.calories} goal={goals.calories} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-white font-black text-xl leading-none">{totals.calories}</span>
              <span className="text-white/35 text-[10px] mt-0.5">kcal</span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            {[
              { label: 'Protein', val: totals.protein, goal: goals.protein, unit: 'g', color: '#3b82f6', bg: 'bg-blue-500' },
              { label: 'Carbs',   val: totals.carbs,   goal: goals.carbs,   unit: 'g', color: '#eab308', bg: 'bg-yellow-500' },
              { label: 'Fat',     val: totals.fat,     goal: goals.fat,     unit: 'g', color: '#f97316', bg: 'bg-orange-500' },
            ].map(({ label, val, goal, unit, bg }) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <span className="text-white/50 text-xs">{label}</span>
                  <span className="text-white/70 text-xs font-medium">{Math.round(val)}<span className="text-white/30">/{goal}{unit}</span></span>
                </div>
                <div className="h-1.5 bg-[rgba(201,169,110,0.06)] rounded-full overflow-hidden">
                  <div className={`h-full ${bg} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, (val / goal) * 100)}%` }} />
                </div>
              </div>
            ))}
            <p className="text-white/25 text-xs">
              {goals.calories - totals.calories > 0
                ? `${goals.calories - totals.calories} kcal remaining`
                : <span className="text-red-400">{totals.calories - goals.calories} kcal over goal</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Meal sections */}
      {MEAL_TYPES.map(mt => {
        const entries = meals.filter(m => m.mealType === mt);
        const mealCal = entries.reduce((s, e) => s + e.calories, 0);
        const cfg = MEAL_CFG[mt];
        return (
          <div key={mt} className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl border flex items-center justify-center text-base ${cfg.bg}`}>
                  {cfg.emoji}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p>
                  {mealCal > 0 && <p className="text-white/30 text-[10px]">{mealCal} kcal</p>}
                </div>
              </div>
              <button onClick={() => { setMealType(mt); setShowAdd(true); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[rgba(201,169,110,0.04)] hover:bg-[rgba(201,169,110,0.08)] text-white/50 hover:text-white transition-all text-xs">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {entries.length === 0 ? (
              <p className="px-4 pb-3 text-white/20 text-xs">Nothing logged yet</p>
            ) : (
              <div className="border-t border-[rgba(201,169,110,0.08)]">
                {entries.map(e => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm truncate">{e.name}</p>
                      <div className="flex gap-2 mt-0.5">
                        <span className="text-[10px] text-blue-400/70">{e.protein}g P</span>
                        <span className="text-[10px] text-yellow-400/70">{e.carbs}g C</span>
                        <span className="text-[10px] text-orange-400/70">{e.fat}g F</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-white font-semibold text-sm">{e.calories}</span>
                      <button onClick={() => removeEntry(e.id)} className="text-red-400/40 hover:text-red-400 active:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Goals modal */}
      {showGoals && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowGoals(false)}>
          <div className="w-full max-w-sm bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-semibold">Daily Goals</p>
              <button onClick={() => setShowGoals(false)} className="text-white/40 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: 'calories', label: 'Calories', unit: 'kcal' },
                { key: 'protein',  label: 'Protein',  unit: 'g' },
                { key: 'carbs',    label: 'Carbs',    unit: 'g' },
                { key: 'fat',      label: 'Fat',      unit: 'g' },
              ].map(({ key, label, unit }) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="text-white/60 text-sm">{label} ({unit})</label>
                  <input type="number" value={(goals as any)[key]}
                    onChange={e => setGoals(g => ({ ...g, [key]: Number(e.target.value) }))}
                    className="w-24 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-3 py-1.5 text-white text-sm text-right focus:outline-none focus:border-[rgba(201,169,110,0.5)]" />
                </div>
              ))}
            </div>
            <button onClick={() => setShowGoals(false)} className="w-full mt-4 py-2.5 rounded-xl bg-[#c9a96e] hover:bg-[#c9a96e] text-white text-sm font-medium transition-all">
              Save Goals
            </button>
          </div>
        </div>
      )}

      {/* Add food modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4" onClick={() => { setShowAdd(false); setQuery(''); setResults([]); }}>
          <div className="w-full max-w-lg bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="text-white font-bold text-base">Log Food</p>
              <button onClick={() => { setShowAdd(false); setQuery(''); setResults([]); }} className="text-white/40 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            {/* Meal type pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {MEAL_TYPES.map(mt => (
                <button key={mt} onClick={() => setMealType(mt)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize ${mealType === mt ? 'bg-[#c9a96e] text-white' : 'bg-[rgba(201,169,110,0.04)] text-white/45 hover:bg-[rgba(201,169,110,0.08)] hover:text-white/70'}`}>
                  {MEAL_CFG[mt].emoji} {mt}
                </button>
              ))}
            </div>
            {/* Tabs */}
            <div className="flex gap-1 bg-[rgba(201,169,110,0.04)] p-0.5 rounded-xl">
              {(['search','scan','quick','custom'] as const).map(t => (
                <button key={t} onClick={() => { setAddTab(t); if (t === 'scan') startBarcodeScan(); else stopScan(); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${addTab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
                  {t === 'search' ? '🔍 Search' : t === 'scan' ? '📷 Scan' : t === 'quick' ? '⚡ Quick' : '✏️ Custom'}
                </button>
              ))}
            </div>

            {/* SCAN TAB */}
            {addTab === 'scan' && (
              <div className="space-y-3">
                {scanError ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                    <p className="text-red-400 text-sm">{scanError}</p>
                    <button onClick={startBarcodeScan} className="mt-2 text-xs text-white/50 hover:text-white underline">Try again</button>
                  </div>
                ) : scanning ? (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                      <video ref={videoRef2} className="w-full h-full object-cover" playsInline muted />
                      {/* Scan overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-32 border-2 border-[rgba(201,169,110,0.45)] rounded-xl opacity-80" />
                        <div className="absolute bottom-3 left-0 right-0 text-center text-white/60 text-xs">Point at barcode</div>
                      </div>
                    </div>
                    <button onClick={stopScan} className="w-full py-2 rounded-xl bg-[rgba(201,169,110,0.04)] text-white/50 text-sm hover:bg-[rgba(201,169,110,0.08)] transition-colors">Cancel</button>
                  </div>
                ) : (
                  <button onClick={startBarcodeScan} className="w-full py-4 rounded-xl bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] text-[#e8c98a] text-sm font-medium hover:bg-[rgba(201,169,110,0.12)] transition-colors">
                    📷 Start Camera
                  </button>
                )}
              </div>
            )}

            {/* SEARCH TAB */}
            {addTab === 'search' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    value={query}
                    onChange={e => { setQuery(e.target.value); searchFood(e.target.value); }}
                    placeholder="Search any food — chicken, banana, oats…"
                    className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
                    autoFocus
                  />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 animate-spin" />}
                </div>
                {results.length > 0 ? (
                  <div className="space-y-1.5">
                    {results.map((item, i) => (
                      <button key={i} onClick={() => addFromSearch(item, 100)}
                        className="w-full text-left px-4 py-3 rounded-xl bg-[rgba(201,169,110,0.04)] hover:bg-[rgba(201,169,110,0.08)] border border-white/[0.06] hover:border-[rgba(201,169,110,0.18)] transition-all group">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-white/85 text-sm font-medium truncate group-hover:text-white transition-colors">{item.name}</p>
                          <span className="text-green-400 font-bold text-sm shrink-0">{item.calories} kcal</span>
                        </div>
                        <div className="flex gap-3 mt-1">
                          <span className="text-blue-400/60 text-[10px]">P {item.protein}g</span>
                          <span className="text-yellow-400/60 text-[10px]">C {item.carbs}g</span>
                          <span className="text-orange-400/60 text-[10px]">F {item.fat}g</span>
                          <span className="text-white/20 text-[10px] ml-auto">per 100g · tap to add</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : query.length > 1 && !searching ? (
                  <p className="text-white/25 text-sm text-center py-4">No results for "{query}" — try the Custom tab</p>
                ) : query.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-white/20 text-sm">Powered by Open Food Facts</p>
                    <p className="text-white/15 text-xs mt-1">Over 3 million products</p>
                  </div>
                ) : null}
              </div>
            )}

            {/* QUICK TAB */}
            {addTab === 'quick' && (
              <div className="grid grid-cols-2 gap-2">
                {QUICK_FOODS.map(f => (
                  <button key={f.name} onClick={() => { quickAdd(f); setShowAdd(false); }}
                    className="text-left px-3 py-2.5 rounded-xl bg-[rgba(201,169,110,0.04)] hover:bg-[rgba(201,169,110,0.08)] border border-white/[0.06] hover:border-white/[0.12] transition-all">
                    <p className="text-white/80 text-xs font-medium leading-tight">{f.name}</p>
                    <p className="text-green-400/70 text-[10px] mt-0.5 font-semibold">{f.calories} kcal · {f.protein}g P</p>
                  </button>
                ))}
              </div>
            )}

            {/* CUSTOM TAB */}
            {addTab === 'custom' && (
              <div className="space-y-2.5">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Food name"
                  className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#c9a96e]/40" />
                <div className="grid grid-cols-2 gap-2">
                  {[['calories','Calories (kcal)'],['protein','Protein (g)'],['carbs','Carbs (g)'],['fat','Fat (g)']].map(([k, lbl]) => (
                    <input key={k} type="number" min="0"
                      value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                      placeholder={lbl}
                      className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#c9a96e]/40" />
                  ))}
                </div>
                <button onClick={addEntry} disabled={!form.name.trim() || !form.calories}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#c9a96e] to-[#a07840] text-white font-semibold  disabled:opacity-40 transition-all">
                  Add Food
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

