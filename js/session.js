// js/session.js
import DB from './db.js';

export const SESSION_KEY = 'ascii.fm/session@v1';

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
export function setSession(s) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Resolve current user from session or Supabase
export async function currentUser() {
  const s = getSession();
  if (!s) return null;

  const db = DB.getAll();
  let user = db.users.find(u => u.id === s.userId);

  if (!user && DB.isRemote && DB.supabase?.auth?.getUser) {
    try {
      const authUser = await DB.supabase.auth.getUser();
      const u = authUser?.data?.user;
      if (u) user = { id: u.id, name: u.user_metadata?.name || u.email || 'user', email: u.email };
    } catch {}
  }
  if (!user && s.userId) user = { id: s.userId, name: 'user' };
  return user;
}