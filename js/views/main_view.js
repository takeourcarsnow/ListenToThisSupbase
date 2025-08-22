// js/views/main_view.js
import { $ } from '../core/utils.js';
import { loadPrefs, savePrefs } from '../auth/prefs.js';
import { updateDock } from '../features/queue.js';
import { onImport } from '../features/import_export.js';

import { setupFeedPane } from './main_view_feed.js';
import { renderProfileBox } from './main_view_profile.js';
import { renderComposeBox } from './main_view_compose.js';
import { setupAutoRefresh, setupVisibilityRefresh } from './main_view_refresh.js';
import { renderLeaderboard } from './leaderboard.js';
import { openLeaderboardOverlay, bindLeaderboardOverlay } from './overlays.js';

export async function renderMain(root, state, DB, render) {
  const prefs = loadPrefs();

  // Restore scrollbars and show header/banner
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  const banner = document.getElementById('ascii-banner');
  if (banner) banner.style.display = '';
  document.body.classList.add('show-header');

  // Layout containers
  const grid = document.createElement('div');
  grid.className = 'grid';
  const left = document.createElement('div');
  const right = document.createElement('div');
  grid.appendChild(left);
  grid.appendChild(right);
  root.appendChild(grid);

  // Leaderboard overlay logic
  window.showLeaderboard = function() {
    const overlay = document.getElementById('leaderboard-overlay');
    if (!overlay) return;
    overlay.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'overlay-inner';
    renderLeaderboard(inner, DB);
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-ghost';
    closeBtn.textContent = '[ close ]';
    closeBtn.setAttribute('data-close-leaderboard', '1');
    closeBtn.style.float = 'right';
    inner.prepend(closeBtn);
    overlay.appendChild(inner);
    openLeaderboardOverlay();
  };
  bindLeaderboardOverlay();

  // Left side: topbar + dock + tags + feed
  setupFeedPane({ root, left, state, DB, prefs, render });

  // Right side: profile + compose (or guest prompt)
  if (state.user) {
    renderProfileBox(right, state, DB, render);
  }
  renderComposeBox(right, state, DB, render);

  // Initialize dock UI
  updateDock(false, state, DB);

  // Auto-refresh and instant refresh (idempotent via window flags)
  setupAutoRefresh(state, DB);
  setupVisibilityRefresh(state, DB);

  // Delegated login button handler (top bar and right box)
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('#goLoginBtn, [data-action="go-login"]');
    if (btn) {
      e.preventDefault();
      state.forceLogin = true;
      render();
    }
  });

  // Optional external controls elsewhere in the page
  const importFile = $('#importFile');
  if (importFile) importFile.addEventListener('change', (e) => onImport(e, DB, state, render));

  const chk = $('#autoScroll');
  if (chk) chk.onchange = () => savePrefs({ autoScroll: chk.checked });
}