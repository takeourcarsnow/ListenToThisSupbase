// js/views/main_view.js
import { $ } from '../core/utils.js';
import { loadPrefs, savePrefs } from '../auth/prefs.js';
import { updateDock } from '../features/queue.js';
import { onImport } from '../features/import_export.js';

import { setupFeedPane } from './main_view_feed.js';
import { renderProfileBox } from './main_view_profile.js';
import { renderComposeBox } from './main_view_compose.js';
import { setupAutoRefresh, setupVisibilityRefresh } from './main_view_refresh.js';

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

  // Mobile tab bar logic
  let isMobile = window.matchMedia('(max-width: 600px)').matches;
  // Responsive: re-render on device width change
  if (!window._tunedinMobileResizeHandler) {
    window._tunedinMobileResizeHandler = true;
    let lastIsMobile = isMobile;
    window.addEventListener('resize', () => {
      const nowMobile = window.matchMedia('(max-width: 600px)').matches;
      if (nowMobile !== lastIsMobile) {
        lastIsMobile = nowMobile;
        // Remove tab bar if present
        const oldTabBar = document.querySelector('.mobile-tab-bar');
        if (oldTabBar) oldTabBar.remove();
        // Re-render main view
        render();
      }
    });
  }
  let currentTab = 'feed';
  // Helper to show/hide views
  function showTab(tab) {
    currentTab = tab;
    // Hide all
    left.style.display = 'none';
    right.style.display = 'none';
    // Show selected
    if (tab === 'feed') left.style.display = '';
    if (tab === 'compose' || tab === 'profile') right.style.display = '';
    // If profile, only show profile box, else show compose
    if (tab === 'profile') {
      right.innerHTML = '';
      renderProfileBox(right, state, DB, render);
    } else if (tab === 'compose') {
      right.innerHTML = '';
      renderComposeBox(right, state, DB, render);
    }
    // Update tab bar active state
    const tabBtns = document.querySelectorAll('.mobile-tab-bar button');
    tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  }

  // Left side: topbar + dock + tags + feed
  setupFeedPane({ root, left, state, DB, prefs, render });

  // Right side: profile + compose (or guest prompt)
  if (!isMobile) {
    if (state.user) {
      renderProfileBox(right, state, DB, render);
    }
    renderComposeBox(right, state, DB, render);
  } else {
    // On mobile, default to feed tab, right is hidden until tab is switched
    right.style.display = 'none';
  }

  // Mobile tab bar injection
  if (isMobile) {
    // Remove any existing tab bar
    const oldTabBar = document.querySelector('.mobile-tab-bar');
    if (oldTabBar) oldTabBar.remove();
    const tabBar = document.createElement('nav');
    tabBar.className = 'mobile-tab-bar';
    tabBar.innerHTML = `
      <button data-tab="feed" class="active" aria-label="Feed">
        <span>🏠</span>
        <span class="tab-label">Feed</span>
      </button>
      <button data-tab="compose" aria-label="Compose">
        <span>✍️</span>
        <span class="tab-label">Compose</span>
      </button>
      <button data-tab="profile" aria-label="Profile">
        <span>👤</span>
        <span class="tab-label">Profile</span>
      </button>
    `;
    document.body.appendChild(tabBar);
    tabBar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (btn) {
        showTab(btn.dataset.tab);
      }
    });
    // Initial state
    showTab('feed');
  }

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