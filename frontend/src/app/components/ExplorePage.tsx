// ExplorePage.tsx — Discover · Trainers · Trending

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Filter, Star, Video, Users, ChevronRight, Flame, Dumbbell, BadgeCheck, UserPlus, Loader2, MapPin, Target, TrendingUp, Briefcase, Building2 } from 'lucide-react';
import { authHeaders } from '../../utils/authToken';
import { User, WorkoutPost } from '../types';
import { getDiscoverPosts, getTrainers, getTrending, getSuggestedUsers } from '../../services/exploreService';
import { followUser, getSentRequestUids } from '../../services/followService';
import { toast } from 'sonner';

import { API } from '../../config';

interface SearchUser {
  uid: string; name: string; username: string; avatar: string;
  accountType: string; bio: string; followers: number;
}

function UserResultCard({ user, currentUserId, following, pendingRequests, onFollow, onViewProfile }: {
  user: SearchUser;
  currentUserId?: string;
  following: Set<string>;
  pendingRequests: Set<string>;
  onFollow: (uid: string, name: string) => void;
  onViewProfile?: (uid: string) => void;
}) {
  const initials = (user.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.08)] hover:border-[rgba(201,169,110,0.12)] hover:bg-[rgba(201,169,110,0.04)] transition-all cursor-pointer"
      onClick={() => onViewProfile?.(user.uid)}
    >
      {user.avatar
        ? <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
        : <div className="w-10 h-10 rounded-full bg-[#c9a96e] flex items-center justify-center text-white text-sm font-semibold shrink-0">{initials}</div>
      }
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-white font-medium text-sm truncate">{user.name}</p>
          {user.accountType !== 'user' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${user.accountType === 'trainer' ? 'bg-orange-500/20 text-orange-300' : 'bg-[rgba(201,169,110,0.12)] text-[#e8c98a]'}`}>
              {user.accountType}
            </span>
          )}
        </div>
        <p className="text-white/40 text-xs">@{user.username} · {(user.followers || 0).toLocaleString()} followers</p>
        {user.bio && <p className="text-white/30 text-xs truncate mt-0.5">{user.bio}</p>}
      </div>
      {user.uid !== currentUserId && !following.has(user.uid) && !pendingRequests.has(user.uid) && (
        <button
          onClick={e => { e.stopPropagation(); onFollow(user.uid, user.name); }}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-white/50 border border-[rgba(201,169,110,0.12)] hover:text-[#e8c98a] hover:border-[rgba(201,169,110,0.25)] hover:bg-[rgba(201,169,110,0.04)] transition-all"
        >
          <UserPlus className="w-3 h-3" /> Follow
        </button>
      )}
      {pendingRequests.has(user.uid) && (
        <span className="shrink-0 text-xs text-yellow-400/80 font-medium border border-yellow-500/20 px-2 py-0.5 rounded-lg">Requested</span>
      )}
      {following.has(user.uid) && (
        <span className="shrink-0 text-xs text-[#c9a96e] font-medium">Following ✓</span>
      )}
    </div>
  );
}

function TrainerCard({ trainer, onBook }: { trainer: any; onBook: (t: any) => void }) {
  const initials = (trainer.displayName || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const ti = trainer.trainerInfo;
  return (
    <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-4 hover:border-[rgba(201,169,110,0.18)] transition-all">
      <div className="flex items-start gap-3 mb-3">
        {trainer.avatar
          ? <img src={trainer.avatar} alt={trainer.displayName} className="w-12 h-12 rounded-xl object-cover shrink-0" />
          : <div className="w-12 h-12 rounded-xl bg-[#c9a96e] flex items-center justify-center text-white font-semibold shrink-0">{initials}</div>
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-white font-medium text-sm truncate">{trainer.displayName}</p>
            {(trainer as any).verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-label="Verified" />}
          </div>
          <p className="text-white/40 text-xs">@{trainer.username}</p>
          {ti?.rating && (
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-yellow-300 text-xs font-medium">{ti.rating}</span>
              {ti.totalSessions && <span className="text-white/30 text-xs">· {ti.totalSessions} sessions</span>}
            </div>
          )}
        </div>
        {ti?.hourlyRate && (
          <div className="text-right shrink-0">
            <p className="text-[#e8c98a] font-bold text-sm">{ti.currency || '$'}{ti.hourlyRate}</p>
            <p className="text-white/30 text-xs">/hr</p>
          </div>
        )}
      </div>
      {trainer.bio && <p className="text-white/50 text-xs leading-relaxed mb-3 line-clamp-2">{trainer.bio}</p>}
      {ti?.specialties?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {ti.specialties.slice(0, 4).map((s: string) => (
            <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(201,169,110,0.08)] text-[#e8c98a] border border-[rgba(201,169,110,0.18)]">{s}</span>
          ))}
          {ti.specialties.length > 4 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(201,169,110,0.04)] text-white/30">+{ti.specialties.length - 4}</span>}
        </div>
      )}
      <div className="flex items-center gap-3 mb-3">
        {ti?.sessionTypes?.map((t: string) => (
          <div key={t} className="flex items-center gap-1 text-white/40 text-xs">
            {t === 'online' ? <Video className="w-3 h-3" /> : <Users className="w-3 h-3" />}
            {t}
          </div>
        ))}
        {ti?.experience > 0 && <span className="text-white/30 text-xs ml-auto">{ti.experience}y exp</span>}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-white/30 text-xs">{(trainer.followers || 0).toLocaleString()} followers</span>
        {ti ? (
          <button onClick={() => onBook(trainer)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#c9a96e] text-white text-xs font-medium hover:bg-[#c9a96e] transition-all">
            Book session <ChevronRight className="w-3 h-3" />
          </button>
        ) : (
          <button className="px-3 py-1.5 rounded-lg border border-[rgba(201,169,110,0.12)] text-white/50 text-xs hover:bg-[rgba(201,169,110,0.04)] transition-all">View profile</button>
        )}
      </div>
    </div>
  );
}

function TrendingChart({ data }: { data: { exercise: string; count: number }[] }) {
  if (!data.length) return <p className="text-white/30 text-sm text-center py-8">No workout data in the last 24h yet</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="space-y-2.5">
      {data.map((item, i) => (
        <div key={item.exercise} className="flex items-center gap-3">
          <div className="w-6 text-right shrink-0">
            <span className={`text-xs font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-white/50' : i === 2 ? 'text-orange-400/70' : 'text-white/25'}`}>{i + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/80 text-sm truncate">{item.exercise}</span>
              <span className="text-white/40 text-xs ml-2 shrink-0">{item.count} post{item.count !== 1 ? 's' : ''}</span>
            </div>
            <div className="h-2 bg-[rgba(201,169,110,0.04)] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${i === 0 ? 'bg-yellow-400' : i < 3 ? 'bg-[#c9a96e]' : 'bg-[rgba(201,169,110,0.04)]0'}`}
                style={{ width: `${Math.round((item.count / max) * 100)}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DiscoverCard({ post, onViewProfile }: { post: WorkoutPost; onViewProfile?: (uid: string) => void }) {
  const u = post.user;
  const initials = (u?.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => u?.id && onViewProfile?.(u.id)}>
        {u?.avatar
          ? <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
          : <div className="w-9 h-9 rounded-full bg-[#c9a96e] flex items-center justify-center text-white text-xs font-semibold shrink-0">{initials}</div>
        }
        <div>
          <p className="text-white font-medium text-sm hover:text-[#e8c98a] transition-colors">{u?.name}</p>
          <p className="text-white/35 text-xs">{post.workoutType} · {post.duration}min · {post.calories}kcal</p>
        </div>
      </div>
      {post.caption && <p className="text-white/70 text-sm leading-relaxed mb-3">{post.caption}</p>}
      <div className="flex items-center gap-4 text-white/30 text-xs">
        <span>❤️ {post.likes || 0}</span>
        <span>💬 {post.comments?.length || 0}</span>
        <span className="ml-auto">{post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ''}</span>
      </div>
    </div>
  );
}

const SPECIALTIES = ['All','Strength Training','HIIT','Weight Loss','Yoga','Cardio','Crossfit','Nutrition'];
const SESSION_TYPES = ['All','online','in-person'];

interface ExplorePageProps { currentUser: User | null; onViewProfile?: (uid: string) => void; }

export function ExplorePage({ currentUser, onViewProfile }: ExplorePageProps) {
  const [tab, setTab] = useState<'discover'|'trainers'|'trending'>('discover');
  const [posts, setPosts] = useState<WorkoutPost[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [trending, setTrending] = useState<{exercise:string;count:number}[]>([]);
  const [trendTotal, setTrendTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('All');
  const [filterSession, setFilterSession] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  // User search results from backend API
  const [searchUsers, setSearchUsers] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // People you may know — shown in Discover when no search query
  const [suggestedUsers, setSuggestedUsers] = useState<SearchUser[]>([]);

  // Near Me
  const [nearMeActive, setNearMeActive] = useState(false);
  const [nearMeUsers, setNearMeUsers]   = useState<SearchUser[]>([]);
  const [nearMeLoading, setNearMeLoading] = useState(false);

  // People Like You
  const [peopleLikeYou, setPeopleLikeYou] = useState<SearchUser[]>([]);

  // Trainer Spotlight
  const [spotlightTrainers, setSpotlightTrainers] = useState<any[]>([]);

  // Mini trending (shown in Discover tab)
  const [miniTrending, setMiniTrending] = useState<{exercise:string;count:number}[]>([]);

  // Load pending sent requests on mount so buttons show "Requested" correctly
  useEffect(() => {
    if (!currentUser) return;
    getSentRequestUids().then(uids => setPendingRequests(new Set(uids))).catch(() => {});
  }, [currentUser]);

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      if (tab === 'discover') {
        const [postsData, suggested] = await Promise.allSettled([
          getDiscoverPosts(currentUser.id),
          getSuggestedUsers(currentUser.id),
        ]);
        if (postsData.status === 'fulfilled') setPosts(postsData.value);
        if (suggested.status === 'fulfilled') setSuggestedUsers(suggested.value);
        // People Like You
        try {
          const plr = await fetch(`${API}/users/people-like-me`, { headers: authHeaders() });
          if (plr.ok) { const pld = await plr.json(); setPeopleLikeYou(pld.users || []); }
        } catch { /* not critical */ }
        // Mini trending teaser
        try {
          const tr = await getTrending();
          setMiniTrending((tr.trending || []).slice(0, 5));
        } catch { /* not critical */ }
        // Trainer Spotlight
        try {
          const sr = await fetch(`${API}/explore/trainer-spotlight`, { headers: authHeaders() });
          if (sr.ok) { const sd = await sr.json(); setSpotlightTrainers(sd.trainers || []); }
        } catch { /* not critical */ }
      }
      else if (tab === 'trainers') { const d = await getTrainers(); setTrainers(d); }
      else { const d = await getTrending(); setTrending(d.trending || []); setTrendTotal(d.totalPosts || 0); }
    } catch { toast.error('Could not load data'); }
    finally { setLoading(false); }
  }, [tab, currentUser]);

  useEffect(() => { load(); }, [load]);

  // Debounced backend user search — fires 350ms after the user stops typing
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (search.trim().length < 2) { setSearchUsers([]); return; }
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        // Strip leading @ so "@coach_marcus" finds user "coach_marcus"
        const q = search.trim().replace(/^@/, '');
        const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}&type=users`);
        const data = await res.json();
        setSearchUsers(data.users || []);
      } catch { /* silent — don't disrupt the page */ }
      finally { setSearchLoading(false); }
    }, 350);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search]);

  const handleNearMe = async () => {
    if (!currentUser) return toast.error('Log in first');
    const gym = (currentUser as any).gym;
    if (!gym) { toast.info('Add your gym in Settings → Profile to use this filter'); return; }
    if (nearMeActive) { setNearMeActive(false); setNearMeUsers([]); return; }
    setNearMeLoading(true);
    setNearMeActive(true);
    try {
      const res = await fetch(`${API}/users/near-me?gym=${encodeURIComponent(gym)}`, { headers: authHeaders() });
      const data = await res.json();
      setNearMeUsers(data.users || []);
    } catch { toast.error('Could not load nearby users'); }
    finally { setNearMeLoading(false); }
  };

  const handleFollow = async (uid: string, name: string) => {
    if (!currentUser) return toast.error('Log in to follow');
    try {
      const result = await followUser(uid);
      if (result.alreadyFollowing) {
        setFollowing(prev => new Set([...prev, uid]));
      } else if (result.alreadyRequested) {
        setPendingRequests(prev => new Set([...prev, uid]));
        toast.info(`Request already sent to ${name}`);
      } else {
        // New request sent
        setPendingRequests(prev => new Set([...prev, uid]));
        setSuggestedUsers(prev => prev.filter(u => u.uid !== uid));
        toast.success(`Follow request sent to ${name}!`);
      }
    } catch { toast.error('Follow request failed'); }
  };

  const filteredTrainers = trainers.filter(t => {
    const name = (t.displayName || t.name || '').toLowerCase();
    const ms = !search || name.includes(search.toLowerCase()) || t.trainerInfo?.specialties?.some((s:string) => s.toLowerCase().includes(search.toLowerCase()));
    const msp = filterSpecialty === 'All' || t.trainerInfo?.specialties?.includes(filterSpecialty);
    const mse = filterSession === 'All' || t.trainerInfo?.sessionTypes?.includes(filterSession);
    return ms && msp && mse;
  });

  const filteredPosts = posts.filter(p => !search ||
    p.caption?.toLowerCase().includes(search.toLowerCase()) ||
    p.workoutType?.toLowerCase().includes(search.toLowerCase()) ||
    p.user?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">
      <div>
        <h1 className="text-white font-semibold text-xl">Explore</h1>
        <p className="text-white/40 text-sm mt-0.5">Discover workouts, trainers and trends</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'trainers' ? 'Search trainers or specialties…' : 'Search workouts or users…'}
          className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]" />
      </div>

      <div className="flex gap-1 bg-[rgba(201,169,110,0.04)] p-1 rounded-xl">
        {([['discover','Discover'],['trainers','Trainers'],['trending','Trending']] as const).map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSearch(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'trainers' && (
        <div>
          <button onClick={() => setShowFilters(f => !f)} className="flex items-center gap-2 text-white/50 text-sm hover:text-white/80 transition-colors mb-3">
            <Filter className="w-3.5 h-3.5" />
            {showFilters ? 'Hide filters' : 'Show filters'}
            {(filterSpecialty !== 'All' || filterSession !== 'All') && <span className="text-xs bg-[rgba(201,169,110,0.12)] text-[#e8c98a] px-1.5 py-0.5 rounded-full">active</span>}
          </button>
          {showFilters && (
            <div className="bg-[rgba(201,169,110,0.04)] rounded-xl p-4 space-y-3">
              <div>
                <p className="text-white/40 text-xs mb-2">Specialty</p>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALTIES.map(s => (
                    <button key={s} onClick={() => setFilterSpecialty(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${filterSpecialty === s ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.45)] text-[#e8c98a]' : 'border-[rgba(201,169,110,0.12)] text-white/50 hover:border-[rgba(201,169,110,0.18)]'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-white/40 text-xs mb-2">Session type</p>
                <div className="flex gap-2">
                  {SESSION_TYPES.map(s => (
                    <button key={s} onClick={() => setFilterSession(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all capitalize ${filterSession === s ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.45)] text-[#e8c98a]' : 'border-[rgba(201,169,110,0.12)] text-white/50 hover:border-[rgba(201,169,110,0.18)]'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'trending' && trendTotal > 0 && (
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <p className="text-white/60 text-sm"><span className="text-white font-medium">{trendTotal}</span> workouts posted in the last 24 hours</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-2xl border border-[rgba(201,169,110,0.08)] p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[rgba(201,169,110,0.06)] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-[rgba(201,169,110,0.06)]" />
                  <div className="h-2 w-20 rounded bg-[rgba(201,169,110,0.04)]" />
                </div>
                <div className="h-7 w-16 rounded-lg bg-[rgba(201,169,110,0.05)]" />
              </div>
              <div className="h-2.5 w-full rounded bg-[rgba(201,169,110,0.04)]" />
              <div className="h-2.5 w-3/4 rounded bg-white/4" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {tab === 'discover' && (
            <div className="space-y-5">
              {/* User search results — shown only when query is typed */}
              {search.trim().length >= 2 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-white/40" />
                    <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">People</p>
                    {searchLoading && <Loader2 className="w-3 h-3 text-[#c9a96e] animate-spin ml-1" />}
                  </div>
                  {!searchLoading && searchUsers.length === 0 && (
                    <p className="text-white/30 text-sm text-center py-4">No users found for "{search}"</p>
                  )}
                  {searchUsers.length > 0 && (
                    <div className="space-y-2">
                      {searchUsers.map(u => (
                        <UserResultCard
                          key={u.uid}
                          user={u}
                          currentUserId={currentUser?.id}
                          following={following}
                          pendingRequests={pendingRequests}
                          onFollow={handleFollow}
                          onViewProfile={onViewProfile}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Post results */}
              {search.trim().length >= 2 && filteredPosts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Dumbbell className="w-4 h-4 text-white/40" />
                    <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Workouts</p>
                  </div>
                  <div className="space-y-3">{filteredPosts.map(p => <DiscoverCard key={p.id} post={p} onViewProfile={onViewProfile} />)}</div>
                </div>
              )}

              {/* Default discover feed (no search active) */}
              {search.trim().length < 2 && (
                <div className="space-y-5">

                  {/* ── Gym Mates toggle ── */}
                  {currentUser && (
                    <div>
                      <button
                        onClick={handleNearMe}
                        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          nearMeActive
                            ? 'bg-[#c9a96e]/15 border-[#c9a96e]/40 text-[#e8c98a]'
                            : 'border-[rgba(201,169,110,0.12)] text-white/50 hover:border-[rgba(201,169,110,0.25)] hover:text-white/80'
                        }`}
                      >
                        <Building2 className={`w-4 h-4 ${nearMeActive ? 'text-[#c9a96e]' : 'text-white/30'}`} />
                        {nearMeActive
                          ? `Members at ${(currentUser as any).gym || 'your gym'}`
                          : (currentUser as any).gym
                            ? `From my gym · ${(currentUser as any).gym}`
                            : 'Find gym mates'}
                        {nearMeLoading && <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />}
                      </button>

                      {nearMeActive && !nearMeLoading && (
                        <div className="mt-3">
                          {nearMeUsers.length === 0 ? (
                            <p className="text-white/30 text-sm py-3">No other Flex users found at your gym yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {nearMeUsers.map(u => (
                                <UserResultCard key={u.uid} user={u} currentUserId={currentUser?.id} following={following} pendingRequests={pendingRequests} onFollow={handleFollow} onViewProfile={onViewProfile} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Mini Trending teaser ── */}
                  {miniTrending.length > 0 && (
                    <button
                      onClick={() => setTab('trending')}
                      className="w-full bg-gradient-to-r from-[rgba(201,169,110,0.04)] to-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 text-left hover:border-[#c9a96e]/25 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4 text-orange-400" />
                          <p className="text-white/80 text-sm font-medium">Trending exercises this week</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-[#c9a96e] transition-colors" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {miniTrending.map((ex, i) => (
                          <span key={ex.exercise} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            i === 0 ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300' :
                            i === 1 ? 'bg-orange-500/15 border-orange-500/25 text-orange-300' :
                            'bg-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.12)] text-white/55'
                          }`}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`} {ex.exercise}
                            <span className="opacity-60">·{ex.count}</span>
                          </span>
                        ))}
                      </div>
                    </button>
                  )}

                  {/* ── People Like You ── */}
                  {peopleLikeYou.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-4 h-4 text-[#c9a96e]" />
                        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">People like you 🎯</p>
                        <span className="text-white/20 text-xs">· same goal or level</span>
                      </div>
                      <div className="space-y-2">
                        {peopleLikeYou.slice(0, 5).map(u => (
                          <UserResultCard key={u.uid} user={u} currentUserId={currentUser?.id} following={following} pendingRequests={pendingRequests} onFollow={handleFollow} onViewProfile={onViewProfile} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Trainer Spotlight ── */}
                  {spotlightTrainers.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-amber-400" />
                          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Find a trainer ✨</p>
                        </div>
                        <button
                          onClick={() => setTab('trainers')}
                          className="text-[11px] text-[#c9a96e] hover:text-[#e8c98a] font-medium transition-colors"
                        >
                          See all →
                        </button>
                      </div>
                      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                        {spotlightTrainers.map((t: any) => {
                          const initials = (t.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                          return (
                            <button
                              key={t.uid}
                              onClick={() => onViewProfile?.(t.uid)}
                              className="flex-none w-36 bg-gradient-to-b from-white/6 to-white/3 border border-[rgba(201,169,110,0.07)] hover:border-amber-500/30 rounded-2xl p-3 text-center transition-all group"
                            >
                              {t.avatar
                                ? <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full object-cover mx-auto mb-2 border-2 border-amber-500/30" />
                                : <div className="w-12 h-12 rounded-full bg-amber-600/40 flex items-center justify-center text-amber-200 text-base font-bold mx-auto mb-2 border-2 border-amber-500/30">{initials}</div>
                              }
                              <div className="flex items-center justify-center gap-1 mb-0.5">
                                <p className="text-white text-xs font-semibold truncate">{t.name}</p>
                                {t.verified && <BadgeCheck className="w-3 h-3 text-blue-400 shrink-0" />}
                              </div>
                              {t.specialty && (
                                <p className="text-white/35 text-[10px] truncate">{t.specialty}</p>
                              )}
                              {t.rating > 0 && (
                                <div className="flex items-center justify-center gap-0.5 mt-1">
                                  <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                                  <span className="text-yellow-300 text-[10px] font-medium">{t.rating.toFixed(1)}</span>
                                </div>
                              )}
                              <div className="mt-2 text-[10px] text-amber-400/80 font-medium group-hover:text-amber-300 transition-colors">Book →</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}


                  {/* ── People you may know ── */}
                  {suggestedUsers.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-4 h-4 text-white/40" />
                        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">People you may know</p>
                      </div>
                      <div className="space-y-2">
                        {suggestedUsers.map(u => (
                          <UserResultCard key={u.uid} user={u} currentUserId={currentUser?.id} following={following} pendingRequests={pendingRequests} onFollow={handleFollow} onViewProfile={onViewProfile} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Recent posts ── */}
                  {filteredPosts.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Dumbbell className="w-4 h-4 text-white/40" />
                        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Recent workouts</p>
                      </div>
                      <div className="space-y-3">{filteredPosts.map(p => <DiscoverCard key={p.id} post={p} onViewProfile={onViewProfile} />)}</div>
                    </div>
                  )}

                  {suggestedUsers.length === 0 && filteredPosts.length === 0 && peopleLikeYou.length === 0 && (
                    <div className="text-center py-16">
                      <Dumbbell className="w-8 h-8 text-white/10 mx-auto mb-3" />
                      <p className="text-white/40 text-sm">No content to discover yet.</p>
                      <p className="text-white/25 text-xs mt-1">Follow some users and they will start appearing here</p>
                    </div>
                  )}
                </div>
              )}

              {/* Nothing at all for this search */}
              {search.trim().length >= 2 && !searchLoading && searchUsers.length === 0 && filteredPosts.length === 0 && (
                <div className="text-center py-12">
                  <Search className="w-8 h-8 text-white/10 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">No results for &quot;{search}&quot;</p>
                  <p className="text-white/25 text-xs mt-1">Try a different name, username, or workout type</p>
                </div>
              )}
            </div>
          )}
          {tab === 'trainers' && (
            filteredTrainers.length === 0
              ? <div className="text-center py-16"><BadgeCheck className="w-8 h-8 text-white/10 mx-auto mb-3" /><p className="text-white/40 text-sm">No trainers found.</p>{filterSpecialty !== 'All' && <button onClick={() => setFilterSpecialty('All')} className="text-[#c9a96e] text-xs mt-2 hover:underline">Clear filter</button>}</div>
              : <div className="space-y-3"><p className="text-white/30 text-xs">{filteredTrainers.length} trainer{filteredTrainers.length !== 1 ? 's' : ''} found</p>{filteredTrainers.map(t => <TrainerCard key={t.uid} trainer={t} onBook={tr => onViewProfile?.(tr.uid)} />)}</div>
          )}
          {tab === 'trending' && (
            <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-5"><Flame className="w-4 h-4 text-orange-400" /><p className="text-white font-medium text-sm">Top exercises today</p></div>
              <TrendingChart data={trending} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
