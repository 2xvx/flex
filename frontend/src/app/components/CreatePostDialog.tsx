import { useState } from 'react';
import { Plus, Trash2, Upload, X, MapPin, Globe, Users, Lock, Video, Image, Music, Trophy,
         Dumbbell, TrendingUp, UtensilsCrossed, Timer, Heart } from 'lucide-react';
import { compressFile } from '../../utils/imageCompression';
import { uploadImage } from '../../utils/authToken';
import { uploadVideoToStorage } from '../../utils/uploadVideo';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Exercise, WorkoutPost } from '../types';
import { toast } from 'sonner';

type PostType = 'workout' | 'progress' | 'meal' | 'run' | 'motivation';

const POST_TYPES: { id: PostType; label: string; emoji: string; icon: any; color: string }[] = [
  { id: 'workout',    label: 'Workout',  emoji: '💪', icon: Dumbbell,        color: 'violet' },
  { id: 'progress',   label: 'Progress', emoji: '📈', icon: TrendingUp,      color: 'emerald' },
  { id: 'meal',       label: 'Meal',     emoji: '🍽️', icon: UtensilsCrossed, color: 'orange' },
  { id: 'run',        label: 'Run',      emoji: '🏃', icon: Timer,           color: 'sky' },
  { id: 'motivation', label: 'Post',     emoji: '✨', icon: Heart,           color: 'pink' },
];

const EXERCISE_PRESETS = [
  'Bench Press','Squats','Deadlifts','Pull-ups','Push-ups','Shoulder Press',
  'Barbell Rows','Bicep Curls','Tricep Extensions','Leg Press','Romanian Deadlifts',
  'Lunges','Lat Pulldowns','Dumbbell Flyes','Calf Raises','Planks','Russian Twists',
  'Burpees','Mountain Climbers','Box Jumps',
];

const MOODS = ['😴','😐','😊','💪','🔥'];
const MOOD_LABELS = ['Tired','Okay','Good','Great','On fire'];

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePost: (post: Partial<WorkoutPost> & { type?: PostType; [key: string]: any }) => void;
  currentUserId?: string;
}

