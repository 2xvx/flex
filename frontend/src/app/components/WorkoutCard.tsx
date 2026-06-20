import { useState, useRef, useEffect } from 'react';
import { API } from '../../config';
import { compressBase64 } from '../../utils/imageCompression';
import { Heart, MessageCircle, Dumbbell, Flame, Clock, MoreVertical, Share2, Repeat2, Send, ImagePlus, X, UserPlus, UserCheck, Pencil, Trash2, CornerDownRight, ExternalLink, Bookmark, BookmarkCheck, Music, Trophy, Copy, TrendingUp, UtensilsCrossed, Timer, Scale, Zap, Wheat, Droplets } from 'lucide-react';
import { WorkoutPost } from '../types';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { ReportDialog } from './ReportDialog';
import { EditPostDialog } from './EditPostDialog';
import { RichText } from './RichText';
import { formatSmartDate } from '../../utils/dateFormatter';
import { followUser, unfollowUser } from '../../services/followService';
import { likeCommentAPI } from '../../services/postService';
import { authFetch, uploadImage } from '../../utils/authToken';
import { toast } from 'sonner';

type ReactionType = 'heart' | 'fire' | 'strong' | 'clap';

const REACTIONS: { type: ReactionType; emoji: string; label: string; color: string }[] = [
  { type: 'heart',  emoji: '❤️', label: 'Love',   color: 'text-red-400' },
  { type: 'fire',   emoji: '🔥', label: 'Fire',   color: 'text-orange-400' },
  { type: 'strong', emoji: '💪', label: 'Strong', color: 'text-blue-400' },
  { type: 'clap',   emoji: '👏', label: 'Clap',   color: 'text-yellow-400' },
];

interface WorkoutCardProps {
  post: WorkoutPost;
  onLike?: (postId: string) => void;
  onComment?: (postId: string, text: string, image?: string | null) => void;
  onRepost?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onPostUpdated?: (postId: string, changes: Partial<WorkoutPost>) => void;
  onDeletePost?: (postId: string) => void;
  onHashtag?: (tag: string) => void;
  onMention?: (username: string) => void;
  onViewPost?: (postId: string) => void;
  onDoThisWorkout?: (post: WorkoutPost) => void;
  currentUserId?: string;
  currentUser?: { id: string; [key: string]: any } | null;
}

