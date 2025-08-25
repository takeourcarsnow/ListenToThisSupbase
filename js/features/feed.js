import { esc, fmtTime, $ } from '../core/utils.js';
import { fetchOEmbed } from './oembed.js';
import { openEditInline } from './posts.js';
import { enableTagCloudDragScroll } from './tagcloud_scroll.js';

function userName(id, state, DB) {
  const db = DB.getAll();
  const u = db.users.find(x => x.id === id);
  if (u) return u.name;
  if (state.user && state.user.id === id) return state.user.name || 'user';
  return 'anon';
}

export function getFilteredPosts(DB, prefs) {
  const db = DB.getAll();
  let posts = db.posts.slice();

  if (prefs.filterTag) {
    posts = posts.filter(p => (p.tags || []).includes(prefs.filterTag));
  }
  if (prefs.search) {
    const q = prefs.search.toLowerCase();
    posts = posts.filter(p => {
      return (p.title || '').toLowerCase().includes(q)
        || (p.artist || '').toLowerCase().includes(q)
        || (p.tags || []).some(t => t.includes(q))
        || (p.body || '').toLowerCase().includes(q);
    });
  }
  if (prefs.sort === 'likes') {
    posts.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0) || b.createdAt - a.createdAt);
  } else if (prefs.sort === 'comments') {
    posts.sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0) || b.createdAt - a.createdAt);
  } else {
    posts.sort((a, b) => b.createdAt - a.createdAt);
  }
  return posts;
}

export function renderCommentHTML(c, postId, state, DB) {
  const canDel = state.user && c.userId === state.user.id;
  const db = DB.getAll();
  const u = db.users.find(x => x.id === c.userId) || null;
  const uname = userName(c.userId, state, DB);
  const avatarUrl = u && u.avatarUrl ? esc(u.avatarUrl) : '/assets/android-chrome-512x512.png';
    return `<div class="comment small" data-comment="${c.id}" data-post="${postId}">
      <img class="avatar avatar-sm" src="${avatarUrl}" alt="avatar" />
      <span class="muted">${fmtTime(c.createdAt)}</span> <b>${u ? `<a href="#" data-action="view-user" data-uid="${esc(u.id)}">${esc(uname)}</a>` : esc(uname)}</b>: ${esc(c.text)}
      ${canDel ? ` <button class="btn btn-ghost small" data-action="delete-comment" data-post="${postId}" data-comment="${c.id}">[ delete ]</button>` : ''}
    </div>`;
}