export function CreatePostDialog({ open, onOpenChange, onCreatePost }: CreatePostDialogProps) {
  const [postType, setPostType]       = useState<PostType>('workout');

  // Workout fields
  const [workoutType, setWorkoutType] = useState('');
  const [duration, setDuration]       = useState('');
  const [calories, setCalories]       = useState('');
  const [exercises, setExercises]     = useState<Partial<Exercise>[]>([]);

  // Progress fields
  const [weight, setWeight]           = useState('');
  const [bodyFat, setBodyFat]         = useState('');

  // Meal fields
  const [mealName, setMealName]       = useState('');
  const [mealCals, setMealCals]       = useState('');
  const [protein, setProtein]         = useState('');
  const [carbs, setCarbs]             = useState('');
  const [fat, setFat]                 = useState('');

  // Run fields
  const [distance, setDistance]       = useState('');
  const [runTime, setRunTime]         = useState('');

  // Common
  const [caption, setCaption]         = useState('');
  const [mood, setMood]               = useState(3);
  const [location, setLocation]       = useState('');
  const [visibility, setVisibility]   = useState<'public' | 'followers'>('public');
  const [music, setMusic]             = useState('');
  const [isPR, setIsPR]               = useState(false);

  // Media
  const [mediaTab, setMediaTab]           = useState<'image' | 'video'>('image');
  const [imagePreview, setImagePreview]   = useState<string | null>(null);
  const [videoFile, setVideoFile]         = useState<File | null>(null);
  const [videoPreview, setVideoPreview]   = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading]     = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addExercise = () =>
    setExercises(e => [...e, { id: Date.now().toString(), name: '', sets: 0, reps: 0 }]);
  const removeExercise = (id: string) =>
    setExercises(e => e.filter(ex => ex.id !== id));
  const updateExercise = (id: string, field: keyof Exercise, value: any) =>
    setExercises(e => e.map(ex => ex.id === id ? { ...ex, [field]: value } : ex));

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error('Image must be under 20 MB'); return; }
    try {
      const compressed = await compressFile(file);
      setImagePreview(compressed);
    } catch { toast.error('Could not process image'); }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) { toast.error('Video must be under 500 MB'); return; }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const calcPace = () => {
    const d = parseFloat(distance);
    const parts = runTime.split(':').map(Number);
    if (!d || parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return '';
    const totalMins = parts[0] * 60 + parts[1] + (parts[2] || 0) / 60;
    const pacePerKm = totalMins / d;
    const pm = Math.floor(pacePerKm);
    const ps = Math.round((pacePerKm - pm) * 60);
    return `${pm}:${ps.toString().padStart(2, '0')} /km`;
  };

  const resetForm = () => {
    setWorkoutType(''); setDuration(''); setCalories(''); setExercises([]);
    setWeight(''); setBodyFat('');
    setMealName(''); setMealCals(''); setProtein(''); setCarbs(''); setFat('');
    setDistance(''); setRunTime('');
    setCaption(''); setMood(3); setLocation(''); setVisibility('public');
    setMusic(''); setIsPR(false);
    setImagePreview(null); setVideoFile(null); setVideoPreview(null);
    setUploadProgress(0);
  };

  const handleSubmit = async () => {
    // Validation per type
    if (postType === 'workout' && !workoutType) {
      toast.error('Add a workout type'); return;
    }
    if (postType === 'run' && !distance) {
      toast.error('Add the distance'); return;
    }
    if (postType === 'meal' && !mealName) {
      toast.error('Add a meal name'); return;
    }
    if (postType === 'motivation' && !caption && !imagePreview) {
      toast.error('Add a caption or photo'); return;
    }

    setIsUploading(true);
    try {
      let imageUrl: string | undefined;
      if (imagePreview) {
        const uploaded = await uploadImage(imagePreview, 'posts');
        imageUrl = uploaded ?? imagePreview;
      }

      let uploadedVideoUrl: string | undefined;
      if (videoFile) {
        setUploadProgress(0);
        uploadedVideoUrl = await uploadVideoToStorage(videoFile, 'posts', pct => setUploadProgress(pct));
        setUploadProgress(100);
      }

      const pace = postType === 'run' ? calcPace() : undefined;

      onCreatePost({
        type: postType,
        // Workout
        workoutType: postType === 'workout' ? workoutType : postType,
        duration: postType === 'workout' ? parseInt(duration) || 0 : undefined,
        calories: postType === 'workout' ? parseInt(calories) || 0
          : postType === 'meal' ? parseInt(mealCals) || 0 : undefined,
        exercises: postType === 'workout' ? (exercises as Exercise[]) : [],
        // Progress
        weight: postType === 'progress' && weight ? parseFloat(weight) : undefined,
        bodyFat: postType === 'progress' && bodyFat ? parseFloat(bodyFat) : undefined,
        // Meal
        mealName: postType === 'meal' ? mealName : undefined,
        protein: postType === 'meal' && protein ? parseInt(protein) : undefined,
        carbs: postType === 'meal' && carbs ? parseInt(carbs) : undefined,
        fat: postType === 'meal' && fat ? parseInt(fat) : undefined,
        // Run
        distance: postType === 'run' && distance ? parseFloat(distance) : undefined,
        runTime: postType === 'run' ? runTime || undefined : undefined,
        pace: postType === 'run' ? pace || undefined : undefined,
        // Common
        caption,
        image: imageUrl,
        videoUrl: uploadedVideoUrl,
        timestamp: 'Just now',
        likes: 0,
        comments: [],
        isLiked: false,
        mood,
        location: location.trim() || undefined,
        visibility,
        music: music.trim() || undefined,
        isPR,
      });

      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create post');
    } finally {
      setIsUploading(false);
    }
  };

  const typeInfo = POST_TYPES.find(t => t.id === postType)!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share something</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Type picker ──────────────────────────────────────────────── */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Post type</Label>
            <div className="flex gap-2 flex-wrap">
              {POST_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setPostType(t.id); resetForm(); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                    postType === t.id
                      ? 'bg-[rgba(201,169,110,0.12)] border-[#c9a96e]/40 text-[#e8c98a]'
                      : 'border-[rgba(201,169,110,0.12)] text-white/50 hover:border-white/25 hover:text-white/75'
                  }`}
                >
                  <span>{t.emoji}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Workout fields ───────────────────────────────────────────── */}
          {postType === 'workout' && (
            <>
              <div>
                <Label>Workout Type</Label>
                <Input placeholder="e.g., Upper Body, Leg Day, HIIT" value={workoutType}
                  onChange={e => setWorkoutType(e.target.value)} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Duration (min)</Label>
                  <Input type="number" placeholder="60" value={duration}
                    onChange={e => setDuration(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Calories Burned</Label>
                  <Input type="number" placeholder="450" value={calories}
                    onChange={e => setCalories(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Exercises</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addExercise}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {exercises.map(ex => (
                    <div key={ex.id} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Select value={ex.name}
                          onValueChange={v => updateExercise(ex.id!, 'name', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Exercise" /></SelectTrigger>
                          <SelectContent>
                            {EXERCISE_PRESETS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="Sets" value={ex.sets || ''}
                          onChange={e => updateExercise(ex.id!, 'sets', parseInt(e.target.value))}
                          className="h-8 text-xs" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="Reps" value={ex.reps || ''}
                          onChange={e => updateExercise(ex.id!, 'reps', parseInt(e.target.value))}
                          className="h-8 text-xs" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="kg" value={ex.weight || ''}
                          onChange={e => updateExercise(ex.id!, 'weight', parseInt(e.target.value))}
                          className="h-8 text-xs" />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button type="button" onClick={() => removeExercise(ex.id!)}
                          className="text-white/25 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* PR toggle */}
              <button type="button" onClick={() => setIsPR(p => !p)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  isPR ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300' : 'border-[rgba(201,169,110,0.07)] text-white/40 hover:border-[rgba(201,169,110,0.18)]'
                }`}>
                <Trophy className={`w-5 h-5 ${isPR ? 'text-yellow-400' : 'text-white/25'}`} />
                <span className="text-sm font-medium">{isPR ? '🏆 Personal Record!' : 'Mark as Personal Record'}</span>
                <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${isPR ? 'border-yellow-400 bg-yellow-400' : 'border-[rgba(201,169,110,0.18)]'}`}>
                  {isPR && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            </>
          )}

          {/* ── Progress fields ──────────────────────────────────────────── */}
          {postType === 'progress' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Body Weight (kg)</Label>
                <Input type="number" step="0.1" placeholder="75.0" value={weight}
                  onChange={e => setWeight(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Body Fat % (optional)</Label>
                <Input type="number" step="0.1" placeholder="18.5" value={bodyFat}
                  onChange={e => setBodyFat(e.target.value)} className="mt-1" />
              </div>
            </div>
          )}

          {/* ── Meal fields ──────────────────────────────────────────────── */}
          {postType === 'meal' && (
            <>
              <div>
                <Label>Meal Name</Label>
                <Input placeholder="e.g. Post-workout protein bowl" value={mealName}
                  onChange={e => setMealName(e.target.value)} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Calories (kcal)</Label>
                  <Input type="number" placeholder="650" value={mealCals}
                    onChange={e => setMealCals(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Protein (g)</Label>
                  <Input type="number" placeholder="42" value={protein}
                    onChange={e => setProtein(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Carbs (g)</Label>
                  <Input type="number" placeholder="60" value={carbs}
                    onChange={e => setCarbs(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Fat (g)</Label>
                  <Input type="number" placeholder="18" value={fat}
                    onChange={e => setFat(e.target.value)} className="mt-1" />
                </div>
              </div>
            </>
          )}

          {/* ── Run fields ───────────────────────────────────────────────── */}
          {postType === 'run' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Distance (km)</Label>
                  <Input type="number" step="0.01" placeholder="5.00" value={distance}
                    onChange={e => setDistance(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Time (hh:mm:ss)</Label>
                  <Input placeholder="0:28:30" value={runTime}
                    onChange={e => setRunTime(e.target.value)} className="mt-1" />
                </div>
              </div>
              {distance && runTime && calcPace() && (
                <div className="flex items-center gap-2 px-3 py-2 bg-sky-500/10 border border-sky-500/20 rounded-xl">
                  <Timer className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-sky-300 text-sm font-medium">Pace: {calcPace()}</span>
                </div>
              )}
            </>
          )}

          {/* ── Media (all types) ────────────────────────────────────────── */}
          <div>
            <Label>Media (optional)</Label>
            <div className="flex gap-2 mt-2 mb-3">
              <button type="button" onClick={() => { setMediaTab('image'); setVideoFile(null); setVideoPreview(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${mediaTab === 'image' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                <Image className="w-3.5 h-3.5" /> Photo
              </button>
              <button type="button" onClick={() => { setMediaTab('video'); setImagePreview(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${mediaTab === 'video' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                <Video className="w-3.5 h-3.5" /> Video
              </button>
            </div>
            {mediaTab === 'image' && (
              !imagePreview
                ? <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" id="img-up" />
                    <label htmlFor="img-up" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click to upload photo</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 20 MB</p>
                    </label>
                  </div>
                : <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                    <Button type="button" variant="destructive" size="icon"
                      className="absolute top-2 right-2" onClick={() => setImagePreview(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
            )}
            {mediaTab === 'video' && (
              !videoPreview
                ? <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input type="file" accept="video/*,.mov,.mp4,.webm" onChange={handleVideoSelect} className="hidden" id="vid-up" />
                    <label htmlFor="vid-up" className="cursor-pointer">
                      <Video className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click to upload video</p>
                      <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM up to 500 MB</p>
                    </label>
                  </div>
                : <div className="relative rounded-lg overflow-hidden bg-black">
                    <video src={videoPreview} controls className="w-full max-h-56 object-contain" />
                    <Button type="button" variant="destructive" size="icon"
                      className="absolute top-2 right-2" onClick={() => { setVideoFile(null); setVideoPreview(null); }}>
                      <X className="w-4 h-4" />
                    </Button>
                    {isUploading && uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-black/60">
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 transition-all rounded-full" style={{ width: uploadProgress + '%' }} />
                        </div>
                        <p className="text-white text-xs text-center mt-1">{uploadProgress}%</p>
                      </div>
                    )}
                  </div>
            )}
          </div>

          {/* ── Caption ──────────────────────────────────────────────────── */}
          <div>
            <Label>Caption</Label>
            <Textarea
              placeholder={
                postType === 'workout'    ? 'How did it go? Any PRs? 💪' :
                postType === 'progress'   ? 'Share your progress story…' :
                postType === 'meal'       ? 'What made this meal great?' :
                postType === 'run'        ? 'How was the route? Felt good?' :
                'Share something inspiring…'
              }
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>

          {/* ── Energy level ─────────────────────────────────────────────── */}
          <div>
            <Label>Energy Level</Label>
            <div className="flex gap-2 mt-1.5">
              {MOODS.map((emoji, i) => (
                <button key={i} type="button" onClick={() => setMood(i + 1)} title={MOOD_LABELS[i]}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border text-lg transition-all ${
                    mood === i + 1 ? 'border-[#c9a96e]/60 bg-[#c9a96e]/15' : 'border-[rgba(201,169,110,0.07)] hover:border-[rgba(201,169,110,0.18)]'
                  }`}>
                  {emoji}
                  <span className="text-[9px] text-white/40">{MOOD_LABELS[i]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Location ─────────────────────────────────────────────────── */}
          <div>
            <Label className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Location (optional)
            </Label>
            <Input placeholder="e.g. Planet Fitness, Central Park…" value={location}
              onChange={e => setLocation(e.target.value)} className="mt-1" />
          </div>

          {/* ── Visibility ───────────────────────────────────────────────── */}
          <div>
            <Label>Visibility</Label>
            <div className="flex gap-2 mt-1.5">
              {(['public', 'followers'] as const).map(v => (
                <button key={v} type="button" onClick={() => setVisibility(v)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    visibility === v ? 'border-[#c9a96e]/60 bg-[#c9a96e]/15 text-[#e8c98a]' : 'border-[rgba(201,169,110,0.07)] text-white/40 hover:border-[rgba(201,169,110,0.18)]'
                  }`}>
                  {v === 'public' ? <><Globe className="w-4 h-4" /> Everyone</> : <><Users className="w-4 h-4" /> Followers only</>}
                </button>
              ))}
            </div>
          </div>

          {/* ── Music ────────────────────────────────────────────────────── */}
          <div>
            <Label className="flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5" /> Now Playing (optional)
            </Label>
            <Input placeholder="Artist – Song name" value={music}
              onChange={e => setMusic(e.target.value)} className="mt-1" />
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={isUploading}>
            {isUploading ? 'Uploading…' : `Share ${typeInfo.emoji} ${typeInfo.label}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
