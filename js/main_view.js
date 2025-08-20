// --- Compose prompt rotation ---
function getComposePrompt() {
  const prompts = [
    '> so what song has been stuck in your head lately?',
    '> share a track that made your day better!',
    '> what have you been looping non-stop?',
    '> found a hidden gem? drop it here!',
    '> what tune do you want everyone to hear right now?'
  ];
  // Use a random prompt each refresh
  return prompts[Math.floor(Math.random() * prompts.length)];
}
import { $, debounce, esc } from './utils.js';
import { loadPrefs, savePrefs } from './prefs.js';
import { renderFeed, renderTags, getFilteredPosts } from './feed.js';
import { onCreatePost } from './posts.js';
import { updateDock } from './queue.js';
import { onImport } from './import_export.js';
import { parseProvider, buildEmbed } from './providers.js';

export async function renderMain(root, state, DB, render) {
  const db = DB.getAll();
  const me = state.user;
  const prefs = loadPrefs();

  // Show header
  const banner = document.getElementById('ascii-banner');
  if (banner) banner.style.display = '';
  document.body.classList.add('show-header');

  const top = document.createElement('div');
  top.className = 'topbar';
  // User filter support
  let userFilterId = window.filterPostsByUserId || null;
  let filteredPosts = getFilteredPosts(DB, prefs);
  // Only for post count display; actual filtering is handled in renderFeed
  if (userFilterId) {
    filteredPosts = filteredPosts.filter(p => p.userId === userFilterId);
  }
  const postCount = (prefs.filterTag || prefs.search || userFilterId) ? filteredPosts.length : db.posts.length;
    top.innerHTML = `
      <div class="hstack toolbar">
        <span class="pill" title="current user">user: ${me ? `<a href="#" data-action="view-user" data-uid="${esc(me.id)}">${esc(me.name)}</a>` : 'guest'}</span>
        <span class="pill" title="total posts">posts: ${postCount}</span>
  ${prefs.filterTag ? `<span class="pill">tag: #${esc(prefs.filterTag)} <a href=\"#\" data-action=\"clear-tag\" title=\"clear tag\">✕</a></span>` : ''}
  ${userFilterId ? `<span class="pill">user filter: <a href="#" data-action="clear-user-filter">${esc(db.users.find(u => u.id === userFilterId)?.name || 'user')}</a> <a href="#" data-action="clear-user-filter" title="clear user filter">✕</a></span>` : ''}
      </div>
      <div class="hstack toolbar">
        <input class="field" id="search" type="search" placeholder="search title/artist/tags..." style="width:240px" value="${esc(prefs.search)}" aria-label="search"/>
        <div class="sort-icons" id="sort-icons" aria-label="sort order">
          <button class="sort-btn${prefs.sort==='new' ? ' active' : ''}" data-sort="new" title="Sort by newest">
            <span class="icon-sort-newest"></span>
          </button>
          <button class="sort-btn${prefs.sort==='likes' ? ' active' : ''}" data-sort="likes" title="Sort by most liked">
            <span class="icon-sort-likes"></span>
          </button>
          <button class="sort-btn${prefs.sort==='comments' ? ' active' : ''}" data-sort="comments" title="Sort by most commented">
            <span class="icon-sort-comments"></span>
          </button>
        </div>
        ${me
          ? `<button class="btn btn-ghost" data-action="logout" title="logout">[ logout ]</button><button class="btn btn-ghost" data-action="show-help" title="keyboard shortcuts">[ help ]</button>`
          : `<button class="btn btn-ghost" id="goLoginBtn" title="login / register">[ login / register ]</button><button class="btn btn-ghost" data-action="show-help" title="keyboard shortcuts">[ help ]</button>`
        }
      </div>
    `;
  root.appendChild(top);
  // --- Player controls dock at top ---
  const dock = document.createElement('div');
  dock.className = 'dock';
  dock.id = 'dock';
  dock.style.display = 'none';
  dock.innerHTML = `
    <div class="hstack" style="justify-content:center; align-items:center; flex-wrap:wrap; gap:18px;">
      <div class="hstack" style="gap:18px;">
        <button class="btn" data-action="q-prev" title="previous in queue (k)">[ prev ]</button>
        <button class="btn" data-action="q-stop" title="stop">[ stop ]</button>
        <button class="btn" data-action="q-next" title="next in queue (j)">[ next ]</button>
        <button class="btn" data-action="q-shuffle" aria-pressed="${prefs.shuffle}" title="shuffle">[ shuffle ]</button>
        <button class="btn btn-ghost" data-action="q-clear" title="clear queue">[ clear ]</button>
      </div>
    </div>
    <div class="small" style="text-align:center; margin-top:6px;">
      <span id="nowPlaying" class="muted"></span> · queue <span id="qPos">0</span>/<span id="qLen">0</span>${prefs.filterTag? ` · tag: #${esc(prefs.filterTag)}`:''}
    </div>
  `;
  // Add stop button logic to close the active player/post
  dock.addEventListener('click', (e) => {
    const stopBtn = e.target.closest('[data-action="q-stop"]');
    if (stopBtn) {
      // Find and close the active player
      const activePlayer = document.querySelector('.player.active');
      if (activePlayer) {
        // Pause any audio or video elements inside the player
        activePlayer.querySelectorAll('audio,video').forEach(el => {
          el.pause && el.pause();
          el.currentTime = 0;
        });
        // Remove src from iframes to fully stop embeds (YouTube, SoundCloud, Bandcamp, Spotify)
        activePlayer.querySelectorAll('iframe').forEach(ifr => {
          ifr.src = '';
        });
        activePlayer.classList.remove('active');
        // Optionally, also remove is-playing from post
        const playingPost = document.querySelector('.post.is-playing');
        if (playingPost) playingPost.classList.remove('is-playing');
      }
    }
  });
  root.appendChild(dock);
  // Listen for user filter events
  if (!window._userFilterHandlerAttached) {
    window.addEventListener('filter-user-posts', (e) => {
      window.filterPostsByUserId = e.detail.userId;
      render();
    });
    window._userFilterHandlerAttached = true;
  }

  // Clear user filter
  top.addEventListener('click', (e) => {
    if (e.target && e.target.dataset && e.target.dataset.action === 'clear-user-filter') {
      window.filterPostsByUserId = null;
      render();
      e.preventDefault();
    }
  });

  const grid = document.createElement('div');
  grid.className = 'grid';

  const left = document.createElement('div');
  let playAllLabel = 'play all';
  if (prefs.filterTag) playAllLabel = `play #${esc(prefs.filterTag)}`;
  // Tag cloud
  const tagsBox = document.createElement('div');
  tagsBox.className = 'box';
  tagsBox.id = 'tagsBoxMain';
  tagsBox.style.marginBottom = '16px';
  tagsBox.innerHTML = `
    <div class="hstack" style="justify-content:space-between; align-items:center">
      <div class="muted small">> tags</div>
      ${prefs.filterTag ? `<button class="btn btn-ghost small" data-action="clear-tag">[ clear tag ]</button>`: ''}
    </div>
    <div id="tags"></div>
  `;
  left.appendChild(tagsBox);
  // Dock (player controls)
  left.appendChild(dock);
  // Feed
  const feedBox = document.createElement('div');
  feedBox.className = 'box';
  feedBox.innerHTML = `
    <div class="hstack" style="justify-content:space-between">
      <div class="muted">> feed</div>
      <div class="hstack">
        <button class="btn btn-ghost" data-action="play-all">[ ${playAllLabel} ]</button>
      </div>
    </div>
    <div id="feed"></div>
    <div id="pager" class="hstack" style="justify-content:center; margin-top:8px"></div>
  `;
  left.appendChild(feedBox);
  grid.appendChild(left);

  const right = document.createElement('div');

  if (me) {
    const meUser = db.users.find(u => u.id === me.id) || null;
    const myAbout = meUser?.about || '';
    const myAvatar = meUser?.avatarUrl || '/favicon-32x32.png';
    right.innerHTML = `
      <div class="box" id="aboutBox">
        <div class="muted small">> my profile</div>
        <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:8px;">
          <img class="profile-avatar-small" src="${esc(myAvatar)}" alt="avatar" />
        </div>
        <div id="aboutCollapsed" style="display:flex; align-items:center; justify-content:space-between; min-height:38px;">
          <div id="aboutText" class="about-preview">${myAbout ? esc(myAbout).replace(/\n/g,'<br>') : '<span class=\'muted small\'>no about yet.</span>'}</div>
          <button class="btn btn-ghost small" id="editAboutBtn" type="button">[ edit ]</button>
        </div>
        <form class="stack" id="aboutEditForm" data-action="profile-form" autocomplete="off" style="display:none; margin-top:8px;" enctype="multipart/form-data">
          <label class="muted small" style="margin-bottom:4px;">Change avatar:</label>
          <input class="field" type="file" id="avatarFile" name="avatar" accept="image/*" style="margin-bottom:8px;" />
          <textarea class="field" id="aboutMe" name="about" rows="3" maxlength="500" placeholder="Write a short bio...">${esc(myAbout)}</textarea>
          <div class="hstack">
            <button class="btn" type="submit">[ save about ]</button>
            <button class="btn btn-ghost small" id="cancelAboutBtn" type="button">[ cancel ]</button>
            <span class="muted small" id="profileMsg"></span>
          </div>
        </form>
      </div>
      <div class="box">
  <div class="muted small" style="margin-bottom:18px;">${getComposePrompt()}</div>
        <form id="postForm" class="stack" autocomplete="off">
          <input class="field" id="f_title" placeholder="Title (song or album)" required maxlength="120" style="margin-top:8px;" />
          <input class="field" id="f_artist" placeholder="Artist" maxlength="120"/>
          <input class="field" id="f_url" placeholder="Link (YouTube / Spotify / Bandcamp / SoundCloud / direct .mp3)" required/>
          <input class="field" id="f_tags" placeholder="tags (space/comma or #tag #chill #2020)"/>
          <div id="tagSuggestions" class="hstack" style="flex-wrap:wrap; gap:4px; margin:4px 0 0 0;"></div>
          <textarea class="field" id="f_body" rows="4" placeholder="Why should we listen? (up to 200 characters)" maxlength="200" oninput="document.getElementById('bodyCounter').textContent = this.value.length + '/200';"></textarea>
          <div class="hstack" style="justify-content:space-between; align-items:center; margin-bottom:4px;">
            <div class="muted small" id="captchaBox" style="margin:0;"></div>
            <span class="muted small" id="bodyCounter">0/200</span>
          </div>
          <input class="field" id="f_captcha" placeholder="Enter captcha answer" autocomplete="off" style="margin-bottom:2px;" />
          <div id="postFormError" class="muted small" style="color:#c00;min-height:18px;"></div>
          <div class="hstack" style="justify-content:center; margin-top:1px; gap:10px;">
            <button class="btn" type="submit">[ post ]</button>
            <button class="btn btn-ghost" type="button" id="previewBtn">[ preview ]</button>
          </div>
          <div id="preview" class="player" aria-live="polite"></div>
        </form>
      </div>
    `;
  } else {
    right.innerHTML = `
      <div class="box">
  <div class="muted small">${getComposePrompt()}</div>
        <div class="notice small">You are in guest read-only mode. Login to post, like, or comment.</div>
        <button class="btn btn-ghost" data-action="go-login">[ login / register ]</button>
      </div>
    `;
  }

  grid.appendChild(right);
  root.appendChild(grid);

  // About edit UI
  if (me) {
    const aboutBox = right.querySelector('#aboutBox');
    const aboutCollapsed = aboutBox.querySelector('#aboutCollapsed');
    const aboutEditForm = aboutBox.querySelector('#aboutEditForm');
    const editBtn = aboutBox.querySelector('#editAboutBtn');
    const cancelBtn = aboutBox.querySelector('#cancelAboutBtn');
    editBtn.addEventListener('click', () => {
      aboutCollapsed.style.display = 'none';
      aboutEditForm.style.display = '';
      aboutEditForm.querySelector('#aboutMe').focus();
    });
    cancelBtn.addEventListener('click', () => {
      aboutEditForm.style.display = 'none';
      aboutCollapsed.style.display = 'flex';
    });
    aboutEditForm.addEventListener('submit', () => {
      setTimeout(() => {
        aboutEditForm.style.display = 'none';
        aboutCollapsed.style.display = 'flex';
      }, 100);
    });
  }

  // Feed & tags
  state.page = 1;
  renderFeed($('#feed'), $('#pager'), state, DB, prefs);
  renderTags($('#tags'), DB);

  // Dock
  updateDock(false, state, DB);

  // --- Auto-refresh feed, comments, and likes (preserve player) ---
  if (!window._autoFeedRefresh) {
    window._autoFeedRefresh = setInterval(async () => {
      if (typeof DB.refresh === 'function') {
        const activePlayer = document.querySelector('.player.active');
        if (!activePlayer) {
          // No player active, safe to re-render
          await DB.refresh();
          renderFeed($('#feed'), $('#pager'), state, DB, loadPrefs());
          renderTags($('#tags'), DB);
        } else {
          // Player is active, update only likes/comments and append new posts
          await DB.refresh();
          const feedEl = $('#feed');
          const pagerEl = $('#pager');
          const prefs = loadPrefs();
          const db = DB.getAll();
          const posts = getFilteredPosts(DB, prefs);
          // Update likes/comments for visible posts
          posts.forEach(p => {
            const postEl = document.getElementById('post-' + p.id);
            if (postEl) {
              // Update like count
              const likeBtn = postEl.querySelector('[data-action="like"]');
              if (likeBtn) {
                likeBtn.innerHTML = `[ ♥ ${p.likes ? p.likes.length : 0} ]`;
                likeBtn.setAttribute('aria-pressed', (p.likes || []).includes(state.user?.id) ? 'true' : 'false');
                if ((p.likes || []).includes(state.user?.id)) likeBtn.classList.add('like-on');
                else likeBtn.classList.remove('like-on');
              }
              // Update comments count
              const commentBtn = postEl.querySelector('[data-action="comment"]');
              if (commentBtn) commentBtn.innerHTML = `[ comments ${p.comments ? p.comments.length : 0} ]`;
            }
          });
          // Append new posts if any
          const existingIds = Array.from(feedEl.querySelectorAll('.post')).map(el => el.getAttribute('data-post'));
          const newPosts = posts.filter(p => !existingIds.includes(String(p.id)));
          if (newPosts.length > 0) {
            import('./feed.js').then(mod => {
              const html = newPosts.map(p => mod.renderPostHTML(p, state, DB)).join('');
              feedEl.insertAdjacentHTML('beforeend', html);
            });
          }
          // Update pager
          if (posts.length > existingIds.length) {
            pagerEl.innerHTML = `<button class="btn btn-ghost" data-action="load-more">[ load more (${existingIds.length}/${posts.length}) ]</button>`;
          } else {
            pagerEl.innerHTML = `<div class="small muted">${posts.length} loaded</div>`;
          }
          // Optionally update tags
          renderTags($('#tags'), DB);
        }
      }
    }, 30000); // 30 seconds
  }

  // --- Instant refresh on window/tab focus or visibility ---
  if (!window._feedVisibilityHandler) {
    const instantRefresh = async () => {
      if (typeof DB.refresh === 'function') {
        const activePlayer = document.querySelector('.player.active');
        if (!activePlayer) {
          await DB.refresh();
          renderFeed($('#feed'), $('#pager'), state, DB, loadPrefs());
          renderTags($('#tags'), DB);
        } else {
          await DB.refresh();
          const feedEl = $('#feed');
          const pagerEl = $('#pager');
          const prefs = loadPrefs();
          const db = DB.getAll();
          const posts = getFilteredPosts(DB, prefs);
          posts.forEach(p => {
            const postEl = document.getElementById('post-' + p.id);
            if (postEl) {
              const likeBtn = postEl.querySelector('[data-action="like"]');
              if (likeBtn) {
                likeBtn.innerHTML = `[ ♥ ${p.likes ? p.likes.length : 0} ]`;
                likeBtn.setAttribute('aria-pressed', (p.likes || []).includes(state.user?.id) ? 'true' : 'false');
                if ((p.likes || []).includes(state.user?.id)) likeBtn.classList.add('like-on');
                else likeBtn.classList.remove('like-on');
              }
              const commentBtn = postEl.querySelector('[data-action="comment"]');
              if (commentBtn) commentBtn.innerHTML = `[ comments ${p.comments ? p.comments.length : 0} ]`;
            }
          });
          const existingIds = Array.from(feedEl.querySelectorAll('.post')).map(el => el.getAttribute('data-post'));
          const newPosts = posts.filter(p => !existingIds.includes(String(p.id)));
          if (newPosts.length > 0) {
            import('./feed.js').then(mod => {
              const html = newPosts.map(p => mod.renderPostHTML(p, state, DB)).join('');
              feedEl.insertAdjacentHTML('beforeend', html);
            });
          }
          if (posts.length > existingIds.length) {
            pagerEl.innerHTML = `<button class=\"btn btn-ghost\" data-action=\"load-more\">[ load more (${existingIds.length}/${posts.length}) ]</button>`;
          } else {
            pagerEl.innerHTML = `<div class=\"small muted\">${posts.length} loaded</div>`;
          }
          renderTags($('#tags'), DB);
        }
      }
    };
    window.addEventListener('focus', instantRefresh);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') instantRefresh();
    });
    window._feedVisibilityHandler = true;
  }

  // Toolbar events
  // No direct handler for logoutBtn; handled by delegated click event

  // Delegated handler for all login/register buttons (top bar and sidebar)
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('#goLoginBtn, [data-action="go-login"]');
    if (btn) {
      e.preventDefault();
      state.forceLogin = true;
      render();
    }
  });

  $('#search').addEventListener('input', debounce((e) => {
    savePrefs({ search: e.target.value });
    state.page = 1;
    renderFeed($('#feed'), $('#pager'), state, DB, loadPrefs());
  }, 120));

  // Sort icon button handler
  const sortIcons = document.getElementById('sort-icons');
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

  // Full post preview logic
  const previewBtn = right.querySelector('#previewBtn');
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      const preview = $('#preview');
      const title = $('#f_title').value.trim();
      const artist = $('#f_artist').value.trim();
      const url = $('#f_url').value.trim();
      const tags = ($('#f_tags').value || '').split(/[#\s,]+/g).map(t => t.trim().toLowerCase()).filter(Boolean);
      const body = $('#f_body').value.trim();
      const pv = parseProvider(url);
      // Fake post object for preview
      const fakePost = {
        id: 'preview',
        userId: (state.user && state.user.id) || 'preview',
        title,
        artist,
        url,
        provider: pv,
        tags,
        body,
        likes: [],
        comments: [],
        createdAt: Date.now(),
      };
      // Use renderPostHTML for full post preview
      import('./feed.js').then(mod => {
        preview.classList.add('active');
        // Render post HTML and remove action buttons for preview
        let html = mod.renderPostHTML(fakePost, state, DB);
        // Remove all action buttons from preview (play, like, comment, queue, share, open src, edit, delete)
        html = html.replace(/<div class="actions[\s\S]*?<\/div>/, '');
        // Add a preview label at the top
        html = `<div class="muted small" style="margin-bottom:4px;">Preview Post</div>` + html;
        preview.innerHTML = html;
      });
    });
  }

  // Autofill metadata via oEmbed
  const f_url = right.querySelector('#f_url');
  if (f_url) {
    let lastMetaUrl = '';
    let lastAutofill = { title: '', artist: '' };
    const f_title = right.querySelector('#f_title');
    const f_artist = right.querySelector('#f_artist');
    let userEdited = { title: false, artist: false };
    f_title.addEventListener('input', () => { userEdited.title = true; });
    f_artist.addEventListener('input', () => { userEdited.artist = true; });
    f_url.addEventListener('input', async () => {
      const url = f_url.value.trim();
      if (!url || url === lastMetaUrl) return;
      lastMetaUrl = url;
      const { fetchOEmbed } = await import('./oembed.js');
      const meta = await fetchOEmbed(url);
      if (meta) {
        let ytArtist = '', ytTitle = '';
        if (/youtube\.com|youtu\.be/.test(url)) {
          const { parseYouTubeTitle } = await import('./yt_title_parse.js');
          const parsed = parseYouTubeTitle(meta);
          ytArtist = parsed.artist;
          ytTitle = parsed.title;
        }
        if ((ytTitle || meta.title) && (!userEdited.title || f_title.value === lastAutofill.title)) {
          f_title.value = ytTitle || meta.title;
          lastAutofill.title = f_title.value;
          userEdited.title = false;
        }
        if ((ytArtist || meta.author_name) && (!userEdited.artist || f_artist.value === lastAutofill.artist)) {
          f_artist.value = ytArtist || meta.author_name;
          lastAutofill.artist = f_artist.value;
          userEdited.artist = false;
        }
      }
    });
  }

  // Captcha logic
  function setCaptcha() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    right.querySelector('#captchaBox').textContent = `Captcha: What is ${a} + ${b}?`;
    right.querySelector('#captchaBox').dataset.answer = (a + b).toString();
    right.querySelector('#f_captcha').value = '';
  }
  setCaptcha();
  const postForm = right.querySelector('#postForm');
  if (postForm) {
    postForm.addEventListener('submit', (e) => onCreatePost(e, state, DB, render));
    // Reset captcha after post
    postForm.addEventListener('resetCaptcha', setCaptcha);
  }

  // Tag suggestions
  const f_tags = right.querySelector('#f_tags');
  const tagSuggestions = right.querySelector('#tagSuggestions');
  if (f_tags && tagSuggestions) {
    function getPopularTags() {
      const db = DB.getAll();
      const m = new Map();
      db.posts.forEach(p => (p.tags || []).forEach(t => m.set(t, (m.get(t) || 0) + 1)));
      return Array.from(m.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 20)
        .map(([t]) => t);
    }
    function renderTagSuggestions(filter = '') {
      const tags = getPopularTags();
      let filtered = tags;
      if (filter) {
        const q = filter.toLowerCase();
        filtered = tags.filter(t => t.toLowerCase().includes(q));
      }
      if (filtered.length === 0) {
        tagSuggestions.innerHTML = '';
        tagSuggestions.style.display = 'none';
        return;
      }
      tagSuggestions.innerHTML = filtered.map(t => `<span class="tag small tag-suggestion" style="cursor:pointer;">#${esc(t)}</span>`).join(' ');
      tagSuggestions.style.display = 'flex';
    }
    function maybeShowSuggestions() {
      const val = f_tags.value;
      if (document.activeElement === f_tags || val.length > 0) {
        const last = val.split(/[, ]/).pop().replace(/^#/, '');
        renderTagSuggestions(last);
      } else {
        tagSuggestions.style.display = 'none';
      }
    }
    f_tags.addEventListener('input', maybeShowSuggestions);
    f_tags.addEventListener('focus', maybeShowSuggestions);
    f_tags.addEventListener('blur', () => {
      setTimeout(() => { tagSuggestions.style.display = 'none'; }, 100);
    });
    tagSuggestions.addEventListener('mousedown', (e) => e.preventDefault());
    tagSuggestions.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-suggestion')) {
        let current = f_tags.value.trim();
        let tag = e.target.textContent.replace(/^#/, '');
        // Only add if not already present
        let tags = current.split(/[, ]+/).map(t => t.trim()).filter(Boolean);
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
        f_tags.value = tags.join(' ') + ' ';
        f_tags.dispatchEvent(new Event('input'));
        f_tags.focus();
      }
    });
    tagSuggestions.style.display = 'none';
  }

  const importFile = $('#importFile');
  if (importFile) importFile.addEventListener('change', (e) => onImport(e, DB, state, render));

  const chk = $('#autoScroll'); if (chk) { chk.onchange = e => savePrefs({ autoScroll: chk.checked }); }
}