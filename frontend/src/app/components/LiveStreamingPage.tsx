// LiveStreamingPage.tsx — all 4 improvements
// A: Rich empty state + Go Live CTA for everyone
// B: Category filter chips + search
// C: Scheduled/upcoming streams timeline
// D: Recent replays horizontal row

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Radio, Users, Heart, Flame, Zap, Trophy, Play,
  StopCircle, ArrowLeft, Plus, Loader2, X, BadgeCheck,
  Eye, Dumbbell, Salad, Sparkles, Smile, Search,
  Clock, Calendar, Video, RefreshCw,
} from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';
import { API } from '../../config';
import { User } from '../types';

interface LiveStream {
  id: string; title: string; description?: string; category: string;
  trainerId: string; trainerName: string; trainerAvatar?: string; trainerVerified?: boolean;
  status: 'live' | 'ended' | 'scheduled';
  viewerCount: number; reactions: Record<string, number>;
  startedAt: string; scheduledAt?: string; duration?: number;
}

interface FloatingEmoji { id: number; emoji: string; x: number; }
interface Props { currentUser: User | null; }

const STREAM_EMOJIS = ['❤️', '🔥', '💪', '⚡', '🏆', '😤', '👏', '🙌'];

const CATEGORIES = [
  { id: 'all',       label: 'All',       Icon: Radio    },
  { id: 'workout',   label: 'Workout',   Icon: Dumbbell },
  { id: 'cardio',    label: 'Cardio',    Icon: Flame    },
  { id: 'nutrition', label: 'Nutrition', Icon: Salad    },
  { id: 'coaching',  label: 'Coaching',  Icon: Sparkles },
  { id: 'q&a',       label: 'Q&A',       Icon: Smile    },
];

