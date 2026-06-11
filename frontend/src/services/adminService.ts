// adminService.ts
// Every function here is one admin action.
// Each function calls the Node.js backend, which uses Firebase Admin SDK
// to make changes in Firebase Auth and/or Firestore.
//
// WHY a separate file?
// Keeping all admin API calls in one place makes it easy to find, test,
// and update them without touching the UI components.

import { authFetch } from '../utils/authToken';

import { API as _API_BASE } from '../config';
const API = _API_BASE + '/admin';

// ─── Helper ───────────────────────────────────────────────────────────────────
// All admin endpoints require a valid auth token + admin role.
const post  = (url: string, body: object) => authFetch(url, { method: 'POST',   body: JSON.stringify(body) });
const patch = (url: string, body: object) => authFetch(url, { method: 'PATCH',  body: JSON.stringify(body) });
const del   = (url: string, body?: object) => authFetch(url, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined });

// ─── USERS ────────────────────────────────────────────────────────────────────

/** Fetch every user who has a Firestore profile. */
export const getAllUsers = async () => {
  const res = await authFetch(`${API}/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
};

/**
 * Ban or unban a user.
 * banned=true  → disables their Firebase Auth account + marks them in Firestore.
 * banned=false → re-enables their account.
 */
export const banUser = async (uid: string, banned: boolean, reason: string, adminId: string) => {
  const res = await patch(`${API}/users/${uid}/ban`, { banned, reason, adminId });
  if (!res.ok) throw new Error('Failed to update ban status');
  return res.json();
};

/**
 * Change a user's role.
 * Roles: 'user' | 'trainer' | 'admin'
 * Updates the accountType field in their Firestore profile.
 */
export const changeUserRole = async (uid: string, role: string, adminId: string) => {
  const res = await patch(`${API}/users/${uid}/role`, { role, adminId });
  if (!res.ok) throw new Error('Failed to change role');
  return res.json();
};

/**
 * Permanently delete a user.
 * Removes them from Firebase Authentication AND their Firestore profile.
 * This cannot be undone.
 */
export const deleteUser = async (uid: string, adminId: string) => {
  const res = await del(`${API}/users/${uid}`, { adminId });
  if (!res.ok) throw new Error('Failed to delete user');
  return res.json();
};

/**
 * Directly set a user's password (admin testing tool).
 */
export const setUserPassword = async (uid: string, password: string) => {
  const res = await post(`${API}/users/${uid}/set-password`, { password });
  if (!res.ok) throw new Error('Failed to set password');
  return res.json();
};

/**
 * Send a password reset email.
 * Firebase generates a secure link and emails it to the user automatically.
 */
export const resetUserPassword = async (uid: string, adminId: string) => {
  const res = await post(`${API}/users/${uid}/reset`, { adminId });
  if (!res.ok) throw new Error('Failed to send reset email');
  return res.json();
};

// ─── POSTS ────────────────────────────────────────────────────────────────────

/** Permanently delete a post from Firestore. */
export const deletePost = async (postId: string, adminId: string) => {
  const res = await del(`${API}/posts/${postId}`, { adminId });
  if (!res.ok) throw new Error('Failed to delete post');
  return res.json();
};

/**
 * Pin or unpin a post.
 * Pinned posts can be shown at the top of the Feed.
 */
export const pinPost = async (postId: string, pinned: boolean, adminId: string) => {
  const res = await patch(`${API}/posts/${postId}/pin`, { pinned, adminId });
  if (!res.ok) throw new Error('Failed to update pin');
  return res.json();
};

/** Remove a specific comment from a post. Matched by comment.id inside the array. */
export const deleteComment = async (postId: string, comment: object, adminId: string) => {
  const res = await del(`${API}/posts/${postId}/comment`, { comment, adminId });
  if (!res.ok) throw new Error('Failed to delete comment');
  return res.json();
};

// ─── CHALLENGES ───────────────────────────────────────────────────────────────

/** Get all challenges created by admins. */
export const getChallenges = async () => {
  const res = await authFetch(`${API}/challenges`);
  if (!res.ok) throw new Error('Failed to fetch challenges');
  return res.json();
};

/** Create a new community challenge. Saved to Firestore challenges collection. */
export const createChallenge = async (data: {
  title: string;
  description: string;
  type: string;
  targetValue: number;
  durationDays: number;
  adminId: string;
}) => {
  const res = await post(`${API}/challenges`, data);
  if (!res.ok) throw new Error('Failed to create challenge');
  return res.json();
};

/** Delete a challenge permanently. */
export const deleteChallenge = async (id: string, adminId: string) => {
  const res = await del(`${API}/challenges/${id}`, { adminId });
  if (!res.ok) throw new Error('Failed to delete challenge');
  return res.json();
};

// ─── ANNOUNCEMENTS ────────────────────────────────────────────────────────────

/** Get all platform announcements. */
export const getAnnouncements = async () => {
  const res = await authFetch(`${API}/announcements`);
  if (!res.ok) throw new Error('Failed to fetch announcements');
  return res.json();
};

/** Send a new announcement to all users. Saved to Firestore. */
export const sendAnnouncement = async (data: {
  title: string;
  message: string;
  type: string;
  adminId: string;
}) => {
  const res = await post(`${API}/announcements`, data);
  if (!res.ok) throw new Error('Failed to send announcement');
  return res.json();
};

/** Delete / deactivate an announcement. */
export const deleteAnnouncement = async (id: string) => {
  const res = await del(`${API}/announcements/${id}`);
  if (!res.ok) throw new Error('Failed to delete announcement');
  return res.json();
};

// ─── FOLLOWS RESET ────────────────────────────────────────────────────────────

/**
 * Clears the entire `follows` collection and resets every user's
 * followers/following counters to 0. One-shot destructive operation.
 */
export const resetAllFollows = async () => {
  const res = await authFetch(`http://192.168.1.102:5000/api/admin/reset-follows`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset follows');
  return res.json();
};

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────

/** Get the 50 most recent admin actions. Each entry shows who did what and when. */
export const getActivityLog = async () => {
  const res = await authFetch(`${API}/logs`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
};

// ─── EXPORT ───────────────────────────────────────────────────────────────────

/**
 * Export data as a downloadable JSON file.
 * Converts the data array to a formatted JSON string, wraps it in a Blob,
 * creates a temporary download link, clicks it, then removes it.
 */
export const exportAsJSON = (data: object[], filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Export data as a downloadable CSV file.
 * Converts an array of objects to comma-separated values.
 * The first row is the column headers (object keys).
 */
export const exportAsCSV = (data: object[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows    = data.map(obj =>
    headers.map(h => {
      const val = (obj as Record<string, unknown>)[h];
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',')
  );
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Platform Health ──────────────────────────────────────────────────────────
export const getAdminHealth = async (): Promise<{ ok: boolean; newToday: number; activeRecently: number; ts: string }> => {
  const res = await authFetch(`${_API_BASE}/admin/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
};

// ─── Reported Posts ───────────────────────────────────────────────────────────
export interface ReportedPost {
  id: string;
  postId: string;
  reportedBy: string;
  reason: string;
  postData: Record<string, any>;
  createdAt: string;
  status: 'pending' | 'dismissed' | 'deleted';
}

export const getReportedPosts = async (): Promise<ReportedPost[]> => {
  const res = await authFetch(`${_API_BASE}/admin/reported-posts`);
  if (!res.ok) return [];
  return res.json();
};

export const dismissReport = async (reportId: string): Promise<void> => {
  await authFetch(`${_API_BASE}/admin/reported-posts/${reportId}/dismiss`, { method: 'DELETE' });
};

export const deleteReportedPost = async (reportId: string): Promise<void> => {
  await authFetch(`${_API_BASE}/admin/reported-posts/${reportId}/delete-post`, { method: 'DELETE' });
};

export const reportPost = async (postId: string, reason: string): Promise<void> => {
  await authFetch(`${_API_BASE}/posts/${postId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
};
