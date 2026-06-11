// EditPostDialog.tsx
// Full edit dialog — caption, workout type, duration, calories, exercises, music, isPR

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { WorkoutPost, Exercise } from '../types';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Music, Trophy } from 'lucide-react';
import { authFetch } from '../../utils/authToken';

import { API } from '../../config';

interface EditPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: WorkoutPost | null;
  onUpdated: (updated: Partial<WorkoutPost>) => void;
}

export function EditPostDialog({ open, onOpenChange, post, onUpdated }: EditPostDialogProps) {
  const [workoutType, setWorkoutType] = useState('');
  const [duration,    setDuration]    = useState('');
  const [calories,    setCalories]    = useState('');
  const [caption,     setCaption]     = useState('');
  const [exercises,   setExercises]   = useState<Partial<Exercise>[]>([]);
  const [music,       setMusic]       = useState('');
  const [isPR,        setIsPR]        = useState(false);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (post && open) {
      setWorkoutType(post.workoutType || '');
      setDuration(String(post.duration || ''));
      setCalories(String(post.calories || ''));
      setCaption(post.caption || '');
      setExercises(post.exercises?.map(e => ({ ...e })) || []);
      setMusic((post as any).music || '');
      setIsPR(!!(post as any).isPR);
    }
  }, [post, open]);

  const addExercise = () =>
    setExercises(prev => [...prev, { id: Date.now().toString(), name: '', sets: 3, reps: 10 }]);

  const removeExercise = (id: string) =>
    setExercises(prev => prev.filter(e => e.id !== id));

  const updateExercise = (id: string, field: keyof Exercise, value: any) =>
    setExercises(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));

  const handleSave = async () => {
    if (!post) return;
    if (!workoutType.trim() || !duration || !calories) {
      toast.error('Workout type, duration and calories are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        workoutType: workoutType.trim(),
        duration:    parseInt(duration),
        calories:    parseInt(calories),
        caption:     caption.trim(),
        exercises:   exercises.filter(e => e.name),
        music:       music.trim() || null,
        isPR,
      };
      const res = await authFetch(`${API}/posts/${post.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Update failed');
      }
      onUpdated(payload as Partial<WorkoutPost>);
      toast.success('Workout updated! ✓');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Workout</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">

          {/* Workout Type */}
          <div>
            <Label htmlFor="edit-wtype">Workout Type</Label>
            <Input
              id="edit-wtype"
              value={workoutType}
              onChange={e => setWorkoutType(e.target.value)}
              placeholder="e.g. Upper Body, Leg Day, HIIT"
            />
          </div>

          {/* Duration & Calories */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-dur">Duration (min)</Label>
              <Input id="edit-dur" type="number" value={duration}
                onChange={e => setDuration(e.target.value)} placeholder="60" />
            </div>
            <div>
              <Label htmlFor="edit-cal">Calories Burned</Label>
              <Input id="edit-cal" type="number" value={calories}
                onChange={e => setCalories(e.target.value)} placeholder="450" />
            </div>
          </div>

          {/* Exercises */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Exercises</Label>
              <button
                type="button"
                onClick={addExercise}
                className="flex items-center gap-1 text-xs text-[#c9a96e] hover:text-[#e8c98a] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {exercises.map(ex => (
                <div key={ex.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Input
                      value={ex.name || ''}
                      onChange={e => updateExercise(ex.id!, 'name', e.target.value)}
                      placeholder="Exercise name"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      value={ex.sets || ''}
                      onChange={e => updateExercise(ex.id!, 'sets', parseInt(e.target.value))}
                      placeholder="Sets"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      value={ex.reps || ''}
                      onChange={e => updateExercise(ex.id!, 'reps', parseInt(e.target.value))}
                      placeholder="Reps"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      value={ex.weight || ''}
                      onChange={e => updateExercise(ex.id!, 'weight', parseInt(e.target.value))}
                      placeholder="lbs"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button type="button" onClick={() => removeExercise(ex.id!)}
                      className="text-red-400/60 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {exercises.length === 0 && (
                <p className="text-white/25 text-xs text-center py-2">No exercises — click Add to add one</p>
              )}
            </div>
          </div>

          {/* Music */}
          <div>
            <Label htmlFor="edit-music" className="flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5" /> Now Playing (optional)
            </Label>
            <Input
              id="edit-music"
              value={music}
              onChange={e => setMusic(e.target.value)}
              placeholder="Artist – Song name"
              className="mt-1"
            />
          </div>

          {/* PR toggle */}
          <button
            type="button"
            onClick={() => setIsPR(p => !p)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
              isPR
                ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300'
                : 'border-[rgba(201,169,110,0.07)] text-white/40 hover:border-[rgba(201,169,110,0.18)] hover:text-white/60'
            }`}
          >
            <Trophy className={`w-5 h-5 ${isPR ? 'text-yellow-400' : 'text-white/25'}`} />
            <span className="text-sm font-medium">{isPR ? '🏆 Personal Record!' : 'Mark as Personal Record'}</span>
            <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${isPR ? 'border-yellow-400 bg-yellow-400' : 'border-[rgba(201,169,110,0.18)]'}`}>
              {isPR && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
          </button>

          {/* Caption */}
          <div>
            <Label htmlFor="edit-cap">Caption</Label>
            <Textarea
              id="edit-cap"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Share your thoughts… use #hashtags or @mentions"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
