import DB from './db.js';
import { parseProvider, buildEmbed } from './providers.js';
import {
  $, $$, debounce, safeClone, fmtTime, uid, esc, liveSay,
  copyText, toast, approxSize, fmtBytes, applyAccent, applyDensity
} from './utils.js';
import { USE_SUPABASE } from './config.js';

// Storage keys and prefs
const SESSION_KEY = 'ascii.fm/session@v1';
const PREF_KEY = 'ascii.fm/prefs@v2';

const defaultPrefs = {
  autoScroll: true,
  sort: 'new', // new | likes | comments
  search: '',
  filterTag: null,
  accent: '#8ab4ff',
  density: 'cozy',
  shuffle: false,
  repeat: 'off' // off | all | one
};

let PREFS = null;
const state = {
  user: null,
  queue: [],
  qIndex: 0,
  pageSize: 30,
  page: 1
};

// Prefs & session
function loadPrefs(){
  if(PREFS) return PREFS;
  const raw = localStorage.getItem(PREF_KEY);
  if(!raw){ PREFS = safeClone(defaultPrefs); return PREFS; }
  try{
    PREFS = { ...defaultPrefs, ...JSON.parse(raw) };
  }catch{
    PREFS = safeClone(defaultPrefs);
  }
  applyAccent(PREFS.accent);
  applyDensity(PREFS.density);
  return PREFS;
}
function savePrefs(p){
  PREFS = { ...loadPrefs(), ...p };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(PREFS)); }catch{}
  if(p.accent) applyAccent(PREFS.accent);
  if(p.density) applyDensity(PREFS.density);
}

function getSession(){ try{ return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }catch{ return null; } }
function setSession(s){ localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }

async function currentUser() {
  const s = getSession();
  if (!s) return null;
  const db = DB.getAll();
  let user = db.users.find(u => u.id === s.userId);
  if (!user && DB.isRemote && DB.supabase && DB.supabase.auth && DB.supabase.auth.getUser) {
    try {
      const authUser = await DB.supabase.auth.getUser();
      const u = authUser?.data?.user;
      if (u) {
        user = { id: u.id, name: u.user_metadata?.name || u.email || 'user', email: u.email };
      }
    } catch {}
  }
  // fallback: if still not found, return a minimal user from session
  if (!user && s.userId) {
    user = { id: s.userId, name: 'user' };
  }
  return user;
}

function userName(id){
  const db = DB.getAll();
  const u = db.users.find(x=>x.id===id);
  return u ? u.name : 'anon';
}

// Root render
async function render() {
  state.user = await currentUser();
  const prefs = loadPrefs();
  applyAccent(prefs.accent);
  applyDensity(prefs.density);
  const root = $('#app');
  root.innerHTML = '';
  if (!state.user) return renderLogin(root);
  return renderMain(root);
}

