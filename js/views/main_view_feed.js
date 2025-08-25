// js/views/main_view_feed.js
import { $, debounce, esc } from '../core/utils.js';
import { loadPrefs, savePrefs } from '../auth/prefs.js';
import { renderFeed, renderTags, getFilteredPosts } from '../features/feed.js';
import { enableTagCloudDragScroll } from '../features/tagcloud_scroll.js';
import notifications from '../core/notifications.js';

export function setupFeedPane({ root, left, state, DB, prefs, render }) {
  // Always reset page to 1 on feed pane setup (tab switch or reload)
  state.page = 1;
  // Ensure pageSize is set to a reasonable default for both mobile and desktop
  if (!state.pageSize || typeof state.pageSize !== 'number' || state.pageSize < 1) {
    state.pageSize = 20;
  }
  // Show welcome/info popup for new users (like notifications)
  const BANNER_KEY = 'tunedin.hideWelcomeBanner';
  if (!localStorage.getItem(BANNER_KEY)) {
    const popup = document.createElement('div');
    popup.className = 'info-popup-banner popup-onboarding';
    popup.innerHTML = `
      <div class="popup-banner-inner" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;width:100%;gap:10px;">
        <div class="popup-banner-msg" style="display:flex;flex-wrap:wrap;align-items:center;gap:7px;font-size:1.08em;line-height:1.5;">
          <span style="font-size:1.15em;line-height:1.1;">Hey!</span>
          <span style="display:inline;white-space:normal;">Check
            <a href="#" class="popup-link popup-nowrap" data-popup-action="help" style="color:#6cf;text-decoration:underline;cursor:pointer;white-space:nowrap;"><b>[ help ]</b></a>
            &amp;
            <a href="#" class="popup-link popup-changelog-link popup-nowrap" data-popup-action="changelog" style="color:#6cf;text-decoration:underline;cursor:pointer;white-space:nowrap;"><b>[ changelog ]</b></a>
            for updates.
          </span>
        </div>
        <button class="btn btn-ghost small" style="font-size:1.25em;opacity:0.7;padding:2px 10px 0 10px;line-height:1;align-self:flex-start;" title="Dismiss" aria-label="Close">×</button>
      </div>
    `;
    // Dismiss logic (only one declaration)
    const close = () => {
      popup.style.animation = 'fadeout-popup-banner-bottom 0.4s';
      setTimeout(() => {
        popup.remove();
        localStorage.setItem(BANNER_KEY, '1');
      }, 350);
    };
    // Make [ help ] and [ dev changelog ] clickable
    popup.querySelector('[data-popup-action="help"]').onclick = (e) => {
      e.preventDefault();
      // Simulate a click on the user menu help button for identical behavior
      const userMenuHelpBtn = document.querySelector('[data-action="show-help"]');
      if (userMenuHelpBtn) userMenuHelpBtn.click();
      close();
    };
    popup.querySelector('[data-popup-action="changelog"]').onclick = (e) => {
      e.preventDefault();
      import('../core/changelog_modal.js').then(mod => {
        // Show the modal
        if (mod && typeof mod.showChangelogModal === 'function') {
          mod.showChangelogModal();
        } else if (window.showChangelogModal) {
          window.showChangelogModal();
        }
        // Inject changelog modal CSS if not present
        if (!document.getElementById('changelog-modal-css')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'css/changelog_modal.css';
          link.id = 'changelog-modal-css';
          document.head.appendChild(link);
        }
        // Close any open overlays (help, etc.)
        document.querySelectorAll('.overlay').forEach(el => el.remove());
      }).catch(err => {
        if (window.showChangelogModal) window.showChangelogModal();
        else console.error('Failed to load changelog modal:', err);
        if (!document.getElementById('changelog-modal-css')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'css/changelog_modal.css';
          link.id = 'changelog-modal-css';
          document.head.appendChild(link);
        }
        document.querySelectorAll('.overlay').forEach(el => el.remove());
      });
      close();
    };
    popup.style.textAlign = 'left';
    Object.assign(popup.style, {
      position: 'fixed',
      bottom: '32px',
      left: '0',
      right: '0',
      margin: '0 auto',
      background: 'linear-gradient(90deg, #23272a 80%, #2d3136 100%)',
      color: '#f3f3f3',
      padding: '14px 18px 14px 18px',
      borderRadius: '13px',
      fontSize: '1em',
      display: 'block',
      boxShadow: '0 8px 32px #0005',
      maxWidth: '480px',
      minWidth: '220px',
      zIndex: 20000,
      animation: 'fadein-popup-banner-bottom 0.7s',
      cursor: 'default',
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
    });
  // (removed duplicate close function)
    popup.querySelector('button').onclick = close;
    // Auto-dismiss after 8 seconds if not closed
    setTimeout(() => { if (document.body.contains(popup)) close(); }, 8000);
    document.body.appendChild(popup);
    // Add fadein/fadeout keyframes if not present
    if (!document.getElementById('info-popup-banner-anim-bottom')) {
      const style = document.createElement('style');
      style.id = 'info-popup-banner-anim-bottom';
      style.textContent = `
        @keyframes fadein-popup-banner-bottom { from { opacity:0; transform:translateY(48px);} to { opacity:1; transform:none; } }
        @keyframes fadeout-popup-banner-bottom { from { opacity:1; } to { opacity:0; transform:translateY(48px);} }
      `;
      document.head.appendChild(style);
    }
  }
  // Ensure help overlay can always be opened
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="show-help"]');
    if (btn) {
      import('../core/help.js').then(mod => mod.renderHelpOverlay());
    }
  });
  const db = DB.getAll();
  const me = state.user;

  // Topbar
  let userFilterId = window.filterPostsByUserId || null;
  let filteredPosts = getFilteredPosts(DB, prefs);
  if (userFilterId) filteredPosts = filteredPosts.filter(p => p.userId === userFilterId);
  const postCount = (prefs.filterTag || prefs.search || userFilterId)
    ? filteredPosts.length
    : db.posts.length;

  const top = document.createElement('div');
  top.className = 'topbar';
  top.innerHTML = `
    <div class="toolbar topbar-toolbar">
      <div class="user-actions-container">
        ${me ? '<span class="notification-dot" id="mobile-notification-dot" style="position: static; cursor: pointer; display: inline-block; margin-left: 0px; margin-right: 0px; opacity: 0.35;" title="No notifications"></span>' : ''}
        <div class="user-pill" tabindex="0" role="button" aria-haspopup="true" aria-expanded="false">
          <span class="pill" title="current user">> user: ${me ? esc(me.name) : 'guest'}</span>
        </div>
        <div class="user-action-buttons">
          ${
            me
              ? `<button class="btn btn-ghost" data-action="view-user" data-uid="${esc(me.id)}" style="position:relative;">
                  [ profile ]
                </button><button class="btn btn-ghost" data-action="logout" title="logout">[ logout ]</button>`
              : `<button class="btn btn-ghost" id="goLoginBtn" title="login / register" style="position:relative;">
                  [ login / register ]
                </button>`
          }
          <button class="btn btn-ghost" data-action="show-help" title="keyboard shortcuts">[ help ]</button>
        </div>
      </div>
    </div>
  `;
  // Notification dot logic
  // Notification dot logic (dynamically insert dot as child of user button)
  const userBtn = top.querySelector('[data-action="view-user"], #goLoginBtn');
  // Notification dot removed from user button (already present in profile section)

  // Slide-out user action buttons logic
  const userActionsContainer = top.querySelector('.user-actions-container');
  const userPill = top.querySelector('.user-pill');
  const userActionButtons = top.querySelector('.user-action-buttons');
  if (userPill && userActionButtons) {
  // (Leaderboard and changelog buttons moved to help menu)
    // On touch devices, open on first tap (touchstart)
    if ('ontouchstart' in window) {
      userPill.addEventListener('touchstart', (e) => {
        if (!userActionsContainer.classList.contains('open')) {
          userActionsContainer.classList.add('open');
          userPill.setAttribute('aria-expanded', 'true');
          e.preventDefault();
        }
      });
      // Also allow closing on tap if already open
      userPill.addEventListener('click', () => {
        if (userActionsContainer.classList.contains('open')) {
          userActionsContainer.classList.remove('open');
          userPill.setAttribute('aria-expanded', 'false');
        }
      });
    } else {
      userPill.addEventListener('click', () => {
        userActionsContainer.classList.toggle('open');
        userPill.setAttribute('aria-expanded', userActionsContainer.classList.contains('open'));
      });
    }
    userPill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        userActionsContainer.classList.toggle('open');
        userPill.setAttribute('aria-expanded', userActionsContainer.classList.contains('open'));
      }
    });
    // Enable hover open/close for desktop (non-touch) only
    if (!('ontouchstart' in window)) {
      userActionsContainer.addEventListener('mouseenter', () => {
        userActionsContainer.classList.add('open');
        userPill.setAttribute('aria-expanded', 'true');
      });
      userActionsContainer.addEventListener('mouseleave', () => {
        userActionsContainer.classList.remove('open');
        userPill.setAttribute('aria-expanded', 'false');
      });
    }
    // Optional: close on outside click
    document.addEventListener('click', (e) => {
      if (!userActionsContainer.contains(e.target)) {
        userActionsContainer.classList.remove('open');
        userPill.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Dock
  const prefsNow = loadPrefs();
  const dock = document.createElement('div');
  dock.className = 'dock';
  dock.id = 'dock';
  dock.style.display = 'none';
  dock.style.borderBottom = 'none';
  dock.innerHTML = `
    <div class="hstack" style="justify-content:center; align-items:center; flex-wrap:wrap; gap:18px;">
      <div class="hstack" style="gap:18px;">
  <button class="btn" data-action="q-prev" title="previous in queue (k)">&#9198;</button>
  <button class="btn" data-action="q-stop" title="stop">&#9632;</button>
  <button class="btn" data-action="q-next" title="next in queue (j)">&#9197;</button>
  <button class="btn" data-action="q-shuffle" aria-pressed="${prefsNow.shuffle}" title="shuffle">&#8646;</button>
  <button class="btn btn-ghost" data-action="q-clear" title="clear queue"><span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;"><svg width="13" height="13" viewBox="0 0 13 13" style="display:block;margin:auto;" xmlns="http://www.w3.org/2000/svg"><line x1="3" y1="3" x2="10" y2="10" stroke="#39ff14" stroke-width="1.7" stroke-linecap="round"/><line x1="10" y1="3" x2="3" y2="10" stroke="#39ff14" stroke-width="1.7" stroke-linecap="round"/></svg></span></button>
      </div>
    </div>
    <div class="dock-info">
      <div class="nowplaying-marquee-wrap">
        <span id="nowPlaying" class="muted nowplaying-marquee"></span>
      </div>
      <div class="queue-info small" style="text-align:center; margin-top:2px;">
        queue <span id="qPos">0</span>/<span id="qLen">0</span>
      </div>
    </div>
  `;
  dock.addEventListener('click', (e) => {
    const stopBtn = e.target.closest('[data-action="q-stop"]');
    if (stopBtn) {
      const activePlayer = document.querySelector('.player.active');
      if (activePlayer) {
        activePlayer.querySelectorAll('audio,video').forEach(el => {
          el.pause && el.pause();
          el.currentTime = 0;
        });
        activePlayer.querySelectorAll('iframe').forEach(ifr => (ifr.src = ''));
        activePlayer.classList.remove('active');
        const playingPost = document.querySelector('.post.is-playing');
        if (playingPost) playingPost.classList.remove('is-playing');
      }
    }

    // Handle clear queue button: also close the current open post
    const clearBtn = e.target.closest('[data-action="q-clear"]');
    if (clearBtn) {
      // Remove any overlays (if open post is an overlay)
      document.querySelectorAll('.overlay').forEach(el => el.remove());
      // Remove is-playing from any post
      const playingPost = document.querySelector('.post.is-playing');
      if (playingPost) playingPost.classList.remove('is-playing');
      // Remove active from any player
      const activePlayer = document.querySelector('.player.active');
      if (activePlayer) activePlayer.classList.remove('active');
    }
  });

  // Left column: tags and feed
  const playAllLabel = prefs.filterTag ? `play #${esc(prefs.filterTag)}` : 'play all';

  const tagsBox = document.createElement('div');
  tagsBox.className = 'box';
  tagsBox.id = 'tagsBoxMain';
  tagsBox.style.marginBottom = '16px';
  tagsBox.innerHTML = `
    <div class="hstack" style="justify-content:space-between; align-items:center">
      <div class="muted small">> tags</div>
    </div>
    <div id="tags"></div>
  `;

  const feedBox = document.createElement('div');
  feedBox.className = 'box';
  feedBox.innerHTML = `
    <div class="feed-search-bar" style="margin-bottom:12px;">
      <input class="field" id="search" type="search" placeholder="search title/artist/tags..." value="${esc(prefs.search)}" aria-label="search"/>
    </div>
    <div class="hstack feed-header-bar" style="justify-content:space-between; flex-wrap:wrap; align-items:center; margin-bottom:8px;">
      <div class="hstack" style="gap:10px; align-items:center;">
        <span class="muted">&gt; feed</span>
        ${
          userFilterId
            ? `<span class="pill">user filter: <a href="#" data-action="clear-user-filter">${esc(
                db.users.find(u => u.id === userFilterId)?.name || 'user'
              )}</a> <a href="#" data-action="clear-user-filter" title="clear user filter">✕</a></span>`
            : ''
        }
        ${prefs.filterTag ? `<span class="pill">tag: #${esc(prefs.filterTag)} <a href="#" data-action="clear-tag" title="clear tag">✕</a></span>` : ''}
  <span title="total posts">posts: ${postCount}</span>
      </div>
      <div class="hstack" style="gap:12px; align-items:center;">
        <button class="btn btn-ghost" data-action="play-all">[ ${playAllLabel} ]</button>
        <div class="sort-icons" id="sort-icons" aria-label="sort order">
          <button class="sort-btn${prefs.sort === 'new' ? ' active' : ''}" data-sort="new" title="Sort by newest"><span class="icon-sort-newest"></span></button>
          <button class="sort-btn${prefs.sort === 'likes' ? ' active' : ''}" data-sort="likes" title="Sort by most liked"><span class="icon-sort-likes"></span></button>
          <button class="sort-btn${prefs.sort === 'comments' ? ' active' : ''}" data-sort="comments" title="Sort by most commented"><span class="icon-sort-comments"></span></button>
        </div>
      </div>
    </div>
    <div id="feed"></div>
    <div id="pager" class="hstack" style="justify-content:center; margin-top:8px"></div>
  `;

  left.appendChild(top);
  left.appendChild(tagsBox);
  left.appendChild(dock);
  left.appendChild(feedBox);

  // Always reload prefs and re-render feed/tags for correct tag highlight (mobile/desktop)
  function doRender() {
    // Save tag cloud scroll position before rerender
    const tagCloud = document.querySelector('.tag-cloud');
    if (tagCloud) {
      window._tagCloudScrollLeft = tagCloud.scrollLeft;
    }
    const latestPrefs = loadPrefs();
    state.page = 1;
    renderFeed($('#feed'), $('#pager'), state, DB, latestPrefs);
    renderTags($('#tags'), DB, latestPrefs);
    enableTagCloudDragScroll();
  }
  // Global user filter event (once)
  if (!window._userFilterHandlerAttached) {
    window.addEventListener('filter-user-posts', (e) => {
      window.filterPostsByUserId = e.detail.userId;
      doRender();
    });
    window._userFilterHandlerAttached = true;
  }

  // Clear user filter (now in feed header bar)
  feedBox.addEventListener('click', (e) => {
    if (e.target && e.target.dataset && e.target.dataset.action === 'clear-user-filter') {
      window.filterPostsByUserId = null;
      doRender();
      e.preventDefault();
    }
  });

  // Initial feed + tags render
  doRender();

  // Infinite scroll implementation
  let isLoading = false;
  const feedEl = feedBox.querySelector('#feed');
  function handleScroll() {
    if (isLoading) return;
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
    let scrollable, scrollTop, windowHeight;
    if (isMobile) {
      // On mobile, use the feed pane as the scrollable container
      scrollable = left;
      scrollTop = scrollable.scrollTop;
      windowHeight = scrollable.clientHeight;
    } else {
      scrollable = document.documentElement;
      scrollTop = window.scrollY || scrollable.scrollTop;
      windowHeight = window.innerHeight || scrollable.clientHeight;
    }
    const feedRect = feedEl.getBoundingClientRect();
    const threshold = isMobile ? 400 : 200;
    // If feed bottom is within threshold of viewport bottom (for mobile, relative to scrollable)
    let nearBottom;
    if (isMobile) {
      nearBottom = (scrollable.scrollHeight - scrollTop - windowHeight) < threshold;
    } else {
      nearBottom = (feedRect.bottom - windowHeight) < threshold;
    }
    if (nearBottom) {
      // Check if more posts are available
      const prefsNow = loadPrefs();
      const posts = getFilteredPosts(DB, prefsNow);
      const total = posts.length;
      const end = Math.min((state.page + 1) * state.pageSize, total);
      if (end > state.page * state.pageSize && end <= total) {
        isLoading = true;
        state.page++;
        renderFeed(feedEl, feedBox.querySelector('#pager'), state, DB, prefsNow);
        setTimeout(() => { isLoading = false; }, 400); // Prevent rapid firing
      }
    }
  }
  // Attach scroll event to correct container
  const isMobile = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
  if (isMobile) {
    left.addEventListener('scroll', handleScroll);
  } else {
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
  }

  // Fallback: after each feed render, check if more posts should be loaded (in case feed is too short)
  function checkFeedFill() {
    setTimeout(() => {
      handleScroll();
    }, 100); // Wait for DOM update
  }
  // Call checkFeedFill after initial render
  checkFeedFill();

  // Patch: call checkFeedFill after every renderFeed
  const origRenderFeed = renderFeed;
  function renderFeedWithFill(...args) {
    origRenderFeed(...args);
    checkFeedFill();
  }
  // Use our patched version for this pane only
  left.renderFeedWithFill = renderFeedWithFill;

  // Search (now in feedBox)
  const searchInput = feedBox.querySelector('#search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      savePrefs({ search: e.target.value });
      state.page = 1;
      renderFeed($('#feed'), $('#pager'), state, DB, loadPrefs());
  checkFeedFill();
  checkFeedFill();
  checkFeedFill();
  checkFeedFill();
    }, 120));
  }

  // Sort icons
  const sortIcons = feedBox.querySelector('#sort-icons');
  if (sortIcons) {
    sortIcons.addEventListener('click', (e) => {
      const btn = e.target.closest('.sort-btn');
      if (btn) {
        const sortType = btn.getAttribute('data-sort');
        savePrefs({ sort: sortType });
        state.page = 1;
        renderFeed($('#feed'), $('#pager'), state, DB, loadPrefs());
      }
    });
  }

  return { top, dock, tagsBox, feedBox };
}
