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

// ── Demo exercises — shown when no trainers have published yet ────────────────
const DEMO_EXERCISES: Exercise[] = [
  {
    id: 'demo_bench', name: 'Barbell Bench Press', category: 'strength',
    difficulty: 'intermediate', equipment: ['Barbell', 'Bench'],
    primaryMuscles: ['chest'], secondaryMuscles: ['front_delts', 'triceps'],
    photos: ['https://img.youtube.com/vi/vcBig73ojpE/maxresdefault.jpg'], videoUrl: 'https://www.youtube.com/watch?v=vcBig73ojpE',
    steps: [
      'Lie flat on the bench, eyes directly under the bar.',
      'Grip the bar slightly wider than shoulder-width, thumbs wrapped around.',
      'Unrack, lower the bar to your mid-chest in 2–3 seconds.',
      'Press the bar back up in a slight arc until arms are fully locked out.',
    ],
    mistakes: ['Flaring elbows past 75° — keep them at 45–60°.', 'Bouncing the bar off the chest.', 'Hips rising off the bench.'],
    variations: [{ name: 'Dumbbell Bench Press', type: 'easier' }, { name: 'Paused Bench Press', type: 'harder' }],
    trainerTip: 'Squeeze your shoulder blades together before unracking — it creates a stable shelf and protects your shoulders.',
    authorId: 'flex_team', authorName: 'Flex Team', authorVerified: true, saves: 1247, createdAt: new Date().toISOString(),
  },
  {
    id: 'demo_squat', name: 'Barbell Back Squat', category: 'strength',
    difficulty: 'intermediate', equipment: ['Barbell', 'Squat Rack'],
    primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings', 'lower_back', 'adductors'],
    photos: ['https://img.youtube.com/vi/ultWZbUMPL8/maxresdefault.jpg'], videoUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8',
    steps: [
      'Position bar on your upper traps and step back from the rack.',
      'Feet shoulder-width apart, toes pointed out 15–30°.',
      'Brace core, push knees out and descend until hips are below knees.',
      'Drive through the whole foot to return to standing.',
    ],
    mistakes: ['Knees caving inward (valgus collapse).', 'Heels rising off the floor.', 'Rounding the lower back at the bottom.'],
    variations: [{ name: 'Goblet Squat', type: 'easier' }, { name: 'Pause Squat', type: 'harder' }],
    trainerTip: 'Think "spread the floor" with your feet — this cue activates your glutes and keeps knees tracked over toes.',
    authorId: 'flex_team', authorName: 'Flex Team', authorVerified: true, saves: 1583, createdAt: new Date().toISOString(),
  },
  {
    id: 'demo_deadlift', name: 'Conventional Deadlift', category: 'strength',
    difficulty: 'advanced', equipment: ['Barbell'],
    primaryMuscles: ['hamstrings', 'glutes', 'lower_back'], secondaryMuscles: ['traps', 'lats', 'forearms'],
    photos: ['https://img.youtube.com/vi/op9kVnSso6Q/maxresdefault.jpg'], videoUrl: 'https://www.youtube.com/watch?v=op9kVnSso6Q',
    steps: [
      'Stand with the bar over mid-foot, feet hip-width apart.',
      'Hinge at the hips and grip the bar just outside your legs.',
      'Take a deep breath, brace your core and lat-spread the bar.',
      'Push the floor away to stand tall — lock hips and knees out together.',
      'Hinge back down with control, keeping the bar close to the body.',
    ],
    mistakes: ['Jerking the bar off the floor.', 'Rounding the upper back.', 'Bar drifting away from the body.'],
    variations: [{ name: 'Trap Bar Deadlift', type: 'easier' }, { name: 'Deficit Deadlift', type: 'harder' }],
    trainerTip: '"Leg press the earth away" — thinking of it as a leg press rather than a pull reduces lower-back rounding.',
    authorId: 'flex_team', authorName: 'Flex Team', authorVerified: true, saves: 2031, createdAt: new Date().toISOString(),
  },
  {
    id: 'demo_pullup', name: 'Pull-Up', category: 'strength',
    difficulty: 'intermediate', equipment: ['Pull-up Bar'],
    primaryMuscles: ['lats', 'biceps'], secondaryMuscles: ['rhomboids', 'rear_delts', 'forearms'],
    photos: ['https://img.youtube.com/vi/eGo4IYlbE5g/maxresdefault.jpg'], videoUrl: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
    steps: [
      'Hang from the bar with an overhand grip, slightly wider than shoulders.',
      'Depress your shoulder blades and drive elbows down toward your hips.',
      'Pull your chin over the bar, squeezing the lats at the top.',
      'Lower yourself fully with control to a dead hang.',
    ],
    mistakes: ['Kipping / swinging for reps.', 'Not reaching full extension at the bottom.', 'Shrugging shoulders up instead of depressing them.'],
    variations: [{ name: 'Assisted Pull-Up / Band', type: 'easier' }, { name: 'Weighted Pull-Up', type: 'harder' }],
    trainerTip: 'Imagine you\'re trying to put your elbows in your back pockets — this cue instantly engages your lats.',
    authorId: 'flex_team', authorName: 'Flex Team', authorVerified: true, saves: 987, createdAt: new Date().toISOString(),
  },
  {
    id: 'demo_ohp', name: 'Overhead Press', category: 'strength',
    difficulty: 'intermediate', equipment: ['Barbell'],
    primaryMuscles: ['front_delts'], secondaryMuscles: ['triceps', 'traps'],
    photos: ['https://img.youtube.com/vi/qEwKCR5JCog/maxresdefault.jpg'], videoUrl: 'https://www.youtube.com/watch?v=qEwKCR5JCog',
    steps: [
      'Grip the bar just outside shoulder-width, wrists stacked over elbows.',
      'Unrack the bar to shoulder level, elbows slightly forward.',
      'Press the bar straight up, slipping your chin back to clear the path.',
      'Lock out overhead then lower back to shoulders with control.',
    ],
    mistakes: ['Pressing in front of the face instead of straight up.', 'Flaring the rib cage (over-arching).', 'Not locking out at the top.'],
    variations: [{ name: 'Dumbbell Shoulder Press', type: 'easier' }, { name: 'Push Press', type: 'harder' }],
    trainerTip: 'Keep your glutes and abs tight throughout — the whole body acts as a base for a stable overhead press.',
    authorId: 'flex_team', authorName: 'Flex Team', authorVerified: true, saves: 743, createdAt: new Date().toISOString(),
  },
  {
    id: 'demo_row', name: 'Barbell Row', category: 'strength',
    difficulty: 'intermediate', equipment: ['Barbell'],
    primaryMuscles: ['lats', 'rhomboids'], secondaryMuscles: ['rear_delts', 'biceps', 'lower_back'],
    photos: ['https://img.youtube.com/vi/kBWAon7ItDw/maxresdefault.jpg'], videoUrl: 'https://www.youtube.com/watch?v=kBWAon7ItDw',
    steps: [
      'Hinge until your torso is ~45° from horizontal, bar hanging at mid-shin.',
      'Row the bar into your lower sternum, driving elbows past your torso.',
      'Squeeze the shoulder blades together at the top for 1 second.',
      'Lower the bar with control back to the start position.',
    ],
    mistakes: ['Using momentum / hip drive.', 'Rowing to the belly button instead of lower chest.', 'Excessive torso rocking.'],
    variations: [{ name: 'Dumbbell Row', type: 'easier' }, { name: 'Pendlay Row', type: 'harder' }],
    trainerTip: 'Lead with the elbow, not the hand — this keeps the focus on the back and off the biceps.',
    authorId: 'flex_team', authorName: 'Flex Team', authorVerified: true, saves: 621, createdAt: new Date().toISOString(),
  },
  {
    id: 'demo_rdl', name: 'Romanian Deadlift', category: 'strength',
    difficulty: 'intermediate', equipment: ['Barbell'],
    primaryMuscles: ['hamstrings', 'glutes'], secondaryMuscles: ['lower_back', 'forearms'],
    photos: ['https://img.youtube.com/vi/JCXUYuzwNrM/maxresdefault.jpg'], videoUrl: 'https://www.youtube.com/watch?v=JCXUYuzwNrM',
    steps: [
      'Stand with the bar in front of you, overhand grip at hip-width.',
      'Hinge at the hips, pushing them back, lowering the bar along your legs.',
      'Stop when you feel a strong hamstring stretch (usually just below the knee).',
      'Drive hips forward to return to standing, squeezing glutes at the top.',
    ],
    mistakes: ['Bending the knees too much (turning it into a squat).', 'Rounding the lower back.', 'Bar drifting away from the legs.'],
    variations: [{ name: 'Dumbbell RDL', type: 'easier' }, { name: 'Single-Leg RDL', type: 'harder' }],
    trainerTip: 'Drag the bar down your legs — it keeps it close and forces a proper hip hinge pattern.',
    authorId: 'flex_team', authorName: 'Flex Team', authorVerified: true, saves: 812, createdAt: new Date().toISOString(),
  },
  {
    id: 'demo_pushup', name: 'Push-Up', category: 'strength',
    difficulty: 'beginner', equipment: ['Bodyweight'],
    primaryMuscles: ['chest', 'triceps'], secondaryMuscles: ['front_delts', 'abs'],
    photos: ['https://img.youtube.com/vi/IODxDxX7oi4/maxresdefault.jpg'], videoUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4',
    steps: [
      'Place hands slightly wider than shoulder-width on the floor.',
      'Keep your body in a straight line from head to heels — no sagging hips.',
      'Lower your chest to the floor with elbows at ~45° to the torso.',
      'Press back up explosively until arms are fully extended.',
    ],
    mistakes: ['Sagging the hips — always keep the body rigid.', 'Flaring elbows to 90°.', 'Not reaching full depth (chest must touch or nearly touch the floor).'],
    variations: [{ name: 'Knee Push-Up', type: 'easier' }, { name: 'Archer Push-Up', type: 'harder' }],
    trainerTip: 'Squeeze everything — glutes, abs, quads — the push-up is a full-body tension exercise, not just a chest move.',
    authorId: 'flex_team', authorName: 'Flex Team', authorVerified: true, saves: 534, createdAt: new Date().toISOString(),
  },
  {
    id: 'demo_curl', name: 'Dumbbell Bicep Curl', category: 'strength',
    difficulty: 'beginner', equipment: ['Dumbbell'],
    primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'],
    photos: ['https://img.youtube.com/vi/ykJmrZ5v0Oo/maxresdefault.jpg'], videoUrl: 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo',
    steps: [
      'Stand with a dumbbell in each hand, arms fully extended, palms facing forward.',
      'Curl the weights up by flexing at the elbow — keep upper arms stationary.',
      'Squeeze the biceps hard at the top, hold for 1 second.',
      'Lower slowly back to full extension — the eccentric phase builds the most size.',
    ],
    mistakes: ['Swinging the torso to get the weight up.', 'Not reaching full extension at the bottom.', 'Elbows drifting forward at the top.'],
    variations: [{ name: 'Hammer Curl', type: 'easier' }, { name: 'Incline Dumbbell Curl', type: 'harder' }],
    trainerTip: 'Slow the lowering phase to 3–4 seconds — most bicep growth happens on the way down.',
    authorId: 'flex_team', authorName: 'Flex Team', authorVerified: true, saves: 478, createdAt: new Date().toISOString(),
  },
  {
    id: 'demo_plank', name: 'Plank', category: 'strength',
    difficulty: 'beginner', equipment: ['Bodyweight'],
    primaryMuscles: ['abs'], secondaryMuscles: ['obliques', 'hip_flexors'],
    photos: ['https://img.youtube.com/vi/ASdvN_XEl_c/maxresdefault.jpg'], videoUrl: 'https://www.youtube.com/watch?v=ASdvN_XEl_c',
    steps: [
      'Place forearms on the floor, elbows directly under your shoulders.',
      'Lift your hips so your body forms a straight line head to heels.',
      'Brace your abs as if bracing for a punch — breathe normally.',
      'Hold for the prescribed time without letting hips drop or rise.',
    ],
    mistakes: ['Hips sagging down.', 'Hips piking too high.', 'Holding your breath.'],
    variations: [{ name: 'Knee Plank', type: 'easier' }, { name: 'RKC Plank', type: 'harder' }],
    trainerTip: 'Try to "pull" your elbows and toes toward each other — this shortens the core and dramatically increases tension.',
    authorId: 'flex_team', authorName: 'Flex Team', authorVerified: true, saves: 355, createdAt: new Date().toISOString(),
  },
  {
    id: 'demo_boxjump', name: 'Box Jump', category: 'power',
    difficulty: 'intermediate', equipment: ['Plyometric Box'],
    primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings', 'calves'],
    photos: ['https://img.youtube.com/vi/52r4M2bsFmQ/maxresdefault.jpg'], videoUrl: 'https://www.youtube.com/watch?v=52r4M2bsFmQ',
    steps: [
      'Stand facing the box at about arm\'s length away.',
      'Dip into a quarter squat, swinging arms back for momentum.',
      'Explode upward, swinging arms forward, and land softly on the box with knees bent.',
      'Stand fully on the box, then step (do not jump) back down.',
    ],
    mistakes: ['Landing stiff-legged — always land with soft, bent knees.', 'Jumping too high before mastering lower boxes.', 'Jumping back down (high injury risk).'],
    variations: [{ name: 'Step-Up', type: 'easier' }, { name: 'Depth Jump', type: 'harder' }],
    trainerTip: 'Land as quietly as possible — silent landings mean your muscles, not your joints, are absorbing the force.',
    authorId: 'flex_team', authorName: 'Flex Team', authorVerified: true, saves: 428, createdAt: new Date().toISOString(),
  },
  {
    id: 'demo_latpulldown', name: 'Lat Pulldown', category: 'strength',
    difficulty: 'beginner', equipment: ['Cable', 'Machine'],
    primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'rear_delts', 'rhomboids'],
    photos: ['https://img.youtube.com/vi/CAwf7n6Luuc/maxresdefault.jpg'], videoUrl: 'https://www.youtube.com/watch?v=CAwf7n6Luuc',
    steps: [
      'Sit at the pulldown station, pad secure over your thighs, grip wide.',
      'Lean back slightly, depress your shoulder blades.',
      'Pull the bar to your upper chest, driving elbows down and back.',
      'Squeeze the lats at the bottom, then slowly return to the top.',
    ],
    mistakes: ['Pulling behind the neck (shoulder injury risk).', 'Using momentum / body rock.', 'Not fully extending arms at the top.'],
    variations: [{ name: 'Close-Grip Pulldown', type: 'easier' }, { name: 'Single-Arm Cable Pulldown', type: 'harder' }],
    trainerTip: 'Think of your hands as hooks and your elbows as the primary movers — this shifts work from biceps to lats.',
    authorId: 'flex_team', authorName: 'Flex Team', authorVerified: true, saves: 690, createdAt: new Date().toISOString(),
  },
];

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
      const apiExercises: Exercise[] = data.exercises || [];
      if (apiExercises.length > 0) {
        setExercises(apiExercises);
      } else {
        // No trainer exercises yet — filter and show demo exercises
        let demos = DEMO_EXERCISES;
        if (search) demos = demos.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
        if (category !== 'All') demos = demos.filter(e => e.category.toLowerCase() === category.toLowerCase());
        if (difficulty !== 'All') demos = demos.filter(e => e.difficulty === difficulty.toLowerCase());
        if (equipment !== 'All') demos = demos.filter(e => e.equipment.some(eq => eq.toLowerCase() === equipment.toLowerCase()));
        setExercises(demos);
      }
    } catch {
      // API unreachable — use demo exercises
      setExercises(DEMO_EXERCISES);
    }
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
          {ex.authorA