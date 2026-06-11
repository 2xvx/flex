// duelService.ts — Duel (friend challenge) API calls

import { API } from '../config';

export const createDuel = async (data: {
  challengerId: string;
  challengerName: string;
  challengedId: string;
  challengedName: string;
  exercise: string;
  goalType: 'reps' | 'weight' | 'workouts';
  goalTarget: number;
  durationDays: number;
}) => {
  const res = await fetch(`${API}/duels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create duel');
  return res.json();
};

export const getUserDuels = async (uid: string) => {
  const res = await fetch(`${API}/users/${uid}/duels`);
  if (!res.ok) throw new Error('Failed to fetch duels');
  return res.json();
};

export const acceptDuel = async (duelId: string) => {
  const res = await fetch(`${API}/duels/${duelId}/accept`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Failed to accept duel');
  return res.json();
};

export const declineDuel = async (duelId: string) => {
  const res = await fetch(`${API}/duels/${duelId}/decline`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Failed to decline duel');
  return res.json();
};

export const updateDuelScore = async (duelId: string, userId: string, score: number) => {
  const res = await fetch(`${API}/duels/${duelId}/score`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, score }),
  });
  if (!res.ok) throw new Error('Failed to update score');
  return res.json();
};

export const searchUserByUsername = async (username: string) => {
  const res = await fetch(`${API}/users/search?username=${encodeURIComponent(username)}`);
  if (!res.ok) throw new Error('User not found');
  return res.json();
};
