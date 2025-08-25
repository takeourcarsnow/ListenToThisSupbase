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
  // Restore scrollbars and show header/banner
  // Don't force-hide document scroll here. Instead, when in mobile pane
  // mode we move the header into the feed pane so it scrolls with the
  // pane (prevents header from appearing stuck when body overflow is
  // modified by other code or browsers).
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
    // If a header exists, move it into the feed pane on mobile so it scrolls
    // with the pane instead of being visually stuck at the top when users
    // scroll the pane. On desktop the header remains in .wrap (handled by
    // header.renderHeader()).
    try {
      const header = document.querySelector('header[role="banner"]');
      if (header && feedPane && feedPane.appendChild) {
        feedPane.insertBefore(header, feedPane.firstChild);
      }
    } catch (e) { /* ignore */ }
    // For compatibility with rest of code
    left = feedPane;
    right = composePane; // will be used for compose/profile

    // --- Swipe gesture support for mobile tabs ---
    let touchStartX = null, touchStartY = null, touchEndX = null, touchEndY = null;
    // If a touch starts inside the tag cloud, ignore the global tab-swipe handler
    let ignoreSwipeFromTagCloud = false;
    const tabOrder = ['feed', 'compose', 'profile'];
    // Capture-phase listeners to detect touches that start inside interactive
    // child widgets (like the tag cloud) before the slideWrapper's bubble
    // handlers run. This prevents accidental tab swipes when interacting
    // with those widgets.
    function _captureTouchStart(e) {
      try {
        if (e.touches && e.touches.length >= 1) {
          // If the touch started inside any element with class 'tag-cloud'
          if (e.target && e.target.closest && e.target.closest('.tag-cloud')) {
            ignoreSwipeFromTagCloud = true;
          }
        }
      } catch (err) { /* ignore */ }
    }
    function _captureTouchEnd() {
      ignoreSwipeFromTagCloud = false;
    }
    document.addEventListener('touchstart', _captureTouchStart, { capture: true, passive: true });
    document.addEventListener('touchend', _captureTouchEnd, { capture: true, passive: true });

    slideWrapper.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1) {
        // If capture-phase already detected a touch inside tag cloud, keep flag
        // otherwise evaluate here as a fallback.
        if (!ignoreSwipeFromTagCloud) {
          ignoreSwipeFromTagCloud = !!(e.target && e.target.closest && e.target.closest('.tag-cloud'));
        }
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchEndX = null;
        touchEndY = null;
      }
    });
    slideWrapper.addEventListener('touchmove', function(e) {
      if (ignoreSwipeFromTagCloud) return; // don't track tab-swipe when interacting with tag cloud
      if (e.touches.length === 1) {
        touchEndX = e.touches[0].clientX;
        touchEndY = e.touches[0].clientY;
      }
    });
    slideWrapper.addEventListener('touchend', function(e) {
      if (ignoreSwipeFromTagCloud) {
        // Reset and ignore this swipe
        touchStartX = touchStartY = touchEndX = touchEndY = null;
        ignoreSwipeFromTagCloud = false;
        return;
      }
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
    try {
      const header = document.querySelector('header[role="banner"]');
      if (header && document.querySelector('.wrap')) {
        document.querySelector('.wrap').prepend(header);
      }
    } catch (e) { /* ignore */ }
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
      // Move header into feed pane so it is visible when returning to feed
      try {
        const header = document.querySelector('header[role="banner"]');
        if (header && feedPane) feedPane.insertBefore(header, feedPane.firstChild);
      } catch (e) { /* ignore */ }
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
      // Move header into the active pane so header is visible and scrolls
      try {
        const header = document.querySelector('header[role="banner"]');
        if (header && composePane) composePane.insertBefore(header, composePane.firstChild);
      } catch (e) { /* ignore */ }
    } else if (tab === 'profile') {
      profilePane.innerHTML = '';
      renderProfileBox(profilePane, state, DB, render);
      // Ensure scroll position is reset for profile tab
      resetScroll(profilePane);
      // Move header into the active pane so header is visible and scrolls
      try {
        const header = document.querySelector('header[role="banner"]');
        if (header && profilePane) profilePane.insertBefore(header, profilePane.firstChild);
      } catch (e) { /* ignore */ }
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
      // Use window scroll on desktop, but when mobile panes are used the
      // visible scrolling container is the feed pane. Observe that instead
      // so the tab bar still responds to user scrolling on mobile.
      let isPane = false;
      let scrollEl = window;
      try {
        const pane = document.querySelector('.mobile-slide-pane.feed-pane');
        if (pane) {
          isPane = true;
          scrollEl = pane;
        }
      } catch (e) { /* ignore */ }
      let _lastScrollY = 0;
      try {
        _lastScrollY = isPane ? (scrollEl.scrollTop || 0) : (window.scrollY || 0);
      } catch (e) { _lastScrollY = 0; }
      const handler = () => {
        try {
          const tab = document.querySelector('.mobile-tab-bar');
          if (!tab) return;
          const y = isPane ? (scrollEl.scrollTop || 0) : (window.scrollY || window.pageYOffset || 0);
          // If scrolling up (new y is less than previous), make sure tab is visible
          if (y < _lastScrollY) {
            tab.style.transform = 'translateY(0)';
            tab.style.opacity = '1';
            tab.classList.remove('hidden');
            tab.classList.remove('hide');
          }
          _lastScrollY = y;
        } catch (err) { /* ignore */ }
      };
      try {
        if (isPane && scrollEl && typeof scrollEl.addEventListener === 'function') scrollEl.addEventListener('scroll', handler, { passive: true });
        else window.addEventListener('scroll', handler, { passive: true });
      } catch (e) {
        // Fallback to window
        window.addEventListener('scroll', handler, { passive: true });
      }
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