function StreamCard({ stream, onJoin }: { stream: LiveStream; onJoin: () => void }) {
  const totalReactions = Object.values(stream.reactions || {}).reduce((a, v) => a + v, 0);
  const isScheduled = stream.status === 'scheduled';
  return (
    <div onClick={!isScheduled ? onJoin : undefined}
      className={`bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl overflow-hidden transition-all group ${!isScheduled ? 'cursor-pointer hover:border-red-500/30 hover:bg-[rgba(201,169,110,0.04)]' : 'opacity-80'}`}>
      <div className="relative bg-gradient-to-br from-red-900/30 to-orange-900/20 aspect-video flex items-center justify-center">
        {!isScheduled ? (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
          </div>
        ) : (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            <Calendar className="w-2.5 h-2.5" /> SOON
          </div>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 text-white/80 text-[10px] px-1.5 py-0.5 rounded-full">
          {isScheduled ? <Clock className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
          {isScheduled ? (stream.scheduledAt ? new Date(stream.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBA') : stream.viewerCount}
        </div>
        <Radio className={`w-10 h-10 text-white/10 ${!isScheduled ? 'group-hover:text-white/20' : ''} transition-colors`} />
      </div>
      <div className="p-3">
        <h3 className="text-white text-sm font-medium leading-tight line-clamp-1 group-hover:text-red-300 transition-colors">{stream.title}</h3>
        <div className="flex items-center gap-2 mt-1.5">
          {stream.trainerAvatar
            ? <img src={stream.trainerAvatar} className="w-4 h-4 rounded-full object-cover" />
            : <div className="w-4 h-4 rounded-full bg-[#c9a96e]/40 flex items-center justify-center text-[8px] text-[#e8c98a]">{stream.trainerName[0]}</div>
          }
          <span className="text-white/40 text-[11px]">{stream.trainerName}</span>
          {stream.trainerVerified && <BadgeCheck className="w-3 h-3 text-[#c9a96e]" />}
        </div>
        {totalReactions > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            {Object.entries(stream.reactions || {}).slice(0, 4).map(([emoji, count]) => (
              <span key={emoji} className="text-[11px]">{emoji} <span className="text-white/30 text-[9px]">{count}</span></span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReplayCard({ stream, onJoin }: { stream: LiveStream; onJoin: () => void }) {
  return (
    <div onClick={onJoin} className="shrink-0 w-44 cursor-pointer group">
      <div className="relative bg-gradient-to-br from-gray-800/60 to-gray-900/40 rounded-xl overflow-hidden aspect-video mb-2 border border-white/5 group-hover:border-white/15 transition-all">
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 text-white/60 text-[9px] px-1.5 py-0.5 rounded-full">
          <Video className="w-2 h-2" /> REPLAY
        </div>
        {stream.duration && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white/70 text-[9px] px-1.5 py-0.5 rounded-full">
            {Math.floor(stream.duration / 60)}m
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <Play className="w-7 h-7 text-white/20 group-hover:text-white/40 transition-colors" />
        </div>
      </div>
      <p className="text-white/70 text-xs font-medium line-clamp-2 leading-tight">{stream.title}</p>
      <p className="text-white/30 text-[10px] mt-0.5">{stream.trainerName}</p>
    </div>
  );
}

function ViewerMode({ stream, currentUser, onLeave }: { stream: LiveStream; currentUser: User; onLeave: () => void }) {
  const [viewerCount, setViewerCount] = useState(stream.viewerCount);
  const [reactions, setReactions]     = useState<Record<string, number>>(stream.reactions || {});
  const [floaters, setFloaters]       = useState<FloatingEmoji[]>([]);
  const [ended, setEnded]             = useState(false);
  const [sending, setSending]         = useState<string | null>(null);
  const nextId = useRef(0);
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    authFetch(`${API}/livestreams/${stream.id}/join`, { method: 'POST' }).catch(() => {});
    return () => {
      authFetch(`${API}/livestreams/${stream.id}/leave`, { method: 'POST' }).catch(() => {});
      sseRef.current?.close();
    };
  }, [stream.id]);

  useEffect(() => {
    const sse = new EventSource(`${API}/livestreams/${stream.id}/sse?uid=${currentUser.id}`);
    sseRef.current = sse;
    sse.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'reaction') { setReactions(prev => ({ ...prev, [msg.emoji]: (prev[msg.emoji] || 0) + 1 })); spawnFloater(msg.emoji); }
        else if (msg.type === 'viewer_count') { setViewerCount(msg.count); }
        else if (msg.type === 'stream_ended') { setEnded(true); }
      } catch {}
    };
    return () => sse.close();
  }, [stream.id, currentUser.id]);

  const spawnFloater = (emoji: string) => {
    const id = nextId.current++;
    setFloaters(prev => [...prev, { id, emoji, x: 10 + Math.random() * 80 }]);
    setTimeout(() => setFloaters(prev => prev.filter(f => f.id !== id)), 2500);
  };

  const sendReaction = async (emoji: string) => {
    if (sending) return;
    setSending(emoji); spawnFloater(emoji);
    setReactions(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
    try { await authFetch(`${API}/livestreams/${stream.id}/react`, { method: 'POST', body: JSON.stringify({ emoji }) }); }
    catch {} finally { setSending(null); }
  };

  const totalReactions = Object.values(reactions).reduce((a, v) => a + v, 0);

  return (
    <div className="space-y-4">
      <button onClick={onLeave} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to streams
      </button>
      <div className="relative bg-gradient-to-br from-red-900/40 to-gray-900 rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
        {!ended && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
          </div>
        )}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 text-white/80 text-xs px-2.5 py-1 rounded-full z-10">
          <Users className="w-3 h-3" /> {viewerCount}
        </div>
        {floaters.map(f => (
          <div key={f.id} className="absolute bottom-16 text-2xl pointer-events-none z-20 animate-float-up" style={{ left: `${f.x}%` }}>{f.emoji}</div>
        ))}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {ended ? (
            <><StopCircle className="w-10 h-10 text-white/20" /><p className="text-white/50 text-sm">Stream ended</p>
              <button onClick={onLeave} className="mt-2 bg-[#c9a96e] text-white text-xs px-4 py-2 rounded-xl">Back to streams</button></>
          ) : (
            <><Radio className="w-10 h-10 text-red-400 animate-pulse" /><p className="text-white/60 text-sm">Live stream in progress</p></>
          )}
        </div>
      </div>
      <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-xl px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h2 className="text-white font-semibold text-sm">{stream.title}</h2>
            {stream.description && <p className="text-white/40 text-xs mt-0.5 leading-relaxed">{stream.description}</p>}
            <div className="flex items-center gap-2 mt-2">
              {stream.trainerAvatar
                ? <img src={stream.trainerAvatar} className="w-5 h-5 rounded-full object-cover" />
                : <div className="w-5 h-5 rounded-full bg-[#c9a96e]/40 flex items-center justify-center text-[9px] text-[#e8c98a]">{stream.trainerName[0]}</div>}
              <span className="text-white/50 text-xs">{stream.trainerName}</span>
              {stream.trainerVerified && <BadgeCheck className="w-3 h-3 text-[#c9a96e]" />}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-white/60 text-sm font-bold">{totalReactions.toLocaleString()}</p>
            <p className="text-white/25 text-[10px]">reactions</p>
          </div>
        </div>
      </div>
      {!ended && (
        <div>
          <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">React</p>
          <div className="flex gap-2 flex-wrap">
            {STREAM_EMOJIS.map(emoji => (
              <button key={emoji} onClick={() => sendReaction(emoji)} disabled={!!sending}
                className="text-2xl hover:scale-125 active:scale-110 transition-transform disabled:opacity-50 leading-none p-1">
                {emoji}
                {reactions[emoji] ? <span className="text-[9px] text-white/30 block text-center">{reactions[emoji]}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}
      <style>{`@keyframes float-up{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-120px) scale(1.5);opacity:0}}.animate-float-up{animation:float-up 2.5s ease-out forwards}`}</style>
    </div>
  );
}

function HostMode({ stream, currentUser, onEnd }: { stream: LiveStream; currentUser: User; onEnd: () => void }) {
  const [viewerCount, setViewerCount] = useState(stream.viewerCount);
  const [reactions, setReactions]     = useState<Record<string, number>>(stream.reactions || {});
  const [floaters, setFloaters]       = useState<FloatingEmoji[]>([]);
  const [ending, setEnding]           = useState(false);
  const [elapsed, setElapsed]         = useState(0);
  const nextId = useRef(0);

  const spawnFloater = useCallback((emoji: string) => {
    const id = nextId.current++;
    setFloaters(prev => [...prev, { id, emoji, x: 10 + Math.random() * 80 }]);
    setTimeout(() => setFloaters(prev => prev.filter(f => f.id !== id)), 2500);
  }, []);

  useEffect(() => {
    const sse = new EventSource(`${API}/livestreams/${stream.id}/sse?uid=${currentUser.id}`);
    sse.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'reaction') { setReactions(prev => ({ ...prev, [msg.emoji]: (prev[msg.emoji] || 0) + 1 })); spawnFloater(msg.emoji); }
        else if (msg.type === 'viewer_count') setViewerCount(msg.count);
      } catch {}
    };
    return () => sse.close();
  }, [stream.id, currentUser.id, spawnFloater]);

  useEffect(() => {
    const start = new Date(stream.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, [stream.startedAt]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const handleEnd = async () => {
    setEnding(true);
    try { await authFetch(`${API}/livestreams/${stream.id}/end`, { method: 'POST' }); toast.success('Stream ended — saved to Clips!'); onEnd(); }
    catch { toast.error('Failed to end stream'); setEnding(false); }
  };

  const totalReactions = Object.values(reactions).reduce((a, v) => a + v, 0);

  return (
    <div className="space-y-4">
      <div className="relative bg-gradient-to-br from-red-900/40 to-gray-900 rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full z-10">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE · {fmt(elapsed)}
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 text-white/80 text-xs px-2.5 py-1 rounded-full z-10">
          <Users className="w-3 h-3" /> {viewerCount}
        </div>
        {floaters.map(f => (
          <div key={f.id} className="absolute bottom-16 text-3xl pointer-events-none z-20 animate-float-up" style={{ left: `${f.x}%` }}>{f.emoji}</div>
        ))}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Radio className="w-12 h-12 text-red-400 animate-pulse" />
          <p className="text-white/50 text-sm">You are live</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Viewers', value: viewerCount, Icon: Eye, color: 'text-sky-400' },
          { label: 'Reactions', value: totalReactions, Icon: Heart, color: 'text-red-400' },
          { label: 'Duration', value: fmt(elapsed), Icon: Zap, color: 'text-amber-400' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-xl p-3 text-center">
            <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
            <p className={`font-bold text-sm ${color}`}>{value}</p>
            <p className="text-white/25 text-[9px]">{label}</p>
          </div>
        ))}
      </div>
      {totalReactions > 0 && (
        <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-xl px-4 py-3">
          <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Reactions</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(reactions).sort((a,b) => b[1]-a[1]).map(([emoji, count]) => (
              <div key={emoji} className="flex items-center gap-1"><span className="text-lg">{emoji}</span><span className="text-white/50 text-xs font-medium">{count}</span></div>
            ))}
          </div>
        </div>
      )}
      <button onClick={handleEnd} disabled={ending}
        className="w-full flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 font-medium py-3 rounded-xl transition-all disabled:opacity-50">
        {ending ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
        {ending ? 'Ending…' : 'End Stream & Save to Clips'}
      </button>
      <style>{`@keyframes float-up{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-120px) scale(1.5);opacity:0}}.animate-float-up{animation:float-up 2.5s ease-out forwards}`}</style>
    </div>
  );
}

function GoLiveModal({ onClose, onStarted }: { onClose: () => void; onStarted: (id: string) => void }) {
  const [form, setForm]   = useState({ title: '', description: '', category: 'workout' });
  const [going, setGoing] = useState(false);

  const handleStart = async () => {
    if (!form.title.trim()) return toast.error('Enter a stream title');
    setGoing(true);
    try {
      const r = await authFetch(`${API}/livestreams`, { method: 'POST', body: JSON.stringify(form) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      const { id } = await r.json();
      toast.success('You are live!'); onStarted(id);
    } catch (e: any) { toast.error(e.message || 'Failed to start stream'); }
    finally { setGoing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,169,110,0.07)]">
          <h2 className="text-white font-semibold flex items-center gap-2"><Radio className="w-4 h-4 text-red-400" /> Go Live</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Stream Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Morning Strength Session with Q&A"
              className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/50" />
          </div>
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.filter(c => c.id !== 'all').map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setForm(f => ({ ...f, category: id }))}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs transition-all ${form.category === id ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'border-[rgba(201,169,110,0.12)] text-white/30 hover:border-[rgba(201,169,110,0.18)]'}`}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Description (optional)</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What will you be covering today?"
              className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-red-500/50 resize-none" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/60 text-sm hover:bg-[rgba(201,169,110,0.04)]">Cancel</button>
          <button onClick={handleStart} disabled={going}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {going ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            {going ? 'Starting…' : 'Start Streaming'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LiveStreamingPage({ currentUser }: Props) {
  const [streams, setStreams]               = useState<LiveStream[]>([]);
  const [loading, setLoading]               = useState(true);
  const [showGoLive, setShowGoLive]         = useState(false);
  const [activeStream, setActiveStream]     = useState<LiveStream | null>(null);
  const [isHosting, setIsHosting]           = useState(false);
  // Option B
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery]       = useState('');

  const isTrainer = currentUser?.accountType === 'trainer';

  const loadStreams = useCallback(async () => {
    try {
      const r = await authFetch(`${API}/livestreams`);
      const d = await r.json();
      setStreams(d.streams || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStreams(); }, [loadStreams]);
  useEffect(() => { const t = setInterval(loadStreams, 15000); return () => clearInterval(t); }, [loadStreams]);

  const joinStream = (stream: LiveStream) => {
    setActiveStream(stream);
    setIsHosting(stream.trainerId === currentUser?.id);
  };

  const handleStarted = async (id: string) => {
    setShowGoLive(false);
    try {
      const r = await authFetch(`${API}/livestreams/${id}`);
      const d = await r.json();
      setActiveStream(d); setIsHosting(true);
    } catch { toast.error('Could not load stream'); }
  };

  const handleLeave = () => { setActiveStream(null); setIsHosting(false); loadStreams(); };

  // Option B + C + D — derived lists
  const liveStreams = useMemo(() =>
    streams.filter(s => s.status === 'live')
      .filter(s => activeCategory === 'all' || s.category === activeCategory)
      .filter(s => !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.trainerName.toLowerCase().includes(searchQuery.toLowerCase())),
    [streams, activeCategory, searchQuery]
  );
  const scheduledStreams = useMemo(() => streams.filter(s => s.status === 'scheduled').slice(0, 5), [streams]);
  const replayStreams    = useMemo(() => streams.filter(s => s.status === 'ended').slice(0, 8), [streams]);

  if (activeStream && currentUser) {
    return isHosting
      ? <HostMode stream={activeStream} currentUser={currentUser} onEnd={handleLeave} />
      : <ViewerMode stream={activeStream} currentUser={currentUser} onLeave={handleLeave} />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-400" /> Live Streams
          </h2>
          <p className="text-white/35 text-xs mt-0.5">Watch trainers live or go live yourself</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadStreams} className="p-2 rounded-xl bg-[rgba(201,169,110,0.04)] hover:bg-[rgba(201,169,110,0.08)] text-white/40 hover:text-white/70 transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {isTrainer && (
            <button onClick={() => setShowGoLive(true)}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium px-3 py-1.5 rounded-xl transition-all">
              <Radio className="w-3.5 h-3.5" /> Go Live
            </button>
          )}
        </div>
      </div>

      {/* Option B — Category chips + search */}
      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveCategory(id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                activeCategory === id
                  ? 'bg-red-500/20 border-red-500/40 text-red-300'
                  : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:text-white/70 hover:border-[rgba(201,169,110,0.18)]'
              }`}>
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search streams or trainers…"
            className="w-full pl-9 pr-4 py-2 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.10)] rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.35)]" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-red-400 animate-spin" /></div>
      ) : liveStreams.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {liveStreams.map(s => <StreamCard key={s.id} stream={s} onJoin={() => joinStream(s)} />)}
        </div>
      ) : (
        /* Option A — Rich empty state */
        <div className="space-y-5">
          <div className="border border-[rgba(201,169,110,0.07)] rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.12)] flex items-center justify-center mx-auto mb-4">
              <Radio className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/50 text-sm font-medium mb-1">No live streams right now</p>
            <p className="text-white/25 text-xs mb-5">Trainers go live regularly — check back soon or be the first!</p>
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
              <button onClick={() => setShowGoLive(true)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 hover:border-red-500/30 transition-all group">
                <Radio className="w-5 h-5 text-red-400" />
                <span className="text-white/60 text-xs font-medium group-hover:text-white/80">Go Live</span>
              </button>
              <button onClick={loadStreams}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.10)] hover:bg-[rgba(201,169,110,0.08)] transition-all group">
                <RefreshCw className="w-5 h-5 text-[#c9a96e]" />
                <span className="text-white/60 text-xs font-medium group-hover:text-white/80">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Option C — Scheduled streams */}
      {scheduledStreams.length > 0 && (
        <div className="space-y-3">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" /> Upcoming
          </p>
          <div className="space-y-2">
            {scheduledStreams.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-xl hover:border-[rgba(201,169,110,0.12)] transition-all">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{s.title}</p>
                  <p className="text-white/40 text-xs">{s.trainerName} · {s.scheduledAt ? new Date(s.scheduledAt).toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBA'}</p>
                </div>
                <button className="shrink-0 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/25 hover:border-blue-500/40 px-2.5 py-1 rounded-lg transition-all" onClick={() => toast.success('We will notify you!')}>
                  Notify me
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Option D — Replays */}
      {replayStreams.length > 0 && (
        <div className="space-y-3">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
            <Video className="w-3.5 h-3.5" /> Recent Replays
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {replayStreams.map(s => <ReplayCard key={s.id} stream={s} onJoin={() => joinStream(s)} />)}
          </div>
        </div>
      )}

      {showGoLive && <GoLiveModal onClose={() => setShowGoLive(false)} onStarted={handleStarted} />}
    </div>
  );
}