export function renderPostHTML(p, state, DB) {
  const db = DB.getAll();
  const user = db.users.find(u => u.id === p.userId);
  const me = state.user;
  const liked = me ? (p.likes || []).includes(me.id) : false;
  // Highlight selected tag
  const selectedTag = state && state.prefs && state.prefs.filterTag;
  const tgs = (p.tags || []).map(t =>
    `<a href="#" class="tag small${selectedTag && t === selectedTag ? ' tag-selected' : ''}" data-action="filter-tag" data-tag="${esc(t)}">#${esc(t)}</a>`
  ).join(' ');
  const perma = `${location.origin ? (location.origin + location.pathname) : location.pathname}#post-${p.id}`;
  const canEdit = !!(me && p.userId === me.id);
  const likeCount = p.likes ? p.likes.length : 0;
  const commentsCount = p.comments ? p.comments.length : 0;
  const commentsHTML = (p.comments || []).map(c => renderCommentHTML(c, p.id, state, DB)).join('');

  const authorAvatar = user && user.avatarUrl ? esc(user.avatarUrl) : '/assets/android-chrome-512x512.png';
  // Only show 'by' before artist or username, not both
  const artistHTML = p.artist ? `<span class="post-artist-twolines muted thin">by ${esc(p.artist)}</span>` : '';
  const userBy = p.artist ? '' : 'by ';
  // Determine thumbnail: use p.thumbnail if present, else try to generate from p.url (YouTube, SoundCloud, Spotify), else fallback
  let thumbnailUrl = '';
  if (p.thumbnail) {
    thumbnailUrl = esc(p.thumbnail);
  } else if (p.url) {
    // YouTube
    const ytMatch = p.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([\w-]{11})/);
    if (ytMatch) {
      thumbnailUrl = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    } else if (/soundcloud\.com/.test(p.url)) {
      // SoundCloud: use logo as placeholder (oEmbed requires async)
      thumbnailUrl = '/assets/logo.png'; // Replace with SoundCloud logo if available
    } else if (/spotify\.com/.test(p.url)) {
      // Spotify: show Spotify logo as thumbnail
      thumbnailUrl = '/assets/spotify-logo.png';
    } else {
      thumbnailUrl = '/assets/logo.png';
    }
  } else {
    thumbnailUrl = '/assets/logo.png';
  }
  return `
  <article class="post" id="post-${p.id}" data-post="${p.id}" aria-label="${esc(p.title)}">
    <div class="post-thumbnail-wrap">
      <img class="post-thumbnail" src="${thumbnailUrl}" alt="post thumbnail" loading="lazy" data-action="toggle-player" data-post="${p.id}" style="cursor:pointer;" />
    </div>
    <div class="post-header-twolines">
      <div class="post-title-twolines">${esc(p.title)}${artistHTML}</div>
      <div class="small meta-twolines">
        <a href="#" data-action="view-user" data-uid="${user ? esc(user.id) : ''}">
          <img class="avatar avatar-sm" src="${authorAvatar}" alt="avatar" />
        </a>
        <span class="muted">${userBy}${user ? `<a href=\"#\" data-action=\"view-user\" data-uid=\"${esc(user.id)}\">${esc(user.name)}</a>` : 'anon'}</span>
    <span class="muted sep-slash">/</span>
  <span class="muted" title="${(() => { const d = new Date(p.createdAt); let m = d.getMinutes(); m = m < 15 ? 0 : m < 45 ? 30 : 0; if (m === 0 && d.getMinutes() >= 45) d.setHours(d.getHours() + 1); d.setMinutes(m, 0, 0); return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); })()}">${fmtTime(p.createdAt)}</span>
  ${tgs ? `<span class="muted sep-slash">/</span> <div class="tag-cloud post-tags-twolines">${tgs}</div>` : ''}
      </div>
    </div>
  ${p.body ? `<div class="sep"></div><div>${esc(p.body)}</div>` : ''}
  <div class="actions hstack" style="margin-top:8px">
  <button class="btn" data-action="toggle-player">[ play ]</button>
  <button class="btn ${liked ? 'like-on' : ''}" data-action="like" aria-pressed="${liked}" title="like">[ ♥ ${likeCount} ]</button>
  <button class="btn" data-action="comment" title="comments">[ comments ${commentsCount} ]</button>
  <button class="btn btn-ghost" data-action="show-lyrics" data-artist="${esc(p.artist || '')}" data-title="${esc(p.title || '')}" data-post="${p.id}">[ lyrics ]</button>
  <button class="btn btn-ghost" data-action="queue" title="add to queue">[ add to queue ]</button>
  <button class="btn btn-ghost" data-action="share" data-perma="${esc(perma)}" title="share/copy link">[ share ]</button>
      ${canEdit ? `
        <button class="btn btn-ghost" data-action="edit" data-post="${p.id}">[ edit ]</button>
        <button class="btn btn-ghost" data-action="delete">[ delete ]</button>
      ` : ''}
    </div>
  <div class="lyrics-box small muted" id="lyrics-${p.id}" style="display:none;margin-top:8px;white-space:pre-line;position:relative;"></div>
    <div class="player" id="player-${p.id}" aria-label="player"></div>
    <div class="comment-box" id="cbox-${p.id}">
      <div class="sep"></div>
      <div id="comments-${p.id}">
        ${commentsHTML}
      </div>
      ${state.user ? `
        <form class="hstack" data-action="comment-form" data-post="${p.id}">
          <label class="sr-only" for="c-${p.id}">Write a comment</label>
          <input class="field" id="c-${p.id}" placeholder="write a comment…" maxlength="500" aria-label="Write a comment" />
          <button class="btn">[ send ]</button>
        </form>
      ` : `<div class="muted small">login to comment</div>`}
    </div>
  </article>
  `;
}

export function renderFeed(el, pager, state, DB, prefs) {
  // --- Swipe gesture support for feed navigation ---
  let touchStartX = null;
  let touchEndX = null;
  const minSwipeDist = 60;
  function handleTouchStart(e) {
    if (e.touches && e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
    }
  }
  function handleTouchMove(e) {
    if (e.touches && e.touches.length === 1) {
      touchEndX = e.touches[0].clientX;
    }
  }
  function handleTouchEnd() {
    if (touchStartX !== null && touchEndX !== null) {
      const dist = touchEndX - touchStartX;
      if (Math.abs(dist) > minSwipeDist) {
        if (dist < 0 && state.page * state.pageSize < total) {
          // Swipe left: next page
          state.page++;
          renderFeed(el, pager, state, DB, prefs);
        } else if (dist > 0 && state.page > 1) {
          // Swipe right: previous page
          state.page--;
          renderFeed(el, pager, state, DB, prefs);
        }
      }
    }
    touchStartX = null;
    touchEndX = null;
  }
  el.removeEventListener('touchstart', handleTouchStart);
  el.removeEventListener('touchmove', handleTouchMove);
  el.removeEventListener('touchend', handleTouchEnd);
  el.addEventListener('touchstart', handleTouchStart, { passive: true });
  el.addEventListener('touchmove', handleTouchMove, { passive: true });
  el.addEventListener('touchend', handleTouchEnd, { passive: true });
  // --- Preserve open comment boxes and their input values ---
  const openComments = Array.from(document.querySelectorAll('.comment-box.active')).map(box => box.id);
  // Map of comment box id -> input value
  const commentInputs = {};
  openComments.forEach(id => {
    const box = document.getElementById(id);
    if (box) {
      const inp = box.querySelector('input.field');
      if (inp) commentInputs[id] = inp.value;
    }
  });

  // Attach prefs to state for tag highlighting
  state = { ...state, prefs };
  let posts = getFilteredPosts(DB, prefs);
  // User filter support (from prefs or global)
  const userId = prefs._userFilterId || window.filterPostsByUserId;
  if (userId) {
    posts = posts.filter(p => p.userId === userId);
  }
  const total = posts.length;
  const start = 0;
  const end = Math.min(state.page * state.pageSize, total);
  const chunk = posts.slice(start, end);

  if (total === 0) {
    el.innerHTML = `<div class="notice small">No posts yet. Add one on the right.</div>`;
    pager.innerHTML = '';
    return;
  }
  el.innerHTML = chunk.map(p => renderPostHTML(p, state, DB)).join('');

  // Background: replace Spotify logo placeholders with actual thumbnails via Spotify oEmbed
  (async function replaceSpotifyThumbnails() {
    try {
      const spotifyPosts = chunk.filter(p => p.url && /spotify\.com/.test(p.url) && !p.thumbnail);
      if (!spotifyPosts.length) return;
      for (const p of spotifyPosts) {
        try {
          const md = await fetchOEmbed(p.url);
          if (md && md.thumbnail_url) {
            // Update DB object if possible
            try { p.thumbnail = md.thumbnail_url; } catch {}
            // Find image element and swap src if it still points to the spotify logo
            const img = document.querySelector(`#post-${p.id} .post-thumbnail`);
            if (img && img.getAttribute('src') && img.getAttribute('src').includes('spotify-logo')) {
              img.src = md.thumbnail_url;
            }
          }
        } catch (e) {
          // ignore per-post failures
        }
      }
    } catch (e) {
      // overall failure is non-fatal
    }
  })();

  // --- Restore open comment boxes and their input values ---
  openComments.forEach(id => {
    const box = document.getElementById(id);
    if (box) {
      box.classList.add('active');
      const inp = box.querySelector('input.field');
      if (inp && commentInputs[id] !== undefined) inp.value = commentInputs[id];
    }
  });

  // Save for edit restore
  setFeedGlobals(state, DB);

  // Restore edit panel if editingPostId is set
  if (window.editingPostId) {
    const card = document.getElementById('post-' + window.editingPostId);
    const editBoxId = 'editbox-' + window.editingPostId;
    const editPanel = document.getElementById(editBoxId);
    if (card && editPanel && editPanel.parentNode !== card) {
      // Move the existing edit panel back into the card (no animation, no re-creation)
      card.appendChild(editPanel);
    } else if (card && !editPanel) {
      // If not present at all, create it (no animation on restore)
      openEditInline(window.editingPostId, state, DB, { noAnimation: true });
    }
  }
