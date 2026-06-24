// ClipsPage.tsx — TikTok desktop layout (centered vertical card)
import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, MessageCircle, Share2, Upload, X, Play, VolumeX, Volume2, Send, Loader2, Eye, Bookmark, BookmarkCheck, ChevronUp, ChevronDown, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { API } from '../../config';
import { User } from '../types';
import { toast } from 'sonner';

interface Clip {
  id: string;
  videoUrl: string;
  caption?: string;
  user: { id: string; name: string; username: string; avatar?: string };
  likes: number;
  likedBy: string[];
  views: number;
  comments: ClipComment[];
  createdAt: string;
}
interface ClipComment {
  id: string;
  user: { id: string; name: string; avatar?: string };
  text: string;
  createdAt: string;
}
interface Props { currentUser: User | null; onViewProfile?: (uid: string) => void; onHashtag?: (tag: string) => void; }

function Caption({ text }: { text: string }) {
  const parts = text.split(/(#\w+)/g);
  return (
    <span>
      {parts.map((p, i) => p.startsWith('#')
        ? <span key={i} className="text-[#c9a96e] font-semibold">{p}</span>
        : p)}
    </span>
  );
}

function FloatingHeart({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 900); return () => clearTimeout(t); }, []);
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
      <Heart className="text-red-500 fill-red-500" style={{ width: 90, height: 90, opacity: 0, animation: 'heartPop 0.8s ease-out forwards' }} />
      <style>{`@keyframes heartPop{0%{opacity:0;transform:scale(0.5)}40%{opacity:1;transform:scale(1.3)}70%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.1)}}`}</style>
    </div>
  );
}

