import { esc, fmtTime, $ } from './utils.js';

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
  const avatarUrl = u && u.avatarUrl ? esc(u.avatarUrl) : '/favicon-32x32.png';
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
  const tgs = (p.tags || []).map(t =>
    `<a href="#" class="tag small" data-action="filter-tag" data-tag="${esc(t)}">#${esc(t)}</a>`
  ).join(' ');
  const perma = `${location.origin ? (location.origin + location.pathname) : location.pathname}#post-${p.id}`;
  const canEdit = !!(me && p.userId === me.id);
  const likeCount = p.likes ? p.likes.length : 0;
  const commentsCount = p.comments ? p.comments.length : 0;
  const commentsHTML = (p.comments || []).map(c => renderCommentHTML(c, p.id, state, DB)).join('');

  const authorAvatar = user && user.avatarUrl ? esc(user.avatarUrl) : '/favicon-32x32.png';
    return `
  <article class="post" id="post-${p.id}" data-post="${p.id}" aria-label="${esc(p.title)}">
    <div class="title">${esc(p.title)} ${p.artist ? `<span class="muted thin">by ${esc(p.artist)}</span>` : ''}</div>
    <div class="small meta">
      <img class="avatar avatar-sm" src="${authorAvatar}" alt="avatar" />
      <span class="muted">posted by ${user ? `<a href="#" data-action="view-user" data-uid="${esc(user.id)}">${esc(user.name)}</a>` : 'anon'}</span>
      <span class="muted dot">·</span>
      <span class="muted">${fmtTime(p.createdAt)}</span>
      ${tgs ? `<span class="muted dot">·</span> ${tgs}` : ''}
    </div>
  ${p.body ? `<div class="sep"></div><div>${esc(p.body)}</div>` : ''}
  <div class="actions hstack" style="margin-top:8px">
    <button class="btn" data-action="toggle-player">[ play ]</button>
    <button class="btn ${liked ? 'like-on' : ''}" data-action="like" aria-pressed="${liked}" title="like">[ ♥ ${likeCount} ]</button>
    <button class="btn" data-action="comment" title="comments">[ comments ${commentsCount} ]</button>
    <button class="btn btn-ghost" data-action="queue" title="add to queue">[ add to queue ]</button>
    <button class="btn btn-ghost" data-action="share" data-perma="${esc(perma)}" title="share/copy link">[ share ]</button>
    ${canEdit ? `
      <button class="btn btn-ghost" data-action="edit">[ edit ]</button>
      <button class="btn btn-ghost" data-action="delete">[ delete ]</button>
    ` : ''}
  </div>
  <div class="player" id="player-${p.id}" aria-label="player"></div>
  <div class="comment-box" id="cbox-${p.id}">
    <div class="sep"></div>
    <div id="comments-${p.id}">
      ${commentsHTML}
    </div>
    ${state.user ? `
      <form class="hstack" data-action="comment-form" data-post="${p.id}">
        <label class="sr-only" for="c-${p.id}">Write a comment</label>
        <input class="field" id="c-${p.id}" placeholder="write a comment…" maxlength="500" />
        <button class="btn">[ send ]</button>
      </form>
    ` : `<div class="muted small">login to comment</div>`}
  </div>
</article>
`;
}

export function renderFeed(el, pager, state, DB, prefs) {
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
}

export function renderTags(el, DB) {
  const db = DB.getAll();
  const m = new Map();
  db.posts.forEach(p => (p.tags || []).forEach(t => m.set(t, (m.get(t) || 0) + 1)));
  const top = Array.from(m.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 80);
  if (top.length === 0) { el.innerHTML = '<span class="muted small">no tags yet</span>'; return; }
  // Find min and max counts for scaling
  const counts = top.map(([_, c]) => c);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  // Assign frequency classes (1-5, or max)
  function freqClass(count) {
    if (max === min) return 'tag--freq-3';
    const level = Math.ceil(((count - min) / (max - min)) * 4) + 1; // 1-5
    return level >= 5 ? 'tag--freq-max' : `tag--freq-${level}`;
  }
  el.innerHTML = `<div class="tag-cloud">` +
    top.map(([t, c]) =>
      `<span class="tag ${freqClass(c)}" data-action="filter-tag" data-tag="${esc(t)}"><span class="tag-label">#${esc(t)} <span class="muted">(${c})</span></span></span>`
    ).join(' ') + `</div>`;
}