// Login
function renderLogin(root) {
  const div = document.createElement('div');
  div.className = 'box login';
  div.innerHTML = `
    <div class="small muted">┌─ register or login to</div>
    <div class="logo">ascii.fm</div>
    <div class="small muted">└──────────────────────</div>
    <div class="sep"></div>
    <form id="registerForm" class="stack" autocomplete="off">
      <label>username
        <input required minlength="2" maxlength="24" id="regName" class="field" placeholder="e.g. moonbeam" />
      </label>
      <label>email
        <input required type="email" id="regEmail" class="field" placeholder="e.g. you@email.com" />
      </label>
      <label>password
        <input required minlength="6" maxlength="64" id="regPass" class="field" type="password" placeholder="password" />
      </label>
      <div class="hstack">
        <button class="btn" type="submit">[ register ]</button>
        <button class="btn btn-ghost" id="showLoginBtn" type="button">[ login ]</button>
        <button class="btn btn-ghost" id="demoBtn" type="button">[ add demo content ]</button>
      </div>
      <div class="muted small" id="regMsg">${DB.isRemote ? 'Synced with Supabase. ' : ''}Register to access content.</div>
    </form>
    <form id="loginForm" class="stack" autocomplete="off" style="display:none">
      <label>email
        <input required type="email" id="loginEmail" class="field" placeholder="your@email.com" />
      </label>
      <label>password
        <input required minlength="6" maxlength="64" id="loginPass" class="field" type="password" placeholder="password" />
      </label>
      <div class="hstack">
        <button class="btn" type="submit">[ login ]</button>
        <button class="btn btn-ghost" id="showRegBtn" type="button">[ register ]</button>
        <button class="btn btn-ghost" id="demoBtn2" type="button">[ add demo content ]</button>
      </div>
      <div class="muted small" id="loginMsg">${DB.isRemote ? 'Synced with Supabase. ' : ''}Login to access content.</div>
    </form>
  `;
  root.appendChild(div);

  // Toggle forms
  $('#showLoginBtn').onclick = () => {
    $('#registerForm').style.display = 'none';
    $('#loginForm').style.display = '';
  };
  $('#showRegBtn').onclick = () => {
    $('#registerForm').style.display = '';
    $('#loginForm').style.display = 'none';
  };

  // Register
  $('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#regName').value.trim();
    const email = $('#regEmail').value.trim();
    const pass = $('#regPass').value;
    if (!name || !email || !pass) return;
    $('#regMsg').textContent = 'Registering...';
    try {
      let u;
      if (DB.isRemote && DB.supabase) {
        // Supabase signup
        const { data, error } = await DB.supabase.auth.signUp({ email, password: pass, options: { data: { name } } });
        if (error) throw error;
        const userId = data.session?.user?.id || data.user?.id;
        u = { id: userId, name, email };
        await DB.ensureUser(name);
        setSession({ userId: u.id });
        await DB.refresh();
        render();
      } else {
        // Local: store user with email/pass (not secure, demo only)
        u = await DB.ensureUser(name, email, pass);
        setSession({ userId: u.id });
        await DB.refresh();
        render();
      }
    } catch (err) {
      $('#regMsg').textContent = 'Registration failed: ' + (err.message || err);
    }
  });

  // Login
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim();
    const pass = $('#loginPass').value;
    if (!email || !pass) return;
    $('#loginMsg').textContent = 'Logging in...';
    try {
      let u;
      if (DB.isRemote && DB.supabase) {
        // Supabase login
        const { data, error } = await DB.supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        const userId = data.session?.user?.id || data.user?.id;
        u = { id: userId, email };
        setSession({ userId: u.id });
        await DB.refresh();
        render();
      } else {
        // Local: check user/pass (not secure, demo only)
        u = await DB.loginUser(email, pass);
        if (!u) throw new Error('Invalid credentials');
        setSession({ userId: u.id });
        await DB.refresh();
        render();
      }
    } catch (err) {
      $('#loginMsg').textContent = 'Login failed: ' + (err.message || err);
    }
  });

  $('#demoBtn').addEventListener('click', seedDemo);
  $('#demoBtn2').addEventListener('click', seedDemo);
  $('#regName').focus();
}

