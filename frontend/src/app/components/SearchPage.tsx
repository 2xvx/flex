// SearchPage.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, User as UserIcon, Dumbbell, X, UserPlus, Loader2, Hash, TrendingUp, Clock, BadgeCheck } from 'lucide-react';
import { User } from '../types';
import { followUser, getFollowingList } from '../../services/followService';
import { EmptyState } from './EmptyState';
import { toast } from 'sonner';

import { API } from '../../config';

interface SearchPageProps {
  currentUser?: User | null;
  onViewProfile: (uid: string) => void;
  onHashtag?: (tag: string) => void;
  hashtagFilter?: string | null;
  onClearHashtag?: () => void;
}
interface SearchUser {
  uid: string; name: string; username: string; avatar: string;
  accountType: string; bio: string; followers: number; verified?: boolean;
}
interface SearchPost {
  id: string; workoutType: string; caption: string; likes: number;
  duration: number; calories: number; user: any; createdAt: string; imageUrl?: string;
}

const TRENDING_TAGS = ['fitness','gains','cardio','weightloss','hiit','calisthenics','powerlifting','crossfit'];

export function SearchPage({ currentUser, onViewProfile, onHashtag, hashtagFilter, onClearHashtag }: SearchPageProps) {
  const [query,       setQuery]       = useState('');
  const [activeTab,   setActiveTab]   = useState<'all'|'users'|'posts'|'exercises'|'gyms'>('all');
  const [users,       setUsers]       = useState<SearchUser[]>([]);
  const [posts,       setPosts]       = useState<SearchPost[]>([]);
  const [exercises,   setExercises]   = useState<any[]>([]);
  const [gyms,        setGyms]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [searched,    setSearched]    = useState(false);
  const [following,   setFollowing]   = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<SearchUser[]>([]);
  const [hashPosts,   setHashPosts]   = useState<SearchPost[]>([]);
  const [hashLoading, setHashLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('flex_recent_searches') || '[]'); } catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API}/explore/suggestions?uid=${currentUser?.id || ''}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSuggestions(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    getFollowingList(currentUser.id).then((ids: string[]) => setFollowing(new Set(ids))).catch(() => {});
  }, [currentUser?.id]);

  useEffect(() => {
    if (!hashtagFilter) { setHashPosts([]); return; }
    setHashLoading(true);
    fetch(`${API}/posts/hashtag/${encodeURIComponent(hashtagFilter)}`)
      .then(r => r.ok ? r.json() : { posts: [] })
      .then(d => setHashPosts(d.posts || []))
      .catch(() => setHashPosts([]))
      .finally(() => setHashLoading(false));
  }, [hashtagFilter]);

  const doSearch = useCallback(async (q: string, type: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setLoading(true); setSearched(true);
    // Save to recent
    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 6);
      try { localStorage.setItem('flex_recent_searches', JSON.stringify(updated)); } catch {}
      return updated;
    });
    try {
      const res  = await fetch(`${API}/search?q=${encodeURIComponent(trimmed)}&type=${type}`);
      const data = await res.json();
      setUsers(data.users || []); setPosts(data.posts || []);
      setExercises(data.exercises || []); setGyms(data.gyms || []);
    } catch { toast.error('Search failed'); }
    finally { setLoading(false); }
  }, []);

  const handleFollow = async (uid: string, name: string) => {
    if (!currentUser) return toast.error('Log in to follow');
    try {
      await followUser(uid);
      setFollowing(prev => new Set([...prev, uid]));
      toast.success(`Following ${name}!`);
    } catch { toast.error('Follow failed'); }
  };

  const clearSearch = () => { setQuery(''); setUsers([]); setPosts([]); setExercises([]); setGyms([]); setSearched(false); };

  const UserCard = ({ u }: { u: SearchUser }) => (
    <div onClick={() => onViewProfile(u.uid)}
      className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#080608] border border-[rgba(201,169,110,0.08)] hover:border-white/[0.12] hover:bg-[#110e09] transition-all cursor-pointer group">
      <div className="relative shrink-0">
        <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#c9a96e] to-[#a07840] flex items-center justify-center">
          {u.avatar
            ? <img src={u.avatar} className="w-full h-full object-cover" alt={u.name} />
            : <span className="text-white font-semibold text-sm">{u.name?.[0]}</span>}
        </div>
        {u.verified && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 border border-[#080608] flex items-center justify-center">
            <BadgeCheck className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-white font-semibold text-sm truncate group-hover:text-[#e8c98a] transition-colors">{u.name}</p>
          {u.accountType !== 'user' && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${u.accountType === 'trainer' ? 'bg-orange-500/20 text-orange-300' : 'bg-[rgba(201,169,110,0.12)] text-[#e8c98a]'}`}>
              {u.accountType}
            </span>
          )}
        </div>
        <p className="text-white/35 text-xs">@{u.username} · {u.followers} followers</p>
        {u.bio && <p className="text-white/25 text-xs truncate mt-0.5">{u.bio}</p>}
      </div>
      {u.uid !== currentUser?.id && (
        following.has(u.uid)
          ? <span className="shrink-0 text-xs text-[#c9a96e] font-semibold">Following ✓</span>
          : <button onClick={e => { e.stopPropagation(); handleFollow(u.uid, u.name); }}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-white/50 border border-[rgba(201,169,110,0.12)] hover:text-[#e8c98a] hover:border-[rgba(201,169,110,0.25)] hover:bg-[#c9a96e]/8 transition-all">
              <UserPlus className="w-3 h-3" /> Follow
            </button>
      )}
    </div>
  );

  if (hashtagFilter) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#c9a96e]/15 border border-[rgba(201,169,110,0.18)] flex items-center justify-center">
            <Hash className="w-6 h-6 text-[#c9a96e]" />
          </div>
          <div>
            <h1 className="text-white font-black text-2xl">#{hashtagFilter}</h1>
            <p className="text-white/35 text-sm">{hashPosts.length} post{hashPosts.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClearHashtag}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/45 hover:text-white hover:bg-[rgba(201,169,110,0.08)] text-sm transition-all">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
        {hashLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" /></div>
        ) : hashPosts.length === 0 ? (
          <EmptyState icon="search" title={`No posts with #${hashtagFilter}`} sub="Be the first to post with this hashtag!" />
        ) : (
          <div className="space-y-3">
            {hashPosts.map(p => (
              <div key={p.id} onClick={() => p.user?.id && onViewProfile(p.user.id)}
                className="p-4 rounded-2xl bg-[#080608] border border-[rgba(201,169,110,0.08)] hover:border-white/[0.12] cursor-pointer transition-all">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-[#a07840] shrink-0 flex items-center justify-center">
                    {p.user?.avatar ? <img src={p.user.avatar} className="w-full h-full object-cover" /> : <span className="text-white text-xs font-semibold">{p.user?.name?.[0]}</span>}
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-medium">{p.user?.name}</p>
                    <p className="text-white/35 text-xs">@{p.user?.username}</p>
                  </div>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[rgba(201,169,110,0.04)] text-white/40">{p.workoutType}</span>
                </div>
                {p.imageUrl && <img src={p.imageUrl} className="w-full rounded-xl object-cover max-h-48 mb-2" alt="" />}
                {p.caption && (
                  <p className="text-white/70 text-sm mb-2 leading-relaxed">
                    {p.caption.split(/(#\w+)/g).map((part: string, i: number) =>
                      part.startsWith('#')
                        ? <span key={i} className="text-[#c9a96e] cursor-pointer font-medium" onClick={e => { e.stopPropagation(); onHashtag?.(part.slice(1)); }}>{part}</span>
                        : part
                    )}
                  </p>
                )}
                <div className="flex gap-3 text-white/30 text-xs">
                  <span>❤️ {p.likes || 0}</span><span>⏱ {p.duration}min</span><span>🔥 {p.calories} cal</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-white font-black text-2xl tracking-tight mb-4">Search</h1>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={e => { setQuery(e.target.value); if (e.target.value.trim().length >= 2) doSearch(e.target.value, activeTab); else if (!e.target.value) clearSearch(); }}
            onKeyDown={e => e.key === 'Enter' && doSearch(query, activeTab)}
            placeholder="Users, workouts, exercises…"
            className="w-full pl-11 pr-10 py-3.5 bg-[#080608] border border-white/[0.08] rounded-2xl text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-[#c9a96e]/40 focus:bg-[#110e09] transition-all"
          />
          {query && (
            <button onClick={clearSearch} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {searched && (
        <div className="flex gap-1.5 mb-5">
          {[{id:'all',label:'All'},{id:'users',label:'People'},{id:'posts',label:'Workouts'},{id:'exercises',label:'Exercises'},{id:'gyms',label:'Gyms'}].map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id as any); if (query.length >= 2) doSearch(query, t.id); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeTab === t.id ? 'bg-[#c9a96e] text-white' : 'bg-[rgba(201,169,110,0.04)] text-white/40 hover:text-white/70 hover:bg-[rgba(201,169,110,0.06)]'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" /></div>
      )}

      {/* Empty / default state */}
      {!loading && !searched && (
        <div className="space-y-6">
          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Recent</p>
                <button onClick={() => { setRecentSearches([]); localStorage.removeItem('flex_recent_searches'); }} className="text-white/25 text-xs hover:text-white/50 transition-colors">Clear</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map(s => (
                  <button key={s} onClick={() => { setQuery(s); doSearch(s, activeTab); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.08)] text-white/55 text-sm hover:bg-[rgba(201,169,110,0.08)] hover:text-white/80 transition-all">
                    <Clock className="w-3 h-3" /> {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Trending tags */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#c9a96e]" />
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Trending</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TRENDING_TAGS.map(tag => (
                <button key={tag} onClick={() => onHashtag?.(tag)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] text-[#e8c98a] text-sm hover:bg-[rgba(201,169,110,0.12)] transition-all font-medium">
                  #{tag}
                </button>
              ))}
            </div>
          </div>
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-[#c9a96e]" />
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">People you may know</p>
              </div>
              <div className="space-y-2">
                {suggestions.slice(0, 5).map(u => <UserCard key={u.uid} u={u} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {!loading && searched && users.length === 0 && posts.length === 0 && exercises.length === 0 && gyms.length === 0 && (
        <EmptyState icon="search" title={`No results for "${query}"`} sub="Try a different name, exercise or gym." />
      )}

      {!loading && searched && (
        <div className="space-y-6">
          {/* People */}
          {(activeTab === 'all' || activeTab === 'users') && users.length > 0 && (
            <div>
              <p className="text-white/35 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
                <UserIcon className="w-3.5 h-3.5" /> People
              </p>
              <div className="space-y-2">
                {users.map(u => <UserCard key={u.uid} u={u} />)}
              </div>
            </div>
          )}

          {/* Exercises */}
          {(activeTab === 'all' || activeTab === 'exercises') && exercises.length > 0 && (
            <div>
              <p className="text-white/35 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
                <Dumbbell className="w-3.5 h-3.5" /> Exercises
              </p>
              <div className="space-y-2">
                {exercises.map(ex => (
                  <div key={ex.id} className="p-3.5 rounded-2xl bg-[#080608] border border-[rgba(201,169,110,0.08)] hover:border-[rgba(201,169,110,0.25)] transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm">{ex.name}</p>
                          <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-[10px] border border-fuchsia-500/20">{ex.difficulty}</span>
                          <span className="px-2 py-0.5 rounded-full bg-[rgba(201,169,110,0.05)] text-white/40 text-[10px]">{ex.category}</span>
                        </div>
                        {ex.primaryMuscles?.length > 0 && (
                          <p className="text-white/35 text-xs mt-1">{ex.primaryMuscles.slice(0,3).join(' · ')}</p>
                        )}
                        {ex.equipment?.length > 0 && (
                          <p className="text-white/25 text-xs mt-0.5">{ex.equipment.slice(0,3).join(', ')}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ex.authorAvatar
                          ? <img src={ex.authorAvatar} className="w-5 h-5 rounded-full object-cover" />
                          : <div className="w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center text-white text-[9px]">{ex.authorName?.[0]}</div>
                        }
                        {ex.authorVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#c9a96e]" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gyms */}
          {(activeTab === 'all' || activeTab === 'gyms') && gyms.length > 0 && (
            <div>
              <p className="text-white/35 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
                🏛️ Gyms
              </p>
              <div className="space-y-2">
                {gyms.map(gym => (
                  <div key={gym.id} className="rounded-2xl bg-[#080608] border border-[rgba(201,169,110,0.08)] hover:border-white/[0.12] overflow-hidden transition-all">
                    {gym.coverPhoto && (
                      <img src={gym.coverPhoto} className="w-full h-24 object-cover" alt={gym.name} />
                    )}
                    <div className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-white font-semibold text-sm">{gym.name}</p>
                          <p className="text-white/40 text-xs mt-0.5">{gym.city}{gym.address ? ` · ${gym.address}` : ''}</p>
                        </div>
                        {gym.monthlyFee && (
                          <span className="text-emerald-300 text-xs font-semibold shrink-0">from £{gym.monthlyFee}/mo</span>
                        )}
                      </div>
                      {gym.amenities?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {gym.amenities.map((a: string) => (
                            <span key={a} className="px-2 py-0.5 rounded-full bg-[rgba(201,169,110,0.04)] text-white/35 text-[10px]">{a}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workouts */}
          {(activeTab === 'all' || activeTab === 'posts') && posts.length > 0 && (
            <div>
              <p className="text-white/35 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
                <Dumbbell className="w-3.5 h-3.5" /> Workouts
              </p>
              <div className="space-y-2">
                {posts.map(p => (
                  <div key={p.id} onClick={() => p.user?.id && onViewProfile(p.user.id)}
                    className="p-3.5 rounded-2xl bg-[#080608] border border-[rgba(201,169,110,0.08)] hover:border-white/[0.12] cursor-pointer transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-[#a07840] shrink-0 flex items-center justify-center">
                        {p.user?.avatar ? <img src={p.user.avatar} className="w-full h-full object-cover" /> : <span className="text-white text-xs">{p.user?.name?.[0]}</span>}
                      </div>
                      <p className="text-white/55 text-xs">@{p.user?.username}</p>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#c9a96e]/15 text-[#e8c98a] border border-[rgba(201,169,110,0.18)]">{p.workoutType}</span>
                    </div>
                    {p.caption && (
                      <p className="text-white/70 text-sm mb-2 leading-relaxed">
                        {p.caption.split(/(#\w+)/g).map((part: string, i: number) =>
                          part.startsWith('#')
                            ? <span key={i} className="text-[#c9a96e] font-medium" onClick={e => { e.stopPropagation(); onHashtag?.(part.slice(1)); }}>{part}</span>
                            : part
                        )}
                      </p>
                    )}
                    <div className="flex gap-3 text-white/30 text-xs">
                      <span>❤️ {p.likes||0}</span><span>⏱ {p.duration}min</span><span>🔥 {p.calories}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
