// MealsPage.tsx
// Community healthy meals — browse, save, add to nutrition log.
import { useState, useEffect } from 'react';
import {
  Search, Bookmark, BookmarkCheck, Plus, X, ChefHat,
  Flame, Zap, Wheat, Droplets, ArrowLeft, PlusCircle,
  Filter, Star, Clock
} from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';
import { User } from '../types';

import { API } from '../../config';

const CATEGORIES = [
  { id: 'all',        label: 'All',         emoji: '🍽️' },
  { id: 'breakfast',  label: 'Breakfast',   emoji: '🌅' },
  { id: 'lunch',      label: 'Lunch',       emoji: '🥗' },
  { id: 'dinner',     label: 'Dinner',      emoji: '🍗' },
  { id: 'snack',      label: 'Snacks',      emoji: '🥜' },
  { id: 'smoothie',   label: 'Smoothies',   emoji: '🥤' },
  { id: 'high-protein', label: 'High Protein', emoji: '💪' },
  { id: 'vegan',      label: 'Vegan',       emoji: '🌱' },
  { id: 'other',      label: 'Other',       emoji: '✨' },
];

interface Meal {
  id: string;
  name: string;
  description: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  instructions: string;
  photo?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  saves: number;
  saved?: boolean;
  createdAt: string;
}

interface MealsPageProps {
  currentUser: User | null;
}

