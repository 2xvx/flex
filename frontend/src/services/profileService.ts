import { authFetch } from '../utils/authToken';
// profileService.ts
// All API calls for user profiles, trainer info, and session bookings.

import { API } from '../config';

// ─── PROFILE ──────────────────────────────────────────────────────────────────

/** Fetch a user's full profile including their posts.
 *  Pass requesterId so the backend can determine if posts should be hidden (private account). */
export const getProfile = async (uid: string, requesterId?: string) => {
  const url = requesterId
    ? `${API}/users/${uid}/profile?requesterId=${encodeURIComponent(requesterId)}`
    : `${API}/users/${uid}/profile`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
};

/** Update basic profile fields (bio, fitnessGoal, fitnessLevel, gym, isPrivate). */
export const updateProfile = async (uid: string, data: {
  bio?: string;
  username?: string;
  fitnessGoal?: string;
  fitnessLevel?: string;
  gym?: string;
  isPrivate?: boolean;
  gender?: string;
  displayName?: string;
  instagram?: string;
  twitter?: string;
  usernameChangedAt?: string;
}) => {
  const res = await authFetch(`${API}/users/${uid}/profile`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update profile');
  }
  return res.json();
};

// ─── TRAINER ──────────────────────────────────────────────────────────────────

/** Save a trainer's pricing, availability, specialties. */
export const updateTrainerInfo = async (uid: string, trainerInfo: object) => {
  const res = await fetch(`${API}/users/${uid}/trainer`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trainerInfo }),
  });
  if (!res.ok) throw new Error('Failed to update trainer info');
  return res.json();
};

// ─── BOOKINGS ─────────────────────────────────────────────────────────────────

/**
 * Create a new booking request.
 * The session starts as 'pending' until the trainer confirms.
 */
export const createBooking = async (data: {
  trainerId: string;
  trainerName: string;
  clientId: string;
  clientName: string;
  date: string;
  timeSlot: string;
  sessionType: 'online' | 'in-person';
  notes: string;
  price: number;
}) => {
  const res = await authFetch(`${API}/bookings`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Failed to create booking');
  }
  return res.json();
};

/**
 * Get all bookings for a user.
 * role='trainer' → sessions where they are the trainer.
 * role='client'  → sessions they booked with a trainer.
 */
export const getBookings = async (uid: string, role: 'trainer' | 'client') => {
  const res = await fetch(`${API}/users/${uid}/bookings?role=${role}`);
  if (!res.ok) throw new Error('Failed to fetch bookings');
  return res.json();
};

/**
 * Update booking status.
 * Trainers use this to confirm, cancel, or mark a session completed.
 */
export const updateBookingStatus = async (
  bookingId: string,
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
) => {
  const res = await fetch(`${API}/bookings/${bookingId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update booking status');
  return res.json();
};
