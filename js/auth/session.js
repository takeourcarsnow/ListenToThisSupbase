export const SESSION_KEY = 'tunedIn.space/session@v1';
export const GUEST_KEY = 'tunedIn.space/guest@v1';

// Use sessionStorage for session data (cleared on tab close, less persistent)
export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
export function setSession(s) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
export function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

// Guest mode can remain in localStorage (not sensitive)
export function isGuestMode() { return localStorage.getItem(GUEST_KEY) === '1'; }
export function setGuestMode(on) { if (on) localStorage.setItem(GUEST_KEY, '1'); else localStorage.removeItem(GUEST_KEY); }