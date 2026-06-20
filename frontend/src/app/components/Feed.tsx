import { API } from '../../config';
// Feed.tsx
// Center column — the paginated list of workout posts.
//
// What this component does:
//   1. Loads the first page of posts on mount (with 30-second cache)
//   2. Reports posts up to App.tsx via onPostsLoaded
//   3. Silently polls every 15 s and shows a "New posts" banner
//   4. Renders skeleton placeholders while loading
//   5. Supports "Load more" button for pagination
//   6. Handles like, comment, repost, and share actions

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Plus, Dumbbell, Loader2, SlidersHorizontal, TrendingUp, Clock } from "lucide-react";
import { WorkoutPost, User } from "../types";
import { WorkoutCard } from "./WorkoutCard";
import { WorkoutCardSkeleton } from "./WorkoutCardSkeleton";
import { CommunityPulse } from "./CommunityPulse";
import { Button } from "./ui/button";
import { CreatePostDialog } from "./CreatePostDialog";
import { toast } from "sonner";
import {
  fetchPosts,
  createPostAPI,
  likePostAPI,
  addCommentAPI,
  repostAPI,
} from "../../services/postService";
import { fireXP, XP_EVENT } from "../../services/xpService";

interface FeedProps {
  currentUserId?: string;
  currentUser?: User | null;
  onPostsLoaded?: (posts: WorkoutPost[]) => void;
  isCreateDialogOpen?: boolean;
  onCreateDialogChange?: (open: boolean) => void;
  onViewPost?: (postId: string) => void;
}

