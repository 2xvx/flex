// PostDetailPage.tsx
// Full-page view for a single post — shows all comments, likes, and actions.
// Opened when a notification links to a specific post, or when a user
// taps "View post" from the feed. Supports deep-linking via /post/:id.

import { API } from '../../config';
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { WorkoutPost, User } from '../types';
import { WorkoutCard } from './WorkoutCard';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { likePostAPI, addCommentAPI, repostAPI } from '../../services/postService';

interface PostDetailPageProps {
  postId: string;
  currentUser: User | null;
  onBack: () => void;
}

export function PostDetailPage({ postId, currentUser, onBack }: PostDetailPageProps) {
  const [post, setPost] = useState<WorkoutPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadPost = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/posts/${postId}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error('Failed to load post');
      const data = await res.json();
      // Apply like state for current user
      const withLike: WorkoutPost = {
        ...data,
        isLiked: data.likedBy?.includes(currentUser?.id || '') || false,
      };
      setPost(withLike);
    } catch (e: any) {
      toast.error('Could not load post');
    } finally {
      setLoading(false);
    }
  }, [postId, currentUser?.id]);

  useEffect(() => { loadPost(); }, [loadPost]);

  // ── Action handlers ────────────────────────────────────────────────────────
  const handleLike = (postId: string) => {
    if (!currentUser?.id) return toast.error('Log in to like posts');
    setPost(prev => {
      if (!prev) return prev;
      const liked = prev.likedBy?.includes(currentUser.id) || false;
      return {
        ...prev,
        isLiked: !liked,
        likes: liked ? Math.max(0, prev.likes - 1) : prev.likes + 1,
        likedBy: liked
          ? (prev.likedBy || []).filter(id => id !== currentUser.id)
          : [...(prev.likedBy || []), currentUser.id],
      };
    });
    likePostAPI(postId, currentUser.id).catch(() => {});
  };

  const handleComment = (postId: string, text: string, image?: string | null) => {
    if (!currentUser?.id || (!text.trim() && !image)) return;
    const newComment = {
      id: `c_${Date.now()}`,
      text: text.trim(),
      image: image || null,
      timestamp: new Date().toISOString(),
      user: {
        name: currentUser.name,
        username: currentUser.username,
        avatar: currentUser.avatar,
        accountType: currentUser.accountType,
      },
    };
    setPost(prev => prev ? { ...prev, comments: [...(prev.comments || []), newComment as any] } : prev);
    addCommentAPI(postId, text, { id: currentUser.id, name: currentUser.name, username: currentUser.username, avatar: currentUser.avatar }, image || undefined).catch(() => {});
  };

  const handleRepost = async (postId: string) => {
    if (!currentUser) return toast.error('Log in to repost');
    try {
      await repostAPI(postId, currentUser as any);
      toast.success('Reposted! 🔁');
    } catch (e: any) {
      toast.error(e.message === 'already_reposted' ? 'Already reposted' : 'Repost failed');
    }
  };

  const handleShare = (postId: string) => {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Link copied!'))
      .catch(() => toast.error('Copy failed'));
  };

  const handlePostUpdated = (_postId: string, changes: Partial<WorkoutPost>) => {
    setPost(prev => prev ? { ...prev, ...changes } : prev);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-4 text-white/50 hover:text-white hover:bg-[rgba(201,169,110,0.04)] gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Button>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#c9a96e] animate-spin" />
        </div>
      )}

      {!loading && notFound && (
        <div className="text-center py-20">
          <p className="text-white/40 text-lg mb-2">Post not found</p>
          <p className="text-white/25 text-sm">It may have been deleted or you don't have access.</p>
          <Button variant="ghost" onClick={onBack} className="mt-6 text-[#c9a96e]">Go back</Button>
        </div>
      )}

      {!loading && post && (
        <WorkoutCard
          post={post}
          currentUserId={currentUser?.id}
          onLike={handleLike}
          onComment={handleComment}
          onRepost={handleRepost}
          onShare={handleShare}
          onPostUpdated={handlePostUpdated}
          onDeletePost={() => onBack()}
        />
      )}
    </div>
  );
}
