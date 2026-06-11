import { API } from '../config';
import { authFetch } from '../utils/authToken';

// ── XP event type constants ───────────────────────────────────────────────────
export const XP_EVENT = {
  POST_CREATED:         'post_created',
  POST_CREATED_FIRST:   'post_created_first',
  PR_LOGGED:            'pr_logged',
  COMMENT_LEFT:         'comment_left',
  LIKE_RECEIVED:        'like_received',
  COMMENT_RECEIVED:     'comment_received',
  FOLLOWER_GAINED:      'follower_gained',
  TRENDING_POST:        'trending_post',
  CHALLENGE_COMPLETED:  'challenge_completed',
  PROFILE_COMPLETED:    'profile_completed',
  LEVEL_5_REACHED:      'level_5_reached',
  FOLLOW_5_USERS:       'follow_5_users',
  DAILY_LOGIN:          'daily_login',
  DAILY_TASK:           'daily_task',
  GOAL_MILESTONE:       'goal_milestone',
  STREAK_7_DAYS:        'streak_7_days',
  STREAK_3_WEEK:        'streak_3_week',
  WORKOUT_TIMER:        'workout_timer',
} as const;

export type XPEventType = typeof XP_EVENT[keyof typeof XP_EVENT];

// XP values mirrored from backend (for optimistic UI display)
export const XP_VALUES: Record<XPEventType, number> = {
  post_created:         50,
  post_created_first:  100,
  pr_logged:            75,
  comment_left:          5,
  like_received:        10,
  comment_received:     15,
  follower_gained:      20,
  trending_post:        50,
  challenge_completed: 150,
  profile_completed:    80,
  level_5_reached:     500,
  follow_5_users:       50,
  daily_login:          10,
  daily_task:           50,
  goal_milestone:      120,
  streak_7_days:       200,
  streak_3_week:       100,
  workout_timer:        30,
};

export interface XPResult {
  awarded: boolean;
  alreadyAwarded?: boolean;
  amount?: number;
  totalXP: number;
  level: number;
  xpInLevel: number;
  leveledUp?: boolean;
  prevLevel?: number;
}

export interface XPState {
  totalXP: number;
  level: number;
  xpInLevel: number;
  xpToNext: number;
}

// ── getUserXP ─────────────────────────────────────────────────────────────────
export async function getUserXP(uid: string): Promise<XPState> {
  const res = await authFetch(`${API}/users/${uid}/xp`);
  if (!res.ok) throw new Error('Failed to fetch XP');
  return res.json();
}

// ── awardXP ───────────────────────────────────────────────────────────────────
// idempotencyKey: pass a unique string to prevent double-awarding the same action
// e.g. "daily_login:2026-05-25"  or  "post_created_first"
export async function awardXP(
  uid: string,
  event: XPEventType,
  idempotencyKey?: string
): Promise<XPResult> {
  const res = await authFetch(`${API}/users/${uid}/xp/award`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, idempotencyKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to award XP');
  }
  return res.json();
}

// ── dailyLoginXP ──────────────────────────────────────────────────────────────
// Returns XPResult. Idempotent — safe to call on every app load.
export async function dailyLoginXP(uid: string): Promise<XPResult> {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  return awardXP(uid, XP_EVENT.DAILY_LOGIN, `daily_login:${today}`);
}

// ── fireXP ────────────────────────────────────────────────────────────────────
// Awards XP and dispatches window events so HeroSection refreshes and
// App.tsx can show the level-up modal.
// Safe to call fire-and-forget: `fireXP(uid, XP_EVENT.POST_CREATED)`
export async function fireXP(
  uid: string,
  event: XPEventType,
  idempotencyKey?: string
): Promise<XPResult | null> {
  try {
    const result = await awardXP(uid, event, idempotencyKey);
    // Notify HeroSection to re-fetch XP bar
    window.dispatchEvent(new CustomEvent('xp-updated', { detail: result }));
    // If user leveled up, fire a separate event for the modal
    if (result.awarded && result.leveledUp) {
      window.dispatchEvent(new CustomEvent('xp-level-up', { detail: result }));
    }
    return result;
  } catch {
    // XP is non-critical — never let errors surface to the user
    return null;
  }
}
