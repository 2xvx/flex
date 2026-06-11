// settingsService.ts

import { authFetch } from '../utils/authToken';

import { API } from '../config';

export const getUserSettings = async (uid: string) => {
  const res = await fetch(`${API}/users/${uid}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
};

export const saveUserSettings = async (uid: string, settings: object) => {
  const res = await authFetch(`${API}/users/${uid}/settings`, {
    method: 'PATCH',
    body: JSON.stringify({ settings }),
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json();
};

export const changePassword = async (uid: string, newPassword: string) => {
  const res = await authFetch(`${API}/users/${uid}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ newPassword }),
  });
  if (!res.ok) throw new Error('Failed to change password');
  return res.json();
};

export const changeEmail = async (uid: string, newEmail: string) => {
  const res = await authFetch(`${API}/users/${uid}/email-update`, {
    method: 'PATCH',
    body: JSON.stringify({ newEmail }),
  });
  if (!res.ok) throw new Error('Failed to change email');
  return res.json();
};

export const updateAccount = async (uid: string, data: { displayName?: string; username?: string }) => {
  const res = await authFetch(`${API}/users/${uid}/account`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update account');
  return res.json();
};
