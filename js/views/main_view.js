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
  // Mobile tab bar logic
  let isMobile = window.matchMedia('(max-width: 600px)').matches;
  // Remove mobile tab bar if entering login/auth screen
  if (isMobile && state.forceLogin) {
    const oldTabBar = document.querySelector('.mobile-tab-bar');
    if (oldTabBar) oldTabBar.remove();
  }
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

  // Mobile tab bar injection with accessibility and keyboard navigation
  // Show if mobile and NOT in login/auth screen (state.forceLogin)
  if (isMobile && !state.forceLogin) {
    // Remove any existing tab bar
    const oldTabBar = document.querySelector('.mobile-tab-bar');
    if (oldTabBar) oldTabBar.remove();
    const tabBar = document.createElement('nav');
    tabBar.className = 'mobile-tab-bar';
    tabBar.setAttribute('role', 'tablist');
    tabBar.innerHTML = `
      <div class="tab-indicator"></div>
      <button data-tab="feed" class="active" aria-label="Feed" role="tab" aria-selected="true" tabindex="0">
        <span>🏠</span>
      </button>
      <button data-tab="compose" aria-label="Compose" role="tab" aria-selected="false" tabindex="-1">
        <span>✍️</span>
      </button>
      <button data-tab="profile" aria-label="Profile" role="tab" aria-selected="false" tabindex="-1">
        <span>👤</span>
      </button>
    `;
    document.body.appendChild(tabBar);

    const tabBtns = Array.from(tabBar.querySelectorAll('button[data-tab]'));
    const indicator = tabBar.querySelector('.tab-indicator');
    function moveIndicator(tab) {
      const idx = tabBtns.findIndex(b => b.dataset.tab === tab);
      if (idx !== -1 && indicator) {
        indicator.style.left = `calc(${idx} * 100% / 3)`;
      }
    }

    tabBar.addEventListener('keydown', (e) => {
      const idx = tabBtns.findIndex(btn => btn === document.activeElement);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        let nextIdx = idx;
        if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabBtns.length;
        if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabBtns.length) % tabBtns.length;
        tabBtns[nextIdx].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        tabBtns[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        tabBtns[tabBtns.length - 1].focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (idx !== -1) tabBtns[idx].click();
      }
    });

    tabBar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (btn) {
        showTab(btn.dataset.tab);
        // Update ARIA attributes and tabindex
        tabBtns.forEach(b => {
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
          b.tabIndex = b === btn ? 0 : -1;
        });
        btn.focus();
        moveIndicator(btn.dataset.tab);
      }
    });

    // Initial state
    showTab('feed');
    moveIndicator('feed');
    // Ensure first tab is focusable
    tabBtns[0].tabIndex = 0;
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