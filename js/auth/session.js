export const SESSION_KEY = 'tunedIn.space/session@v1';
export const GUEST_KEY = 'tunedIn.space/guest@v1';

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
export function setSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
export function clearSession() { localStorage.removeItem(SESSION_KEY); }

export function isGuestMode() { return localStorage.getItem(GUEST_KEY) === '1'; }
export function setGuestMode(on) { if (on) localStorage.setItem(GUEST_KEY, '1'); else localStorage.removeItem(GUEST_KEY); }