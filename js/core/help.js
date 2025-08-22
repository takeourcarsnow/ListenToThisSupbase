// Help overlay module: injects the help overlay HTML into the page
export function renderHelpOverlay() {
  const helpHTML = `
  <div class="sheet">
      <div class="hstack" style="justify-content:space-between; align-items:center">
        <div class="muted small">> help</div>
        <button class="btn btn-ghost small" data-close-help>[ close ]</button>
      </div>
      <div class="sep"></div>
      <div class="small stack" style="gap:1.5em">
        <div style="text-align:center;">
          <b>👋 Welcome to <span style="color:var(--accent,#6cf)">tunedIn.space</span>!</b><br>
          <span class="muted">Your new favorite place to overshare your music taste. (We won't judge. Much.)</span>
        </div>
        <div>
          <b>Getting Started</b><br>
          <ul style="margin:0 0 0 1.2em; padding:0;">
            <li>Scroll the feed and eavesdrop on what everyone else is jamming to.</li>
            <li>Smash <b>[ login / register ]</b> to join the party and drop your own bangers.</li>
            <li>Share links from YouTube, Spotify, Bandcamp, SoundCloud, or even that obscure .mp3 you found at 3am.</li>
            <li>Tag your posts (#vibes, #throwback, #2020) so fellow music nerds can find them.</li>
            <li>Hit <b>[ play all ]</b> to turn the feed into your personal radio station.</li>
          </ul>
        </div>
        <div>
          <b>How to Post</b><br>
          <ul style="margin:0 0 0 1.2em; padding:0;">
            <li>Give us a title, an artist, and a legit music link. (No Rickrolls. Or... maybe just one.)</li>
            <li>Tags = discoverability. Don’t be shy.</li>
            <li>Optional: Tell us why this track slaps. Or just type "banger." We get it.</li>
          </ul>
        </div>
        <div>
          <b>Listening & Queue</b><br>
          <ul style="margin:0 0 0 1.2em; padding:0;">
            <li>Player controls up top: play, skip, shuffle, clear. DJ skills not required.</li>
            <li>The queue is just the current feed, so filter and sort to your heart’s content.</li>
          </ul>
        </div>
        <div>
          <b>Personalize</b><br>
          <button class="btn icon" title="accent color" data-action="accent-pick">🎨</button>
          <span class="muted small">Pick an accent color. Express yourself. (Sorry, no glitter... yet.)</span>
        </div>
        <div>
          <b>Tips & Tricks</b><br>
          <ul style="margin:0 0 0 1.2em; padding:0;">
            <li>Click tags to filter the feed. Use [ clear tag ] to see everything again.</li>
            <li>Everything is keyboard accessible, so you can flex your shortcut skills.</li>
            <li>Be kind, have fun, and remember: one person’s guilty pleasure is another’s anthem.</li>
          </ul>
        </div>
      </div>
      <div class="sep"></div>
      <div style="text-align:center; margin-top:2em;">
        <button class="btn btn-danger" data-action="delete-account">Delete My Account</button>
        <div class="muted small" style="margin-top:0.5em;">This will permanently remove your account and posts.</div>
      </div>
    </div>
  `;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'help';
  overlay.innerHTML = helpHTML;
  document.body.appendChild(overlay);
  // Attach delete account handler
  overlay.querySelector('[data-action="delete-account"]').onclick = async () => {
    if (!confirm('Are you sure you want to permanently delete your account and all your posts? This cannot be undone.')) return;
    const DB = (await import('./db.js')).default;
    const { currentUser } = await import('../auth/auth.js');
    const { clearSession } = await import('../auth/session.js');
    let user = await currentUser(DB);
    if (!user) { alert('No user logged in.'); return; }
    const ok = await DB.deleteUser(user.id);
    if (ok) {
      // If using Supabase, also sign out
      if (DB.isRemote && DB.supabase && DB.supabase.auth && DB.supabase.auth.signOut) {
        try { await DB.supabase.auth.signOut(); } catch (e) { /* ignore */ }
      }
      clearSession();
      alert('Your account and posts have been deleted.');
      location.reload();
    } else {
      alert('Failed to delete account.');
    }
  };
}