// Attach edit button handler globally (once)
if (!window._editBtnHandlerAttached) {
  document.addEventListener('click', function(e) {
    // Edit button
    const editBtn = e.target.closest('button[data-action="edit"][data-post]');
    if (editBtn) {
      const postId = editBtn.getAttribute('data-post');
      const card = document.getElementById('post-' + postId);
      // Close lyrics panel if open
      const lyricsBox = document.getElementById('lyrics-' + postId);
      if (lyricsBox && lyricsBox.style.display === 'block') {
        lyricsBox.classList.remove('fade-in');
        lyricsBox.classList.add('fade-out');
        setTimeout(() => {
          lyricsBox.style.display = 'none';
          lyricsBox.textContent = '';
          lyricsBox.classList.remove('fade-out');
        }, 180);
      }
      const editBoxId = 'editbox-' + postId;
      const opened = card ? card.querySelector('#' + editBoxId) : null;
      if (opened) {
        // If already open, close it
        opened.classList.remove('fade-in');
        opened.classList.add('fade-out');
        setTimeout(() => {
          if (opened.parentNode) opened.parentNode.removeChild(opened);
          if (window.editingPostId == postId) window.editingPostId = null;
        }, 180);
      } else {
        openEditInline(postId, window._lastFeedState, window._lastFeedDB);
      }
      e.preventDefault();
      return;
    }
    // Comment button
    const commentBtn = e.target.closest('button[data-action="comment"][data-post],button[data-action="comment"]');
    if (commentBtn) {
      const postId = commentBtn.getAttribute('data-post') || (commentBtn.closest('.post') && commentBtn.closest('.post').dataset.post);
      if (postId) {
        // Close lyrics panel if open
        const lyricsBox = document.getElementById('lyrics-' + postId);
        if (lyricsBox && lyricsBox.style.display === 'block') {
          lyricsBox.classList.remove('fade-in');
          lyricsBox.classList.add('fade-out');
          setTimeout(() => {
            lyricsBox.style.display = 'none';
            lyricsBox.textContent = '';
            lyricsBox.classList.remove('fade-out');
          }, 180);
        }
      }
    }
    // ...existing code...
  });
  window._editBtnHandlerAttached = true;
}

