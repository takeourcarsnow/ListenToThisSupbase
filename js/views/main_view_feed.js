// js/views/main_view_feed.js
import { $, debounce, esc } from '../core/utils.js';
import { loadPrefs, savePrefs } from '../auth/prefs.js';
import { renderFeed, renderTags, getFilteredPosts } from '../features/feed.js';
import { enableTagCloudDragScroll } from '../features/tagcloud_scroll.js';
import notifications from '../core/notifications.js';

export function setupFeedPane({ root, left, state, DB, prefs, render }) {
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
        <button class="btn" data-action="q-prev" title="previous in queue (k)">[ prev ]</button>
        <button class="btn" data-action="q-stop" title="stop">[ stop ]</button>
        <button class="btn" data-action="q-next" title="next in queue (j)">[ next ]</button>
        <button class="btn" data-action="q-shuffle" aria-pressed="${prefsNow.shuffle}" title="shuffle">[ shuffle ]</button>
        <button class="btn btn-ghost" data-action="q-clear" title="clear queue">[ clear ]</button>
      </div>
    </div>
    <div class="small" style="text-align:center; margin-top:6px;">
      <span id="nowPlaying" class="muted"></span> · queue <span id="qPos">0</span>/<span id="qLen">0</span>
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
      ${prefs.filterTag ? `<button class="btn btn-ghost small" data-action="clear-tag">[ clear tag ]</button>` : ''}
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

  // Global user filter event (once)
  if (!window._userFilterHandlerAttached) {
    window.addEventListener('filter-user-posts', (e) => {
      window.filterPostsByUserId = e.detail.userId;
      render();
    });
    window._userFilterHandlerAttached = true;
  }

  // Clear user filter (now in feed header bar)
  feedBox.addEventListener('click', (e) => {
    if (e.target && e.target.dataset && e.target.dataset.action === 'clear-user-filter') {
      window.filterPostsByUserId = null;
      render();
      e.preventDefault();
    }
  });

  // Initial feed + tags render
  state.page = 1;
  renderFeed($('#feed'), $('#pager'), state, DB, prefs);
  renderTags($('#tags'), DB);
  enableTagCloudDragScroll();

  // Search (now in feedBox)
  const searchInput = feedBox.querySelector('#search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      savePrefs({ search: e.target.value });
      state.page = 1;
      renderFeed($('#feed'), $('#pager'), state, DB, loadPrefs());
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