export function WorkoutCard({ post, onLike, onComment, onRepost, onShare, onPostUpdated, onDeletePost, onHashtag, onMention, onViewPost, onDoThisWorkout, currentUserId, currentUser }: WorkoutCardProps) {
  // Support both currentUserId (direct) and currentUser.id (from profile saved tab etc.)
  const resolvedUserId = currentUserId ?? currentUser?.id;
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [editDialogOpen,   setEditDialogOpen]   = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videoError, setVideoError] = useState(false);
  // Bookmark + repost state
  const [isSaved, setIsSaved] = useState(false);
  const [isReposted, setIsReposted] = useState(!!post.isReposted);

  // Reaction state
  const [userReaction, setUserReaction] = useState<ReactionType | null>((post.userReaction as ReactionType) || null);
  const [reactionCounts, setReactionCounts] = useState<Record<ReactionType, number>>({
    heart:  post.reactions?.heart  || post.likes || 0,
    fire:   post.reactions?.fire   || 0,
    strong: post.reactions?.strong || 0,
    clap:   post.reactions?.clap   || 0,
  });
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync heart count with post.likes (for posts that predate the reactions system)
  useEffect(() => {
    if (!post.reactions && post.likes) {
      setReactionCounts(c => ({ ...c, heart: post.likes || 0 }));
    }
    if (post.isLiked && !post.userReaction) {
      setUserReaction('heart');
    }
  }, [post.id]);

  const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);

  const handleReact = async (type: ReactionType) => {
    if (!resolvedUserId) { toast.error('Log in to react'); return; }
    setShowReactionPicker(false);
    const prev = userReaction;
    const isToggleOff = prev === type;
    // Optimistic update
    setUserReaction(isToggleOff ? null : type);
    setReactionCounts(c => {
      const next = { ...c };
      if (prev) next[prev] = Math.max(0, next[prev] - 1);
      if (!isToggleOff) next[type] = next[type] + 1;
      return next;
    });
    // Also call legacy onLike when toggling the heart reaction (keeps feed counts in sync)
    if (type === 'heart') onLike?.(post.id);
    try {
      await authFetch(`${API}/posts/${post.id}/react`, {
        method: 'POST',
        body: JSON.stringify({ reactionType: isToggleOff ? null : type }),
      });
    } catch {
      setUserReaction(prev);
      setReactionCounts(c => {
        const next = { ...c };
        if (!isToggleOff) next[type] = Math.max(0, next[type] - 1);
        if (prev) next[prev] = next[prev] + 1;
        return next;
      });
    }
  };

  const cancelHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  };
  const scheduleHide = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowReactionPicker(false), 200);
  };
  const handlePickerMouseEnter = () => {
    cancelHide();
    hoverTimerRef.current = setTimeout(() => setShowReactionPicker(true), 400);
  };
  const handlePickerMouseLeave = scheduleHide;

  const handleSave = async () => {
    if (!resolvedUserId) { toast.error('Log in to save posts'); return; }
    const next = !isSaved;
    setIsSaved(next);
    try {
      await authFetch(`${API}/posts/${post.id}/save`, {
        method: 'POST',
        });
      toast.success(next ? 'Post saved! 🔖' : 'Removed from saved');
    } catch { setIsSaved(!next); }
  };

  // Comment likes + replies
  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({});
  const [commentLikedBy, setCommentLikedBy] = useState<Record<string, string[]>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleLikeComment = async (commentId: string, currentLikedBy: string[]) => {
    if (!resolvedUserId) return;
    const isLiked = currentLikedBy.includes(resolvedUserId);
    // Optimistic update
    setCommentLikes(prev => ({ ...prev, [commentId]: (prev[commentId] ?? (currentLikedBy.length)) + (isLiked ? -1 : 1) }));
    setCommentLikedBy(prev => ({
      ...prev,
      [commentId]: isLiked ? currentLikedBy.filter(id => id !== resolvedUserId) : [...currentLikedBy, resolvedUserId],
    }));
    try { await likeCommentAPI(post.id, commentId, resolvedUserId!); } catch {}
  };

  const handleReply = async (commentId: string) => {
    if (!replyText.trim() || !resolvedUserId) return;
    const text = replyText.trim();
    setReplyText('');
    setReplyingTo(null);
    // Optimistic update — attach reply to the comment in local state
    const optimisticReply = {
      id: `r_${Date.now()}`,
      text,
      user: { id: resolvedUserId, name: 'You', username: 'you', avatar: '' },
      timestamp: new Date().toISOString(),
    };
    // Update post comments locally
    const updatedComments = (post.comments || []).map((c: any) =>
      c.id === commentId
        ? { ...c, replies: [...(c.replies || []), optimisticReply] }
        : c
    );
    onPostUpdated?.(post.id, { comments: updatedComments });
    try {
      const res = await fetch(`${API}/posts/${post.id}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, user: { id: resolvedUserId } }),
      });
      if (res.ok) {
        const saved = await res.json();
        // Replace optimistic reply with server reply
        const finalComments = (post.comments || []).map((c: any) =>
          c.id === commentId
            ? { ...c, replies: [...(c.replies || []).filter((r: any) => r.id !== optimisticReply.id), saved] }
            : c
        );
        onPostUpdated?.(post.id, { comments: finalComments });
      }
    } catch {}
  };

  const isOwnPost = post.user?.id === resolvedUserId;

  const handleDelete = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      const res = await authFetch(`${API}/posts/${post.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Post deleted');
      onDeletePost?.(post.id);
    } catch {
      toast.error('Could not delete post');
    }
  };

  const handleFollow = async () => {
    if (!resolvedUserId) return toast.error('Log in to follow users');
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(post.user?.id!);
        setIsFollowing(false);
        toast.success('Unfollowed');
      } else {
        await followUser(post.user?.id!);
        setIsFollowing(true);
        toast.success(`Following ${post.user?.name}!`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleReport = (reason: string, details: string) => {
    console.log('Report submitted:', { postId: post.id, reason, details });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert('Image must be under 20 MB'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string;
      // Compress the image before storing — keeps Firestore docs small
      try {
        const compressed = await compressBase64(raw);
        setCommentImage(compressed);
        setImagePreview(compressed);
      } catch {
        // Fallback: use raw if compression fails
        setCommentImage(raw);
        setImagePreview(raw);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // allow re-selecting the same file
  };

  const handleRemoveImage = () => {
    setCommentImage(null);
    setImagePreview(null);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() && !commentImage) return;
    let imageUrl: string | null = null;
    if (commentImage) {
      const uploaded = await uploadImage(commentImage, 'comments');
      imageUrl = uploaded ?? commentImage; // fall back to base64 if upload fails
    }
    onComment?.(post.id, commentText, imageUrl);
    setCommentText('');
    setCommentImage(null);
    setImagePreview(null);
  };

  return (
    <Card className="overflow-hidden border-[rgba(201,169,110,0.08)] bg-[#0d0b08] transition-all duration-300 hover:border-[rgba(201,169,110,0.12)] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30">

      {/* PR Gold Banner */}
      {post.isPR && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500/20 via-amber-500/15 to-yellow-500/10 border-b border-yellow-500/25">
          <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          <span className="text-yellow-300 text-xs font-semibold tracking-wide">Personal Record 🏆</span>
          <div className="ml-auto flex gap-0.5">
            {['✨','🌟','✨'].map((s, i) => <span key={i} className="text-xs">{s}</span>)}
          </div>
        </div>
      )}

      {/* User Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="relative">
          {post.user?.workingOut && (
            <span className="absolute -inset-0.5 rounded-full z-10 pointer-events-none">
              <span className="absolute inset-0 rounded-full border-2 border-green-400 animate-ping opacity-60" />
              <span className="absolute inset-0 rounded-full border-2 border-green-400" />
            </span>
          )}
          <Avatar className="ring-2 ring-[rgba(201,169,110,0.15)] transition-all duration-300 hover:ring-[rgba(201,169,110,0.35)]">
          <AvatarImage src={post.user?.avatar} alt={post.user?.name} />
          <AvatarFallback className="bg-gradient-to-br from-[#c9a96e] to-[#a07840] text-white font-semibold">
            {post.user?.name?.[0] || '?'}
          </AvatarFallback>
        </Avatar>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{post.user?.name}</p>
          <p className="text-white/40 text-sm">
            @{post.user?.username?.includes('@') ? post.user.username.split('@')[0] : post.user?.username} · {formatSmartDate(post.timestamp || post.createdAt || '')}
          </p>
        </div>
        {/* Follow button — only shown on other people's posts */}
        {!isOwnPost && (
          <button
            type="button"
            onClick={handleFollow}
            disabled={followLoading}
            title={isFollowing ? 'Unfollow' : 'Follow'}
            className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50
              ${isFollowing
                ? 'text-[#e8c98a] bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] hover:text-red-400 hover:border-red-400/20 hover:bg-red-500/5'
                : 'text-white/50 border border-[rgba(201,169,110,0.12)] hover:text-[#e8c98a] hover:border-[rgba(201,169,110,0.25)] hover:bg-[rgba(201,169,110,0.04)]'}`}
          >
            {isFollowing
              ? <><UserCheck className="w-3 h-3" /> Following</>
              : <><UserPlus  className="w-3 h-3" /> Follow</>}
          </button>
        )}
        <Badge variant="secondary" className="bg-[rgba(201,169,110,0.04)] text-white/60 border-0 shrink-0 capitalize">
          {(post as any).type === 'progress'   ? '📈 Progress'   :
           (post as any).type === 'meal'       ? '🍽️ Meal'       :
           (post as any).type === 'run'        ? '🏃 Run'        :
           (post as any).type === 'motivation' ? '✨ Post'       :
           post.workoutType || '💪 Workout'}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white/40 hover:text-white hover:bg-[rgba(201,169,110,0.04)] shrink-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#110e09] border-[rgba(201,169,110,0.12)]">
            {isOwnPost && (
              <>
                <DropdownMenuItem onClick={() => setEditDialogOpen(true)} className="text-white/70 hover:text-white">
                  <Pencil className="w-3.5 h-3.5 mr-2" /> Edit post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-red-400 hover:text-red-300 focus:text-red-300">
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete post
                </DropdownMenuItem>
              </>
            )}
            {onViewPost && (
              <DropdownMenuItem onClick={() => onViewPost(post.id)} className="text-white/70 hover:text-white">
                <ExternalLink className="w-3.5 h-3.5 mr-2" /> View full post
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setReportDialogOpen(true)} className="text-white/70 hover:text-white">
              Report post
            </DropdownMenuItem>
            {post.user?.id && post.user.id !== resolvedUserId && (
              <>
                <DropdownMenuItem
                  onClick={async () => {
                    await authFetch(`${API}/users/${post.user.id}/mute`, { method: 'POST', });
                    toast.success(`@${post.user.username} muted`);
                  }}
                  className="text-white/70 hover:text-white"
                >
                  Mute @{post.user?.username}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    if (!confirm(`Block @${post.user.username}? Their posts will be hidden from your feed.`)) return;
                    await authFetch(`${API}/users/${post.user.id}/block`, { method: 'POST', });
                    toast.success(`@${post.user.username} blocked`);
                  }}
                  className="text-red-400 hover:text-red-300 focus:text-red-300"
                >
                  Block @{post.user?.username}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Workout Video */}
      {post.videoUrl && !videoError && (
        <div className="relative overflow-hidden bg-black mx-0">
          <video
            src={post.videoUrl}
            controls
            playsInline
            className="w-full max-h-[480px] object-contain"
            preload="metadata"
            onError={() => setVideoError(true)}
          />
        </div>
      )}

      {/* Workout Image */}
      {post.image && (!post.videoUrl || videoError) && (
        <div
          className="relative aspect-[4/3] overflow-hidden group cursor-pointer"
          onClick={() => setExpandedImage(post.image!)}
        >
          <img src={post.image} alt="Workout" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      )}

      {/* ── Stats block — adapts to post type ────────────────────────────── */}
      {post.type === 'progress' ? (
        (post as any).weight || (post as any).bodyFat ? (
          <div className="grid grid-cols-2 gap-4 px-4 py-3 bg-emerald-500/5 border border-emerald-500/15 mx-4 rounded-xl mt-1">
            {(post as any).weight && (
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="text-xs text-white/30">Weight</p>
                  <p className="text-sm font-medium text-white">{(post as any).weight} kg</p>
                </div>
              </div>
            )}
            {(post as any).bodyFat && (
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="text-xs text-white/30">Body Fat</p>
                  <p className="text-sm font-medium text-white">{(post as any).bodyFat}%</p>
                </div>
              </div>
            )}
          </div>
        ) : null
      ) : post.type === 'meal' ? (
        <div className="px-4 py-3 bg-orange-500/5 border border-orange-500/15 mx-4 rounded-xl mt-1 space-y-2">
          {(post as any).mealName && (
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-orange-400 shrink-0" />
              <p className="text-sm font-semibold text-white">{(post as any).mealName}</p>
            </div>
          )}
          <div className="flex gap-3 flex-wrap">
            {(post as any).calories > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/50">
                <Flame className="w-3 h-3 text-orange-400" /> {(post as any).calories} kcal
              </span>
            )}
            {(post as any).protein > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/50">
                <Zap className="w-3 h-3 text-blue-400" /> {(post as any).protein}g protein
              </span>
            )}
            {(post as any).carbs > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/50">
                <Wheat className="w-3 h-3 text-yellow-400" /> {(post as any).carbs}g carbs
              </span>
            )}
            {(post as any).fat > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/50">
                <Droplets className="w-3 h-3 text-[#c9a96e]" /> {(post as any).fat}g fat
              </span>
            )}
          </div>
        </div>
      ) : post.type === 'run' ? (
        <div className="grid grid-cols-3 gap-4 px-4 py-3 bg-sky-500/5 border border-sky-500/15 mx-4 rounded-xl mt-1">
          {(post as any).distance && (
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-sky-400" />
              <div>
                <p className="text-xs text-white/30">Distance</p>
                <p className="text-sm font-medium text-white">{(post as any).distance} km</p>
              </div>
            </div>
          )}
          {(post as any).runTime && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <div>
                <p className="text-xs text-white/30">Time</p>
                <p className="text-sm font-medium text-white">{(post as any).runTime}</p>
              </div>
            </div>
          )}
          {(post as any).pace && (
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              <div>
                <p className="text-xs text-white/30">Pace</p>
                <p className="text-sm font-medium text-white">{(post as any).pace}</p>
              </div>
            </div>
          )}
        </div>
      ) : post.type !== 'motivation' ? (
        /* Default: workout stats */
        <div className="grid grid-cols-3 gap-4 px-4 py-3 bg-[rgba(201,169,110,0.04)] mx-4 rounded-xl mt-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-white/30" />
            <div>
              <p className="text-xs text-white/30">Duration</p>
              <p className="text-sm font-medium text-white">{post.duration} min</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <div>
              <p className="text-xs text-white/30">Calories</p>
              <p className="text-sm font-medium text-white">{post.calories}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-white/30" />
            <div>
              <p className="text-xs text-white/30">Exercises</p>
              <p className="text-sm font-medium text-white">{post.exercises?.length || 0}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Exercises (workout only) */}
      {post.exercises?.length > 0 && (
        <div className="px-4 pt-3 pb-1 space-y-1">
          {post.exercises.map((exercise) => (
            <div key={exercise.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg hover:bg-[rgba(201,169,110,0.04)] transition-colors duration-150">
              <span className="font-medium text-white/80">{exercise.name}</span>
              <span className="text-white/40 text-xs font-mono">
                {exercise.sets} × {exercise.reps}{exercise.weight && ` @ ${exercise.weight}lbs`}
                {exercise.duration && `${exercise.duration}s`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div className="px-4 py-3">
          <RichText
            text={post.caption}
            onHashtag={onHashtag}
            onMention={onMention}
            className="text-white/70 text-sm"
          />
        </div>
      )}

      {/* Music chip */}
      {post.music && (
        <div className="px-4 pb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.07)]">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shrink-0">
              <Music className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-white/60 text-xs truncate max-w-[200px]">{post.music}</span>
          </div>
        </div>
      )}

      {/* Reaction counts row — only show if there are any */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-2 px-4 pb-2">
          <div className="flex -space-x-0.5">
            {REACTIONS.filter(r => reactionCounts[r.type] > 0).slice(0, 3).map(r => (
              <span key={r.type} className="text-sm">{r.emoji}</span>
            ))}
          </div>
          <span className="text-white/30 text-xs">{totalReactions}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-1 px-3 pb-3 pt-1 border-t border-[rgba(201,169,110,0.08)]">

        {/* Like / Reaction button */}
        <div className="relative">
          {/* Reaction picker — appears after 400ms hover */}
          {showReactionPicker && (
            <div
              className="absolute bottom-full left-0 flex flex-col z-20"
              onMouseEnter={cancelHide}
              onMouseLeave={scheduleHide}
            >
              {/* Invisible bridge: fills the gap between picker and button so mouse can travel */}
              <div className="h-3 w-full" />
              <div className="flex items-center gap-1 bg-[#110e09] border border-[rgba(201,169,110,0.12)] rounded-2xl px-2 py-1.5 shadow-xl">
                {REACTIONS.map(r => (
                  <button
                    key={r.type}
                    onClick={() => handleReact(r.type)}
                    title={r.label}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all hover:bg-[rgba(201,169,110,0.06)] hover:scale-125 active:scale-95 ${userReaction === r.type ? 'bg-white/10 scale-110' : ''}`}
                  >
                    <span className="text-xl leading-none">{r.emoji}</span>
                    <span className="text-[9px] text-white/30">{reactionCounts[r.type] > 0 ? reactionCounts[r.type] : ''}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* The button: click = ❤️ toggle, hover 400ms = picker */}
          <Button
            variant="ghost" size="sm"
            className={`gap-1.5 transition-all duration-200 ${userReaction ? 'text-red-400 bg-red-500/5' : 'text-white/40 hover:text-red-400 hover:bg-red-500/10'}`}
            onMouseEnter={handlePickerMouseEnter}
            onMouseLeave={handlePickerMouseLeave}
            onClick={() => handleReact(userReaction || 'heart')}
          >
            <span className="text-base leading-none select-none">
              {userReaction ? REACTIONS.find(r => r.type === userReaction)?.emoji : '❤️'}
            </span>
            <span className="text-xs font-medium">{totalReactions || 0}</span>
          </Button>
        </div>

        <Button
          variant="ghost" size="sm"
          className={`gap-1.5 transition-all duration-200 ${showComments ? 'text-blue-400 bg-blue-500/10' : 'text-white/40 hover:text-blue-400 hover:bg-blue-500/10'}`}
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle className="w-4 h-4" />
          <span className="text-xs font-medium">{post.comments?.length || 0}</span>
        </Button>

        <Button
          variant="ghost" size="sm"
          className={`gap-1.5 transition-all duration-200 ${isReposted ? 'text-green-400 bg-green-500/10' : 'text-white/40 hover:text-green-400 hover:bg-green-500/10'}`}
          onClick={() => { onRepost?.(post.id); setIsReposted(prev => !prev); }}
        >
          <Repeat2 className="w-4 h-4" />
        </Button>

        {/* Do this workout — only on other people's posts */}
        {!isOwnPost && onDoThisWorkout && post.exercises?.length > 0 && (
          <Button
            variant="ghost" size="sm"
            title="Copy this workout to my log"
            className="gap-1.5 text-white/40 hover:text-[#c9a96e] hover:bg-[rgba(201,169,110,0.08)] transition-all duration-200"
            onClick={() => { onDoThisWorkout(post); toast.success('Workout copied to your log! 💪'); }}
          >
            <Copy className="w-4 h-4" />
            <span className="text-xs font-medium">Do this</span>
          </Button>
        )}

        <Button
          variant="ghost" size="sm"
          className="gap-1.5 text-white/40 hover:text-[#c9a96e] hover:bg-[rgba(201,169,110,0.08)] transition-all duration-200 ml-auto"
          onClick={() => onShare?.(post.id)}
        >
          <Share2 className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost" size="sm"
          className={`gap-1.5 transition-all duration-200 ${isSaved ? 'text-[#c9a96e] hover:text-[#e8c98a]' : 'text-white/40 hover:text-[#c9a96e] hover:bg-[rgba(201,169,110,0.08)]'}`}
          onClick={handleSave}
        >
          {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </Button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-[rgba(201,169,110,0.08)] px-4 pb-4 pt-3 space-y-3">

          {/* Existing Comments */}
          {post.comments?.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {post.comments.map((comment: any) => {
                const cLikedBy = commentLikedBy[comment.id] ?? (comment.likedBy || []);
                const cLikes   = commentLikes[comment.id]   ?? (comment.likes   || 0);
                const cLiked   = cLikedBy.includes(resolvedUserId || '');
                return (
                <div key={comment.id} className="flex gap-2">
                  <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                    <AvatarImage src={comment.user?.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-[#c9a96e] to-[#a07840] text-white text-xs">
                      {comment.user?.name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="bg-[rgba(201,169,110,0.04)] rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-white/70">@{comment.user?.username}</p>
                      {comment.text && (
                        <RichText text={comment.text} onHashtag={onHashtag} onMention={onMention} className="text-sm text-white/60 mt-0.5" />
                      )}
                      {comment.image && (
                        <img src={comment.image} alt="comment attachment" className="mt-1.5 rounded-lg max-h-32 object-cover" />
                      )}
                    </div>

                    {/* Comment actions: like + reply */}
                    <div className="flex items-center gap-3 mt-1 px-1">
                      <button
                        onClick={() => handleLikeComment(comment.id, comment.likedBy || [])}
                        className={`flex items-center gap-1 text-[11px] transition-colors ${
                          (commentLikedBy[comment.id] ?? (comment.likedBy || [])).includes(resolvedUserId || '')
                            ? 'text-red-400' : 'text-white/30 hover:text-red-400'
                        }`}
                      >
                        <Heart className="w-3 h-3" />
                        {(commentLikes[comment.id] ?? comment.likes ?? 0) > 0 &&
                          <span>{commentLikes[comment.id] ?? comment.likes}</span>
                        }
                      </button>
                      <button
                        onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                        className="text-[11px] text-white/30 hover:text-[#c9a96e] transition-colors flex items-center gap-1"
                      >
                        <CornerDownRight className="w-3 h-3" /> Reply
                      </button>
                      <span className="text-[10px] text-white/20 ml-auto">
                        {comment.timestamp ? new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    {/* Inline replies */}
                    {comment.replies?.length > 0 && (
                      <div className="mt-1.5 ml-3 space-y-1.5 border-l border-[rgba(201,169,110,0.07)] pl-3">
                        {comment.replies.map((reply: any) => (
                          <div key={reply.id} className="flex gap-2">
                            <Avatar className="w-5 h-5 shrink-0">
                              <AvatarImage src={reply.user?.avatar} />
                              <AvatarFallback className="bg-[#a07840] text-white text-[8px]">{reply.user?.name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="bg-[rgba(201,169,110,0.04)] rounded-lg px-2.5 py-1.5 flex-1">
                              <p className="text-[10px] font-semibold text-white/60">@{reply.user?.username}</p>
                              <p className="text-xs text-white/50">{reply.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply input */}
                    {replyingTo === comment.id && (
                      <div className="flex gap-2 mt-2 ml-3">
                        <Input
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleReply(comment.id)}
                          placeholder={`Reply to @${comment.user?.username}…`}
                          className="h-7 text-xs bg-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.12)]"
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleReply(comment.id)} className="h-7 px-2 text-[#c9a96e]">
                          <Send className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <p className="text-white/25 text-xs text-center py-2">No comments yet. Be the first!</p>
          )}

          {/* Add Comment */}
          <div className="space-y-2">
            {imagePreview && (
              <div className="relative w-16 h-16">
                <img src={imagePreview} alt="preview" className="w-16 h-16 rounded-lg object-cover border border-[rgba(201,169,110,0.12)]" />
                <button onClick={handleRemoveImage} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
            <div className="flex gap-2 items-center">
              <Input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()}
                placeholder="Add a comment…"
                className="flex-1 h-9 text-sm bg-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.12)] text-white placeholder:text-white/30"
              />
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <Button
                size="sm" variant="ghost"
                className="h-9 w-9 p-0 text-white/30 hover:text-[#c9a96e] hover:bg-[rgba(201,169,110,0.08)]"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="w-4 h-4" />
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-9 w-9 p-0 text-white/30 hover:text-[#c9a96e] hover:bg-[rgba(201,169,110,0.08)]"
                onClick={handleSubmitComment}
                disabled={!commentText.trim() && !commentImage}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded image lightbox */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setExpandedImage(null)}
        >
          <img src={expandedImage} alt="expanded" className="max-w-full max-h-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 text-white/60 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      <ReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        type="post"
        targetName={post.user?.name || 'Post'}
        onReport={handleReport}
      />

      <EditPostDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        post={post}
        onUpdated={(changes) => onPostUpdated?.(post.id, changes)}
      />
    </Card>
  );
}
