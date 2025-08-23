// js/views/leaderboard.js
// Leaderboard view for most contributions and most likes received
import { esc } from '../core/utils.js';
import { showUserProfile } from './profile.js';

export function renderLeaderboard(root, DB) {
  const db = DB.getAll();
  // Count posts per user
  const userContribs = {};
  const userLikes = {};
  db.users.forEach(u => { userContribs[u.id] = 0; userLikes[u.id] = 0; });
  db.posts.forEach(p => {
    if (userContribs[p.userId] !== undefined) userContribs[p.userId]++;
    if (Array.isArray(p.likes)) {
      if (userLikes[p.userId] !== undefined) userLikes[p.userId] += p.likes.length;
    }
  });
  // Sort users by contributions and likes, exclude 0s
  const topContribs = Object.entries(userContribs)
    .filter(([uid, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topLikes = Object.entries(userLikes)
    .filter(([uid, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  // Render
  root.innerHTML = `
    <div class="box leaderboard-box enhanced-leaderboard">
      <h2>🏆 Top Contributors</h2>
      <ol class="leaderboard-list">
        ${topContribs.map(([uid, count], i) => {
          const user = db.users.find(u => u.id === uid);
          const avatar = user && user.avatarUrl
            ? `<img src="${esc(user.avatarUrl)}" class="avatar avatar-sm lb-user-link" data-user-id="${uid}" alt="avatar">`
            : `<img src="assets/android-chrome-512x512.png" class="avatar avatar-sm avatar-fallback lb-user-link" data-user-id="${uid}" alt="avatar">`;
          const badge = `<span class="rank-badge rank-${i+1}" title="Rank ${i+1}">${i+1}</span>`;
          return `<li>${badge}${avatar}<span class="lb-username lb-user-link" data-user-id="${uid}">${user ? esc(user.name) : 'Unknown'}</span> <span class="muted">(${count} posts)</span></li>`;
        }).join('')}
      </ol>
      <h2>👍 Most Liked</h2>
      <ol class="leaderboard-list">
        ${topLikes.map(([uid, count], i) => {
          const user = db.users.find(u => u.id === uid);
          const avatar = user && user.avatarUrl
            ? `<img src="${esc(user.avatarUrl)}" class="avatar avatar-sm lb-user-link" data-user-id="${uid}" alt="avatar">`
            : `<img src="assets/android-chrome-512x512.png" class="avatar avatar-sm avatar-fallback lb-user-link" data-user-id="${uid}" alt="avatar">`;
          const badge = `<span class="rank-badge rank-${i+1}" title="Rank ${i+1}">${i+1}</span>`;
          return `<li>${badge}${avatar}<span class="lb-username lb-user-link" data-user-id="${uid}">${user ? esc(user.name) : 'Unknown'}</span> <span class="muted">(${count} likes)</span></li>`;
        }).join('')}
      </ol>
    </div>
  `;

  // Event delegation for user click
  root.querySelectorAll('.lb-user-link').forEach(el => {
    el.style.cursor = 'pointer';
  });
  root.addEventListener('click', function(e) {
    const el = e.target.closest('.lb-user-link');
    if (el && el.dataset.userId) {
      showUserProfile(el.dataset.userId, DB);
    }
  });
}
