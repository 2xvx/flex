import { useState, useEffect, useCallback } from 'react';
import { Users, MessageCircle, Search, Loader2, ArrowLeft, Heart, MessageSquare, Dumbbell, Flame, ChevronRight } from 'lucide-react';
import { User } from '../types';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';

import { API } from '../../config';

interface Community {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: string;
  memberCount: number;
  members: string[];
}

interface CommunityPost {
  id: string;
  user: { id: string; name: string; avatar?: string; verified?: boolean };
  caption?: string;
  type: string;
  workoutName?: string;
  duration?: number;
  calories?: number;
  exercises?: number;
  mediaUrl?: string;
  likes: number;
  commentCount: number;
  likedBy?: string[];
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  cardio:   'bg-red-500/10 text-red-400 border-red-500/20',
  strength: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  wellness: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  mixed:    'bg-[rgba(201,169,110,0.08)] text-[#c9a96e] border-[rgba(201,169,110,0.18)]',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  currentUser: User | null;
  onNavigate?: (view: string) => void;
}

/* ─────────────────────────────────────────────────────────────
   Community Detail View
───────────────────────────────────────────────────────────── */
function CommunityDetail({
  community,
  currentUser,
  onBack,
  onOpenChat,
}: {
  community: Community;
  currentUser: User | null;
  onBack: () => void;
  onOpenChat: () => void;
}) {
  const [tab, setTab] = useState<'posts' | 'chat'>('posts');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const loadFeed = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res = await authFetch(`${API}/communities/${community.id}/feed`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list: CommunityPost[] = data.posts || [];
      setPosts(list);
      // seed liked state
      if (currentUser) {
        const myLikes = new Set(list.filter(p => p.likedBy?.includes(currentUser.id)).map(p => p.id));
        setLikedIds(myLikes);
      }
    } catch {
      toast.error('Could not load community posts');
    } finally {
      setLoadingPosts(false);
    }
  }, [community.id, currentUser]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const toggleLike = async (post: CommunityPost) => {
    if (!currentUser) { toast.error('Please log in'); return; }
    const liked = likedIds.has(post.id);
    setLikedIds(prev => {
      const next = new Set(prev);
      liked ? next.delete(post.id) : next.add(post.id);
      return next;
    });
    setPosts(prev => prev.map(p =>
      p.id === post.id ? { ...p, likes: p.likes + (liked ? -1 : 1) } : p
    ));
    try {
      await authFetch(`${API}/posts/${post.id}/like`, { method: 'POST' });
    } catch {
      // revert
      setLikedIds(prev => { const next = new Set(prev); liked ? next.add(post.id) : next.delete(post.id); return next; });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: p.likes + (liked ? 1 : -1) } : p));
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl bg-[rgba(201,169,110,0.04)] hover:bg-[rgba(201,169,110,0.08)] transition-colors">
          <ArrowLeft className="w-4 h-4 text-white/60" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-[rgba(201,169,110,0.04)] flex items-center justify-center text-2xl">
          {community.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base leading-tight">{community.name}</p>
          <p className="text-white/40 text-xs">{community.memberCount.toLocaleString()} members</p>
        </div>
        <button
          onClick={onOpenChat}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#c9a96e]/15 text-[#e8c98a] text-xs font-medium hover:bg-[#c9a96e]/25 transition-colors border border-[rgba(201,169,110,0.18)]"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Chat
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1 mb-6">
        {(['posts', 'chat'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); if (t === 'chat') onOpenChat(); }}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all capitalize ${
              tab === t ? 'bg-[rgba(201,169,110,0.12)] text-[#e8c98a]' : 'text-white/40 hover:text-white/60'
            }`}
          >
            {t === 'posts' ? '📋 Posts' : '💬 Chat'}
          </button>
        ))}
      </div>

      {/* Posts tab */}
      {tab === 'posts' && (
        <>
          {loadingPosts ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-[rgba(201,169,110,0.04)] flex items-center justify-center mx-auto mb-4">
                <Dumbbell className="w-7 h-7 text-white/20" />
              </div>
              <p className="text-white/40 text-sm font-medium">No posts yet</p>
              <p className="text-white/25 text-xs mt-1">Members' workouts will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.filter(post => post && post.user).map(post => {
                const liked = likedIds.has(post.id);
                return (
                  <div key={post.id} className="bg-[#0d0b08] border border-[rgba(201,169,110,0.08)] rounded-2xl overflow-hidden">
                    {/* Author row */}
                    <div className="flex items-center gap-3 p-4 pb-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c9a96e] to-[#a07840] flex items-center justify-center overflow-hidden shrink-0">
                        {post.user.avatar
                          ? <img src={post.user.avatar} className="w-full h-full object-cover" alt="" />
                          : <span className="text-white text-sm font-bold">{post.user.name?.[0] || '?'}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-white text-sm font-semibold truncate">{post.user.name || 'Unknown'}</p>
                          {post.user.verified && <span className="text-[#c9a96e] text-xs">✓</span>}
                        </div>
                        <p className="text-white/35 text-xs">{timeAgo(post.createdAt)}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(201,169,110,0.08)] text-[#c9a96e] border border-[rgba(201,169,110,0.18)] capitalize">
                        {post.type}
                      </span>
                    </div>

                    {/* Workout summary card */}
                    {post.workoutName && (
                      <div className="mx-4 mb-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <p className="text-white font-medium text-sm mb-2">{post.workoutName}</p>
                        <div className="flex items-center gap-4">
                          {post.duration != null && (
                            <div className="flex items-center gap-1 text-white/50 text-xs">
                              <Flame className="w-3 h-3 text-orange-400" />
                              {post.duration} min
                            </div>
                          )}
                          {post.calories != null && (
                            <div className="flex items-center gap-1 text-white/50 text-xs">
                              <Flame className="w-3 h-3 text-red-400" />
                              {post.calories} kcal
                            </div>
                          )}
                          {post.exercises != null && (
                            <div className="flex items-center gap-1 text-white/50 text-xs">
                              <Dumbbell className="w-3 h-3 text-blue-400" />
                              {post.exercises} exercises
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Media */}
                    {post.mediaUrl && (
                      <div className="mx-4 mb-3 rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.03] aspect-video flex items-center justify-center">
                        {post.mediaUrl.match(/\.(mp4|webm|mov)/i) ? (
                          <video src={post.mediaUrl} controls className="w-full h-full object-cover" />
                        ) : (
                          <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                    )}

                    {/* Caption */}
                    {post.caption && (
                      <p className="px-4 pb-3 text-white/70 text-sm leading-relaxed">{post.caption}</p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-4 px-4 py-3 border-t border-white/[0.05]">
                      <button
                        onClick={() => toggleLike(post)}
                        className={`flex items-center gap-1.5 text-xs transition-colors ${
                          liked ? 'text-pink-400' : 'text-white/35 hover:text-white/60'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${liked ? 'fill-pink-400' : ''}`} />
                        {post.likes > 0 && post.likes}
                      </button>
                      <button className="flex items-center gap-1.5 text-white/35 hover:text-white/60 text-xs transition-colors">
                        <MessageSquare className="w-4 h-4" />
                        {post.commentCount > 0 && post.commentCount}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main CommunitiesPage
───────────────────────────────────────────────────────────── */
export function CommunitiesPage({ currentUser, onNavigate }: Props) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'joined' | 'cardio' | 'strength' | 'wellness' | 'mixed'>('all');
  const [selected, setSelected] = useState<Community | null>(null);

  useEffect(() => {
    loadCommunities();
  }, []);

  const loadCommunities = async () => {
    try {
      const res = await fetch(`${API}/communities`);
      const data = await res.json();
      setCommunities(data.communities || []);
    } catch {
      toast.error('Failed to load communities');
    } finally { setLoading(false); }
  };

  const handleToggle = async (community: Community) => {
    if (!currentUser) { toast.error('Please log in'); return; }
    const isJoined = community.members.includes(currentUser.id);
    setJoining(j => ({ ...j, [community.id]: true }));
    try {
      const endpoint = isJoined ? 'leave' : 'join';
      const res = await authFetch(`${API}/communities/${community.id}/${endpoint}`, { method: 'POST' });
      if (!res.ok) throw new Error();
      setCommunities(prev => prev.map(c => {
        if (c.id !== community.id) return c;
        const members = isJoined
          ? c.members.filter(m => m !== currentUser.id)
          : [...c.members, currentUser.id];
        return { ...c, members, memberCount: isJoined ? c.memberCount - 1 : c.memberCount + 1 };
      }));
      toast.success(isJoined ? `Left ${community.name}` : `Joined ${community.name}! Find it in Messages 💬`);
    } catch {
      toast.error('Action failed — please try again');
    } finally { setJoining(j => ({ ...j, [community.id]: false })); }
  };

  const filtered = communities.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' ? true
      : filter === 'joined' ? c.members.includes(currentUser?.id || '')
      : c.category === filter;
    return matchSearch && matchFilter;
  });

  const joinedCount = communities.filter(c => c.members.includes(currentUser?.id || '')).length;

  // Show detail view
  if (selected) {
    return (
      <CommunityDetail
        community={selected}
        currentUser={currentUser}
        onBack={() => setSelected(null)}
        onOpenChat={() => onNavigate?.('messages')}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#c9a96e]/15 flex items-center justify-center">
            <Users className="w-5 h-5 text-[#c9a96e]" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">Communities</h1>
            <p className="text-white/40 text-xs">
              {joinedCount > 0 ? `You're in ${joinedCount} group${joinedCount !== 1 ? 's' : ''}` : 'Join groups to chat with like-minded athletes'}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search communities…"
          className="w-full bg-[#0d0b08] border border-[rgba(201,169,110,0.08)] rounded-xl py-2.5 pl-9 pr-4 text-white text-sm placeholder:text-white/25 outline-none focus:border-[#c9a96e]/40"
        />
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {(['all', 'joined', 'cardio', 'strength', 'wellness', 'mixed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs capitalize transition-all border ${
              filter === f
                ? 'bg-[rgba(201,169,110,0.12)] text-[#e8c98a] border-[rgba(201,169,110,0.25)]'
                : 'bg-[rgba(201,169,110,0.04)] text-white/40 border-[rgba(201,169,110,0.12)] hover:text-white/60'
            }`}
          >
            {f === 'joined' ? `Joined (${joinedCount})` : f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No communities found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(community => {
            const isJoined = community.members.includes(currentUser?.id || '');
            const isLoading = joining[community.id];
            return (
              <div
                key={community.id}
                className={`bg-[#0d0b08] border rounded-2xl p-4 transition-all cursor-pointer hover:border-[#c9a96e]/25 ${
                  isJoined ? 'border-[#c9a96e]/25' : 'border-[rgba(201,169,110,0.08)]'
                }`}
                onClick={() => setSelected(community)}
              >
                <div className="flex items-start gap-4">
                  {/* Emoji avatar */}
                  <div className="w-12 h-12 rounded-xl bg-[rgba(201,169,110,0.04)] flex items-center justify-center text-2xl shrink-0">
                    {community.emoji}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white font-semibold text-sm">{community.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border capitalize ${CATEGORY_COLORS[community.category] || 'bg-[rgba(201,169,110,0.04)] text-white/30 border-[rgba(201,169,110,0.12)]'}`}>
                        {community.category}
                      </span>
                    </div>
                    <p className="text-white/45 text-xs mb-2">{community.description}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-white/30 text-xs flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {community.memberCount.toLocaleString()} member{community.memberCount !== 1 ? 's' : ''}
                      </span>
                      {isJoined && (
                        <span className="flex items-center gap-1 text-[#c9a96e] text-xs">
                          <MessageCircle className="w-3 h-3" />
                          Member
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Right side: Join/Leave + chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); handleToggle(community); }}
                      disabled={isLoading}
                      className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-60 ${
                        isJoined
                          ? 'bg-[rgba(201,169,110,0.04)] text-white/50 hover:bg-red-500/10 hover:text-red-400 border border-[rgba(201,169,110,0.12)]'
                          : 'bg-[rgba(201,169,110,0.12)] text-[#e8c98a] hover:bg-[rgba(201,169,110,0.18)] border border-[rgba(201,169,110,0.18)]'
                      }`}
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : isJoined ? 'Leave' : 'Join'}
                    </button>
                    <ChevronRight className="w-4 h-4 text-white/20" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
