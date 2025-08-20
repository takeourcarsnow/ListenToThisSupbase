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
  const filteredPosts = getFilteredPosts(DB, prefs);
  const postCount = (prefs.filterTag || prefs.search) ? filteredPosts.length : db.posts.length;
    top.innerHTML = `
      <div class="hstack toolbar">
        <span class="pill" title="current user">user: ${me ? `<a href="#" data-action="view-user" data-uid="${esc(me.id)}">${esc(me.name)}</a>` : 'guest'}</span>
        <span class="pill" title="total posts">posts: ${postCount}</span>
        ${prefs.filterTag ? `<span class="pill">tag: #${esc(prefs.filterTag)} <a href=\"#\" data-action=\"clear-tag\" title=\"clear tag\">✕</a></span>` : ''}
      </div>
      <div class="hstack toolbar">
        <input class="field" id="search" type="search" placeholder="search title/artist/tags..." style="width:240px" value="${esc(prefs.search)}" aria-label="search"/>
        <select class="field" id="sort" style="width:150px" aria-label="sort order">
          <option value="new" ${prefs.sort==='new'?'selected':''}>sort: newest</option>
          <option value="likes" ${prefs.sort==='likes'?'selected':''}>sort: most liked</option>
          <option value="comments" ${prefs.sort==='comments'?'selected':''}>sort: most commented</option>
        </select>
        <button class="btn icon" title="accent color" data-action="accent-pick">🎨</button>
        ${me
          ? `<button class="btn btn-ghost" data-action="logout" title="logout">[ logout ]</button><button class="btn btn-ghost" data-action="show-help" title="keyboard shortcuts">[ help ]</button>`
          : `<button class="btn btn-ghost" id="goLoginBtn" title="login / register">[ login / register ]</button><button class="btn btn-ghost" data-action="show-help" title="keyboard shortcuts">[ help ]</button>`
        }
      </div>
    `;
  root.appendChild(top);

  const grid = document.createElement('div');
  grid.className = 'grid';

  const left = document.createElement('div');
  let playAllLabel = 'play all';
  if (prefs.filterTag) playAllLabel = `play #${esc(prefs.filterTag)}`;
  left.innerHTML = `
    <div class="box">
      <div class="hstack" style="justify-content:space-between">
        <div class="muted">> feed</div>
        <div class="hstack">
          <button class="btn btn-ghost" data-action="play-all">[ ${playAllLabel} ]</button>
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

  if (me) {
    const meUser = db.users.find(u => u.id === me.id) || null;
    const myAbout = meUser?.about || '';
    const myAvatar = meUser?.avatarUrl || '/favicon-32x32.png';
    right.innerHTML = `
      <div class="box" id="aboutBox">
        <div class="muted small">my profile</div>
        <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:8px;">
          <img class="profile-avatar" src="${esc(myAvatar)}" alt="avatar" />
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
        <div class="muted small">compose</div>
        <form id="postForm" class="stack" autocomplete="off">
          <input class="field" id="f_title" placeholder="Title (song or album)" required maxlength="120" />
          <input class="field" id="f_artist" placeholder="Artist" maxlength="120"/>
          <input class="field" id="f_url" placeholder="Link (YouTube / Spotify / Bandcamp / SoundCloud / direct .mp3)" required/>
          <input class="field" id="f_tags" placeholder="tags (space/comma or #tag #chill #2020)"/>
          <div id="tagSuggestions" class="hstack" style="flex-wrap:wrap; gap:4px; margin:4px 0 0 0;"></div>
          <textarea class="field" id="f_body" rows="4" placeholder="Why should we listen? (up to 200 characters)" maxlength="200" oninput="document.getElementById('bodyCounter').textContent = this.value.length + '/200';"></textarea>
          <div class="muted small" style="text-align:right"><span id="bodyCounter">0/200</span></div>
          <div class="muted small" id="captchaBox" style="margin:8px 0;"></div>
          <input class="field" id="f_captcha" placeholder="Enter captcha answer" autocomplete="off" />
          <div id="postFormError" class="muted small" style="color:#c00;min-height:18px;"></div>
          <div class="hstack">
            <button class="btn" type="submit">[ post ]</button>
            <button class="btn btn-ghost" type="button" id="previewBtn">[ preview ]</button>
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
    `;
  } else {
    right.innerHTML = `
      <div class="box">
        <div class="muted small">> compose</div>
        <div class="notice small">You are in guest read-only mode. Login to post, like, or comment.</div>
        <button class="btn btn-ghost" data-action="go-login">[ login / register ]</button>
      </div>
      <div class="box" id="tagsBox">
        <div class="hstack" style="justify-content:space-between; align-items:center">
          <div class="muted small">> tags</div>
          ${prefs.filterTag ? `<button class="btn btn-ghost small" data-action="clear-tag">[ clear tag ]</button>`: ''}
        </div>
        <div id="tags" class="hstack" style="margin-top:6px; flex-wrap:wrap"></div>
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

  $('#sort').addEventListener('change', (e) => {
    savePrefs({ sort: e.target.value });
    state.page = 1;
    renderFeed($('#feed'), $('#pager'), state, DB, loadPrefs());
  });

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