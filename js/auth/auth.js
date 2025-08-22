
export async function currentUser(DB) {
  // Always use Supabase Auth for user identity
  if (DB.isRemote && DB.supabase && DB.supabase.auth && DB.supabase.auth.getUser) {
    try {
      const authUser = await DB.supabase.auth.getUser();
      const u = authUser?.data?.user;
      if (u) {
        const name = u.user_metadata?.name || u.email || 'user';
        // Ensure user exists in DB
        try { await DB.ensureUser(name); } catch {}
        return { id: u.id, name, email: u.email };
      }
    } catch {}
  }
  // Not authenticated
  return null;
}