function ClipCard({ clip, active, currentUser, onLike, onFollow, followingSet, onPrev, onNext, hasPrev, hasNext, nextClip, savedSet, onSave, onDelete, onEditCaption, onViewProfile }: {
  clip: Clip; active: boolean; currentUser: User | null;
  onLike: (id: string) => void; onFollow: (uid: string) => void; followingSet: Set<string>;
  onPrev: () => void; onNext: () => void; hasPrev: boolean; hasNext: boolean;
  nextClip?: Clip; savedSet: Set<string>;
  onSave: (id: string) => void; onDelete: (id: string) => void; onEditCaption: (id: string, current: string) => void;
  onViewProfile?: (uid: string) => void;
}) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const rafRef    = useRef<number>(0);
  const lastTap   = useRef(0);
  const viewedRef = useRef(false);
  const [paused,  setPaused]  = useState(false);
  const [muted,   setMuted]   = useState(true);
  const [showCom, setShowCom] = useState(false);
  const [comments,setComments]= useState<ClipComment[]>(clip.comments || []);
  const [newCom,  setNewCom]  = useState('');
  const [sending, setSending] = useState(false);
  const [progress,setProgress]= useState(0);
  const [views,   setViews]   = useState(clip.views || 0);
  const [showHeart,setShowHeart] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const liked     = currentUser ? (clip.likedBy || []).includes(currentUser.id) : false;
  const isSaved   = savedSet.has(clip.id);
  const isOwnClip = currentUser?.id === clip.user.id;
  const isFollowing = followingSet.has(clip.user.id);
  const fmtN = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) { v.currentTime = 0; v.play().catch(() => {}); setPaused(false); viewedRef.current = false; }
    else { v.pause(); cancelAnimationFrame(rafRef.current); }
  }, [active]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !active) return;
    const tick = () => {
      if (v.duration) {
        setProgress(v.currentTime / v.duration);
        if (!viewedRef.current && v.currentTime >= 3) {
          viewedRef.current = true;
          setViews(n => n + 1);
          authFetch(`${API}/posts/${clip.id}/view`, { method: 'POST' }).catch(() => {});
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, clip.id]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) { if (!liked) { onLike(clip.id); setShowHeart(true); } }
    else { togglePlay(); }
    lastTap.current = now;
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - r.left) / r.width) * v.duration;
  };

  const sendComment = async () => {
    if (!currentUser || !newCom.trim()) return;
    setSending(true);
    const opt: ClipComment = { id: `c_${Date.now()}`, user: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }, text: newCom.trim(), createdAt: new Date().toISOString() };
    setComments(p => [...p, opt]);
    setNewCom('');
    try { await authFetch(`${API}/posts/${clip.id}/comment`, { method: 'POST', body: JSON.stringify({ text: opt.text }) }); }
    catch { toast.error('Could not post comment'); }
    finally { setSending(false); }
  };

  return (
    <div className="w-full h-full relative">
      {/* Centered wrapper — translate(-50%,-50%) ensures perfect centering regardless of sidebar */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 390 }}>
      {/* ── Video card ── */}
      <div className="relative rounded-xl overflow-hidden bg-black w-full"
        style={{ height: '85vh', maxHeight: 780, boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}>

        {/* Video */}
        <video ref={videoRef} src={clip.videoUrl}
          className="absolute inset-0 w-full h-full object-cover cursor-pointer"
          loop playsInline muted={muted} onClick={handleTap} />

        {/* Floating heart */}
        {showHeart && <FloatingHeart onDone={() => setShowHeart(false)} />}

        {/* Gradient */}
        <div className="absolute inset-0 pointer-events-none rounded-xl"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.0) 45%, rgba(0,0,0,0.15) 100%)' }} />

        {/* Pause icon */}
        {paused && !showCom && (
          <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-14 h-14 rounded-full bg-black/40 flex items-center justify-center">
              <Play className="w-7 h-7 text-white fill-white ml-1" />
            </div>
          </button>
        )}

        {/* Mute — top left */}
        <button onClick={e => { e.stopPropagation(); setMuted(m => !m); }}
          className="absolute top-3 left-3 z-20 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center">
          {muted ? <VolumeX className="w-3.5 h-3.5 text-white" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
        </button>

        {/* Bottom info */}
        <div className="absolute bottom-5 left-4 right-4 z-10 space-y-1">
          <p className="text-white font-bold text-[15px] cursor-pointer w-fit" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
            onClick={() => onViewProfile?.(clip.user.id)}>
            @{clip.user.username || clip.user.name}
          </p>
          {clip.caption && (
            <p className="text-white/90 text-[13px] leading-snug" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              <Caption text={clip.caption} />
            </p>
          )}
          <div className="flex items-center gap-1 pt-0.5">
            <Eye className="w-3 h-3 text-white/50" />
            <span className="text-white/50 text-[11px]">{fmtN(views)} views</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 z-20 h-0.5 bg-white/15 cursor-pointer rounded-b-xl"
          onClick={e => { e.stopPropagation(); handleScrub(e); }}>
          <div className="h-full bg-[#c9a96e] rounded-b-xl" style={{ width: `${progress * 100}%`, transition: 'none' }} />
        </div>

        {/* Comments drawer */}
        {showCom && (
          <div className="absolute inset-x-0 bottom-0 z-30 rounded-b-xl flex flex-col"
            style={{ background: '#0d0b08', height: '62%' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <span className="text-white font-semibold text-sm">Comments ({comments.length})</span>
              <button onClick={() => setShowCom(false)}><X className="w-4 h-4 text-white/50" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
              {comments.length === 0 && <p className="text-white/30 text-sm text-center mt-8">No comments yet</p>}
              {comments.map(c => (
                <div key={c.id} className="flex gap-2">
                  {c.user?.avatar
                    ? <img src={c.user.avatar} className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" />
                    : <div className="w-7 h-7 rounded-full bg-[#c9a96e] flex items-center justify-center text-white text-[10px] font-bold shrink-0">{c.user?.name?.[0] ?? '?'}</div>
                  }
                  <div>
                    <span className="text-white/60 text-xs font-medium mr-1.5">{c.user?.name ?? 'Unknown'}</span>
                    <span className="text-white/90 text-xs">{c.text}</span>
                  </div>
                </div>
              ))}
            </div>
            {currentUser && (
              <div className="flex items-center gap-2 px-4 py-3 border-t border-white/8">
                <input value={newCom} onChange={e => setNewCom(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendComment()}
                  placeholder="Add a comment…"
                  className="flex-1 bg-white/6 border border-white/10 rounded-full px-4 py-2 text-white text-xs placeholder:text-white/30 focus:outline-none" />
                <button onClick={sendComment} disabled={!newCom.trim() || sending}
                  className="w-8 h-8 rounded-full bg-[#c9a96e] disabled:opacity-40 flex items-center justify-center">
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-black" /> : <Send className="w-3.5 h-3.5 text-black" />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right action column — absolute so it doesn't affect centering ── */}
      <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-5 select-none"
        style={{ left: '100%', marginLeft: 20, minWidth: 64 }}>

        {/* Avatar + follow */}
        <div className="relative mb-1">
          <div onClick={() => onViewProfile?.(clip.user.id)} className="cursor-pointer">
            {clip.user.avatar
              ? <img src={clip.user.avatar} className="w-12 h-12 rounded-full object-cover border-2 border-white" />
              : <div className="w-12 h-12 rounded-full bg-[#c9a96e] flex items-center justify-center text-white font-bold text-lg border-2 border-white">{clip.user.name?.[0]}</div>
            }
          </div>
          {currentUser && !isOwnClip && (
            <button onClick={() => onFollow(clip.user.id)}
              className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-black flex items-center justify-center text-white font-bold text-xs transition-all ${isFollowing ? 'bg-gray-500' : 'bg-[#c9a96e]'}`}>
              {isFollowing ? '✓' : '+'}
            </button>
          )}
        </div>

        {/* Like */}
        <button onClick={() => onLike(clip.id)} className="flex flex-col items-center gap-1">
          <Heart className={`w-9 h-9 transition-all drop-shadow-lg ${liked ? 'text-red-500 fill-red-500' : 'text-white'}`} />
          <span className="text-white text-xs font-semibold drop-shadow">{fmtN(clip.likes || 0)}</span>
        </button>

        {/* Comment */}
        <button onClick={() => setShowCom(v => !v)} className="flex flex-col items-center gap-1">
          <MessageCircle className="w-9 h-9 text-white drop-shadow-lg" />
          <span className="text-white text-xs font-semibold drop-shadow">{comments.length}</span>
        </button>

        {/* Bookmark / Save */}
        <button onClick={() => onSave(clip.id)} className="flex flex-col items-center gap-1">
          {isSaved
            ? <BookmarkCheck className="w-9 h-9 text-[#c9a96e] fill-[#c9a96e] drop-shadow-lg" />
            : <Bookmark className="w-9 h-9 text-white drop-shadow-lg" />}
          <span className={`text-xs font-semibold drop-shadow ${isSaved ? 'text-[#c9a96e]' : 'text-white'}`}>
            {isSaved ? 'Saved' : 'Save'}
          </span>
        </button>

        {/* Share */}
        <button onClick={() => {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(clip.videoUrl).then(() => toast.success('Link copied!'));
          } else {
            toast.success('Link: ' + clip.videoUrl);
          }
        }}
          className="flex flex-col items-center gap-1">
          <Share2 className="w-8 h-8 text-white drop-shadow-lg" />
          <span className="text-white text-xs font-semibold drop-shadow">Share</span>
        </button>

        {/* 3-dot menu — only for own clips */}
        {isOwnClip && (
          <div className="relative">
            <button onClick={() => setShowMenu(v => !v)} className="flex flex-col items-center gap-1">
              <MoreHorizontal className="w-8 h-8 text-white drop-shadow-lg" />
              <span className="text-white text-xs font-semibold drop-shadow">More</span>
            </button>
            {showMenu && (
              <div className="absolute right-12 bottom-0 w-40 rounded-xl overflow-hidden z-50 border border-white/10"
                style={{ background: '#1a1814' }}>
                <button
                  onClick={() => { setShowMenu(false); onEditCaption(clip.id, clip.caption || ''); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-white/80 hover:bg-white/5 text-sm transition-colors">
                  <Pencil className="w-4 h-4 text-white/50" /> Edit caption
                </button>
                <button
                  onClick={() => { setShowMenu(false); onDelete(clip.id); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-red-400 hover:bg-red-500/10 text-sm transition-colors border-t border-white/5">
                  <Trash2 className="w-4 h-4" /> Delete clip
                </button>
              </div>
            )}
          </div>
        )}

        {/* Nav arrows */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <button onClick={onPrev} disabled={!hasPrev}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-20 hover:bg-white/20 transition-colors">
            <ChevronUp className="w-5 h-5 text-white" />
          </button>
          <button onClick={onNext} disabled={!hasNext}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-20 hover:bg-white/20 transition-colors">
            <ChevronDown className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Next clip thumbnail */}
        {nextClip && (
          <div onClick={onNext} className="cursor-pointer rounded-lg overflow-hidden mt-1 opacity-70 hover:opacity-100 transition-opacity"
            style={{ width: 52, height: 72 }}>
            <video src={nextClip.videoUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
          </div>
        )}
      </div>
      </div>{/* end wrapper */}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function ReelsPage({ currentUser, onViewProfile, onHashtag }: Props) {
  const [allClips,   setAllClips]   = useState<Clip[]>([]);
  const [tab,        setTab]        = useState<'foryou'|'following'>('foryou');
  const [current,    setCurrent]    = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [uploading,  setUploading]  = useState(false);
  const [upProgress, setUpProgress] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [caption,    setCaption]    = useState('');
  const [videoFile,  setVideoFile]  = useState<File | null>(null);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [savedSet,  setSavedSet]  = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('flex_saved_clips') || '[]')); } catch { return new Set(); }
  });
  const [editingClip, setEditingClip] = useState<{ id: string; caption: string } | null>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const isAnimating = useRef(false);
  const touchY      = useRef(0);

  const clips = tab === 'following'
    ? allClips.filter(c => followingSet.has(c.user.id) || c.user.id === currentUser?.id)
    : allClips;

  const fetchClips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/reels?limit=50`);
      if (res.ok) { const d = await res.json(); setAllClips(d.reels || []); }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClips(); }, [fetchClips]);

  useEffect(() => {
    if (!currentUser?.id) return;
    authFetch(`${API}/users/${currentUser.id}/following`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.following) setFollowingSet(new Set((d.following as any[]).map((u: any) => u.id || u))); })
      .catch(() => {});
  }, [currentUser?.id]);

  useEffect(() => { setCurrent(0); }, [tab]);

  const navigate = useCallback((dir: 1 | -1) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    setCurrent(p => Math.min(Math.max(p + dir, 0), clips.length - 1));
    setTimeout(() => { isAnimating.current = false; }, 420);
  }, [clips.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') navigate(1);
      if (e.key === 'ArrowUp')   navigate(-1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [navigate]);

  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 5) return;
    navigate(e.deltaY > 0 ? 1 : -1);
  };

  const handleLike = async (id: string) => {
    if (!currentUser) return;
    setAllClips(prev => prev.map(c => {
      if (c.id !== id) return c;
      const liked = (c.likedBy || []).includes(currentUser.id);
      return { ...c, likes: liked ? c.likes - 1 : c.likes + 1,
        likedBy: liked ? c.likedBy.filter(u => u !== currentUser.id) : [...(c.likedBy||[]), currentUser.id] };
    }));
    try { await authFetch(`${API}/posts/${id}/like`, { method: 'POST' }); } catch {}
  };

  const handleFollow = async (uid: string) => {
    if (!currentUser) return;
    const was = followingSet.has(uid);
    setFollowingSet(prev => { const n = new Set(prev); was ? n.delete(uid) : n.add(uid); return n; });
    try { await authFetch(`${API}/users/${uid}/follow`, { method: 'POST' }); }
    catch { setFollowingSet(prev => { const n = new Set(prev); was ? n.add(uid) : n.delete(uid); return n; }); }
  };

  const handleSave = (id: string) => {
    setSavedSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast('Removed from saved'); }
      else { next.add(id); toast.success('Clip saved! 🔖'); }
      localStorage.setItem('flex_saved_clips', JSON.stringify([...next]));
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this clip? This cannot be undone.')) return;
    try {
      await authFetch(`${API}/posts/${id}`, { method: 'DELETE' });
      setAllClips(prev => prev.filter(c => c.id !== id));
      setCurrent(p => Math.max(0, p - 1));
      toast.success('Clip deleted');
    } catch { toast.error('Could not delete clip'); }
  };

  const handleEditCaption = (id: string, caption: string) => {
    setEditingClip({ id, caption });
  };

  const saveEditCaption = async () => {
    if (!editingClip) return;
    try {
      await authFetch(`${API}/posts/${editingClip.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ caption: editingClip.caption }),
      });
      setAllClips(prev => prev.map(c => c.id === editingClip.id ? { ...c, caption: editingClip.caption } : c));
      toast.success('Caption updated!');
    } catch { toast.error('Could not update caption'); }
    finally { setEditingClip(null); }
  };

  const handleUpload = async () => {
    if (!videoFile || !currentUser) return;
    setUploading(true); setUpProgress(10);
    try {
      const token = localStorage.getItem('fitconnect_id_token') || '';
      const upRes = await fetch(`${API}/upload-video?filename=${encodeURIComponent(videoFile.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${token}` },
        body: videoFile,
      });
      setUpProgress(75);
      if (!upRes.ok) throw new Error('Upload failed');
      const { url: videoUrl } = await upRes.json();
      setUpProgress(90);
      const postRes = await authFetch(`${API}/posts`, {
        method: 'POST',
        body: JSON.stringify({ videoUrl, caption: caption.trim() || undefined, workoutType: 'Clip', duration: 0, calories: 0, isClip: true,
          user: { id: currentUser.id, name: currentUser.name, username: currentUser.username, avatar: currentUser.avatar } }),
      });
      if (!postRes.ok) throw new Error('Failed to save clip');
      const saved = await postRes.json();
      setUpProgress(100);
      toast.success('Clip posted! 🎬');
      setAllClips(p => [{ id: saved.id || `c_${Date.now()}`, videoUrl, caption: caption.trim() || undefined,
        user: { id: currentUser.id, name: currentUser.name, username: currentUser.username, avatar: currentUser.avatar },
        likes: 0, likedBy: [], views: 0, comments: [], createdAt: new Date().toISOString() }, ...p]);
      setCurrent(0); setTab('foryou'); setShowUpload(false); setCaption(''); setVideoFile(null);
    } catch (e: any) { toast.error(e.message || 'Upload failed'); }
    finally { setUploading(false); setUpProgress(0); }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col"
      onWheel={onWheel}
      onTouchStart={e => { touchY.current = e.touches[0].clientY; }}
      onTouchEnd={e => { const d = touchY.current - e.changedTouches[0].clientY; if (Math.abs(d) > 50) navigate(d > 0 ? 1 : -1); }}>

      {/* Tabs */}
      <div className="flex-shrink-0 flex items-center justify-center pt-4 pb-2 gap-2 z-30">
        {(['foryou','following'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-6 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === t ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
            {t === 'foryou' ? 'For You' : 'Following'}
          </button>
        ))}
        {/* Upload button */}
        {currentUser && (
          <button onClick={() => setShowUpload(true)}
            className="absolute right-5 top-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <Upload className="w-4 h-4 text-white" />
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#c9a96e] animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && clips.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-white/40 text-lg">{tab === 'following' ? 'Follow someone to see clips' : 'No clips yet'}</p>
          {currentUser && tab === 'foryou' && (
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#c9a96e] text-black font-semibold text-sm">
              <Upload className="w-4 h-4" /> Upload First Clip
            </button>
          )}
        </div>
      )}

      {/* Clip stack */}
      {!loading && clips.length > 0 && (
        <div className="flex-1 relative overflow-hidden">
          {clips.map((clip, i) => (
            <div key={clip.id}
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `translateY(${(i - current) * 100}%)`, transition: 'transform 0.32s ease' }}>
              <ClipCard
                clip={clip} active={i === current} currentUser={currentUser}
                onLike={handleLike} onFollow={handleFollow} followingSet={followingSet}
                onPrev={() => setCurrent(c => Math.max(0, c - 1))}
                onNext={() => setCurrent(c => Math.min(clips.length - 1, c + 1))}
                hasPrev={i > 0} hasNext={i < clips.length - 1}
                nextClip={clips[i + 1]}
                savedSet={savedSet}
                onSave={handleSave}
                onDelete={handleDelete}
                onEditCaption={handleEditCaption}
                onViewProfile={onViewProfile}
              />
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