// Save last state/DB for edit restore
function setFeedGlobals(state, DB) {
  window._lastFeedState = state;
  window._lastFeedDB = DB;
}

  if (end < total) {
    pager.innerHTML = `<button class="btn btn-ghost" data-action="load-more">[ load more (${end}/${total}) ]</button>`;
  } else {
    pager.innerHTML = `<div class="small muted">${total} loaded</div>`;
  }

  const h = (location.hash || '').trim();
  if (h.startsWith('#post-')) {
    const id = h.slice(6);
    const node = document.getElementById('post-' + id);
    if (node) {
      node.classList.add('highlight');
      node.scrollIntoView({ block: 'start' });
      setTimeout(() => node.classList.remove('highlight'), 1500);
    }
    history.replaceState(null, '', location.pathname);
  }

  // Always enable drag-to-scroll for each feed post's tag list
  document.querySelectorAll('.tag-cloud.post-tags-twolines').forEach(tc => {
    enableTagCloudDragScroll(tc);
  });

  // Attach event delegation for post thumbnail click to play post
  if (!window._thumbnailPlayHandlerAttached) {
    el.addEventListener('click', function(e) {
      const thumb = e.target.closest('.post-thumbnail[data-action="toggle-player"]');
      if (thumb) {
        e.preventDefault();
        e.stopPropagation();
        const postId = thumb.getAttribute('data-post');
        const playBtn = document.querySelector(`#post-${postId} .btn[data-action="toggle-player"]`);
        if (playBtn) {
          // Dispatch a real click event to trigger all listeners
          playBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
      }
    });
    window._thumbnailPlayHandlerAttached = true;
  }
}

