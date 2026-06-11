// ReelsPage.tsx — "Clips"
// All-in-one upgrade: tabs (For You / Following / Trending), grid toggle,
// scrub bar, stats overlay + XP pill, follow button, enhanced action sidebar

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Heart, MessageCircle, Share2, Dumbbell, Flame, Clock,
  Loader2, Upload, X, Video, Play, ChevronUp, ChevronDown,
  Swords, BookOpen, Send, Clock3, Trophy, CheckCircle2,
  LayoutGrid, LayoutList, UserPlus, UserCheck, Zap, Plus,
} from 'lucide-react';
import { User } from '../types';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { toast } from 'sonner';
import { authFetch } from '../../utils/authToken';
import { uploadVideoToStorage } from '../../utils/uploadVideo';
import { RichText } from './RichText';
import { API } from '../../config';

interface ReelsPageProps {
  currentUser?: User | null;
  onViewProfile: (uid: string) => void;
  onHashtag?: (tag: string) => void;
}

type ClipMode = 'normal' | 'formCheck' | 'tutorial' | 'challenge';
type FeedTab  = 'forYou' | 'following' | 'trending';
type ViewMode = 'feed' | 'grid';

interface TimestampComment {
  uid: string;
  name: string;
  avatar: string;
  text: string;
  timestamp: number;
  createdAt: string;
}

interface Reel {
  id: string;
  workoutType: string;
  caption: string;
  image?: string;
  videoUrl?: string;
  duration: number;
  calories: number;
  exercises: any[];
  likes: number;
  isLiked: boolean;
  comments: any[];
  user: { id: string; name: string; username: string; avatar: string };
  createdAt: string;
  clipMode?: ClipMode;
  tutorialSteps?: string[];
  challengeName?: string;
  challengeParticipants?: number;
  timestampComments?: TimestampComment[];
}

const GRADIENTS = [
  'from-[#1a1508] via-[#2a1f08] to-[#0d0b08]',
  'from-[#1a0d08] via-[#2a1508] to-[#0d0b08]',
  'from-[#0d0b08] via-[#1a1508] to-[#0d0b08]',
  'from-[#1f1a08] via-[#2a1f08] to-[#0d0b08]',
  'from-[#0d0b08] via-[#201508] to-[#1a1508]',
  'from-[#1a1508] via-[#0d0b08] to-[#201508]',
];

const CLIP_MODES: { id: ClipMode; label: string; emoji: string; desc: string }[] = [
  { id: 'normal',    label: 'Normal',     emoji: '🎬', desc: 'Regular workout clip'              },
  { id: 'formCheck', label: 'Form Check', emoji: '😭', desc: 'Roast my form — timed feedback'    },
  { id: 'tutorial',  label: 'Tutorial',   emoji: '📚', desc: 'Step-by-step breakdown'            },
  { id: 'challenge', label: 'Challenge',  emoji: '⚔️', desc: 'Tag a move — others replicate it' },
];

const MODE_BADGE: Record<ClipMode, { label: string; emoji: string; bg: string; text: string }> = {
  normal:    { label: 'Clip',       emoji: '🎬', bg: 'bg-black/40',       text: 'text-white'      },
  formCheck: { label: 'Form Check', emoji: '😭', bg: 'bg-red-500/30',     text: 'text-red-200'    },
  tutorial:  { label: 'Tutorial',   emoji: '📚', bg: 'bg-blue-500/30',    text: 'text-blue-200'   },
  challenge: { label: 'Challenge',  emoji: '⚔️', bg: 'bg-orange-500/30', text: 'text-orange-200' },
};

function fmtTime(s: number): string {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#(\w+)/g) || [];
  return [...new Set(matches.map(t => t.slice(1)))].slice(0, 5);
}

