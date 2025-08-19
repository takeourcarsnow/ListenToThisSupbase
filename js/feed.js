// js/feed.js
import DB from './db.js';
import { state } from './state.js';
import { loadPrefs } from './prefs.js';
import { fmtTime, esc, $ } from './utils.js';

function userName(id){
  const db = DB.getAll();
  const u = db.users.find(x=>x.id===id);
  return u ? u.name : 'anon';
}

export function renderCommentHTML(c){
  return `<div class="comment small"> <span class="muted">${fmtTime(c.createdAt)}</span> <b>${esc(userName(c.userId))}</b>: ${esc(c.text)} </div>`;
}

export function renderPostHTML(p){
  const db = DB.getAll();
  const user = db.users.find(u=>u.id===p.userId);
  const me = state.user || { id: '' };
  const liked = (p.likes||[]).includes(me.id);
  const tgs = (p.tags||[]).map(t=>
    `<a href="#" class="tag small" data-action="filter-tag" data-tag="${esc(t)}">#${esc(t)}</a>`
  ).join(' ');
  const perma = `${location.origin ? (location.origin + location.pathname) : location.pathname}#post-${p.id}`;
  const canEdit = p.userId === me.id;
  const likeCount = p.likes ? p.likes.length : 0;
  const commentsCount = p.comments ? p.comments.length : 0;

  return `
<article class="post" id="post-${p.id}" data-post="${p.id}" aria-label="${esc(p.title)}">
  <div class="title">${esc(p.title)} ${p.artist?`<span class="muted thin">by ${esc(p.artist)}</span>`:''}</div>
  <div class="small meta">
    <span class="muted">posted by ${esc(user ? user.name : 'anon')}</span>
    <span class="muted dot">·</span>
    <span class="muted">${fmtTime(p.createdAt)}</span>
    ${tgs?`<span class="muted dot">·</span> ${tgs}`:''}
  </div>
  ${p.body?`<div class="sep"></div><div>${esc(p.body)}</div>`:''}
  <div class="actions hstack" style="margin-top:8px">
    <button class="btn" data-action="toggle-player">[ play ]</button>
    <button class="btn ${liked?'like-on':''}" data-action="like" aria-pressed="${liked}" title="like">[ ♥ ${likeCount} ]</button>
    <button class="btn" data-action="comment" title="comments">[ comments ${commentsCount} ]</button>
    <button class="btn btn-ghost" data-action="queue" title="add to queue">[ add to queue ]</button>
    <button class="btn btn-ghost" data-action="share" data-perma="${esc(perma)}" title="share/copy link">[ share ]</button>
    <a class="btn btn-ghost" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">[ open src ]</a>
    ${canEdit ? `
      <button class="btn btn-ghost" data-action="edit">[ edit ]</button>
      <button class="btn btn-ghost" data-action="delete">[ delete ]</button>
    `:''}
  </div>
  <div class="player" id="player-${p.id}" aria-label="player"></div>
  <div class="comment-box" id="cbox-${p.id}">
    <div class="sep"></div>
    <div id="comments-${p.id}">
      ${(p.comments||[]).map(c=> renderCommentHTML(c)).join('')}
    </div>
    <form class="hstack" data-action="comment-form" data-post="${p.id}">
      <label class="sr-only" for="c-${p.id}">Write a comment</label>
      <input class="field" id="c-${p.id}" placeholder="write a comment…" maxlength="500" />
      <button class="btn">[ send ]</button>
    </form>
  </div>
</article>
`;
}

export function renderTags(el){
  const db = DB.getAll();
  const m = new Map();
  db.posts.forEach(p=> (p.tags||[]).forEach(t=> m.set(t, (m.get(t)||0)+1)));
  const top = Array.from(m.entries())
    .sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
    .slice(0,80);
  if(top.length===0) { el.innerHTML = '<span class="muted small">no tags yet</span>'; return; }
  el.innerHTML = top.map(([t,c])=>
    `<span class="tag small" data-action="filter-tag" data-tag="${esc(t)}">#${esc(t)} <span class="muted">(${c})</span></span>`
  ).join(' ');
}

export function getFilteredPosts(){
  const db = DB.getAll();
  const prefs = loadPrefs();
  let posts = db.posts.slice();

  if(prefs.filterTag){
    posts = posts.filter(p=> (p.tags||[]).includes(prefs.filterTag));
  }
  if(prefs.search){
    const q = prefs.search.toLowerCase();
    posts = posts.filter(p=>{
      return (p.title||'').toLowerCase().includes(q)
        || (p.artist||'').toLowerCase().includes(q)
        || (p.tags||[]).some(t=>t.includes(q))
        || (p.body||'').toLowerCase().includes(q);
    });
  }
  if(prefs.sort === 'likes'){
    posts.sort((a,b)=> (b.likes?.length||0) - (a.likes?.length||0) || b.createdAt - a.createdAt);
  } else if(prefs.sort === 'comments'){
    posts.sort((a,b)=> (b.comments?.length||0) - (a.comments?.length||0) || b.createdAt - a.createdAt);
  } else {
    posts.sort((a,b)=> b.createdAt - a.createdAt);
  }
  return posts;
}

export function renderFeed(el, pager){
  const posts = getFilteredPosts();
  const total = posts.length;
  const end = Math.min(state.page*state.pageSize, total);
  const chunk = posts.slice(0, end);

  if(total===0){
    el.innerHTML = `<div class="notice small">No posts yet. Add one on the right.</div>`;
    pager.innerHTML = '';
    return;
  }
  el.innerHTML = chunk.map(p=> renderPostHTML(p)).join('');

  if(end < total){
    pager.innerHTML = `<button class="btn btn-ghost" data-action="load-more">[ load more (${end}/${total}) ]</button>`;
  } else {
    pager.innerHTML = `<div class="small muted">${total} loaded</div>`;
  }

  const h = (location.hash||'').trim();
  if(h.startsWith('#post-')){
    const id = h.slice(6);
    const node = document.getElementById('post-'+id);
    if(node){
      node.classList.add('highlight');
      node.scrollIntoView({block:'start'});
      setTimeout(()=>node.classList.remove('highlight'), 1500);
    }
    history.replaceState(null, '', location.pathname);
  }
}