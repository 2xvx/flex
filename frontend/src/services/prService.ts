// prService.ts — Personal Records API calls
import { authFetch } from '../utils/authToken';

import { API } from '../config';

export const logPR = async (data: {
  userId: string;
  exercise: string;
  weight: number;
  reps: number;
  notes?: string;
}) => {
  const res = await authFetch(`${API}/prs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to log PR');
  return res.json();
};

export const getUserPRs = async (uid: string) => {
  const res = await fetch(`${API}/users/${uid}/prs`);
  if (!res.ok) throw new Error('Failed to fetch PRs');
  return res.json();
};

export const deletePR = async (id: string) => {
  const res = await authFetch(`${API}/prs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete PR');
  return res.json();
};
