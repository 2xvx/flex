// ExerciseLibraryPage.tsx
// Upgraded: always-visible category tabs, featured hero, trainer spotlight,
// trending row, recently viewed, equipment filter, smart search autocomplete

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, Dumbbell, BookOpen, ChevronLeft, Bookmark, BookmarkCheck,
  BadgeCheck, ChevronRight, Filter, Zap, AlertTriangle, Lightbulb,
  CheckCircle2, Loader2, Play, Image as ImageIcon, Video, X,
  TrendingUp, Clock, Star, Users,
} from 'lucide-react';
import { MuscleBodyDiagram } from './MuscleBodyDiagram';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';
import { User } from '../types';
import { API } from '../../config';

interface Exercise {
  id: string;
  name: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  photos: string[];
  videoUrl?: string;
  steps: string[];
  mistakes: string[];
  variations: { name: string; type: 'easier' | 'harder' }[];
  trainerTip: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorVerified: boolean;
  saves: number;
  savedByMe?: boolean;
  createdAt: string;
}

const CATEGORIES     = ['All', 'Strength', 'Cardio', 'Flexibility', 'Power', 'Mobility', 'Stretch'];
const DIFFICULTIES   = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const EQUIPMENT_LIST = ['All', 'Barbell', 'Dumbbell', 'Bodyweight', 'Cable', 'Machine', 'Kettlebell', 'Resistance Band', 'Pull-up Bar'];

const DIFF_COLORS: Record<string, string> = {
  beginner:     'bg-green-500/15 text-green-400 border-green-500/25',
  intermediate: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  advanced:     'bg-red-500/15 text-red-400 border-red-500/25',
};

const CAT_ICONS: Record<string, string> = {
  Strength: '🏋️', Cardio: '🏃', Flexibility: '🧘', Power: '⚡',
  Mobility: '🔄', Stretch: '🤸', All: '📚',
};

function isDirectVideo(url?: string | null): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(url);
}

function getYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function VideoPlayer({ url, autoPlay = false, loop = true, showControls = true }:
  { url: string; autoPlay?: boolean; loop?: boolean; showControls?: boolean }) {
  const ytId = getYouTubeId(url);
  if (ytId) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${ytId}?autoplay=${autoPlay ? 1 : 0}&loop=${loop ? 1 : 0}&playlist=${ytId}&mute=1&controls=${showControls ? 1 : 0}&rel=0&modestbranding=1`}
        className="w-full h-full"
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    );
  }
  if (isDirectVideo(url)) {
    return (
      <video src={url} autoPlay={autoPlay} loop={loop} muted playsInline controls={showControls} className="w-full h-full object-cover" />
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center justify-center h-full bg-black/40 text-[#e8c98a] gap-2 text-sm">
      <Play className="w-5 h-5" /> Open video
    </a>
  );
}

interface Props { currentUser: User | null; }

export function ExerciseLibraryPage({ currentUser }: Props) {
  const [exercises,   setExercises]   = useState<Exercise[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [category,    setCategory]    = useState('All');
  const [difficulty,  setDifficulty]  = useState('All');
  const [equipment,   setEquipment]   = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [selected,    setSelected]    = useState<Exercise | null>(null);
  const [photoIdx,    setPhotoIdx]    = useState(0);
  const [recentlyViewed, setRecentlyViewed] = useState<Exercise[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)              params.set('q', search);
      if (category !== 'All') params.set('category', category.toLowerCase());
      if (difficulty !== 'All') params.set('difficulty', difficulty.toLowerCase());
      if (equipment !== 'All') params.set('equipment', equipment.toLowerCase());
      const res  = await authFetch(`${API}/exercises?${params}`);
      const data = await res.json();
      setExercises(data.exercises || []);
    } catch { toast.error('Could not load exercises'); }
    finally  { setLoading(false); }
  }, [search, category, difficulty, equipment]);

  useEffect(() => { load(); }, [load]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleSave = async (ex: Exercise) => {
    if (!currentUser) return toast.error('Log in to save exercises');
    try {
      const res  = await authFetch(`${API}/exercises/${ex.id}/save`, { method: 'POST' });
      const data = await res.json();
      const update = (e: Exercise) =>
        e.id === ex.id ? { ...e, savedByMe: data.saved, saves: e.saves + (data.saved ? 1 : -1) } : e;
      setExercises(prev => prev.map(update));
      if (selected?.id === ex.id) setSelected(prev => prev ? update(prev) : prev);
    } catch { toast.error('Failed to save'); }
  };

  const openExercise = (ex: Exercise) => {
    setSelected(ex);
    setPhotoIdx(0);
    setShowSuggestions(false);
    setRecentlyViewed(prev => [ex, ...prev.filter(e => e.id !== ex.id)].slice(0, 5));
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const noFilters = !search && category === 'All' && difficulty === 'All' && equipment === 'All';

  const featuredExercise = useMemo(() =>
    noFilters && exercises.length > 0 ? [...exercises].sort((a, b) => b.saves - a.saves)[0] : null,
    [noFilters, exercises]
  );

  const trendingExercises = useMemo(() =>
    exercises.length > 0 ? [...exercises].sort((a, b) => b.saves - a.saves).slice(0, 6) : [],
    [exercises]
  );

  const verifiedTrainers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatar?: string; count: number }>();
    exercises.forEach(ex => {
      if (ex.authorVerified) {
        if (!map.has(ex.authorId)) {
          map.set(ex.authorId, { id: ex.authorId, name: ex.authorName, avatar: ex.authorAvatar, count: 0 });
        }
        map.get(ex.authorId)!.count++;
      }
    });
    return Array.from(map.values());
  }, [exercises]);

  const searchSuggestions = useMemo(() =>
    search.trim().length >= 1
      ? exercises.map(e => e.name).filter(n => n.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
      : [],
    [exercises, search]
  );

  if (selected) {
    return (
      <ExerciseDetailView
        exercise={selected}
        photoIdx={photoIdx}
        setPhotoIdx={setPhotoIdx}
        onBack={() => { setSelected(null); setPhotoIdx(0); }}
        onSave={() => toggleSave(selected)}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-white font-bold text-xl flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#c9a96e]" /> Exercise Library
        </h1>
        <p className="text-white/40 text-sm mt-0.5">Expert technique guides from verified trainers</p>
      </div>

      {/* Search + filter button */}
      <div className="flex gap-2">
        <div className="relative flex-1" ref={searchRef}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search exercises…"
            className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
          />
          {search && (
            <button onClick={() => { setSearch(''); setShowSuggestions(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Option D: Search suggestions dropdown */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-xl overflow-hidden z-30 shadow-xl">
              {searchSuggestions.map(name => (
                <button
                  key={name}
                  onClick={() => { setSearch(name); setShowSuggestions(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-[rgba(201,169,110,0.06)] transition-colors text-left"
                >
                  <Search className="w-3.5 h-3.5 text-white/25 shrink-0" />
                  <span className="text-white/80 text-sm">{name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`px-3 py-2 rounded-xl border text-sm transition-all ${showFilters ? 'border-[rgba(201,169,110,0.5)] bg-[rgba(201,169,110,0.08)] text-[#e8c98a]' : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:text-white/70'}`}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Option A: Always-visible category chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border shrink-0 ${
              category === c
                ? 'bg-[#c9a96e] border-transparent text-white'
                : 'bg-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.12)] text-white/50 hover:text-white/80 hover:border-[rgba(201,169,110,0.25)]'
            }`}
          >
            <span className="text-[11px]">{CAT_ICONS[c]}</span>{c}
          </button>
        ))}
      </div>

      {/* Filter panel — difficulty + equipment only */}
      {showFilters && (
        <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Difficulty</p>
            <div className="flex gap-2 flex-wrap">
              {DIFFICULTIES.map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={`px-3 py-1 rounded-lg text-xs border transition-all ${difficulty === d ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.45)] text-[#e8c98a]' : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:border-[rgba(201,169,110,0.18)]'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          {/* Option D: Equipment filter */}
          <div>
            <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Equipment</p>
            <div className="flex gap-1.5 flex-wrap">
              {EQUIPMENT_LIST.map(eq => (
                <button key={eq} onClick={() => setEquipment(eq)}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${equipment === eq ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.45)] text-[#e8c98a]' : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:border-[rgba(201,169,110,0.18)]'}`}>
                  {eq}
                </button>
              ))}
            </div>
          </div>
          {/* Reset */}
          {(!noFilters) && (
            <button onClick={() => { setCategory('All'); setDifficulty('All'); setEquipment('All'); setSearch(''); }}
              className="text-[#c9a96e] text-xs hover:underline">
              Reset all filters
            </button>
          )}
        </div>
      )}

      {/* ── When no active filters: featured + trainers + trending ── */}
      {!loading && noFilters && exercises.length > 0 && (
        <>
          {/* Option B: Featured Exercise hero */}
          {featuredExercise && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Star className="w-3.5 h-3.5 text-[#c9a96e]" />
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Most Saved</p>
              </div>
              <button
                onClick={() => openExercise(featuredExercise)}
                className="w-full rounded-2xl overflow-hidden border border-[rgba(201,169,110,0.18)] hover:border-[rgba(201,169,110,0.35)] transition-all text-left group"
              >
                {/* Cover */}
                {(featuredExercise.photos[0] || featuredExercise.videoUrl) ? (
                  <div className="relative h-44 overflow-hidden">
                    {featuredExercise.photos[0]
                      ? <img src={featuredExercise.photos[0]} alt={featuredExercise.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      : <div className="absolute inset-0 bg-gradient-to-br from-[#1a1508] to-[#0d0b08]" />
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <div>
                        <h3 className="text-white font-bold text-lg leading-tight">{featuredExercise.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${DIFF_COLORS[featuredExercise.difficulty]}`}>
                            {featuredExercise.difficulty}
                          </span>
                          <span className="text-white/60 text-xs capitalize">{CAT_ICONS[featuredExercise.category]} {featuredExercise.category}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-[rgba(201,169,110,0.20)] border border-[rgba(201,169,110,0.35)] px-2.5 py-1 rounded-full">
                        <Bookmark className="w-3 h-3 text-[#c9a96e]" />
                        <span className="text-[#e8c98a] text-xs font-semibold">{featuredExercise.saves}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[rgba(201,169,110,0.04)] px-4 py-4">
                    <h3 className="text-white font-bold text-lg">{featuredExercise.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${DIFF_COLORS[featuredExercise.difficulty]}`}>{featuredExercise.difficulty}</span>
                      <span className="text-white/50 text-xs">{CAT_ICONS[featuredExercise.category]} {featuredExercise.category}</span>
                    </div>
                  </div>
                )}
              </button>
            </div>
          )}

          {/* Option C: Trainer Spotlight */}
          {verifiedTrainers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Verified Trainers</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {verifiedTrainers.map(t => (
                  <div key={t.id} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
                    {t.avatar
                      ? <img src={t.avatar} className="w-12 h-12 rounded-full object-cover border-2 border-[rgba(201,169,110,0.35)]" />
                      : <div className="w-12 h-12 rounded-full bg-[#c9a96e] flex items-center justify-center text-white font-bold text-sm border-2 border-[rgba(201,169,110,0.35)]">{t.name?.[0]}</div>
                    }
                    <p className="text-white text-[9px] font-medium text-center leading-tight truncate w-full">{t.name.split(' ')[0]}</p>
                    <div className="flex items-center gap-0.5 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
                      <BadgeCheck className="w-2.5 h-2.5 text-blue-400" />
                      <span className="text-blue-300 text-[8px] font-medium">{t.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Option B: Trending row */}
          {trendingExercises.length > 1 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#c9a96e]" />
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Trending This Week</p>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {trendingExercises.slice(1).map((ex, i) => (
                  <button
                    key={ex.id}
                    onClick={() => openExercise(ex)}
                    className="relative rounded-xl overflow-hidden shrink-0 border border-[rgba(201,169,110,0.10)] hover:border-[rgba(201,169,110,0.3)] transition-all text-left group"
                    style={{ width: 130 }}
                  >
                    <div className="relative h-24 bg-[#0d0b08]">
                      {ex.photos[0]
                        ? <img src={ex.photos[0]} alt={ex.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        : <div className="absolute inset-0 flex items-center justify-center"><Dumbbell className="w-6 h-6 text-white/10" /></div>
                      }
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                      <div className="absolute top-1.5 left-1.5">
                        <span className="w-5 h-5 rounded-full bg-[rgba(201,169,110,0.85)] text-white text-[9px] font-bold flex items-center justify-center">
                          {i + 2}
                        </span>
                      </div>
                    </div>
                    <div className="px-2 py-1.5 bg-[rgba(201,169,110,0.03)]">
                      <p className="text-white text-[10px] font-semibold line-clamp-2 leading-tight">{ex.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[8px] px-1 py-0.5 rounded border font-medium ${DIFF_COLORS[ex.difficulty]}`}>{ex.difficulty}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Option D: Recently Viewed */}
      {recentlyViewed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Clock className="w-3.5 h-3.5 text-white/30" />
            <p className="text-white/30 text-xs font-semibold uppercase tracking-wider">Recently Viewed</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentlyViewed.map(ex => (
              <button
                key={ex.id}
                onClick={() => openExercise(ex)}
                className="flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.08)] hover:border-[rgba(201,169,110,0.2)] transition-all text-left"
              >
                {ex.photos[0]
                  ? <img src={ex.photos[0]} className="w-7 h-7 rounded-lg object-cover" />
                  : <div className="w-7 h-7 rounded-lg bg-[rgba(201,169,110,0.08)] flex items-center justify-center"><Dumbbell className="w-3.5 h-3.5 text-[#c9a96e]/50" /></div>
                }
                <div className="min-w-0">
                  <p className="text-white/70 text-[10px] font-medium truncate max-w-[100px]">{ex.name}</p>
                  <p className="text-white/30 text-[9px]">{ex.category}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── All Exercises ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.12)] flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="w-7 h-7 text-white/15" />
          </div>
          <p className="text-white/35 text-sm font-medium">No exercises found</p>
          <p className="text-white/20 text-xs mt-1">
            {noFilters ? 'Be the first trainer to publish one!' : 'Try adjusting your filters'}
          </p>
          {!noFilters && (
            <button onClick={() => { setCategory('All'); setDifficulty('All'); setEquipment('All'); setSearch(''); }}
              className="mt-3 text-[#c9a96e] text-xs hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {!noFilters && (
            <p className="text-white/25 text-xs">{exercises.length} guide{exercises.length !== 1 ? 's' : ''}</p>
          )}
          {(noFilters ? exercises.slice(1) : exercises).map(ex => (
            <ExerciseCard
              key={ex.id} exercise={ex}
              onOpen={() => openExercise(ex)}
              onSave={() => toggleSave(ex)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Exercise card ─────────────────────────────────────────────────────────────
function ExerciseCard({ exercise: ex, onOpen, onSave }: {
  exercise: Exercise;
  onOpen: () => void;
  onSave: () => void;
}) {
  const [videoHovered, setVideoHovered] = useState(false);
  const hasVideo = !!ex.videoUrl;
  const hasCover = ex.photos.length > 0 || hasVideo;

  return (
    <div
      onClick={onOpen}
      className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] hover:border-[rgba(201,169,110,0.25)] rounded-2xl overflow-hidden cursor-pointer transition-all group"
    >
      {hasCover && (
        <div
          className="h-36 overflow-hidden relative"
          onMouseEnter={() => hasVideo && setVideoHovered(true)}
          onMouseLeave={() => setVideoHovered(false)}
        >
          {ex.photos[0] && (
            <img src={ex.photos[0]} alt={ex.name}
              className={`w-full h-full object-cover transition-all duration-500 ${videoHovered ? 'opacity-0 scale-105' : 'group-hover:scale-105'}`} />
          )}
          {hasVideo && videoHovered && isDirectVideo(ex.videoUrl) && (
            <div className="absolute inset-0">
              <video src={ex.videoUrl!} autoPlay loop muted playsInline className="w-full h-full object-cover" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
            <div className="flex gap-1.5">
              {ex.photos.slice(1, 3).map((_, i) => (
                <div key={i} className="w-5 h-5 rounded bg-black/40 border border-[rgba(201,169,110,0.18)] flex items-center justify-center">
                  <ImageIcon className="w-2.5 h-2.5 text-white/60" />
                </div>
              ))}
            </div>
            {hasVideo && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all
                ${videoHovered ? 'bg-[#c9a96e]/80 border border-[rgba(201,169,110,0.45)] text-white' : 'bg-black/50 border border-[rgba(201,169,110,0.18)] text-white/70'}`}>
                <Video className="w-2.5 h-2.5" />
                {videoHovered ? 'Playing demo' : 'Demo'}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-semibold text-sm">{ex.name}</h3>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${DIFF_COLORS[ex.difficulty]}`}>
                {ex.difficulty}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/30 text-xs capitalize">{CAT_ICONS[ex.category] || '🏋️'} {ex.category}</span>
              {ex.equipment.length > 0 && (
                <>
                  <span className="text-white/15">·</span>
                  <span className="text-white/30 text-xs truncate">{ex.equipment.slice(0, 2).join(', ')}</span>
                </>
              )}
            </div>
            {ex.primaryMuscles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {ex.primaryMuscles.slice(0, 3).map(m => (
                  <span key={m} className="text-[9px] bg-fuchsia-500/15 text-fuchsia-300/70 px-1.5 py-0.5 rounded-full border border-fuchsia-500/20">
                    {m.replace(/_/g, ' ')}
                  </span>
                ))}
                {ex.primaryMuscles.length > 3 && <span className="text-[9px] text-white/25">+{ex.primaryMuscles.length - 3}</span>}
              </div>
            )}
          </div>
          <button onClick={e => { e.stopPropagation(); onSave(); }}
            className="shrink-0 p-2 rounded-xl hover:bg-[rgba(201,169,110,0.06)] transition-colors">
            {ex.savedByMe
              ? <BookmarkCheck className="w-4 h-4 text-[#c9a96e]" />
              : <Bookmark className="w-4 h-4 text-white/25 hover:text-white/60" />
            }
          </button>
        </div>

        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[rgba(201,169,110,0.08)]">
          {ex.authorAvatar
            ? <img src={ex.authorAvatar} className="w-5 h-5 rounded-full object-cover" />
            : <div className="w-5 h-5 rounded-full bg-[#c9a96e] flex items-center justify-center text-[9px] text-white font-bold">{ex.authorName?.[0]}</div>
          }
          <span className="text-white/35 text-xs">{ex.authorName}</span>
          {ex.authorVerified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />}
          <span className="ml-auto text-white/20 text-xs flex items-center gap-1">
            <Bookmark className="w-2.5 h-2.5" />{ex.saves}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Exercise detail view ──────────────────────────────────────────────────────
function ExerciseDetailView({ exercise: ex, photoIdx, setPhotoIdx, onBack, onSave }: {
  exercise: Exercise;
  photoIdx: number;
  setPhotoIdx: (i: number) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const hasVideo  = !!ex.videoUrl;
  const hasPhotos = ex.photos.length > 0;
  const [mediaTab, setMediaTab] = useState<'video' | 'photos'>(hasVideo ? 'video' : 'photos');

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-4 text-white/40 hover:text-white/70 text-sm transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Library
      </button>

      {(hasVideo || hasPhotos) && (
        <div className="mx-4 mb-6 space-y-2">
          {hasVideo && hasPhotos && (
            <div className="flex gap-2">
              <button onClick={() => setMediaTab('video')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                  ${mediaTab === 'video' ? 'bg-[rgba(201,169,110,0.12)] border-[#c9a96e]/40 text-[#e8c98a]' : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:text-white/60'}`}>
                <Video className="w-3.5 h-3.5" /> Demo video
              </button>
              <button onClick={() => setMediaTab('photos')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                  ${mediaTab === 'photos' ? 'bg-[rgba(201,169,110,0.12)] border-[#c9a96e]/40 text-[#e8c98a]' : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:text-white/60'}`}>
                <ImageIcon className="w-3.5 h-3.5" /> Photos ({ex.photos.length})
              </button>
            </div>
          )}
          {mediaTab === 'video' && hasVideo && (
            <div className="relative rounded-2xl overflow-hidden bg-black" style={{ height: 260 }}>
              <VideoPlayer url={ex.videoUrl!} autoPlay loop showControls />
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-[#c9a96e]/80 text-white text-[10px] font-semibold px-2 py-1 rounded-full pointer-events-none">
                <Video className="w-3 h-3" /> Form demo · loops
              </div>
            </div>
          )}
          {mediaTab === 'photos' && hasPhotos && (
            <div className="relative rounded-2xl overflow-hidden">
              <img src={ex.photos[photoIdx]} alt={ex.name} className="w-full h-56 object-cover" />
              {ex.photos.length > 1 && (
                <>
                  <button onClick={() => setPhotoIdx(Math.max(0, photoIdx - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPhotoIdx(Math.min(ex.photos.length - 1, photoIdx + 1))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {ex.photos.map((_, i) => (
                      <div key={i} onClick={() => setPhotoIdx(i)}
                        className={`w-1.5 h-1.5 rounded-full cursor-pointer ${i === photoIdx ? 'bg-white' : 'bg-white/30'}`} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="px-4 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-white font-bold text-2xl leading-tight">{ex.name}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs px-2 py-1 rounded-lg border font-medium ${DIFF_COLORS[ex.difficulty]}`}>{ex.difficulty}</span>
              <span className="text-white/40 text-xs capitalize">{CAT_ICONS[ex.category]} {ex.category}</span>
              {ex.equipment.map(e => (
                <span key={e} className="text-xs bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/40 px-2 py-0.5 rounded-full">{e}</span>
              ))}
            </div>
          </div>
          <button onClick={onSave} className="flex flex-col items-center gap-1 p-2">
            {ex.savedByMe ? <BookmarkCheck className="w-5 h-5 text-[#c9a96e]" /> : <Bookmark className="w-5 h-5 text-white/30" />}
            <span className="text-white/25 text-[10px]">{ex.saves}</span>
          </button>
        </div>

        <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl p-4">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">Muscles Worked</p>
          <MuscleBodyDiagram primaryMuscles={ex.primaryMuscles} secondaryMuscles={ex.secondaryMuscles} size="lg" />
          {(ex.primaryMuscles.length > 0 || ex.secondaryMuscles.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ex.primaryMuscles.map(m => (
                <span key={m} className="text-[10px] bg-fuchsia-500/15 text-fuchsia-300 px-2 py-0.5 rounded-full border border-fuchsia-500/20">{m.replace(/_/g, ' ')}</span>
              ))}
              {ex.secondaryMuscles.map(m => (
                <span key={m} className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">{m.replace(/_/g, ' ')}</span>
              ))}
            </div>
          )}
        </div>

        {ex.steps.length > 0 && (
          <div className="space-y-3">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#c9a96e]" /> How to perform
            </p>
            <div className="space-y-2">
              {ex.steps.map((step, i) => (
                <div key={i} className="flex gap-3 bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.06)] rounded-xl px-4 py-3">
                  <span className="w-6 h-6 rounded-full bg-[rgba(201,169,110,0.12)] text-[#e8c98a] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-white/75 text-sm leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {ex.mistakes.length > 0 && (
          <div className="space-y-3">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Common mistakes to avoid
            </p>
            <div className="space-y-2">
              {ex.mistakes.map((m, i) => (
                <div key={i} className="flex gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400/70 shrink-0 mt-0.5" />
                  <p className="text-white/65 text-sm leading-relaxed">{m}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {ex.variations.length > 0 && (
          <div className="space-y-3">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-blue-400" /> Variations
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ex.variations.map((v, i) => (
                <div key={i} className={`rounded-xl px-3 py-2 border text-sm ${v.type === 'easier' ? 'bg-green-500/8 border-green-500/20 text-green-300' : 'bg-red-500/8 border-red-500/20 text-red-300'}`}>
                  <span className="text-[9px] font-semibold uppercase opacity-60 block mb-0.5">{v.type === 'easier' ? '↓ Easier' : '↑ Harder'}</span>
                  {v.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {ex.trainerTip && (
          <div className="bg-gradient-to-br from-[rgba(201,169,110,0.06)] to-[rgba(201,169,110,0.03)] border border-[#c9a96e]/25 rounded-2xl px-4 py-4 flex gap-3">
            <Lightbulb className="w-5 h-5 text-[#c9a96e] shrink-0 mt-0.5" />
            <div>
              <p className="text-[#e8c98a] text-xs font-semibold mb-1">Trainer's tip</p>
              <p className="text-white/70 text-sm leading-relaxed">{ex.trainerTip}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl px-4 py-3">
          {ex.authorAvatar
            ? <img src={ex.authorAvatar} className="w-10 h-10 rounded-full object-cover" />
            : <div className="w-10 h-10 rounded-full bg-[#c9a96e] flex items-center justify-center text-white font-bold">{ex.authorName?.[0]}</div>
          }
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-white font-medium text-sm">{ex.authorName}</p>
              {ex.authorVerified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />}
            </div>
            <p className="text-white/35 text-xs">Certified Trainer</p>
          </div>
        </div>
      </div>
    </div>
  );
}