// ── Component ──────────────────────────────────────────────────────────────────
export function ReelsPage({ currentUser, onViewProfile, onHashtag }: ReelsPageProps) {

  // ── Core state ──────────────────────────────────────────────────────────────
  const [reels, setReels]               = useState<Reel[]>([]);
  const [current, setCurrent]           = useState(0);
  const [loading, setLoading]           = useState(true);
  const [likedSet, setLikedSet]         = useState<Set<string>>(new Set());
  const [uploading, setUploading]       = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUpload, setShowUpload]     = useState(false);
  const [videoFile, setVideoFile]       = useState<File | null>(null);
  const [videoCaption, setVideoCaption] = useState('');
  const [videoPaused, setVideoPaused]   = useState(false);
  const [videoTime, setVideoTime]       = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);

  // ── New: tabs + view mode ──────────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState<FeedTab>('forYou');
  const [viewMode, setViewMode]         = useState<ViewMode>('feed');

  // ── New: follow state ──────────────────────────────────────────────────────
  const [followingSet, setFollowingSet]   = useState<Set<string>>(new Set());
  const [followLoading, setFollowLoading] = useState<Set<string>>(new Set());

  // ── Clip mode (upload) ──────────────────────────────────────────────────────
  const [clipMode, setClipMode]           = useState<ClipMode>('normal');
  const [tutorialSteps, setTutorialSteps] = useState<string[]>(['', '', '']);
  const [challengeName, setChallengeName] = useState('');

  // ── Form-check comment panel ────────────────────────────────────────────────
  const [showComments, setShowComments]     = useState(false);
  const [tsComments, setTsComments]         = useState<TimestampComment[]>([]);
  const [newComment, setNewComment]         = useState('');
  const [newCommentTs, setNewCommentTs]     = useState(0);
  const [sendingComment, setSendingComment] = useState(false);

  // ── Challenge join state ────────────────────────────────────────────────────
  const [joiningChallenge, setJoiningChallenge] = useState(false);
  const [joinedChallenges, setJoinedChallenges] = useState<Set<string>>(new Set());

  const videoRef    = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef(0);

  // ── Filtered reels by tab ─────────────────────────────────────────────────
  const filteredReels = useMemo(() => {
    const valid = reels.filter(r => r.user); // guard: skip posts with no user object
    if (activeTab === 'following') return valid.filter(r => followingSet.has(r.user.id));
    if (activeTab === 'trending')  return [...valid].sort((a, b) => b.likes - a.likes);
    return valid;
  }, [reels, activeTab, followingSet]);

  useEffect(() => { setCurrent(0); }, [activeTab]);

  // ── Load reels ─────────────────────────────────────────────────────────────
  const loadReels = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await authFetch(`${API}/reels?limit=20`);
      const data = await res.json();
      // Only keep posts that actually have a video
      const list: Reel[] = (data.reels || []).filter((r: Reel) => r.videoUrl && r.videoUrl.trim() !== '');
      setReels(list);
      setLikedSet(new Set(list.filter(r => r.isLiked).map(r => r.id)));
    } catch {
      toast.error('Failed to load clips');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReels(); }, [loadReels]);

  // ── Auto-play + reset on reel change ──────────────────────────────────────
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play()
        .then(() => setVideoPaused(false))
        .catch(() => setVideoPaused(true));
    }
    setShowComments(false);
    setTsComments([]);
    setVideoTime(0);
    setVideoProgress(0);
  }, [current]);

  // ── Load timestamped comments ──────────────────────────────────────────────
  useEffect(() => {
    const reel = filteredReels[current];
    if (!reel) return;
    setTsComments(reel.timestampComments || []);
  }, [current, filteredReels]);

  // ── Track video time + scrub progress ─────────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const update = () => {
      setVideoTime(vid.currentTime);
      setVideoProgress(vid.duration ? vid.currentTime / vid.duration : 0);
    };
    vid.addEventListener('timeupdate', update);
    return () => vid.removeEventListener('timeupdate', update);
  }, [current]);

  // ── Keyboard nav ───────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next();
      if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  prev();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const next = () => setCurrent(c => Math.min(c + 1, filteredReels.length - 1));
  const prev = () => setCurrent(c => Math.max(c - 1, 0));

  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd   = (e: React.TouchEvent) => {
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
  };

  // ── Like ───────────────────────────────────────────────────────────────────
  const handleLike = async (reel: Reel) => {
    if (!currentUser) return toast.error('Log in to like');
    const liked = likedSet.has(reel.id);
    setLikedSet(prev => { const n = new Set(prev); liked ? n.delete(reel.id) : n.add(reel.id); return n; });
    setReels(prev => prev.map(r => r.id === reel.id ? { ...r, likes: r.likes + (liked ? -1 : 1) } : r));
    try { await authFetch(`${API}/posts/${reel.id}/like`, { method: 'POST' }); } catch {
      setLikedSet(prev => { const n = new Set(prev); liked ? n.add(reel.id) : n.delete(reel.id); return n; });
      setReels(prev => prev.map(r => r.id === reel.id ? { ...r, likes: r.likes + (liked ? 1 : -1) } : r));
    }
  };

  // ── Follow / Unfollow ──────────────────────────────────────────────────────
  const handleFollow = async (userId: string) => {
    if (!currentUser) return toast.error('Log in to follow');
    setFollowLoading(p => new Set([...p, userId]));
    const wasFollowing = followingSet.has(userId);
    setFollowingSet(prev => { const n = new Set(prev); wasFollowing ? n.delete(userId) : n.add(userId); return n; });
    try {
      await authFetch(`${API}/users/${userId}/follow`, { method: 'POST' });
    } catch {
      setFollowingSet(prev => { const n = new Set(prev); wasFollowing ? n.add(userId) : n.delete(userId); return n; });
    } finally {
      setFollowLoading(p => { const n = new Set(p); n.delete(userId); return n; });
    }
  };

  // ── Toggle play/pause ──────────────────────────────────────────────────────
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) { videoRef.current.play(); setVideoPaused(false); }
    else { videoRef.current.pause(); setVideoPaused(true); }
  };

  // ── Scrub bar seek ─────────────────────────────────────────────────────────
  const handleScrubClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    vid.currentTime = pct * vid.duration;
  };

  // ── Video file select ──────────────────────────────────────────────────────
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|webm|avi|mkv)$/i)) {
      toast.error('Please select a video file'); return;
    }
    if (file.size > 500 * 1024 * 1024) { toast.error('Video must be under 500 MB'); return; }
    setVideoFile(file);
    setClipMode('normal');
    setTutorialSteps(['', '', '']);
    setChallengeName('');
    setShowUpload(true);
    e.target.value = '';
  };

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUploadClip = async () => {
    if (!videoFile || !currentUser) return;
    setUploading(true);
    try {
      setUploadProgress(0);
      const videoUrl = await uploadVideoToStorage(videoFile, 'clips', pct => setUploadProgress(pct));
      const modePayload: any = { clipMode };
      if (clipMode === 'tutorial') modePayload.tutorialSteps = tutorialSteps.filter(s => s.trim());
      if (clipMode === 'challenge') {
        modePayload.challengeName = challengeName.trim() || 'Challenge';
        modePayload.challengeParticipants = 0;
      }
      const postRes = await authFetch(`${API}/posts`, {
        method: 'POST',
        body: JSON.stringify({
          user: currentUser, workoutType: 'Clip',
          duration: 0, calories: 0,
          caption: videoCaption.trim() || '', exercises: [], videoUrl,
          ...modePayload,
        }),
      });
      if (!postRes.ok) throw new Error('Failed to create post');
      toast.success('Clip uploaded! 🎬');
      setShowUpload(false); setVideoFile(null); setVideoCaption('');
      loadReels();
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Send timestamped comment ───────────────────────────────────────────────
  const sendTimestampComment = async () => {
    const reel = filteredReels[current];
    if (!currentUser || !newComment.trim() || !reel) return;
    setSendingComment(true);
    const optimistic: TimestampComment = {
      uid: currentUser.id, name: currentUser.name || 'You',
      avatar: currentUser.avatar || '', text: newComment.trim(),
      timestamp: Math.round(newCommentTs), createdAt: new Date().toISOString(),
    };
    setTsComments(prev => [...prev, optimistic].sort((a, b) => a.timestamp - b.timestamp));
    setNewComment('');
    try {
      await authFetch(`${API}/posts/${reel.id}/timestamp-comment`, {
        method: 'POST',
        body: JSON.stringify({ text: optimistic.text, timestamp: optimistic.timestamp }),
      });
    } catch { toast.error('Could not send comment'); }
    finally { setSendingComment(false); }
  };

  // ── Join challenge ──────────────────────────────────────────────────────────
  const handleJoinChallenge = async (reel: Reel) => {
    if (!currentUser) return toast.error('Log in to join');
    if (joinedChallenges.has(reel.id)) return;
    setJoiningChallenge(true);
    setJoinedChallenges(prev => new Set([...prev, reel.id]));
    setReels(prev => prev.map(r => r.id === reel.id
      ? { ...r, challengeParticipants: (r.challengeParticipants || 0) + 1 } : r));
    try {
      await authFetch(`${API}/posts/${reel.id}/join-challenge`, { method: 'POST' });
      toast.success('You joined the challenge! Record your clip 🎥');
    } catch {
      setJoinedChallenges(prev => { const n = new Set(prev); n.delete(reel.id); return n; });
      setReels(prev => prev.map(r => r.id === reel.id
        ? { ...r, challengeParticipants: Math.max(0, (r.challengeParticipants || 1) - 1) } : r));
    } finally { setJoiningChallenge(false); }
  };

  // ── Tutorial step from video time ──────────────────────────────────────────
  const getTutorialStep = (steps: string[], duration: number): number => {
    if (!steps.length || !duration) return 0;
    return Math.min(Math.floor((videoTime / Math.max(duration, 1)) * steps.length), steps.length - 1);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-[#c9a96e] animate-spin" />
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (reels.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] flex items-center justify-center">
          <Video className="w-7 h-7 text-[#c9a96e]" />
        </div>
        <div>
          <p className="text-white font-semibold text-base mb-1">No Clips Yet</p>
          <p className="text-white/35 text-sm max-w-xs">Upload a short workout video to share with the community.</p>
        </div>
        {currentUser && (
          <>
            <input ref={fileInputRef} type="file" accept="video/*,.mov,.mp4,.webm,.avi" className="hidden" onChange={handleVideoSelect} />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c9a96e] hover:bg-[#a07840] text-white text-sm font-medium transition-all">
              <Upload className="w-4 h-4" /> Upload Clip
            </button>
          </>
        )}
      </div>
    );
  }

  const reel       = filteredReels[current] ?? filteredReels[0] ?? reels[0];

  // Guard: if no reel available (e.g. following tab with no video posts), show empty state
  if (!reel || !reel.user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] flex items-center justify-center">
          <Video className="w-7 h-7 text-[#c9a96e]" />
        </div>
        <div>
          <p className="text-white font-semibold text-base mb-1">No Clips Here</p>
          <p className="text-white/35 text-sm max-w-xs">No video posts found in this tab yet.</p>
        </div>
      </div>
    );
  }
  const gradient   = GRADIENTS[current % GRADIENTS.length];
  const isLiked    = likedSet.has(reel.id);
  const mode       = reel.clipMode || 'normal';
  const modeBadge  = MODE_BADGE[mode];
  const activeSteps   = (reel.tutorialSteps || []).filter(s => s.trim());
  const videoDuration = videoRef.current?.duration || 0;
  const tutorialStep  = mode === 'tutorial' && activeSteps.length
    ? getTutorialStep(activeSteps, videoDuration) : -1;
  const activeTimestampComment = mode === 'formCheck'
    ? tsComments.filter(c => Math.abs(c.timestamp - videoTime) <= 2).slice(-1)[0] : null;
  const hashtags = extractHashtags(reel.caption || '');
  const hasStats = reel.duration > 0 || reel.calories > 0 || (reel.exercises?.length ?? 0) > 0;

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#080608] select-none">

      {/* ── Hidden file input ──────────────────────────────────────────────── */}
      <input ref={fileInputRef} type="file" accept="video/*,.mov,.mp4,.webm,.avi" className="hidden" onChange={handleVideoSelect} />

      {/* ── Tab bar + view-mode toggle ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 border-b border-[rgba(201,169,110,0.06)]">
        <div className="flex items-center gap-1">
          {(['forYou', 'following', 'trending'] as FeedTab[]).map(tab => {
            const labels: Record<FeedTab, string> = { forYou: 'For You', following: 'Following', trending: 'Trending' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  activeTab === tab
                    ? 'bg-[#c9a96e] text-white'
                    : 'text-white/45 hover:text-white/70 hover:bg-white/6'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setViewMode(v => v === 'feed' ? 'grid' : 'feed')}
          className="w-8 h-8 rounded-full bg-[rgba(201,169,110,0.08)] hover:bg-[rgba(201,169,110,0.16)] border border-[rgba(201,169,110,0.12)] flex items-center justify-center transition-all"
          title={viewMode === 'feed' ? 'Grid view' : 'Feed view'}
        >
          {viewMode === 'feed'
            ? <LayoutGrid className="w-3.5 h-3.5 text-[#c9a96e]" />
            : <LayoutList className="w-3.5 h-3.5 text-[#c9a96e]" />
          }
        </button>
      </div>

      {/* ── Option D: Grid view ────────────────────────────────────────────── */}
      {viewMode === 'grid' ? (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {filteredReels.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <p className="text-white/40 text-sm">No clips in this feed yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {filteredReels.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => { setCurrent(i); setViewMode('feed'); }}
                  className="relative rounded-xl overflow-hidden bg-[#0d0b08] border border-[rgba(201,169,110,0.08)] group"
                  style={{ aspectRatio: '9/16' }}
                >
                  {r.videoUrl ? (
                    <video src={r.videoUrl} className="absolute inset-0 w-full h-full object-cover" muted preload="metadata" />
                  ) : r.image ? (
                    <img src={r.image} alt="clip" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-b ${GRADIENTS[i % GRADIENTS.length]}`} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                  {r.clipMode && r.clipMode !== 'normal' && (
                    <div className="absolute top-1.5 left-1.5 text-[9px]">{MODE_BADGE[r.clipMode].emoji}</div>
                  )}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Heart className="w-2.5 h-2.5 text-white/70" />
                      <span className="text-white/70 text-[9px]">{r.likes || 0}</span>
                    </div>
                    {r.duration > 0 && <span className="text-white/50 text-[8px]">{r.duration}m</span>}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                      <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      ) : (

      /* ── Feed view ─────────────────────────────────────────────────────── */
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center gap-4 h-full py-6">

          {/* Prev arrow */}
          <button
            onClick={prev}
            disabled={current === 0}
            className="w-10 h-10 rounded-full bg-[rgba(201,169,110,0.06)] hover:bg-white/15 disabled:opacity-20 flex items-center justify-center transition-all shrink-0"
          >
            <ChevronUp className="w-5 h-5 text-white" />
          </button>

          {/* ── Phone-frame video card ──────────────────────────────────── */}
          <div
            className="relative flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-[rgba(201,169,110,0.12)]"
            style={{ width: 'min(360px, 38vw)', height: 'min(640px, 80vh)', minWidth: 260 }}
          >
            {/* Media */}
            {reel.videoUrl ? (
              <video
                ref={videoRef}
                src={reel.videoUrl}
                className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                loop playsInline
                webkit-playsinline="true"
                x-webkit-airplay="allow"
                preload="auto"
                muted={false}
                onClick={togglePlay}
              />
            ) : reel.image ? (
              <img src={reel.image} alt="clip" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-b ${gradient}`} />
            )}

            {/* Play overlay */}
            {reel.videoUrl && videoPaused && (
              <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center z-10">
                <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  <Play className="w-6 h-6 text-white fill-white ml-1" />
                </div>
              </button>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

            {/* Mode badge */}
            {mode !== 'normal' && (
              <div className="absolute top-4 left-3 z-20">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm ${modeBadge.bg} ${modeBadge.text} border border-[rgba(201,169,110,0.12)]`}>
                  <span>{modeBadge.emoji}</span><span>{modeBadge.label}</span>
                </span>
              </div>
            )}

            {/* Counter */}
            <div className="absolute top-4 right-3 text-white/50 text-[11px] font-medium z-10">
              {current + 1}/{filteredReels.length}
            </div>

            {/* ── Option C: Stats overlay pills ───────────────────────── */}
            {hasStats && (
              <div className="absolute top-12 left-0 right-0 z-20 px-3 pointer-events-none">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(reel.exercises?.length ?? 0) > 0 && (
                    <span className="flex items-center gap-1 bg-black/55 backdrop-blur-sm border border-[rgba(201,169,110,0.15)] px-2 py-0.5 rounded-full">
                      <Dumbbell className="w-2.5 h-2.5 text-[#c9a96e]" />
                      <span className="text-white text-[9px] font-medium">{reel.exercises.length} ex</span>
                    </span>
                  )}
                  {reel.duration > 0 && (
                    <span className="flex items-center gap-1 bg-black/55 backdrop-blur-sm border border-[rgba(201,169,110,0.15)] px-2 py-0.5 rounded-full">
                      <Clock className="w-2.5 h-2.5 text-white/60" />
                      <span className="text-white text-[9px] font-medium">{reel.duration}m</span>
                    </span>
                  )}
                  {reel.calories > 0 && (
                    <span className="flex items-center gap-1 bg-black/55 backdrop-blur-sm border border-[rgba(201,169,110,0.15)] px-2 py-0.5 rounded-full">
                      <Flame className="w-2.5 h-2.5 text-orange-400" />
                      <span className="text-white text-[9px] font-medium">{reel.calories} cal</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1 bg-[rgba(201,169,110,0.18)] border border-[rgba(201,169,110,0.35)] px-2 py-0.5 rounded-full">
                    <Zap className="w-2.5 h-2.5 text-[#c9a96e]" />
                    <span className="text-[#e8c98a] text-[9px] font-semibold">+30 XP</span>
                  </span>
                </div>
              </div>
            )}

            {/* Tutorial step overlay */}
            {tutorialStep >= 0 && activeSteps.length > 0 && (
              <div className="absolute top-14 left-0 right-0 z-20 flex flex-col items-center gap-1.5 pointer-events-none">
                <div className="flex items-center gap-1.5 px-3">
                  {activeSteps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 rounded-full transition-all duration-500 ${
                        i < tutorialStep ? 'bg-blue-400 flex-1' :
                        i === tutorialStep ? 'bg-white flex-[2]' :
                        'bg-white/25 flex-1'
                      }`}
                    />
                  ))}
                </div>
                <div className="bg-blue-600/80 backdrop-blur-sm border border-blue-400/30 px-3 py-1 rounded-full">
                  <p className="text-white text-xs font-semibold tracking-wide">
                    Step {tutorialStep + 1}: {activeSteps[tutorialStep]}
                  </p>
                </div>
              </div>
            )}

            {/* Timestamped comment popup */}
            {activeTimestampComment && !showComments && (
              <div className="absolute top-1/2 left-3 right-3 -translate-y-1/2 z-20 pointer-events-none">
                <div className="bg-black/70 backdrop-blur-sm border border-red-500/25 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={activeTimestampComment.avatar} />
                      <AvatarFallback className="bg-red-600 text-white text-[8px]">{activeTimestampComment.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-white/70 text-[10px] font-medium">{activeTimestampComment.name}</span>
                    <span className="ml-auto text-red-300 text-[9px]">{fmtTime(activeTimestampComment.timestamp)}</span>
                  </div>
                  <p className="text-white text-xs leading-relaxed">{activeTimestampComment.text}</p>
                </div>
              </div>
            )}

            {/* Challenge participant count */}
            {mode === 'challenge' && (reel.challengeParticipants || 0) > 0 && (
              <div className="absolute top-14 left-3 z-20 flex items-center gap-1 bg-orange-500/20 border border-orange-400/30 rounded-full px-2 py-0.5">
                <Trophy className="w-3 h-3 text-orange-300" />
                <span className="text-orange-200 text-[10px] font-semibold">{reel.challengeParticipants} joined</span>
              </div>
            )}

            {/* Form-check comment drawer */}
            {showComments && mode === 'formCheck' && (
              <div className="absolute inset-0 z-30 flex flex-col bg-black/85 backdrop-blur-sm">
                <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-[rgba(201,169,110,0.12)]">
                  <p className="text-white text-sm font-semibold">😭 Form Check Feedback</p>
                  <button onClick={() => setShowComments(false)} className="text-white/40 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
                  {tsComments.length === 0 && (
                    <p className="text-white/30 text-xs text-center mt-8">No feedback yet — be the first!</p>
                  )}
                  {tsComments.map((c, i) => (
                    <div key={i} className="flex gap-2">
                      <Avatar className="w-6 h-6 shrink-0">
                        <AvatarImage src={c.avatar} />
                        <AvatarFallback className="bg-red-600 text-white text-[8px]">{c.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-[rgba(201,169,110,0.04)] rounded-xl px-3 py-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-white/80 text-[10px] font-semibold">{c.name}</span>
                          <span className="ml-auto flex items-center gap-0.5 text-red-300 text-[9px]">
                            <Clock3 className="w-2.5 h-2.5" />{fmtTime(c.timestamp)}
                          </span>
                        </div>
                        <p className="text-white/70 text-[11px] leading-relaxed">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {currentUser && (
                  <div className="px-3 pb-4 pt-2 border-t border-[rgba(201,169,110,0.12)] space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock3 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="text-white/50 text-[10px]">At</span>
                      <input
                        type="number" min={0} max={Math.floor(videoDuration || 999)}
                        value={newCommentTs}
                        onChange={e => setNewCommentTs(Number(e.target.value))}
                        className="w-16 bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.12)] rounded-lg px-2 py-1 text-white text-[11px] text-center focus:outline-none focus:border-red-500/50"
                      />
                      <span className="text-white/50 text-[10px]">s = {fmtTime(newCommentTs)}</span>
                      <button
                        onClick={() => setNewCommentTs(Math.round(videoTime))}
                        className="ml-auto text-[9px] text-red-300 border border-red-500/30 rounded px-1.5 py-0.5 hover:bg-red-500/10 transition-colors"
                      >Use now</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendTimestampComment()}
                        placeholder="Your form tip..."
                        className="flex-1 bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-red-500/40"
                      />
                      <button
                        onClick={sendTimestampComment}
                        disabled={!newComment.trim() || sendingComment}
                        className="w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 disabled:opacity-40 flex items-center justify-center transition-all shrink-0"
                      >
                        {sendingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Send className="w-3.5 h-3.5 text-white" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Bottom info ──────────────────────────────────────────── */}
            <div className="absolute bottom-0 left-0 right-0 z-10 pb-3 pt-2 px-4 space-y-2">
              {/* User row + Option A: inline Follow button */}
              <div className="flex items-center gap-2">
                <button onClick={() => onViewProfile(reel.user.id)} className="flex items-center gap-2 group min-w-0 flex-1">
                  <Avatar className="w-8 h-8 ring-2 ring-white/20 shrink-0">
                    <AvatarImage src={reel.user.avatar} />
                    <AvatarFallback className="bg-[#c9a96e] text-white text-xs">{reel.user.name?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="text-left min-w-0">
                    <p className="text-white text-xs font-semibold group-hover:text-[#e8c98a] transition-colors leading-tight truncate">{reel.user.name}</p>
                    <p className="text-white/45 text-[10px]">@{reel.user.username}</p>
                  </div>
                </button>
                {currentUser && reel.user.id !== currentUser.id && (
                  <button
                    onClick={() => handleFollow(reel.user.id)}
                    disabled={followLoading.has(reel.user.id)}
                    className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-semibold transition-all border ${
                      followingSet.has(reel.user.id)
                        ? 'bg-[rgba(201,169,110,0.08)] border-[rgba(201,169,110,0.25)] text-[#c9a96e]'
                        : 'bg-[#c9a96e] border-transparent text-white'
                    }`}
                  >
                    {followLoading.has(reel.user.id)
                      ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      : followingSet.has(reel.user.id)
                        ? <><UserCheck className="w-2.5 h-2.5" /><span>Following</span></>
                        : <><UserPlus className="w-2.5 h-2.5" /><span>Follow</span></>
                    }
                  </button>
                )}
              </div>

              {/* Challenge name */}
              {mode === 'challenge' && reel.challengeName && (
                <div className="flex items-center gap-1.5">
                  <Swords className="w-3 h-3 text-orange-400" />
                  <span className="text-orange-200 text-xs font-semibold">{reel.challengeName}</span>
                </div>
              )}

              {/* Caption */}
              {reel.caption && (
                <RichText text={reel.caption} onHashtag={onHashtag} className="text-white/80 text-xs leading-relaxed line-clamp-2" />
              )}

              {/* Option B: Hashtag chips */}
              {hashtags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {hashtags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => onHashtag?.(tag)}
                      className="text-[#c9a96e] text-[9px] font-medium bg-[rgba(201,169,110,0.10)] px-2 py-0.5 rounded-full hover:bg-[rgba(201,169,110,0.20)] transition-colors"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Option A: Scrub bar ──────────────────────────────────── */}
            {reel.videoUrl && (
              <div
                className="absolute bottom-0 left-0 right-0 z-20 h-1 bg-white/15 cursor-pointer group"
                onClick={handleScrubClick}
              >
                <div className="h-full bg-[#c9a96e] relative transition-none" style={{ width: `${videoProgress * 100}%` }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#e8c98a] opacity-0 group-hover:opacity-100 transition-opacity -mr-1.5" />
                </div>
              </div>
            )}
          </div>

          {/* ── Option B: Enhanced right action column ─────────────────── */}
          <div className="flex flex-col items-center gap-4 shrink-0">

            {/* Creator avatar + follow badge */}
            <div className="relative flex flex-col items-center pb-2">
              <button onClick={() => onViewProfile(reel.user.id)} className="group">
                <Avatar className="w-12 h-12 ring-2 ring-[rgba(201,169,110,0.35)] group-hover:ring-[rgba(201,169,110,0.6)] transition-all">
                  <AvatarImage src={reel.user.avatar} />
                  <AvatarFallback className="bg-[#c9a96e] text-white text-sm font-semibold">{reel.user.name?.[0] || '?'}</AvatarFallback>
                </Avatar>
              </button>
              {currentUser && reel.user.id !== currentUser.id && !followingSet.has(reel.user.id) && (
                <button
                  onClick={() => handleFollow(reel.user.id)}
                  className="absolute -bottom-0 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#c9a96e] hover:bg-[#e8c98a] flex items-center justify-center border-2 border-[#080608] transition-all"
                >
                  <Plus className="w-3 h-3 text-white" />
                </button>
              )}
            </div>

            {/* Like */}
            <button onClick={() => handleLike(reel)} className="flex flex-col items-center gap-1 group">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all
                ${isLiked ? 'bg-red-500/20' : 'bg-[rgba(201,169,110,0.06)] hover:bg-white/15'}`}>
                <Heart className={`w-5 h-5 transition-all ${isLiked ? 'fill-red-400 text-red-400 scale-110' : 'text-white/70'}`} />
              </div>
              <span className="text-white/55 text-[10px] font-medium">{reel.likes || 0}</span>
            </button>

            {/* Comments */}
            <button
              className="flex flex-col items-center gap-1 group"
              onClick={() => {
                if (mode === 'formCheck') { setNewCommentTs(Math.round(videoTime)); setShowComments(v => !v); }
              }}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all
                ${mode === 'formCheck' ? 'bg-red-500/15 hover:bg-red-500/30 border border-red-500/30' : 'bg-[rgba(201,169,110,0.06)] hover:bg-white/15'}`}>
                <MessageCircle className={`w-5 h-5 ${mode === 'formCheck' ? 'text-red-300' : 'text-white/70'}`} />
              </div>
              <span className="text-white/55 text-[10px] font-medium">
                {mode === 'formCheck' ? tsComments.length : reel.comments?.length || 0}
              </span>
            </button>

            {/* Challenge join */}
            {mode === 'challenge' && currentUser && reel.user.id !== currentUser.id && (
              <button
                onClick={() => handleJoinChallenge(reel)}
                disabled={joiningChallenge || joinedChallenges.has(reel.id)}
                className="flex flex-col items-center gap-1 group"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border
                  ${joinedChallenges.has(reel.id)
                    ? 'bg-orange-500/25 border-orange-400/50'
                    : 'bg-[rgba(201,169,110,0.06)] hover:bg-orange-500/20 border-orange-500/25 hover:border-orange-400/50'
                  }`}>
                  {joinedChallenges.has(reel.id)
                    ? <CheckCircle2 className="w-5 h-5 text-orange-300" />
                    : joiningChallenge
                      ? <Loader2 className="w-4 h-4 animate-spin text-orange-300" />
                      : <Swords className="w-5 h-5 text-orange-300" />
                  }
                </div>
                <span className="text-orange-300/70 text-[10px] font-medium">
                  {joinedChallenges.has(reel.id) ? 'Joined' : 'Join'}
                </span>
              </button>
            )}

            {/* Tutorial step indicator */}
            {mode === 'tutorial' && activeSteps.length > 0 && (
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-blue-300" />
                </div>
                <span className="text-blue-300/70 text-[10px] font-medium">
                  {tutorialStep + 1}/{activeSteps.length}
                </span>
              </div>
            )}

            {/* Share */}
            <button
              onClick={() => { navigator.clipboard.writeText(window.location.href).then(() => toast.success('Link copied!')); }}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-12 h-12 rounded-full bg-[rgba(201,169,110,0.06)] hover:bg-white/15 flex items-center justify-center transition-all">
                <Share2 className="w-5 h-5 text-white/70" />
              </div>
              <span className="text-white/55 text-[10px] font-medium">Share</span>
            </button>

            {/* Upload */}
            {currentUser && (
              <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 group">
                <div className="w-12 h-12 rounded-full bg-[#c9a96e]/25 hover:bg-[#c9a96e]/45 border border-[rgba(201,169,110,0.25)] flex items-center justify-center transition-all">
                  <Upload className="w-4 h-4 text-[#e8c98a]" />
                </div>
                <span className="text-[#e8c98a]/70 text-[10px] font-medium">Upload</span>
              </button>
            )}
          </div>

          {/* Next arrow */}
          <button
            onClick={next}
            disabled={current === filteredReels.length - 1}
            className="w-10 h-10 rounded-full bg-[rgba(201,169,110,0.06)] hover:bg-white/15 disabled:opacity-20 flex items-center justify-center transition-all shrink-0"
          >
            <ChevronDown className="w-5 h-5 text-white" />
          </button>

        </div>

        {/* Dot progress indicators */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
          {filteredReels.slice(Math.max(0, current - 4), Math.min(filteredReels.length, current + 5)).map((_, i) => {
            const idx = Math.max(0, current - 4) + i;
            return (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                className={`rounded-full transition-all ${idx === current ? 'w-1.5 h-4 bg-[#c9a96e]' : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'}`}
              />
            );
          })}
        </div>

      </div>
      )} {/* end feed / grid toggle */}

      {/* ── Upload modal ──────────────────────────────────────────────────────── */}
      {showUpload && videoFile && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl p-5 space-y-4 mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">Upload Clip</p>
              <button onClick={() => { setShowUpload(false); setVideoFile(null); }} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 bg-[rgba(201,169,110,0.04)] rounded-xl px-4 py-3">
              <Video className="w-5 h-5 text-[#c9a96e] shrink-0" />
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{videoFile.name}</p>
                <p className="text-white/40 text-xs">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</p>
              </div>
            </div>
            <textarea
              value={videoCaption}
              onChange={e => setVideoCaption(e.target.value)}
              placeholder="Describe your workout..."
              rows={2}
              className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/25 resize-none focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
            />
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2.5">Clip Type</p>
              <div className="grid grid-cols-2 gap-2">
                {CLIP_MODES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setClipMode(m.id)}
                    className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      clipMode === m.id
                        ? m.id === 'formCheck' ? 'bg-red-500/15 border-red-500/50'
                          : m.id === 'tutorial' ? 'bg-blue-500/15 border-blue-500/50'
                          : m.id === 'challenge' ? 'bg-orange-500/15 border-orange-500/50'
                          : 'bg-[#c9a96e]/15 border-[rgba(201,169,110,0.5)]'
                        : 'bg-white/4 border-[rgba(201,169,110,0.12)] hover:bg-[rgba(201,169,110,0.06)]'
                    }`}
                  >
                    <span className="text-base leading-none">{m.emoji}</span>
                    <span className={`text-xs font-semibold ${clipMode === m.id ? 'text-white' : 'text-white/60'}`}>{m.label}</span>
                    <span className="text-[9px] text-white/35 leading-tight">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            {clipMode === 'tutorial' && (
              <div>
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Step Labels</p>
                <div className="space-y-2">
                  {tutorialSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-blue-300 text-xs font-bold w-14 shrink-0">Step {i + 1}</span>
                      <input
                        value={step}
                        onChange={e => setTutorialSteps(prev => prev.map((s, j) => j === i ? e.target.value : s))}
                        placeholder={`e.g. ${['Set up', 'Engage core', 'Full rep'][i] || 'Step'}`}
                        className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-3 py-1.5 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
                      />
                    </div>
                  ))}
                  {tutorialSteps.length < 6 && (
                    <button onClick={() => setTutorialSteps(p => [...p, ''])} className="text-blue-300/60 text-xs hover:text-blue-300 transition-colors">
                      + Add step
                    </button>
                  )}
                </div>
              </div>
            )}
            {clipMode === 'challenge' && (
              <div>
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Challenge Name</p>
                <input
                  value={challengeName}
                  onChange={e => setChallengeName(e.target.value)}
                  placeholder="e.g. 100 Rep Squat Challenge"
                  className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-orange-500/50"
                />
                <p className="text-white/30 text-[10px] mt-1.5">Others can join and record their own attempt</p>
              </div>
            )}
            {clipMode === 'formCheck' && (
              <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5">
                <p className="text-red-300 text-xs font-medium mb-0.5">😭 Ask for feedback</p>
                <p className="text-white/40 text-[10px] leading-relaxed">Viewers can leave timed comments at specific seconds.</p>
              </div>
            )}
            {uploading && uploadProgress > 0 && (
              <div>
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span>Uploading…</span><span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-[rgba(201,169,110,0.08)] rounded-full h-1.5">
                  <div
                    className="bg-[#c9a96e] h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            <button
              onClick={handleUploadClip}
              disabled={uploading}
              className="w-full py-2.5 rounded-xl bg-[#c9a96e] text-[#0a0806] text-sm font-bold hover:bg-[#e8c98a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? `Uploading ${uploadProgress}%…` : 'Upload Clip'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
