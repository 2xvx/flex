// followService.ts
import { authFetch } from '../utils/authToken';

import { API } from '../config';

export interface FollowRequest {
  id: string;
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  fromUser: { name: string; avatar: string; username: string };
}

/**
 * Send a follow REQUEST to targetUid.
 * The target must accept before the follow relationship is created.
 * Returns { alreadyFollowing, alreadyRequested, requestId } depending on state.
 */
export const followUser = async (targetUid: string) => {
  const res = await authFetch(`${API}/users/${targetUid}/follow`, { method: 'POST' });
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.error || 'Follow request failed');
  }
  return res.json();
};

/** Unfollow a user. Requires a valid auth token. */
export const unfollowUser = async (targetUid: string) => {
  const res = await authFetch(`${API}/users/${targetUid}/unfollow`, { method: 'POST' });
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.error || 'Unfollow failed');
  }
  return res.json();
};

/** Returns the array of uid strings that `uid` is following. */
export const getFollowingList = async (uid: string): Promise<string[]> => {
  const res = await fetch(`${API}/users/${uid}/following`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.following || [];
};

/** Returns incoming pending follow requests for the current user. */
export const getFollowRequests = async (): Promise<FollowRequest[]> => {
  const res = await authFetch(`${API}/follow-requests`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.requests || [];
};

/** Returns uid list of users the current user has a PENDING request to. */
export const getSentRequestUids = async (): Promise<string[]> => {
  const res = await authFetch(`${API}/follow-requests/sent`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.pendingUids || [];
};

/** Accept an incoming follow request. Returns { conversationId }. */
export const acceptFollowRequest = async (requestId: string) => {
  const res = await authFetch(`${API}/follow-requests/${requestId}/accept`, { method: 'POST' });
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.error || 'Accept failed');
  }
  return res.json();
};

/** Decline / dismiss an incoming follow request. */
export const declineFollowRequest = async (requestId: string) => {
  const res = await authFetch(`${API}/follow-requests/${requestId}/decline`, { method: 'POST' });
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.error || 'Decline failed');
  }
  return res.json();
};