export function renderTags(el, DB, prefs) {
  const db = DB.getAll();
  const m = new Map();
  db.posts.forEach(p => (p.tags || []).forEach(t => m.set(t, (m.get(t) || 0) + 1)));

  // Sorting UI
  let sortMode = window.localStorage.getItem('tagSortMode') || 'freq';
  function setSortMode(mode) {
    sortMode = mode;
    window.localStorage.setItem('tagSortMode', mode);
    renderTags(el, DB, prefs);
  }
  // Remove old sort UI if present
  const oldSortUI = el.querySelector('.tag-sort-ui');
  if (oldSortUI) oldSortUI.remove();
  // Remove old tag cloud if present
  const oldCloud = el.querySelector('.tag-cloud');
  if (oldCloud) oldCloud.remove();
  // Tag cloud
  let top = Array.from(m.entries());
  if (sortMode === 'freq') {
    top = top.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  } else {
    top = top.sort((a, b) => a[0].localeCompare(b[0]) || b[1] - a[1]);
  }
  top = top.slice(0, 80);
  if (top.length === 0) { el.innerHTML = '<span class="muted small">no tags yet</span>'; return; }
  // Render all tags with the same class, no frequency-based sizing
  const tagCloudDiv = document.createElement('div');
  tagCloudDiv.className = 'tag-cloud';
  // Highlight the selected tag in the tag cloud
  const selectedTag = prefs && prefs.filterTag;
  tagCloudDiv.innerHTML = top.map(([t, c]) =>
    `<span class="tag${selectedTag === t ? ' tag-selected' : ''}" data-action="filter-tag" data-tag="${esc(t)}"${selectedTag === t ? ' style="background:var(--acc,#8ab4ff);color:#111;font-weight:600;border-radius:6px;outline:2px solid var(--acc,#8ab4ff);outline-offset:0;z-index:2;"' : ''}><span class="tag-label">#${esc(t)}</span></span>`
  ).join(' ');
  el.appendChild(tagCloudDiv);
  // Restore scrollLeft if present, else center selected tag only if user is at start, using rAF for timing
  if (typeof window !== 'undefined' && typeof window._tagCloudScrollLeft === 'number') {
    let tries = 0;
    const maxTries = 8;
    function rafScrollRestore() {
      tagCloudDiv.scrollLeft = window._tagCloudScrollLeft;
      tries++;
      if (tries < maxTries) {
        requestAnimationFrame(rafScrollRestore);
      } else {
        delete window._tagCloudScrollLeft;
      }
    }
    requestAnimationFrame(rafScrollRestore);
  } else if (selectedTag) {
    // Center the selected tag after render if user is at start and no previous scroll position, only once
    requestAnimationFrame(() => {
      const tagEl = tagCloudDiv.querySelector('.tag-selected');
      if (tagEl && tagCloudDiv.scrollLeft < 5) {
        const tagRect = tagEl.getBoundingClientRect();
        const cloudRect = tagCloudDiv.getBoundingClientRect();
        // Only center if tag is not fully visible
        if (tagRect.left < cloudRect.left || tagRect.right > cloudRect.right) {
          const offset = tagEl.offsetLeft + tagRect.width / 2 - cloudRect.width / 2;
          tagCloudDiv.scrollLeft = offset;
        }
      }
    });
  }
  // Enable drag-to-scroll for the main tag cloud (desktop)
  if (typeof enableTagCloudDragScroll === 'function') {
    enableTagCloudDragScroll(tagCloudDiv);
  }
  // On mobile, add touchend handler directly to each tag to ensure tap works
  if ('ontouchstart' in window) {
  // No-op: all tap/drag/click logic is handled in tagcloud_scroll.js
  }
  // Minimal sort UI below
    const sortUI = document.createElement('div');
    sortUI.className = 'tag-sort-ui';
    sortUI.style.display = 'inline-flex';
    sortUI.style.gap = '10px';
    sortUI.style.marginTop = '6px';
    sortUI.style.fontSize = '0.93em';
    sortUI.innerHTML = `
      <a href="#" data-sort="freq" class="tag-sort-link${sortMode==='freq'?' active':''}">frequency</a>
      <span style="color:#444;opacity:0.5;">|</span>
      <a href="#" data-sort="az" class="tag-sort-link${sortMode==='az'?' active':''}" tabindex="0">a - z</a>
      <style>
        .tag-sort-link {
          color: #aaa;
          text-decoration: none;
          border: none;
          background: none;
          padding: 0 2px;
          cursor: pointer;
          transition: color 0.18s;
          font-weight: 500;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          outline: none;
          box-shadow: none;
          overflow: visible;
        }
        .tag-sort-link.active {
          color: var(--acc, #8ab4ff);
        }
        .tag-sort-link::after {
          content: '';
          display: block;
          position: absolute;
          left: 0; right: 0; bottom: -2px;
          height: 2px;
          background: var(--acc, #8ab4ff);
          opacity: 0;
          transform: scaleX(0.5);
          transition: opacity 0.18s, transform 0.18s;
        }
        .tag-sort-link:hover::after, .tag-sort-link:focus::after, .tag-sort-link.active::after {
          opacity: 1;
          transform: scaleX(1);
        }
        .tag-sort-link:hover, .tag-sort-link:focus {
          color: var(--acc, #8ab4ff);
        }
      </style>
    `;
  sortUI.addEventListener('click', e => {
    const link = e.target.closest('a[data-sort]');
    if (link) {
      e.preventDefault();
      setSortMode(link.getAttribute('data-sort'));
    }
  });
  el.appendChild(sortUI);
}