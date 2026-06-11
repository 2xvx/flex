// Stories.tsx
// 24-hour story ring row + viewer overlay + add-story button.
import { useState, useEffect, useRef } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Upload, Bookmark } from 'lucide-react';
import { User } from '../types';
import { authFetch, uploadImage } from '../../utils/authToken';
import { toast } from 'sonner';

import { API } from '../../config';

interface Story {
  id: string;
  userId: string;
  user: { id: string; name: string; username: string; avatar: string };
  imageUrl: string;
  caption?: string;
  createdAt: string;
  expiresAt: string;
  views: string[];
}

interface StoryGroup {
  user: { id: string; name: string; username: string; avatar: string };
  stories: Story[];
}

interface Props {
  currentUser: User | null;
}

export function Stories({ currentUser }: Props) {
  const [groups,       setGroups]       = useState<StoryGroup[]>([]);
  const [highlights,   setHighlights]   = useState<any[]>([]);
  const [showHLPicker, setShowHLPicker] = useState(false);
  const [hlStory,      setHlStory]      = useState<Story | null>(null);
  const [viewing,      setViewing]      = useState<{ groupIdx: number; storyIdx: number } | null>(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [caption,      setCaption]      = useState('');
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const [progress,     setProgress]     = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchStories();
  }, []);

  // Auto-advance story every 5 seconds
  useEffect(() => {
    if (viewing === null) { if (timerRef.current) clearInterval(timerRef.current); return; }
    setProgress(0);
    timerRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { advanceStory(); return 0; }
        return p + 2; // 5s total (100 / 2 = 50 ticks × 100ms)
      });
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [viewing?.groupIdx, viewing?.storyIdx]);

  // Load own highlights for "Add to Highlight" picker
  useEffect(() => {
    if (!currentUser) return;
    fetch(`${API}/users/${currentUser.id}/highlights`)
      .then(r => r.ok ? r.json() : { highlights: [] })
      .then(d => setHighlights(d.highlights || []))
      .catch(() => {});
  }, [currentUser]);

  const fetchStories = async () => {
    try {
      const res = await authFetch(`${API}/stories`);
      if (!res.ok) return;
      const data = await res.json();
      setGroups(data.storyGroups || []);
    } catch {}
  };

  const advanceStory = () => {
    if (!viewing) return;
    const group = groups[viewing.groupIdx];
    if (viewing.storyIdx < group.stories.length - 1) {
      setViewing({ ...viewing, storyIdx: viewing.storyIdx + 1 });
    } else if (viewing.groupIdx < groups.length - 1) {
      setViewing({ groupIdx: viewing.groupIdx + 1, storyIdx: 0 });
    } else {
      setViewing(null);
    }
  };

  const prevStory = () => {
    if (!viewing) return;
    if (viewing.storyIdx > 0) {
      setViewing({ ...viewing, storyIdx: viewing.storyIdx - 1 });
    } else if (viewing.groupIdx > 0) {
      const prevGroup = groups[viewing.groupIdx - 1];
      setViewing({ groupIdx: viewing.groupIdx - 1, storyIdx: prevGroup.stories.length - 1 });
    }
  };

  const openStory = (groupIdx: number) => {
    setViewing({ groupIdx, storyIdx: 0 });
    // Mark first story as viewed
    const story = groups[groupIdx].stories[0];
    authFetch(`${API}/stories/${story.id}/view`, { method: 'POST' }).catch(() => {});
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPreviewUrl(ev.target?.result as string);
      setShowAdd(true);
    };
    reader.readAsDataURL(file);
  };

  // Resize a base64 image to max 800px wide so it fits in Firestore if upload fails
  const resizeBase64 = (dataUrl: string, maxW = 800): Promise<string> =>
    new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const scale  = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = img.width  * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  const handlePost = async () => {
    if (!previewUrl || !currentUser) return;
    setUploading(true);
    try {
      // Try to upload to server; fall back to storing a resized base64 in Firestore
      let imageUrl = await uploadImage(previewUrl, 'stories');
      if (!imageUrl) {
        // Fallback: resize to ≤800px and store data URL directly (< 1 MB in Firestore)
        imageUrl = await resizeBase64(previewUrl, 800);
      }
      const res = await authFetch(`${API}/stories`, {
        method: 'POST',
        body: JSON.stringify({ imageUrl, caption }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to post story');
      }
      toast.success('Story posted! 📸');
      setShowAdd(false);
      setPreviewUrl(null);
      setCaption('');
      fetchStories();
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const currentStory = viewing !== null ? groups[viewing.groupIdx]?.stories[viewing.storyIdx] : null;

  if (groups.length === 0 && !currentUser) return null;

  return (
    <>
      {/* Story ring row */}
      <div className="flex gap-3 px-1 py-2 overflow-x-auto scrollbar-hide">
        {/* Add story button */}
        {currentUser && (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div className="w-14 h-14 rounded-full bg-[rgba(201,169,110,0.04)] border-2 border-dashed border-[rgba(201,169,110,0.18)] flex items-center justify-center hover:border-[rgba(201,169,110,0.45)] hover:bg-[rgba(201,169,110,0.08)] transition-all">
              <Plus className="w-5 h-5 text-white/40" />
            </div>
            <span className="text-[10px] text-white/40">Your story</span>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </button>
        )}

        {/* Story rings */}
        {groups.filter(g => g && g.user).map((group, idx) => {
          const viewed = currentUser
            ? group.stories.every(s => s.views.includes(currentUser.id))
            : false;
          return (
            <button
              key={group.user.id}
              onClick={() => openStory(idx)}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div className={`w-14 h-14 rounded-full p-0.5 ${viewed ? 'bg-white/10' : 'bg-gradient-to-br from-[#c9a96e] via-[#e8c98a] to-[#c9a96e]'}`}>
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#080608]">
                  {group.user.avatar
                    ? <img src={group.user.avatar} alt={group.user.name || ''} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-[#a07840] flex items-center justify-center text-white text-sm font-bold">
                        {group.user.name?.[0] || '?'}
                      </div>
                  }
                </div>
              </div>
              <span className="text-[10px] text-white/50 max-w-[56px] truncate">{(group.user.name || '').split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Story viewer overlay */}
      {viewing !== null && currentStory && (
        <div className="fixed inset-0 z-50 bg-black">

          {/* ── Story image — fills the whole frame ───────────────────────── */}
          {currentStory.imageUrl ? (
            <img
              key={currentStory.id}
              src={currentStory.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
              onError={e => {
                // If the URL is broken show a gradient placeholder instead
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : null}

          {/* Gradient placeholder shown when there's no image or it fails */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d0b08] via-[#080608] to-[#0d0b08] -z-10" />

          {/* Soft vignette so text is always readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none" />

          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 flex gap-1 p-3">
            {groups[viewing.groupIdx].stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 bg-white/25 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-none"
                  style={{ width: i < viewing.storyIdx ? '100%' : i === viewing.storyIdx ? `${progress}%` : '0%' }}
                />
              </div>
            ))}
          </div>

          {/* User info */}
          <div className="absolute top-8 left-0 right-0 flex items-center gap-2.5 px-4 pt-2">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/30 shrink-0">
              {currentStory.user.avatar
                ? <img src={currentStory.user.avatar} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-[#a07840] flex items-center justify-center text-white text-xs font-bold">{currentStory.user.name?.[0] || '?'}</div>
              }
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-none">{currentStory.user.name}</p>
              <p className="text-white/50 text-xs">{new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <button onClick={() => setViewing(null)} className="ml-auto text-white/70 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Caption */}
          {currentStory.caption && (
            <div className="absolute bottom-12 left-0 right-0 px-4">
              <p className="text-white text-sm text-center bg-black/40 rounded-xl px-3 py-2 backdrop-blur-sm">{currentStory.caption}</p>
            </div>
          )}

          {/* Add to Highlight button — only for own stories */}
          {currentUser && currentStory?.user?.id === currentUser.id && (
            <button
              onClick={() => { setHlStory(currentStory); setShowHLPicker(true); }}
              className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/50 backdrop-blur-sm text-white/80 text-xs hover:bg-black/70 transition-all"
            >
              <Bookmark className="w-3.5 h-3.5" /> Add to Highlight
            </button>
          )}

          {/* Nav zones */}
          <button onClick={prevStory} className="absolute left-0 top-0 bottom-0 w-1/3" />
          <button onClick={advanceStory} className="absolute right-0 top-0 bottom-0 w-1/3" />

          {/* Visible nav arrows on desktop */}
          <button onClick={prevStory} className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 rounded-full items-center justify-center text-white hover:bg-black/60">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={advanceStory} className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 rounded-full items-center justify-center text-white hover:bg-black/60">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Highlight picker — appears over story viewer */}
      {showHLPicker && hlStory && currentUser && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-end justify-center p-4" onClick={() => setShowHLPicker(false)}>
          <div className="w-full max-w-sm bg-[#0d0b08] rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold text-sm">Add to Highlight</p>
              <button onClick={() => setShowHLPicker(false)}><X className="w-4 h-4 text-white/40" /></button>
            </div>
            {highlights.length === 0 ? (
              <p className="text-white/40 text-xs">No highlights yet. Create one from your profile page.</p>
            ) : (
              <div className="space-y-2">
                {highlights.map((hl: any) => (
                  <button key={hl.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[rgba(201,169,110,0.04)] hover:bg-[rgba(201,169,110,0.08)] transition-all text-left"
                    onClick={async () => {
                      try {
                        const story = { id: hlStory.id, imageUrl: hlStory.imageUrl, caption: hlStory.caption || '', createdAt: hlStory.createdAt };
                        await authFetch(`${API}/users/${currentUser.id}/highlights/${hl.id}/stories`, {
                          method: 'POST', body: JSON.stringify({ story }),
                        });
                        toast.success(`Added to "${hl.name}"!`);
                      } catch { toast.error('Failed to add to highlight'); }
                      setShowHLPicker(false);
                    }}
                  >
                    {hl.coverUrl
                      ? <img src={hl.coverUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                      : <div className="w-8 h-8 rounded-full bg-[rgba(201,169,110,0.18)] flex items-center justify-center"><Bookmark className="w-3.5 h-3.5 text-[#c9a96e]" /></div>}
                    <span className="text-white/80 text-sm">{hl.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add story sheet */}
      {showAdd && previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0d0b08] rounded-2xl overflow-hidden">
            <img src={previewUrl} alt="preview" className="w-full aspect-[9/16] object-cover max-h-64" />
            <div className="p-4 space-y-3">
              <input
                placeholder="Add a caption…"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/30 outline-none focus:border-[rgba(201,169,110,0.5)]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAdd(false); setPreviewUrl(null); setCaption(''); }}
                  className="flex-1 py-2.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/60 text-sm"
                >Cancel</button>
                <button
                  onClick={handlePost}
                  disabled={uploading}
                  className="flex-1 py-2.5 rounded-xl bg-[#c9a96e] hover:bg-[#a07840] text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Posting…' : 'Share Story'}
                </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
