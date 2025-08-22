// js/views/leaderboard.js
// Leaderboard view for most contributions and most likes received
import { esc } from '../core/utils.js';

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
    <div class="box leaderboard-box">
      <h2>🏆 Top Contributors</h2>
      <ol>
        ${topContribs.map(([uid, count], i) => {
          const user = db.users.find(u => u.id === uid);
          return `<li><b>${i+1}.</b> ${user ? esc(user.name) : 'Unknown'} <span class="muted">(${count} posts)</span></li>`;
        }).join('')}
      </ol>
      <h2>👍 Most Liked</h2>
      <ol>
        ${topLikes.map(([uid, count], i) => {
          const user = db.users.find(u => u.id === uid);
          return `<li><b>${i+1}.</b> ${user ? esc(user.name) : 'Unknown'} <span class="muted">(${count} likes)</span></li>`;
        }).join('')}
      </ol>
    </div>
  `;
}
