import { getSession } from './session.js';

export async function currentUser(DB) {
  const s = getSession();
  if (!s) return null;
  const db = DB.getAll();
  let user = db.users.find(u => u.id === s.userId);
  if (!user && DB.isRemote && DB.supabase && DB.supabase.auth && DB.supabase.auth.getUser) {
    try {
      const authUser = await DB.supabase.auth.getUser();
      const u = authUser?.data?.user;
      if (u) {
        const name = u.user_metadata?.name || u.email || 'user';
        user = { id: u.id, name, email: u.email };
        try { await DB.ensureUser(name); } catch {}
      }
    } catch {}
  }
  if (!user && s.userId) {
    user = { id: s.userId, name: 'user' };
  }
  return user;
}