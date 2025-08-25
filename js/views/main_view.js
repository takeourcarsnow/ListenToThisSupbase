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
  // Helper to attach scroll listener to feedPane for mobile infinite scroll
  function attachFeedPaneScrollListener() {
  // Autoloading removed: no automatic scroll-to-load behavior. Kept as no-op
  return;
  }

  // Robust scroll reset helper: tries immediate, rAF and timeout resets to cover
  // different browsers and transformed ancestors where scrollTop may lag.
  function resetScroll(el) {
    try {
      if (!el) return;
      el.scrollTop = 0;
      if (typeof el.scrollTo === 'function') {
        try { el.scrollTo(0, 0); } catch (e) {}
      }
    } catch (e) {}
    requestAnimationFrame(() => {
      try { el.scrollTop = 0; if (typeof el.scrollTo === 'function') el.scrollTo(0,0); } catch (e) {}
      setTimeout(() => {
        try { el.scrollTop = 0; if (typeof el.scrollTo === 'function') el.scrollTo(0,0); window.scrollTo(0,0); document.documentElement.scrollTop = 0; } catch (e) {}
      }, 30);
    });
  }
  // Autoloading removed: no observers or auto-click behavior for load-more.
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

  // Layout containers with sliding wrapper for mobile
  // Per-tab state objects for independence
  let feedTabState = state.feedTabState || {};
  let composeTabState = state.composeTabState || {};
  let profileTabState = state.profileTabState || {};

  let slideWrapper, feedPane, composePane, profilePane, left, right;
  if (window.matchMedia('(max-width: 600px)').matches) {
    slideWrapper = document.createElement('div');
    slideWrapper.className = 'mobile-slide-wrapper';
    // Each pane is 100vw wide
    feedPane = document.createElement('div');
    feedPane.className = 'mobile-slide-pane feed-pane';
    composePane = document.createElement('div');
    composePane.className = 'mobile-slide-pane compose-pane';
    profilePane = document.createElement('div');
    profilePane.className = 'mobile-slide-pane profile-pane';
    slideWrapper.appendChild(feedPane);
    slideWrapper.appendChild(composePane);
    slideWrapper.appendChild(profilePane);
    root.appendChild(slideWrapper);
    // For compatibility with rest of code
    left = feedPane;
    right = composePane; // will be used for compose/profile

    // --- Swipe gesture support for mobile tabs ---
    let touchStartX = null, touchStartY = null, touchEndX = null, touchEndY = null;
    const tabOrder = ['feed', 'compose', 'profile'];
    slideWrapper.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchEndX = null;
        touchEndY = null;
      }
    });
    slideWrapper.addEventListener('touchmove', function(e) {
      if (e.touches.length === 1) {
        touchEndX = e.touches[0].clientX;
        touchEndY = e.touches[0].clientY;
      }
    });
    slideWrapper.addEventListener('touchend', function(e) {
      if (touchStartX !== null && touchEndX !== null) {
        const dx = touchEndX - touchStartX;
        const dy = (touchEndY || 0) - (touchStartY || 0);
        // Only trigger if mostly horizontal swipe and at least 40px
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          let currentTab = slideWrapper.getAttribute('data-tab') || 'feed';
          let idx = tabOrder.indexOf(currentTab);
          if (dx < 0 && idx < tabOrder.length - 1) {
            // Swipe left: next tab
            const nextTab = tabOrder[idx + 1];
            if (nextTab) {
              const btn = document.querySelector('.mobile-tab-bar button[data-tab="' + nextTab + '"]');
              if (btn) btn.click();
            }
          } else if (dx > 0 && idx > 0) {
            // Swipe right: previous tab
            const prevTab = tabOrder[idx - 1];
            if (prevTab) {
              const btn = document.querySelector('.mobile-tab-bar button[data-tab="' + prevTab + '"]');
              if (btn) btn.click();
            }
          }
        }
      }
      touchStartX = touchStartY = touchEndX = touchEndY = null;
    });
  } else {
    // Desktop: use grid as before
    slideWrapper = null;
    const grid = document.createElement('div');
    grid.className = 'grid';
    left = document.createElement('div');
    right = document.createElement('div');
    grid.appendChild(left);
    grid.appendChild(right);
    root.appendChild(grid);
  }

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
  // Helper to show/hide views with sliding animation
  function showTab(tab) {
    if (!isMobile) {
        currentTab = tab;
        left.style.display = '';
        right.style.display = '';
        if (tab === 'profile') {
            right.innerHTML = '';
            renderProfileBox(right, state, DB, render);
            // Reset scroll position for profile tab
+            resetScroll(right);
        } else if (tab === 'compose') {
            right.innerHTML = '';
            renderComposeBox(right, state, DB, render);
            // Reset scroll position for compose tab
+            resetScroll(right);
        }
        // Update tab bar active state
        const tabBtns = document.querySelectorAll('.mobile-tab-bar button');
        tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
        return;
    }

    // Mobile: animate slide
    currentTab = tab;

    // Render content into correct pane, preserve per-tab state
  if (feedPane && composePane && profilePane) {
      if (tab === 'feed') {
      if (!feedPane.innerHTML.trim()) {
        setupFeedPane({ root, left: feedPane, state, DB, prefs, render });
        feedTabState.rendered = true;
        // Autoloading removed: no observer to attach here.
      }
      // Reset feed pane scroll reliably
      resetScroll(feedPane);
      // --- Scroll to currently playing post on mobile ---
      if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches && state.queue && state.queue.length > 0 && typeof state.qIndex === 'number') {
        setTimeout(() => {
          const postId = state.queue[state.qIndex];
          if (postId) {
            const postEl = document.getElementById('post-' + postId);
            if (postEl && feedPane.contains(postEl)) {
              postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 150); // Delay to ensure feed is rendered
      }
    } else if (tab === 'compose') {
      composePane.innerHTML = '';
      renderComposeBox(composePane, state, DB, render);
      // Ensure scroll position is reset for compose tab
      resetScroll(composePane);
    } else if (tab === 'profile') {
      profilePane.innerHTML = '';
      renderProfileBox(profilePane, state, DB, render);
      // Ensure scroll position is reset for profile tab
      resetScroll(profilePane);
    }

    // Slide to correct tab
    let slideIndex = 0;
    if (tab === 'feed') slideIndex = 0;
    if (tab === 'compose') slideIndex = 1;
    if (tab === 'profile') slideIndex = 2;
    slideWrapper.style.transform = `translateX(-${slideIndex * 100}vw)`;
    slideWrapper.setAttribute('data-tab', tab);

    // Update tab bar active state
    const tabBtns = document.querySelectorAll('.mobile-tab-bar button');
    tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  }

    // Save per-tab state to global state for persistence
    state.feedTabState = feedTabState;
    state.composeTabState = composeTabState;
    state.profileTabState = profileTabState;

    // Restore player UI if feed tab is active
    if (tab === 'feed' && state.queue && state.queue.length > 0 && typeof state.qIndex === 'number') {
        setTimeout(() => {
            import('../features/queue.js').then(mod => {
                if (mod && typeof mod.jumpToQueueItem === 'function') {
                    mod.jumpToQueueItem(state.qIndex, state);
                }
            });
        }, 0);
    }
  }

  // Left side: topbar + dock + tags + feed
  if (window.matchMedia('(max-width: 600px)').matches) {
    // Only render feedPane initially, others are blank until tab is switched
    if (!feedTabState.rendered) {
      setupFeedPane({ root, left: feedPane, state, DB, prefs, render });
      feedTabState.rendered = true;
      // Autoloading removed: no observer to attach after render
    }
    // Compose/profile panes will be rendered on tab switch
  } else {
    setupFeedPane({ root, left, state, DB, prefs, render });
  // Autoloading removed: no observer to attach for desktop feed
    // Right side: profile + compose (or guest prompt)
    if (state.user) {
      renderProfileBox(right, state, DB, render);
    }
    renderComposeBox(right, state, DB, render);
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

    // Keep mobile tab bar visible when scrolling up.
    // Some browsers or other handlers may hide/show UI on scroll; this listener
    // ensures the tab bar is forced visible when the user scrolls upward.
    if (!window._tunedinMobileTabScrollHandler) {
      window._tunedinMobileTabScrollHandler = true;
      let _lastScrollY = typeof window !== 'undefined' ? window.scrollY || 0 : 0;
      window.addEventListener('scroll', () => {
        try {
          const tab = document.querySelector('.mobile-tab-bar');
          if (!tab) return;
          const y = window.scrollY || window.pageYOffset || 0;
          // If scrolling up (new y is less than previous), make sure tab is visible
          if (y < _lastScrollY) {
            tab.style.transform = 'translateY(0)';
            tab.style.opacity = '1';
            // remove any helper class that might hide it
            tab.classList.remove('hidden');
            tab.classList.remove('hide');
          }
          _lastScrollY = y;
        } catch (err) { /* ignore */ }
      }, { passive: true });
    }
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

  // Restore player UI after re-render (fixes player closing on resize)
  if (state.queue && state.queue.length > 0 && typeof state.qIndex === 'number') {
    setTimeout(() => {
      import('../features/queue.js').then(mod => {
        if (mod && typeof mod.jumpToQueueItem === 'function') {
          mod.jumpToQueueItem(state.qIndex, state);
        }
      });
    }, 0);
  }
}