// API host resolution:
//   1. VITE_API_URL  — set this in Vercel dashboard to your Render backend URL
//   2. Capacitor mobile — uses the local PC IP for dev
//   3. Fallback — localhost:5000 for local dev
const MOBILE_HOST = 'http://192.168.1.102:5000';
const BROWSER_HOST = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getApiHost(): string {
  if (typeof window === 'undefined') return BROWSER_HOST;
  if (window.location.protocol === 'capacitor:') return MOBILE_HOST;
  if ((window as any).Capacitor?.isNativePlatform?.()) return MOBILE_HOST;
  return BROWSER_HOST;
}

export const API_HOST = getApiHost();
export const API = `${API_HOST}/api`;
