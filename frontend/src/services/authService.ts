// authService.ts
import { User } from '../app/types';
import { setAuthToken, setRefreshToken, clearAuthToken, refreshIdToken } from '../utils/authToken';

import { API } from '../config';

const buildUser = (data: Record<string, unknown>): User => ({
  id: data.uid as string,
  name: (data.displayName as string) || (data.email as string)?.split('@')[0] || 'User',
  username: (data.username as string) || (data.email as string)?.split('@')[0] || 'user',
  email: data.email as string,
  avatar:
    (data.avatar as string) ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      (data.displayName as string) || (data.email as string) || 'User'
    )}&background=7c3aed&color=fff`,
  bio: (data.bio as string) || '',
  fitnessGoal: (data.fitnessGoal as string) || '',
  fitnessLevel: (data.fitnessLevel as string) || 'Intermediate',
  gym: (data.gym as string) || '',
  workouts: (data.workouts as number) || 0,
  followers: (data.followers as number) || 0,
  following: (data.following as number) || 0,
  accountType: (data.accountType as 'user' | 'trainer' | 'admin') || 'user',
  role: (data.role as string) || undefined,
  createdAt: (data.createdAt as string) || new Date().toISOString(),
});

// ─── Sign in ──────────────────────────────────────────────────────────────────
export const signIn = async (email: string, password: string): Promise<User> => {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  if (data.idToken)      setAuthToken(data.idToken);
  if (data.refreshToken) setRefreshToken(data.refreshToken);
  return buildUser(data);
};

// ─── Sign up ──────────────────────────────────────────────────────────────────
// Creates the account, signs in, then fires a verification email.
export const signUp = async (
  email: string,
  password: string,
  displayName: string,
  accountType: string
): Promise<User> => {
  const res = await fetch(`${API}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, accountType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Signup failed');
  const user = await signIn(email, password);
  // Fire verification email — best effort, don't block signup on failure
  const idToken = localStorage.getItem('fitconnect_id_token');
  if (idToken) {
    fetch(`${API}/send-verification-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }).catch(() => {});
  }
  return { ...user, emailVerified: false };
};

// ─── Resend verification email ────────────────────────────────────────────────
export const resendVerificationEmail = async (): Promise<void> => {
  // Refresh the token first so we always send a fresh one to Firebase
  let idToken = await refreshIdToken();
  if (!idToken) idToken = localStorage.getItem('fitconnect_id_token');
  if (!idToken) throw new Error('Not logged in');
  const res = await fetch(`${API}/send-verification-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).error || 'Failed to resend verification email');
  }
};

// ─── Check email verification status ─────────────────────────────────────────
export const checkEmailVerified = async (): Promise<boolean> => {
  // Always refresh the token first — Firebase only reflects email verification
  // status in a fresh token, not the cached one.
  const freshToken = await refreshIdToken();
  const idToken = freshToken || localStorage.getItem('fitconnect_id_token');
  if (!idToken) return false;
  try {
    const res = await fetch(`${API}/email-verified`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.emailVerified === true;
  } catch { return false; }
};

// ─── Demo login ───────────────────────────────────────────────────────────────
export const demoLogin = async (accountType: 'user' | 'trainer' | 'admin'): Promise<User> => {
  const res = await fetch(`${API}/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Demo login failed');
  if (data.idToken)      setAuthToken(data.idToken);
  if (data.refreshToken) setRefreshToken(data.refreshToken);
  return buildUser(data);
};


// ─── Google sign-in ───────────────────────────────────────────────────────────
export const signInWithGoogle = async (): Promise<User> => {
  const { initializeApp, getApps, getApp } = await import('firebase/app');
  const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');

  const FB_CONFIG = {
    apiKey:     'AIzaSyDYIbJ010CGwWqBLtv4j_TqA6l31HJUrEU',
    authDomain: 'fitconnect-937d0.firebaseapp.com',
    projectId:  'fitconnect-937d0',
  };
  const app      = getApps().length ? getApp() : initializeApp(FB_CONFIG);
  const auth     = getAuth(app);
  const provider = new GoogleAuthProvider();

  const result  = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  setAuthToken(idToken);

  // Upsert user profile in our backend
  const res  = await fetch(`${API}/google-auth`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body:    JSON.stringify({
      uid:         result.user.uid,
      displayName: result.user.displayName || result.user.email?.split('@')[0] || 'User',
      email:       result.user.email,
      avatar:      result.user.photoURL || '',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
  if (data.idToken)      setAuthToken(data.idToken);
  if (data.refreshToken) setRefreshToken(data.refreshToken);
  return buildUser({ ...data, idToken });
};

// ─── Sign out ─────────────────────────────────────────────────────────────────
export const signOut = async (): Promise<void> => {
  clearAuthToken();
  localStorage.removeItem('currentUser');
};

// ─── Auth state observer ──────────────────────────────────────────────────────
export const onAuthChange = (callback: (user: User | null) => void) => {
  const check = () => {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      try { callback(JSON.parse(stored)); }
      catch { callback(null); }
    } else {
      callback(null);
    }
  };
  check();
  window.addEventListener('storage', check);
  return () => window.removeEventListener('storage', check);
};
