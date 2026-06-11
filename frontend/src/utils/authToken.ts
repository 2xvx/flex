// authToken.ts — helpers for storing and retrieving Firebase auth tokens.
// Firebase ID tokens expire in 1 hour. We also store the refresh token so
// we can silently get a new ID token without forcing the user to log in again.

const ID_TOKEN_KEY      = 'fitconnect_id_token';
const REFRESH_TOKEN_KEY = 'fitconnect_refresh_token';

export const setAuthToken     = (token: string)   => localStorage.setItem(ID_TOKEN_KEY, token);
export const getAuthToken     = (): string | null  => localStorage.getItem(ID_TOKEN_KEY);
export const setRefreshToken  = (token: string)   => localStorage.setItem(REFRESH_TOKEN_KEY, token);
export const getRefreshToken  = (): string | null  => localStorage.getItem(REFRESH_TOKEN_KEY);
export const clearAuthToken   = () => {
  localStorage.removeItem(ID_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

/**
 * Silently exchange the stored refresh token for a fresh ID token.
 * Returns the new ID token, or null if refresh fails (user must log in again).
 */
export const refreshIdToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch('http://192.168.1.102:5000/api/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.idToken) {
      setAuthToken(data.idToken);
      if (data.refreshToken) setRefreshToken(data.refreshToken);
      return data.idToken;
    }
    return null;
  } catch {
    return null;
  }
};

/** Returns fetch headers with Authorization added if a token is stored. */
export const authHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
};

/**
 * Make an authenticated fetch. If the response is 401 (expired token),
 * automatically refresh and retry once.
 * If refresh also fails (no refresh token stored, or Firebase rejects it),
 * dispatch 'fitconnect-session-expired' so App.tsx can sign the user out cleanly.
 */
export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res = await fetch(url, { ...options, headers });

  // Token expired → try to refresh once
  if (res.status === 401) {
    const newToken = await refreshIdToken();
    if (newToken) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
      res = await fetch(url, { ...options, headers: retryHeaders });
    }
    // Still 401 after refresh attempt → session is unrecoverable, force sign-out
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('fitconnect-session-expired'));
    }
  }

  return res;
};

/**
 * Upload a base64 image to Firebase Storage via the backend.
 * Returns the public HTTPS URL, or null on failure.
 * Pass folder = 'posts' | 'comments' | 'avatars' etc.
 */
export const uploadImage = async (
  base64: string,
  folder: string = 'posts',
): Promise<string | null> => {
  try {
    const res = await authFetch('http://192.168.1.102:5000/api/upload', {
      method: 'POST',
      body: JSON.stringify({ base64, folder }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch {
    return null;
  }
};