// Main
async function renderMain(root){
  const db = DB.getAll();
  const me = state.user = currentUser();
  const prefs = loadPrefs();

  const top = document.createElement('div');
  top.className = 'topbar';
  top.innerHTML = `
    <div class="hstack toolbar">
      <span class="pill" title="current user">user: ${esc(me.name)}</span>
      ${prefs.filterTag ? `<span class="pill">tag: #${esc(prefs.filterTag)} <a href="#" data-action="clear-tag" title="clear tag">✕</a></span>` : ''}
      <span class="pill" title="total posts">posts: ${db.posts.length}</span>
      <span class="pill" title="keyboard shortcuts">keys: <span class="kbd">/</span> <span class="kbd">n</span> <span class="kbd">j</span>/<span class="kbd">k</span> <span class="kbd">?</span></span>
    </div>
    <div class="hstack toolbar">
      <input class="field" id="search" type="search" placeholder="search title/artist/tags..." style="width:240px" value="${esc(prefs.search)}" aria-label="search"/>
      <select class="field" id="sort" style="width:150px" aria-label="sort order">
        <option value="new" ${prefs.sort==='new'?'selected':''}>sort: newest</option>
        <option value="likes" ${prefs.sort==='likes'?'selected':''}>sort: most liked</option>
        <option value="comments" ${prefs.sort==='comments'?'selected':''}>sort: most commented</option>
      </select>
      <button class="btn icon" title="accent color" data-action="accent-pick">🎨</button>
      <button class="btn icon" title="density" data-action="toggle-density">${prefs.density==='compact'?'▥':'▤'}</button>
      <button class="btn btn-ghost" id="logoutBtn" title="logout">[ logout ]</button>
    </div>
  `;
  root.appendChild(top);

  const grid = document.createElement('div');
  grid.className = 'grid';

  const left = document.createElement('div');
  left.innerHTML = `
    <div class="box">
      <div class="hstack" style="justify-content:space-between">
        <div class="muted">feed</div>
        <div class="hstack">
          <button class="btn btn-ghost" data-action="play-all">[ play all ${prefs.filterTag?('#'+esc(prefs.filterTag)):(prefs.search?('(search)'):'(all)')} ]</button>
          <button class="btn btn-ghost" data-action="add-demo">[ quick demo ]</button>
          <button class="btn btn-ghost" data-action="show-help" title="keyboard shortcuts">[ help ]</button>
        </div>
      </div>
      <div id="feed"></div>
      <div id="pager" class="hstack" style="justify-content:center; margin-top:8px"></div>
    </div>
    <div class="dock" id="dock" style="display:none">
      <div class="hstack" style="justify-content:space-between; align-items:center">
        <div class="hstack">
          <button class="btn" data-action="q-prev" title="previous in queue (k)">[ prev ]</button>
          <button class="btn" data-action="q-next" title="next in queue (j)">[ next ]</button>
          <button class="btn" data-action="q-shuffle" aria-pressed="${prefs.shuffle}" title="shuffle">[ shuffle ]</button>
          <button class="btn" data-action="q-repeat" title="repeat">[ repeat: ${prefs.repeat} ]</button>
          <button class="btn btn-ghost" data-action="q-clear" title="clear queue">[ clear ]</button>
          <label class="small muted" title="auto-scroll to playing">
            <input type="checkbox" id="autoScroll" ${prefs.autoScroll?'checked':''}/> auto-scroll
          </label>
        </div>
        <div class="small">
          <span id="nowPlaying" class="muted"></span> · queue <span id="qPos">0</span>/<span id="qLen">0</span>${prefs.filterTag? ` · tag: #${esc(prefs.filterTag)}`:''}
        </div>
      </div>
    </div>
  `;
  grid.appendChild(left);

  const right = document.createElement('div');
  const storageText = await storageInfo();
  right.innerHTML = `
    <div class="box">
      <div class="muted small">compose</div>
      <form id="postForm" class="stack" autocomplete="off">
        <input class="field" id="f_title" placeholder="Title (song or album)" required maxlength="120" />
        <input class="field" id="f_artist" placeholder="Artist" maxlength="120"/>
        <input class="field" id="f_url" placeholder="Link (YouTube / Spotify / Bandcamp / SoundCloud / direct .mp3)" required/>
        <input class="field" id="f_tags" placeholder="tags (space/comma or #tag #chill #2020)"/>
        <textarea class="field" id="f_body" rows="4" placeholder="Why should we listen?"></textarea>
        <div class="hstack">
          <button class="btn" type="submit">[ post ]</button>
          <button class="btn btn-ghost" type="button" id="previewBtn">[ preview player ]</button>
        </div>
        <div id="preview" class="player" aria-live="polite"></div>
      </form>
    </div>
    <div class="box" id="tagsBox">
      <div class="hstack" style="justify-content:space-between; align-items:center">
        <div class="muted small">tags</div>
        ${prefs.filterTag ? `<button class="btn btn-ghost small" data-action="clear-tag">[ clear tag ]</button>`: ''}
      </div>
      <div id="tags" class="hstack" style="margin-top:6px; flex-wrap:wrap"></div>
    </div>
    <div class="box">
      <div class="muted small">data & settings</div>
      <div class="hstack" style="margin-top:6px; flex-wrap:wrap">
        <button class="btn" data-action="export">[ export json ]</button>
        <label class="btn btn-ghost">
          <input type="file" id="importFile" accept="application/json" class="sr-only" />
          <span>[ import (replace) ]</span>
        </label>
        <button class="btn btn-ghost" data-action="reset">[ reset all ]</button>
      </div>
      <div class="small muted" style="margin-top:8px">${storageText.text}</div>
      ${storageText.percent !== null ?
        `<div class="meter" style="margin-top:6px"><span style="width:${storageText.percent}%"></span></div>` : ''
      }
    </div>
    <div class="notice small">
      Tip: Works with YouTube (watch / youtu.be / shorts), Spotify (tracks/albums/playlists), Bandcamp (page or EmbeddedPlayer URL), SoundCloud, or direct audio files. ${DB.isRemote ? 'Data is synced with Supabase.' : 'Everything stays in LocalStorage.'}
    </div>
  `;
  grid.appendChild(right);

  root.appendChild(grid);

  // FEED
  state.page = 1;
  renderFeed($('#feed'), $('#pager'));
  renderTags($('#tags'));

  // Dock initial
  updateDock();

  // Events
  $('#logoutBtn').addEventListener('click', ()=>{ clearSession(); render(); });

  $('#search').addEventListener('input', debounce((e)=>{
    savePrefs({search: e.target.value});
    state.page = 1;
    renderFeed($('#feed'), $('#pager'));
  }, 120));

  $('#sort').addEventListener('change', (e)=>{
    savePrefs({sort: e.target.value});
    state.page = 1;
    renderFeed($('#feed'), $('#pager'));
  });

  right.querySelector('#previewBtn').addEventListener('click', ()=>{
    const url = $('#f_url').value.trim();
    const pv = parseProvider(url);
    const preview = $('#preview');
    if(!url){ preview.classList.remove('active'); preview.innerHTML=''; return; }
    preview.classList.add('active');
    const fakePost = { provider: pv, url };
    buildEmbed(fakePost, preview);
  });

  right.querySelector('#postForm').addEventListener('submit', onCreatePost);

  root.addEventListener('click', onActionClick);
  root.addEventListener('submit', onDelegatedSubmit);

  $('#importFile').addEventListener('change', onImport);

  document.addEventListener('keydown', onKey);

  const chk = $('#autoScroll'); if(chk){ chk.onchange = e => savePrefs({autoScroll: chk.checked}); }

  $('[data-close-help]')?.addEventListener('click', ()=> $('#help').classList.remove('active'));
  $('#help')?.addEventListener('click', (e)=>{ if(e.target.id==='help') $('#help').classList.remove('active'); });
}

// Feed & tags
function renderTags(el){
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

function getFilteredPosts(){
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

function renderFeed(el, pager){
  const posts = getFilteredPosts();
  const total = posts.length;
  const start = 0;
  const end = Math.min(state.page*state.pageSize, total);
  const chunk = posts.slice(start, end);

  if(total===0){
    el.innerHTML = `<div class="notice small">No posts yet. Add one on the right, or hit "quick demo" to seed examples.</div>`;
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

function renderPostHTML(p){
  const db = DB.getAll();
  const user = db.users.find(u=>u.id===p.userId);
  const me = state.user;
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

function renderCommentHTML(c){
  return `<div class="comment small"> <span class="muted">${fmtTime(c.createdAt)}</span> <b>${esc(userName(c.userId))}</b>: ${esc(c.text)} </div>`;
}

// Post creation
async function onCreatePost(e){
  e.preventDefault();
  const db = DB.getAll();
  const me = state.user;
  const title = $('#f_title').value.trim();
  const artist = $('#f_artist').value.trim();
  const url = $('#f_url').value.trim();
  const body = $('#f_body').value.trim();
  let tags = ($('#f_tags').value || '').trim();
  if(!title || !url){ return; }
  const provider = parseProvider(url);
  tags = tags
    .split(/[#,\s]+/g)
    .map(t=>t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0,12);

  const dup = db.posts.find(p =>
    p.url.trim() === url ||
    (p.provider && provider && p.provider.provider === provider.provider && p.provider.id === provider.id && p.provider.kind === provider.kind)
  );
  if(dup){
    if(!confirm('This link looks like a duplicate. Add anyway?')) {
      setTimeout(()=>{
        const el = document.getElementById('post-'+dup.id);
        if(el){
          el.classList.add('highlight');
          el.scrollIntoView({block:'start'});
          setTimeout(()=>el.classList.remove('highlight'), 1500);
        }
      }, 10);
      return;
    }
  }

  const post = {
    id: uid('p'),
    userId: me.id,
    title, artist, url,
    provider,
    tags,
    body,
    likes: [],
    comments: [],
    createdAt: Date.now()
  };
  await DB.createPost(post);

  $('#f_title').value='';
  $('#f_artist').value='';
  $('#f_url').value='';
  $('#f_tags').value='';
  $('#f_body').value='';
  const preview = $('#preview'); preview.classList.remove('active'); preview.innerHTML='';

  render();
  setTimeout(()=>{
    const el = document.getElementById('post-'+post.id);
    if(el){
      el.classList.add('highlight');
      el.scrollIntoView({block:'start'});
      setTimeout(()=>el.classList.remove('highlight'), 1500);
    }
  }, 10);
}

// Delegated actions
async function onActionClick(e){
  const btn = e.target.closest('[data-action]');
  if(!btn) return;
  const action = btn.dataset.action;
  const root = $('#app');

  const card = e.target.closest('.post');
  const postId = card ? card.dataset.post : null;

  if(action==='toggle-player' && postId){
    const pl = document.getElementById('player-'+postId);
    const active = pl.classList.contains('active');
    if(active){
      pl.classList.remove('active');
      // cleanup existing embeds
      try { pl._cleanup && pl._cleanup(); } catch {}
      pl.innerHTML='';
      card.classList.remove('is-playing');
    }else{
      pl.classList.add('active');
      const db = DB.getAll();
      const p = db.posts.find(x=>x.id===postId);
      buildEmbed(p, pl, { autoplay:true, onEnded: ()=> queueNext(true) });
      markNowPlaying(postId);
      if(loadPrefs().autoScroll){
        card.scrollIntoView({block:'center'});
      }
    }
  }

  if(action==='like' && postId){
    const updated = await DB.toggleLike(postId, state.user.id);
    if(updated && card) card.outerHTML = renderPostHTML(updated);
  }

  if(action==='comment' && postId){
    const cbox = document.getElementById('cbox-'+postId);
    cbox.classList.toggle('active');
    if(cbox.classList.contains('active')){
      const inp = cbox.querySelector('input.field'); inp.focus();
    }
  }

  if(action==='share'){
    const perma = btn.dataset.perma || (location.pathname+'#post-'+postId);
    const db = DB.getAll();
    const p = postId ? db.posts.find(x=>x.id===postId) : null;
    const title = p ? `${p.title}${p.artist? ' — '+p.artist:''}` : 'ascii.fm';
    if(navigator.share){
      navigator.share({ title, url: perma }).catch(()=> copyText(perma));
    }else{
      copyText(perma)
        .then(()=> toast(card||root, 'permalink copied to clipboard'))
        .catch(()=> toast(card||root, 'copy failed', true));
    }
  }

  if(action==='queue' && postId){
    if(!state.queue.includes(postId)) state.queue.push(postId);
    updateDock(true);
    toast(card, 'added to queue');
  }

  if(action==='filter-tag'){
    const t = btn.dataset.tag;
    savePrefs({ filterTag: t, search: '' });
    state.page = 1;
    renderFeed($('#feed'), $('#pager'));
    renderTags($('#tags'));
  }

  if(action==='clear-tag'){
    savePrefs({filterTag: null});
    state.page = 1;
    renderFeed($('#feed'), $('#pager'));
    renderTags($('#tags'));
  }

  if(action==='q-prev'){ queuePrev(); }
  if(action==='q-next'){ queueNext(false); }
  if(action==='q-clear'){ state.queue=[]; state.qIndex=0; updateDock(); }
  if(action==='q-shuffle'){ savePrefs({shuffle: !loadPrefs().shuffle}); updateDock(); }
  if(action==='q-repeat'){
    const order = ['off','all','one'];
    const cur = loadPrefs().repeat;
    const next = order[(order.indexOf(cur)+1)%order.length];
    savePrefs({repeat: next});
    updateDock();
  }

  if(action==='play-all'){
    const ids = getFilteredPosts().map(p=>p.id);
    state.queue = ids;
    state.qIndex = 0;
    updateDock(true);
    jumpToQueueItem(0);
  }

  if(action==='add-demo'){ seedDemo(); }

  if(action==='edit' && postId){ openEditInline(postId); }

  if(action==='delete' && postId){
    const db = DB.getAll();
    const p = db.posts.find(x=>x.id===postId);
    if(!p) return;
    if(p.userId !== state.user.id){
      toast(card, 'you can only delete your posts', true); return;
    }
    if(confirm('Delete this post? This cannot be undone.')){
      await DB.deletePost(postId);
      state.queue = state.queue.filter(id=> id!==postId);
      renderFeed($('#feed'), $('#pager'));
      updateDock();
    }
  }

  if(action==='export'){
    const blob = new Blob([DB.exportJSON()], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ascii.fm-export-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }

  if(action==='reset'){
    if(DB.isRemote){
      alert('Reset all is only for local mode. For Supabase, use Import to replace remote data.');
      return;
    }
    if(confirm('Reset all ascii.fm data (posts, users, prefs)? This cannot be undone.')){
      localStorage.removeItem('ascii.fm/db@v2');
      localStorage.removeItem('ascii.fm/v1');
      localStorage.removeItem(PREF_KEY);
      localStorage.removeItem(SESSION_KEY);
      PREFS = null;
      state.queue = [];
      state.qIndex = 0;
      await DB.init();
      render();
    }
  }

  if(action==='accent-pick'){ pickAccent(); }
  if(action==='toggle-density'){
    const cur = loadPrefs().density;
    const next = cur === 'cozy' ? 'compact' : 'cozy';
    savePrefs({density: next});
    render();
  }
  if(action==='load-more'){
    state.page++;
    renderFeed($('#feed'), $('#pager'));
  }
  if(action==='show-help'){
    $('#help').classList.add('active');
  }
}

async function onDelegatedSubmit(e){
  const form = e.target.closest('form[data-action="comment-form"], form[data-action="edit-form"]');
  if(!form) return;
  e.preventDefault();
  const pid = form.dataset.post;

  if(form.dataset.action === 'comment-form'){
    const input = form.querySelector('input');
    const text = input.value.trim();
    if(!text) return;
    const c = { id: uid('c'), userId: state.user.id, text, createdAt: Date.now() };
    await DB.addComment(pid, c);
    input.value = '';
    const p = DB.getAll().posts.find(x=>x.id===pid);
    const cwrap = document.getElementById('comments-'+pid);
    cwrap.innerHTML = (p.comments||[]).map(x=>renderCommentHTML(x)).join('');
    liveSay('comment added');
    return;
  }

  if(form.dataset.action === 'edit-form'){
    const title = form.querySelector('[name=title]').value.trim();
    const artist = form.querySelector('[name=artist]').value.trim();
    const url = form.querySelector('[name=url]').value.trim();
    const body = form.querySelector('[name=body]').value.trim();
    const tagsRaw = form.querySelector('[name=tags]').value.trim();
    const tags = tagsRaw.split(/[#,\s]+/g).map(t=>t.trim().toLowerCase()).filter(Boolean).slice(0,12);
    const provider = parseProvider(url);
    const updated = await DB.updatePost(pid, { title, artist, url, body, tags, provider });
    const card = document.getElementById('post-'+pid);
    if(card && updated) card.outerHTML = renderPostHTML(updated);
    liveSay('post updated');
    return;
  }
}

function openEditInline(postId){
  const db = DB.getAll();
  const p = db.posts.find(x=>x.id===postId);
  if(!p) return;
  if(p.userId !== state.user.id){ toast($('#app'), 'you can only edit your posts', true); return; }
  const card = document.getElementById('post-'+postId);
  if(!card) return;
  const editBoxId = 'editbox-'+postId;
  const opened = card.querySelector('#'+editBoxId);
  if(opened){ opened.remove(); return; }
  const edit = document.createElement('div');
  edit.className = 'box';
  edit.id = editBoxId;
  edit.style.marginTop = '8px';
  edit.innerHTML = `
    <div class="muted small">edit post</div>
    <form class="stack" data-action="edit-form" data-post="${p.id}">
      <input class="field" name="title" value="${esc(p.title)}" required maxlength="120"/>
      <input class="field" name="artist" value="${esc(p.artist||'')}"/>
      <input class="field" name="url" value="${esc(p.url)}" required/>
      <input class="field" name="tags" value="${esc((p.tags||[]).join(' '))}" placeholder="#tag another"/>
      <textarea class="field" name="body" rows="4">${esc(p.body||'')}</textarea>
      <div class="hstack">
        <button class="btn" type="submit">[ save ]</button>
        <button class="btn btn-ghost" type="button" data-action="toggle-player">[ preview ]</button>
      </div>
    </form>
  `;
  card.appendChild(edit);
}

// Queue
function updateDock(showIfHidden=false){
  const dock = $('#dock');
  const len = state.queue.length;
  $('#qLen') && ($('#qLen').textContent = String(len));
  $('#qPos') && ($('#qPos').textContent = String(len ? (state.qIndex+1) : 0));
  const prefs = loadPrefs();
  const shuffleBtn = $('[data-action="q-shuffle"]');
  if(shuffleBtn){ shuffleBtn.setAttribute('aria-pressed', String(!!prefs.shuffle)); }
  const repeatBtn = $('[data-action="q-repeat"]');
  if(repeatBtn){ repeatBtn.textContent = `[ repeat: ${prefs.repeat} ]`; }
  if(len>0 || showIfHidden){
    dock.style.display = 'block';
    const id = getActiveQueueId();
    if(id){
      const db = DB.getAll();
      const p = db.posts.find(x=>x.id===id);
      if(p){
        $('#nowPlaying').textContent = `now: ${p.title}${p.artist?' — '+p.artist:''}`;
      }else{
        $('#nowPlaying').textContent = '';
      }
    }else{
      $('#nowPlaying').textContent = '';
    }
  }else{
    dock.style.display = 'none';
  }
  const chk = $('#autoScroll');
  if(chk){ chk.onchange = e => savePrefs({autoScroll: chk.checked}); }
}
function getActiveQueueId(){ return state.queue[state.qIndex] || null; }
function queuePrev(){
  if(state.queue.length===0) return;
  const prefs = loadPrefs();
  if(prefs.repeat==='one'){
    // stay on same
  } else if(state.qIndex===0){
    if(prefs.repeat==='all') state.qIndex = state.queue.length-1;
    else state.qIndex = 0;
  } else {
    state.qIndex = Math.max(0, state.qIndex-1);
  }
  updateDock();
  jumpToQueueItem(state.qIndex);
}
function queueNext(auto=false){
  if(state.queue.length===0) return;
  const prefs = loadPrefs();
  if(prefs.repeat==='one'){
    // stay on same
  } else if(prefs.shuffle && state.queue.length>1){
    let n;
    do { n = Math.floor(Math.random()*state.queue.length); } while(n===state.qIndex);
    state.qIndex = n;
  } else if(state.qIndex >= state.queue.length-1){
    if(prefs.repeat==='all') state.qIndex = 0;
    else if(auto) return;
    else state.qIndex = state.queue.length-1;
  } else {
    state.qIndex++;
  }
  updateDock();
  jumpToQueueItem(state.qIndex);
}
function jumpToQueueItem(idx){
  const id = state.queue[idx];
  if(!id) return;
  const card = document.getElementById('post-'+id);
  if(!card) return;
  const pl = document.getElementById('player-'+id);
  if(!pl.classList.contains('active')){
    const btn = card.querySelector('[data-action="toggle-player"]');
    if(btn) btn.click();
  }
  document.querySelectorAll('.post').forEach(p=>p.classList.remove('is-playing'));
  card.classList.add('is-playing');
  if(loadPrefs().autoScroll) card.scrollIntoView({block:'center'});
}
function markNowPlaying(postId){
  document.querySelectorAll('.post').forEach(p=>p.classList.remove('is-playing'));
  const card = document.getElementById('post-'+postId);
  if(card) card.classList.add('is-playing');
  updateDock();
}

// Import
async function onImport(e){
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    if(!data || !Array.isArray(data.posts) || !Array.isArray(data.users)){
      alert('Invalid export file.'); return;
    }
    await DB.replaceAll({ ...data, version: 2 });
    toast($('#app'), DB.isRemote ? 'imported to Supabase' : 'imported');
    state.queue = [];
    state.qIndex = 0;
    await DB.refresh();
    render();
  }catch(err){
    console.error(err);
    alert('Import failed.');
  }finally{
    e.target.value = '';
  }
}

// Seed demo
async function seedDemo(){
  const me = state.user || await DB.ensureUser('demo');
  if(!state.user) { setSession({userId: me.id}); state.user = me; }

  const samples = [
    {
      title:'Selected Ambient Works 85 - 92', artist:'Aphex Twin',
      url:'https://www.youtube.com/watch?v=Xw5AiRVqfqk',
      tags:['idm','electronic','techno'], body:'Richard D James early work. A must hear.',
    },
    {
      title:'Šlamantys', artist:'Mesijus',
      url:'https://open.spotify.com/track/64rMCuIiJVT49SjLhmrHdW',
      tags:['hiphop','rap','lithuanian'], body:'Lithuanian version of MF Doom.'
    },
    {
      title:'Pints of Guiness Make You Strong', artist:'Against Me!',
      url:'https://againstme.bandcamp.com/track/pints-of-guiness-make-you-strong',
      tags:['punk','folk'], body:'The punk classic!'
    },
    {
      title:'Kaleo - All the Pretty Girls (Live on KEXP)',
      artist:'Kaleo',
      url:'https://www.youtube.com/watch?v=xy_fxxj1mMY',
      tags:['jazz','bebop'],
      body:'One of the greatest jazz albums of all time.'
    },
    {
      title:'Mania',
      artist:'ChildsMind',
      url:'https://soundcloud.com/childsmindmusic/mania',
      tags:['electronic','techno'], body:'Some fun techno from Soundcloud.'
    }
  ];

  // Clear all posts, keep users
  if(DB.isRemote && DB.replaceAll){
    // For Supabase, replaceAll clears all posts and users, so preserve users
    const users = DB.getAll().users;
    await DB.replaceAll({ users, posts: [] });
  } else if(DB.getAll && DB.getAll().posts) {
    // For local, clear posts array
    DB.getAll().posts.length = 0;
    await DB.refresh();
  }

  let firstId = null;
  for(const [i, s] of samples.entries()){
    const provider = parseProvider(s.url);
    const post = {
      id: uid('p'),
      userId: me.id,
      title: s.title, artist: s.artist, url: s.url,
      provider, tags: s.tags, body: s.body,
      likes:[], comments:[], createdAt: Date.now()
    };
    if(i === 0) firstId = post.id;
    await DB.createPost(post);
  }
  await DB.refresh();
  render();
  // Auto-play the first demo post for feedback
  setTimeout(() => {
    const btn = document.querySelector(`#post-${firstId} [data-action="toggle-player"]`);
    if(btn) btn.click();
  }, 600);
}

