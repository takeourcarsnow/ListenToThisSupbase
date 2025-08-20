import { esc } from './utils.js';

export function showUserProfile(userId, DB) {
  const db = DB.getAll();
  const u = db.users.find(x => x.id === userId);
  const userPosts = db.posts.filter(p => p.userId === userId);

  const overlay = document.createElement('div');
  overlay.id = 'profile';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.4)';
  overlay.style.zIndex = '10000';
  overlay.innerHTML = `
    <div class="box" style="max-width:520px; margin:10vh auto; background:var(--bg,#111);">
      <div class="hstack" style="justify-content:space-between; align-items:center">
        <div class="muted small">user profile</div>
        <button class="btn btn-ghost" data-close-profile="1">[ close ]</button>
      </div>
      <div class="sep"></div>
      ${
        u
          ? `
            <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:12px;">
              <img class="profile-avatar" src="${u.avatarUrl ? esc(u.avatarUrl) : '/favicon-32x32.png'}" alt="avatar" />
            </div>
            <div class="title">${esc(u.name)}</div>
            <div style="margin:8px 0;">
              <button class="btn btn-ghost" id="filter-user-posts-btn" data-user-id="${esc(u.id)}">[ show only this user's posts ]</button>
            </div>
            <div class="small muted" style="margin-bottom:8px">member since ${new Date(u.createdAt||Date.now()).toLocaleDateString()}</div>
            <div>${u.about ? esc(u.about).replace(/\n/g,'<br>') : '<span class="muted small">no about yet.</span>'}</div>
            <!-- Post list removed, only filter button remains -->
          `
          : `<div class="muted small">user not found</div>`
      }
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target.dataset.closeProfile || e.target.id === 'profile') overlay.remove();
    // Filter posts by user button
    if (e.target && e.target.id === 'filter-user-posts-btn') {
      overlay.remove();
      // Set a global filter and re-render feed
      window.filterPostsByUserId = userId;
      const event = new CustomEvent('filter-user-posts', { detail: { userId } });
      window.dispatchEvent(event);
    }
  });
}