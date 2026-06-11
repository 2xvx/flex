// leaderboardService.ts

import { API } from '../config';

export type LeaderboardCategory = 'workouts' | 'likes' | 'prs' | 'followers';

export const getLeaderboard = async (
  category: LeaderboardCategory,
  period: 'week' | 'month' | 'alltime' = 'week',
  uid?: string
) => {
  const params = new URLSearchParams({ category, period });
  if (uid) params.set('uid', uid);
  const res = await fetch(`${API}/leaderboard?${params}`);
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  const data = await res.json();
  // Support both old array shape and new { leaderboard, myRank } shape
  if (Array.isArray(data)) return { leaderboard: data, myRank: null };
  return data;
};

export const getHallOfFame = async () => {
  const res = await fetch(`${API}/leaderboard/hall-of-fame`);
  if (!res.ok) throw new Error('Failed to fetch hall of fame');
  return res.json();
};