// Helpers
function pickAccent(){
  const colors = ['#8ab4ff','#ff79c6','#7ab6ff','#7bd389','#ffd166','#ff6b6b','#c792ea','#64d2ff','#f4a261','#00e5ff'];
  const palette = document.createElement('div');
  palette.className = 'box';
  palette.style.position='fixed';
  palette.style.right='16px';
  palette.style.top='16px';
  palette.style.zIndex='9999';
  palette.innerHTML = `
    <div class="small muted">choose accent</div>
    <div class="hstack" style="margin-top:6px; flex-wrap:wrap">
      ${colors.map(c=>`<button class="btn" data-color="${c}" style="background:${c}20;border-color:${c}80;color:${c}">●</button>`).join('')}
      <button class="btn btn-ghost" data-close="1">[ close ]</button>
    </div>
  `;
  document.body.appendChild(palette);
  palette.addEventListener('click', (e)=>{
    const b = e.target.closest('button');
    if(!b) return;
    if(b.dataset.close){ palette.remove(); return; }
    const c = b.dataset.color;
    savePrefs({accent:c});
    applyAccent(c);
  });
}

async function storageInfo(){
  if(DB.isRemote){
    return { text: 'Data synced with Supabase. Preferences and session are saved locally.', percent: null };
  }
  try{
    if(navigator.storage && navigator.storage.estimate){
      const est = await navigator.storage.estimate();
      const used = est.usage || 0;
      const quota = est.quota || 0;
      const pct = quota ? Math.min(100, Math.round((used/quota)*100)) : null;
      return {
        text: `Storage approx: ${fmtBytes(used)}${quota ? ' of '+fmtBytes(quota) : ''} used · Local-only.`,
        percent: pct
      };
    }
  }catch{}
  const raw = (localStorage.getItem('ascii.fm/db@v2') || '') + (localStorage.getItem(PREF_KEY) || '');
  return { text: 'Storage approx: ' + approxSize(raw) + ' · Local-only.', percent: null };
}

