// postService.ts
// Sends HTTP requests to the Node.js backend and adds a thin caching layer so
// page switches don't hit Firebase on every render.

import { WorkoutPost } from '../app/types';
import { getCache, setCache, invalidateCachePrefix } from '../utils/cache';
import { authFetch } from '../utils/authToken';

import { API } from '../config';

// ── Response shape from the paginated GET /api/posts ──────────────────────────
export interface FetchPostsResult {
  posts:      WorkoutPost[];
  nextCursor: string | null;
  hasMore:    boolean;
}

export interface FetchPostsOptions {
  cursor?:      string | null;
  workoutType?: string | null;
  sort?:        'newest' | 'trending';
  followingOf?: string | null;
}

// ── Fetch a page of posts ─────────────────────────────────────────────────────
// Supports optional filter params — workoutType, sort, followingOf.
// Results are cached for 30 s; invalidated on new post or manual refresh.
export const fetchPosts = async (
  cursor: string | null = null,
  opts: Omit<FetchPostsOptions, 'cursor'> = {},
): Promise<FetchPostsResult> => {
  const { workoutType = null, sort = 'newest', followingOf = null } = opts;
  const cacheKey = `posts:${cursor ?? 'first'}:${workoutType ?? ''}:${sort}:${followingOf ?? ''}`;
  const cached = getCache<FetchPostsResult>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams();
  if (cursor)      params.set('cursor',      cursor);
  if (workoutType) params.set('workoutType', workoutType);
  if (sort !== 'newest') params.set('sort', sort);
  if (followingOf) params.set('followingOf', followingOf);
  const qs = params.toString();
  const url = qs ? `${API}/posts?${qs}` : `${API}/posts`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch posts');
  const data: FetchPostsResult = await res.json();

  setCache(cacheKey, data, 30_000);
  return data;
};

// ── Create a post (invalidates cache so the feed refreshes) ──────────────────
export const createPostAPI = async (postData: Record<string, unknown>) => {
  const res = await authFetch(`${API}/posts`, {
    method:  'POST',
    body:    JSON.stringify(postData),
  });
  if (!res.ok) throw new Error('Failed to create post');
  // Drop all cached pages so the new post appears immediately
  invalidateCachePrefix('posts:');
  return res.json();
};

// ── Like / unlike (fire-and-forget; Feed does optimistic update) ─────────────
export const likePostAPI = async (postId: string, _userId: string) => {
  const res = await authFetch(`${API}/posts/${postId}/like`, {
    method:  'POST',
    body:    JSON.stringify({}), // userId is taken from the token on the backend
  });
  if (!res.ok) throw new Error('Failed to update like');
  return res.json();
};

// ── Add a comment ─────────────────────────────────────────────────────────────
export const addCommentAPI = async (
  postId: string,
  text:   string,
  user:   Record<string, unknown>,
  image?: string | null,
) => {
  const res = await authFetch(`${API}/posts/${postId}/comment`, {
    method:  'POST',
    body:    JSON.stringify({ text, user, image: image || null }),
  });
  if (!res.ok) throw new Error('Failed to add comment');
  return res.json();
};

// ── Repost ────────────────────────────────────────────────────────────────────
export const repostAPI = async (postId: string, currentUser: Record<string, unknown>) => {
  const res = await authFetch(`${API}/posts/${postId}/repost`, {
    method:  'POST',
    body:    JSON.stringify({ user: currentUser }),
  });
  if (res.status === 409) throw new Error('already_reposted');
  if (!res.ok) throw new Error('Repost failed');
  invalidateCachePrefix('posts:');
  return res.json();
};

// ── Like a comment (optimistic; WorkoutCard handles UI) ──────────────────────
export const likeCommentAPI = async (postId: string, commentId: string, _userId: string) => {
  const res = await authFetch(`${API}/posts/${postId}/comments/${commentId}/like`, {
    method:  'POST',
    body:    JSON.stringify({}),
  });
  if (!res.ok) throw new Error('Failed to like comment');
  return res.json();
};
