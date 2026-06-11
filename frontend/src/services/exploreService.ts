// exploreService.ts — Explore API calls

import { API } from '../config';

/** Discovery feed: posts from other users ranked by likes. */
export const getDiscoverPosts = async (userId: string) => {
  const res = await fetch(`${API}/explore/posts?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch discover posts');
  return res.json();
};

/** All trainer profiles. Optional specialty filter. */
export const getTrainers = async (specialty?: string) => {
  const url = specialty
    ? `${API}/explore/trainers?specialty=${encodeURIComponent(specialty)}`
    : `${API}/explore/trainers`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch trainers');
  return res.json();
};

/** Top trending exercises from posts in the last 24 hours. */
export const getTrending = async () => {
  const res = await fetch(`${API}/explore/trending`);
  if (!res.ok) throw new Error('Failed to fetch trending');
  return res.json();
};

/** Users the current user doesn't follow yet — for "People you may know". */
export const getSuggestedUsers = async (uid: string) => {
  const res = await fetch(`${API}/explore/suggestions?uid=${encodeURIComponent(uid)}`);
  if (!res.ok) throw new Error('Failed to fetch suggestions');
  return res.json();
};