function MacroBadge({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)]`}>
      <Icon size={12} className={color} />
      <span className="text-white/60 text-xs">{label}</span>
      <span className="text-white text-xs font-semibold">{value}g</span>
    </div>
  );
}

function MealCardSkeleton() {
  return (
    <div className="bg-[rgba(201,169,110,0.04)] rounded-2xl overflow-hidden animate-pulse">
      <div className="h-44 bg-white/10" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-full" />
        <div className="flex gap-2">
          <div className="h-6 bg-white/10 rounded-lg w-16" />
          <div className="h-6 bg-white/10 rounded-lg w-16" />
          <div className="h-6 bg-white/10 rounded-lg w-16" />
        </div>
      </div>
    </div>
  );
}

export function MealsPage({ currentUser }: MealsPageProps) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Meal | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tab, setTab] = useState<'community' | 'saved'>('community');
  const [addingToLog, setAddingToLog] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Add meal form state
  const [form, setForm] = useState({
    name: '', description: '', category: 'breakfast',
    calories: '', protein: '', carbs: '', fat: '',
    ingredients: '', instructions: '', photo: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  const isTrainer = currentUser?.accountType === 'trainer' || currentUser?.accountType === 'admin';

  useEffect(() => { fetchMeals(); }, [tab]);

  async function fetchMeals() {
    setLoading(true);
    try {
      const endpoint = tab === 'saved' ? `${API}/meals/saved` : `${API}/meals`;
      const res = await authFetch(endpoint);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setMeals(data);
    } catch {
      toast.error('Could not load meals');
    } finally {
      setLoading(false);
    }
  }

  async function toggleSave(meal: Meal) {
    if (!currentUser) return;
    setSavingId(meal.id);
    try {
      const res = await authFetch(`${API}/meals/${meal.id}/save`, { method: 'POST' });
      const data = await res.json();
      setMeals(prev => prev.map(m =>
        m.id === meal.id
          ? { ...m, saved: data.saved, saves: m.saves + (data.saved ? 1 : -1) }
          : m
      ));
      if (selected?.id === meal.id) setSelected(s => s ? { ...s, saved: data.saved, saves: s.saves + (data.saved ? 1 : -1) } : s);
      toast.success(data.saved ? '🔖 Meal saved!' : 'Removed from saved');
    } catch {
      toast.error('Could not save meal');
    } finally {
      setSavingId(null);
    }
  }

  async function addToLog(meal: Meal) {
    if (!currentUser) return;
    setAddingToLog(meal.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await authFetch(`${API}/users/${currentUser.id}/nutrition/${today}`);
      const dayData = res.ok ? await res.json() : { meals: [] };
      const existing = dayData.meals || [];
      const newEntry = {
        id: `meal_${Date.now()}`,
        name: meal.name,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      await authFetch(`${API}/users/${currentUser.id}/nutrition/${today}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, meals: [...existing, newEntry] }),
      });
      toast.success(`✅ ${meal.name} added to today's log!`);
    } catch {
      toast.error('Could not add to log');
    } finally {
      setAddingToLog(null);
    }
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    // Create compressed preview via canvas
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      setPhotoPreview(dataUrl);
      setForm(f => ({ ...f, photo: dataUrl }));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function handleAddMeal(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.category) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`${API}/meals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          calories: Number(form.calories) || 0,
          protein: Number(form.protein) || 0,
          carbs: Number(form.carbs) || 0,
          fat: Number(form.fat) || 0,
          ingredients: form.ingredients.split('\n').filter(Boolean),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      const meal = await res.json();
      setMeals(prev => [meal, ...prev]);
      setShowAddModal(false);
      setForm({ name: '', description: '', category: 'breakfast', calories: '', protein: '', carbs: '', fat: '', ingredients: '', instructions: '', photo: '' });
      setPhotoFile(null);
      setPhotoPreview('');
      toast.success('🍽️ Meal posted!');
    } catch (err: any) {
      toast.error(err.message || 'Could not post meal');
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = meals.filter(m => {
    const matchCat = category === 'all' || m.category === category;
    const matchQ = !query || m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.description.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  const catInfo = (id: string) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selected) {
    const cat = catInfo(selected.category);
    return (
      <div className="min-h-screen bg-[#080608] px-4 py-6 max-w-2xl mx-auto">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors">
          <ArrowLeft size={18} /> Back to Meals
        </button>

        {/* Hero */}
        <div className="rounded-3xl overflow-hidden mb-6 bg-gradient-to-br from-emerald-600/20 to-teal-600/20 border border-[rgba(201,169,110,0.12)]">
          {selected.photo ? (
            <img src={selected.photo} alt={selected.name} className="w-full h-56 object-cover" />
          ) : (
            <div className="h-56 flex items-center justify-center">
              <span className="text-8xl">{cat.emoji}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-2xl p-6 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {cat.emoji} {cat.label}
              </span>
              <h1 className="text-white text-2xl font-bold mt-2">{selected.name}</h1>
              <p className="text-white/60 text-sm mt-1">by {selected.authorName}</p>
            </div>
            <button
              onClick={() => toggleSave(selected)}
              disabled={savingId === selected.id}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              {selected.saved
                ? <BookmarkCheck size={20} className="text-emerald-400" />
                : <Bookmark size={20} className="text-white/60" />}
            </button>
          </div>

          {selected.description && (
            <p className="text-white/70 text-sm leading-relaxed mb-4">{selected.description}</p>
          )}

          {/* Macros */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center">
              <Flame size={16} className="text-orange-400 mx-auto mb-1" />
              <div className="text-white font-bold">{selected.calories}</div>
              <div className="text-white/50 text-xs">kcal</div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
              <Zap size={16} className="text-blue-400 mx-auto mb-1" />
              <div className="text-white font-bold">{selected.protein}g</div>
              <div className="text-white/50 text-xs">protein</div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
              <Wheat size={16} className="text-yellow-400 mx-auto mb-1" />
              <div className="text-white font-bold">{selected.carbs}g</div>
              <div className="text-white/50 text-xs">carbs</div>
            </div>
            <div className="bg-pink-500/10 border border-[rgba(201,169,110,0.15)] rounded-xl p-3 text-center">
              <Droplets size={16} className="text-pink-400 mx-auto mb-1" />
              <div className="text-white font-bold">{selected.fat}g</div>
              <div className="text-white/50 text-xs">fat</div>
            </div>
          </div>

          <button
            onClick={() => addToLog(selected)}
            disabled={addingToLog === selected.id}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {addingToLog === selected.id ? (
              <span className="animate-spin border-2 border-white/30 border-t-white rounded-full w-4 h-4" />
            ) : (
              <><PlusCircle size={16} /> Add to Today's Log</>
            )}
          </button>
        </div>

        {/* Ingredients */}
        {selected.ingredients?.length > 0 && (
          <div className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-2xl p-5 mb-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <ChefHat size={16} className="text-emerald-400" /> Ingredients
            </h3>
            <ul className="space-y-1.5">
              {selected.ingredients.map((ing, i) => (
                <li key={i} className="flex items-start gap-2 text-white/70 text-sm">
                  <span className="text-emerald-400 mt-0.5">•</span>{ing}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Instructions */}
        {selected.instructions && (
          <div className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-3">Instructions</h3>
            <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">{selected.instructions}</p>
          </div>
        )}
      </div>
    );
  }

  // ── Main listing ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080608] px-4 py-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Healthy Meals</h1>
          <p className="text-white/50 text-sm mt-0.5">Curated meals from our trainers</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> Add Meal
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(['community', 'saved'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-[rgba(201,169,110,0.04)] text-white/60 hover:bg-[rgba(201,169,110,0.08)] hover:text-white'
            }`}
          >
            {t === 'community' ? '🍽️ Community' : '🔖 Saved'}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search meals..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      {/* Category pills */}
      {tab === 'community' && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                category === cat.id
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                  : 'bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/60 hover:border-[rgba(201,169,110,0.18)] hover:text-white'
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <MealCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <span className="text-3xl">🍽️</span>
          </div>
          <h3 className="text-white font-semibold mb-1">
            {tab === 'saved' ? 'No saved meals yet' : 'No meals found'}
          </h3>
          <p className="text-white/40 text-sm max-w-xs">
            {tab === 'saved'
              ? 'Browse community meals and tap the bookmark to save them here.'
              : 'Be the first to add a healthy meal!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(meal => {
            const cat = catInfo(meal.category);
            return (
              <div
                key={meal.id}
                onClick={() => setSelected(meal)}
                className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-2xl overflow-hidden cursor-pointer hover:border-emerald-500/30 hover:bg-[rgba(201,169,110,0.06)] transition-all group"
              >
                {/* Photo / emoji hero */}
                <div className="h-44 bg-gradient-to-br from-emerald-600/10 to-teal-600/10 relative overflow-hidden">
                  {meal.photo ? (
                    <img src={meal.photo} alt={meal.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-6xl">{cat.emoji}</span>
                    </div>
                  )}
                  {/* Category badge */}
                  <span className="absolute top-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full bg-black/50 text-white/80 backdrop-blur-sm">
                    {cat.label}
                  </span>
                  {/* Save button */}
                  <button
                    onClick={e => { e.stopPropagation(); toggleSave(meal); }}
                    disabled={savingId === meal.id}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors"
                  >
                    {meal.saved
                      ? <BookmarkCheck size={14} className="text-emerald-400" />
                      : <Bookmark size={14} className="text-white/70" />}
                  </button>
                </div>

                <div className="p-4">
                  <h3 className="text-white font-semibold text-sm leading-snug mb-1 line-clamp-2">{meal.name}</h3>
                  {meal.description && (
                    <p className="text-white/50 text-xs leading-relaxed mb-3 line-clamp-2">{meal.description}</p>
                  )}

                  {/* Calories + macros */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    <div className="flex items-center gap-1 text-orange-400 text-xs font-semibold">
                      <Flame size={11} />{meal.calories} kcal
                    </div>
                    <span className="text-white/20">·</span>
                    <MacroBadge icon={Zap} label="P" value={meal.protein} color="text-blue-400" />
                    <MacroBadge icon={Wheat} label="C" value={meal.carbs} color="text-yellow-400" />
                    <MacroBadge icon={Droplets} label="F" value={meal.fat} color="text-pink-400" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">by {meal.authorName}</span>
                    <button
                      onClick={e => { e.stopPropagation(); addToLog(meal); }}
                      disabled={addingToLog === meal.id}
                      className="flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                    >
                      {addingToLog === meal.id
                        ? <span className="animate-spin border border-emerald-400/50 border-t-emerald-400 rounded-full w-3 h-3" />
                        : <PlusCircle size={13} />}
                      Log it
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Meal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#110e09] border border-[rgba(201,169,110,0.12)] rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">Post a Meal</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-xl hover:bg-[rgba(201,169,110,0.08)] text-white/60 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddMeal} className="space-y-4">
              <div>
                <label className="text-white/70 text-xs font-medium mb-1 block">Meal Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. High-Protein Chicken Bowl"
                  className="w-full px-3 py-2.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-white/70 text-xs font-medium mb-1 block">Category *</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#110e09] border border-[rgba(201,169,110,0.12)] text-white text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.emoji} {cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-white/70 text-xs font-medium mb-1 block">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description..."
                  className="w-full px-3 py-2.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50 resize-none"
                />
              </div>

              {/* Macros */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'calories', label: 'Calories (kcal)', placeholder: '450' },
                  { key: 'protein',  label: 'Protein (g)',     placeholder: '35' },
                  { key: 'carbs',    label: 'Carbs (g)',       placeholder: '40' },
                  { key: 'fat',      label: 'Fat (g)',          placeholder: '12' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-white/70 text-xs font-medium mb-1 block">{label}</label>
                    <input
                      type="number"
                      min="0"
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="text-white/70 text-xs font-medium mb-1 block">Ingredients (one per line)</label>
                <textarea
                  rows={4}
                  value={form.ingredients}
                  onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))}
                  placeholder={"200g chicken breast\n1 cup brown rice\n1 avocado"}
                  className="w-full px-3 py-2.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50 resize-none"
                />
              </div>

              <div>
                <label className="text-white/70 text-xs font-medium mb-1 block">Instructions</label>
                <textarea
                  rows={3}
                  value={form.instructions}
                  onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                  placeholder="Step by step instructions..."
                  className="w-full px-3 py-2.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50 resize-none"
                />
              </div>

              <div>
                <label className="text-white/70 text-xs font-medium mb-1 block">Photo (optional)</label>
                <label className="flex flex-col items-center justify-center w-full cursor-pointer rounded-xl border border-dashed border-[rgba(201,169,110,0.25)] hover:border-emerald-500/50 transition-colors overflow-hidden bg-[rgba(201,169,110,0.04)]">
                  {photoPreview ? (
                    <div className="relative w-full">
                      <img src={photoPreview} alt="preview" className="w-full h-40 object-cover" />
                      <span className="absolute bottom-2 right-2 text-xs text-white/70 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm">tap to change</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                      <span className="text-3xl">📷</span>
                      <span className="text-white/50 text-xs">Tap to upload photo</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white/70 text-sm font-medium hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? <span className="animate-spin border-2 border-white/30 border-t-white rounded-full w-4 h-4" /> : '🍽️ Post Meal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