export function Feed({
  currentUserId: currentUserIdProp,
  currentUser,
  onPostsLoaded,
  isCreateDialogOpen = false,
  onCreateDialogChange,
  onViewPost,
}: FeedProps) {
  // Derive the effective user ID — App.tsx only passes currentUser, not currentUserId
  const currentUserId = currentUserIdProp ?? currentUser?.id;
  const [livePosts,         setLivePosts]         = useState<WorkoutPost[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [loadingMore,       setLoadingMore]       = useState(false);
  const [hasMore,           setHasMore]           = useState(false);
  const [nextCursor,        setNextCursor]        = useState<string | null>(null);
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const [newPostsCount,     setNewPostsCount]     = useState(0);
  // Filter + sort state
  const [activeFilter,      setActiveFilter]      = useState<string>('all');
  const [sortBy,            setSortBy]            = useState<'newest' | 'trending'>('newest');
  const [followingIds,      setFollowingIds]      = useState<Set<string>>(new Set());

  const latestTimestampRef = useRef<string>('');
  const POLL_INTERVAL      = 15_000;

  // Load following list for the "Following" filter
  useEffect(() => {
    if (!currentUserId) return;
    fetch(`${API}/users/${currentUserId}/following`)
      .then(r => r.json())
      .then(d => {
        const ids = (d.following || []).map((u: any) => u.id || u.uid || u);
        setFollowingIds(new Set(ids));
      })
      .catch(() => {});
  }, [currentUserId]);

  // Derive all unique workout types from loaded posts (for filter chips)
  const workoutTypes = useMemo(() => {
    const types = new Set(livePosts.map(p => {
      // For typed posts, use the type as filter key; for old workout posts use workoutType
      const t = (p as any).type;
      if (t && t !== 'workout') return t;
      return (p as any).workoutType || '';
    }).filter(Boolean));
    return [...types].slice(0, 6);
  }, [livePosts]);

  // Apply active filter + sort on top of livePosts
  const displayPosts = useMemo(() => {
    let posts = [...livePosts];
    if (activeFilter === 'following') {
      posts = posts.filter(p => followingIds.has(p.user?.id || ''));
    } else if (activeFilter !== 'all') {
      posts = posts.filter(p => {
        const t = (p as any).type;
        const key = (t && t !== 'workout') ? t : ((p as any).workoutType || '');
        return key === activeFilter;
      });
    }
    if (sortBy === 'trending') {
      posts = [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }
    return posts;
  }, [livePosts, activeFilter, sortBy, followingIds]);

  // ── Apply like-state for the current user ────────────────────────────────
  const applyLikeState = useCallback(
    (posts: WorkoutPost[]): WorkoutPost[] =>
      posts.map(p => ({
        ...p,
        isLiked: p.likedBy?.includes(currentUserId || '') || false,
      })),
    [currentUserId]
  );

  // ── Load (or refresh) the first page ─────────────────────────────────────
  const loadPosts = useCallback(async (silent = false) => {
    try {
      const result    = await fetchPosts(null);
      const withLikes = applyLikeState(result.posts);
      setLivePosts(withLikes);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
      onPostsLoaded?.(withLikes);
      if (withLikes.length > 0) {
        latestTimestampRef.current =
          withLikes[0].createdAt || withLikes[0].timestamp || '';
      }
      setNewPostsAvailable(false);
      setNewPostsCount(0);
    } catch (err) {
      if (!silent) {
        console.error('Failed to load posts:', err);
        toast.error('Could not load posts — is the server running?');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [applyLikeState, onPostsLoaded]);

  // ── Load the next page and append ────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result    = await fetchPosts(nextCursor);
      const withLikes = applyLikeState(result.posts);
      setLivePosts(prev => [...prev, ...withLikes]);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch {
      toast.error('Could not load more posts.');
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, applyLikeState]);

  // ── Silent background poll ────────────────────────────────────────────────
  const silentPoll = useCallback(async () => {
    try {
      const result = await fetchPosts(null);
      if (result.posts.length === 0) return;
      const newest = result.posts[0].createdAt || result.posts[0].timestamp || '';
      if (newest && newest !== latestTimestampRef.current && latestTimestampRef.current) {
        setNewPostsAvailable(true);
        setNewPostsCount(result.posts.length);
      }
      // Silently update like/comment counts on existing posts
      setLivePosts(prev =>
        prev.map(existing => {
          const updated = result.posts.find(d => d.id === existing.id);
          if (!updated) return existing;
          return {
            ...existing,
            likes:    updated.likes,
            comments: updated.comments,
            likedBy:  updated.likedBy,
            isLiked:  updated.likedBy?.includes(currentUserId || '') || false,
          };
        })
      );
    } catch { /* silent — don't show error for background polls */ }
  }, [currentUserId]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  useEffect(() => {
    const interval = setInterval(silentPoll, POLL_INTERVAL);
    const onFocus  = () => silentPoll();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [silentPoll]);

  // ── Create post ──────────────────────────────────────────────────────────
  const handleCreatePost = async (newPost: Partial<WorkoutPost>) => {
    if (!currentUser) { toast.error('Please log in to create a post'); return; }
    try {
      toast.loading('Creating post...', { id: 'create-post' });
      await createPostAPI({ ...newPost, user: currentUser });
      // Update streak server-side so RightSidebar shows accurate count
      fetch(`${API}/users/${currentUser.id}/update-streak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('fitconnect_id_token')}` },
      }).catch(() => {});
      // Award XP: +50 for every post, +100 one-time bonus for very first post
      fireXP(currentUser.id, XP_EVENT.POST_CREATED);
      fireXP(currentUser.id, XP_EVENT.POST_CREATED_FIRST, 'post_created_first');
      await loadPosts();
      toast.success('Workout posted! 💪', { id: 'create-post' });
    } catch {
      toast.error('Failed to create post', { id: 'create-post' });
    }
  };

  // ── Like / Unlike (optimistic) ───────────────────────────────────────────
  const handleLike = (postId: string) => {
    if (!currentUserId) { toast.error('Please log in to like posts'); return; }
    setLivePosts(prev =>
      prev.map(post => {
        if (post.id !== postId) return post;
        const liked = post.likedBy?.includes(currentUserId) || false;
        return {
          ...post,
          isLiked: !liked,
          likes:   liked ? Math.max(0, post.likes - 1) : post.likes + 1,
          likedBy: liked
            ? (post.likedBy || []).filter(id => id !== currentUserId)
            : [...(post.likedBy || []), currentUserId],
        };
      })
    );
    likePostAPI(postId, currentUserId).catch(err =>
      console.error('Like sync failed:', err)
    );
  };

  // ── Add comment ──────────────────────────────────────────────────────────
  const handleComment = (postId: string, text: string, image?: string | null) => {
    if (!currentUserId || (!text.trim() && !image)) return;
    const commentUser = currentUser
      ? { name: currentUser.name, username: currentUser.username, avatar: currentUser.avatar, accountType: currentUser.accountType }
      : { name: 'You', username: 'you', avatar: '' };
    const newComment = {
      id:        `c_${Date.now()}`,
      text:      text.trim(),
      image:     image || null,
      timestamp: new Date().toISOString(),
      user:      commentUser,
    };
    setLivePosts(prev =>
      prev.map(post =>
        post.id === postId
          ? { ...post, comments: [...(post.comments || []), newComment as any] }
          : post
      )
    );
    addCommentAPI(postId, text, commentUser as Record<string, unknown>, image || undefined).catch(err =>
      console.error('Comment sync failed:', err)
    );
    // Award XP for leaving a comment
    if (currentUserId) fireXP(currentUserId, XP_EVENT.COMMENT_LEFT);
  };

  // ── Post updated (edit dialog callback) ──────────────────────────────────
  const handlePostUpdated = (postId: string, changes: Partial<WorkoutPost>) => {
    setLivePosts(prev =>
      prev.map(post => post.id === postId ? { ...post, ...changes } : post)
    );
  };

  // ── Post deleted ─────────────────────────────────────────────────────────
  const handleDeletePost = (postId: string) => {
    setLivePosts(prev => prev.filter(post => post.id !== postId));
  };

  // ── Repost ────────────────────────────────────────────────────────────────
  const handleRepost = async (postId: string) => {
    if (!currentUser) return toast.error('Log in to repost');
    try {
      const newPost = await repostAPI(postId, currentUser as unknown as Record<string, unknown>);
      setLivePosts(prev => [newPost, ...prev]);
      toast.success('Reposted! 🔁');
    } catch (e: any) {
      if (e.message === 'already_reposted') toast.error('Already reposted');
      else toast.error('Repost failed');
    }
  };

  // ── Share — copy direct link to post ─────────────────────────────────────
  const handleShare = (postId: string) => {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied!')).catch(() => toast.error('Copy failed'));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 pb-20 lg:pb-4 space-y-4">

      {/* Create post button */}
      <Button
        onClick={() => onCreateDialogChange?.(true)}
        className="w-full bg-[rgba(201,169,110,0.12)] hover:bg-[rgba(201,169,110,0.18)] text-[#e8c98a] border border-[rgba(201,169,110,0.18)] rounded-xl py-3 text-sm font-medium transition-all"
        variant="ghost"
      >
        <Plus className="w-4 h-4 mr-2" />
        Log a workout
      </Button>

      {/* Filter + sort bar */}
      {!loading && livePosts.length > 0 && (
        <div className="flex flex-col gap-2">
          {/* Sort toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-white/40 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter</span>
            </div>
            <div className="flex gap-1 bg-[rgba(201,169,110,0.04)] p-0.5 rounded-lg">
              <button
                onClick={() => setSortBy('newest')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${sortBy === 'newest' ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/60'}`}
              >
                <Clock className="w-3 h-3" /> Newest
              </button>
              <button
                onClick={() => setSortBy('trending')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${sortBy === 'trending' ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/60'}`}
              >
                <TrendingUp className="w-3 h-3" /> Trending
              </button>
            </div>
          </div>
          {/* Filter chips */}
          <div className="flex gap-1.5 flex-wrap">
            {['all', 'following', ...workoutTypes].map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all border ${
                  activeFilter === f
                    ? 'bg-[rgba(201,169,110,0.18)] border-[rgba(201,169,110,0.5)] text-[#e8c98a]'
                    : 'border-[rgba(201,169,110,0.07)] text-white/35 hover:text-white/60 hover:border-[rgba(201,169,110,0.12)]'
                }`}
              >
                {f === 'all' ? 'All' : f === 'following' ? '👥 Following' : f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Community pulse bar */}
      <CommunityPulse />

      {/* Floating "new posts" pill — fixed at the top like Twitter */}
      {newPostsAvailable && (
        <div className="sticky top-14 z-30 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={() => loadPosts()}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full bg-[#c9a96e] hover:bg-[#c9a96e] text-white text-xs font-semibold shadow-lg shadow-[rgba(201,169,110,0.25)] transition-all active:scale-95"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {newPostsCount > 0 ? `${newPostsCount} new post${newPostsCount !== 1 ? 's' : ''}` : 'New posts'}
          </button>
        </div>
      )}

      {/* Post list */}
      {loading ? (
        <>
          <WorkoutCardSkeleton />
          <WorkoutCardSkeleton />
          <WorkoutCardSkeleton />
        </>
      ) : displayPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] flex items-center justify-center mb-4">
            <Dumbbell className="w-7 h-7 text-[#c9a96e]" />
          </div>
          <h3 className="text-white font-semibold text-base mb-1">
            {activeFilter === 'following' ? 'No posts from people you follow' : activeFilter !== 'all' ? `No ${activeFilter} posts yet` : 'No workouts yet'}
          </h3>
          <p className="text-white/35 text-sm max-w-xs">
            {activeFilter === 'following' ? 'Follow more people to see their workouts here.' : 'Be the first to log a workout and inspire others!'}
          </p>
        </div>
      ) : (
        <>
          {displayPosts.map(post => (
            <WorkoutCard
              key={post.id}
              post={post}
              currentUserId={currentUser?.id ?? currentUserId}
              currentUser={currentUser}
              onLike={handleLike}
              onComment={handleComment}
              onRepost={handleRepost}
              onShare={handleShare}
              onPostUpdated={handlePostUpdated}
              onDeletePost={handleDeletePost}
              onViewPost={onViewPost}
            />
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-2 pb-6">
              <Button
                onClick={loadMore}
                disabled={loadingMore}
                variant="ghost"
                className="text-white/50 hover:text-white/80 hover:bg-[rgba(201,169,110,0.04)] px-6"
              >
                {loadingMore
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</>
                  : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create post dialog */}
      <CreatePostDialog
        open={isCreateDialogOpen}
        onOpenChange={onCreateDialogChange}
        onCreatePost={handleCreatePost}
        currentUserId={currentUser?.id}
      />
    </div>
  );
}