// Keys
function onKey(e){
  const tag = e.target.tagName.toLowerCase();
  if(tag==='input' || tag==='textarea') return;

  const posts = $$('#app', '.post');
  const currentId = getActiveQueueId();
  const currentEl = currentId ? document.getElementById('post-'+currentId) : null;
  let focusCard = currentEl || posts[0];

  if(e.key === '/'){ e.preventDefault(); $('#search')?.focus(); return; }
  if(e.key.toLowerCase() === 'n'){ $('#f_title')?.focus(); return; }
  if(e.key.toLowerCase() === 'j'){ e.preventDefault(); queueNext(false); return; }
  if(e.key.toLowerCase() === 'k'){ e.preventDefault(); queuePrev(); return; }
  if(e.key === '?'){ $('#help').classList.toggle('active'); return; }
  if(e.key.toLowerCase() === 'l' && focusCard){
    const likeBtn = focusCard.querySelector('[data-action="like"]');
    likeBtn?.click(); return;
  }
  if(e.key.toLowerCase() === 'o' && focusCard){
    const playBtn = focusCard.querySelector('[data-action="toggle-player"]');
    playBtn?.click(); return;
  }
}

// Double click to like
document.addEventListener('dblclick', (e)=>{
  const card = e.target.closest('.post');
  if(!card) return;
  const likeBtn = card.querySelector('[data-action="like"]');
  likeBtn?.click();
});

// Cross-tab sync
window.addEventListener('storage', async (ev)=>{
  if(ev.key === PREF_KEY || ev.key === SESSION_KEY){
    await DB.refresh();
    render();
  }
});

async function boot() {
  await DB.init();
  await render();
}

boot();