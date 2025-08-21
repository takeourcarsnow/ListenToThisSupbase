// js/views/main_view_compose.js
import { PROMPTS } from '../core/constants.js';
import { $, esc } from '../core/utils.js';
import { onCreatePost } from '../features/posts.js';
import { parseProvider } from '../features/providers.js';

function getComposePrompt() {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}

export function renderComposeBox(right, state, DB, render) {
  const me = state.user;

  if (!me) {
    const guest = document.createElement('div');
    guest.className = 'box';
    guest.innerHTML = `
      <div class="muted small">${getComposePrompt()}</div>
      <div class="notice small">You are in guest read-only mode. Login to post, like, or comment.</div>
      <button class="btn btn-ghost" data-action="go-login">[ login / register ]</button>
    `;
    right.appendChild(guest);
    return;
  }

  const box = document.createElement('div');
  box.className = 'box';
  box.innerHTML = `
    <div class="muted small" style="margin-bottom:18px;">${getComposePrompt()}</div>
    <form id="postForm" class="stack" autocomplete="off">
      <input class="field" id="f_url" placeholder="Link (YouTube / Spotify / Bandcamp, etc)" required/>
  <div class="muted small" id="autofillMsg" style="margin-bottom:2px; display:none;">&#8593; Auto-fills artist & title.</div>
      <input class="field" id="f_artist" placeholder="Artist" maxlength="120" style="margin-top:8px;" />
      <input class="field" id="f_title" placeholder="Title (song or album)" required maxlength="120" />
      <input class="field" id="f_tags" placeholder="#Tags go here"/>
      <div id="tagSuggestions" class="hstack" style="flex-wrap:wrap; gap:4px; margin:4px 0 0 0;"></div>
      <textarea class="field" id="f_body" rows="4" placeholder="Share something about this track, a memory, or the vibe it gives you." maxlength="200" oninput="document.getElementById('bodyCounter').textContent = this.value.length + '/200';"></textarea>
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
  `;
  // Show autofill message only when user is interacting with the composer
  const autofillMsg = box.querySelector('#autofillMsg');
  const composerFields = [
    box.querySelector('#f_url'),
    box.querySelector('#f_title'),
    box.querySelector('#f_artist'),
    box.querySelector('#f_tags'),
    box.querySelector('#f_body')
  ];
  composerFields.forEach(field => {
    if (field) {
      field.addEventListener('focus', () => { autofillMsg.style.display = 'block'; });
      field.addEventListener('input', () => { autofillMsg.style.display = 'block'; });
      field.addEventListener('blur', () => {
        setTimeout(() => {
          if (!composerFields.some(f => f && document.activeElement === f)) {
            autofillMsg.style.display = 'none';
          }
        }, 50);
      });
    }
  });
  right.appendChild(box);

  // Full post preview
  const previewBtn = box.querySelector('#previewBtn');
  if (previewBtn) {
    previewBtn.addEventListener('click', async () => {
      const preview = $('#preview');
      const title = $('#f_title').value.trim();
      const artist = $('#f_artist').value.trim();
      const url = $('#f_url').value.trim();
      const tags = ($('#f_tags').value || '').split(/[#\s,]+/g).map(t => t.trim().toLowerCase()).filter(Boolean);
      const body = $('#f_body').value.trim();
      const pv = parseProvider(url);
      const fakePost = {
        id: 'preview',
        userId: (state.user && state.user.id) || 'preview',
        title, artist, url, provider: pv, tags, body,
        likes: [], comments: [], createdAt: Date.now(),
      };

      const mod = await import('../features/feed.js');
      preview.classList.add('active');
      let html = mod.renderPostHTML(fakePost, state, DB);
      html = html.replace(/<div class="actions[\s\S]*?<\/div>/, ''); // strip actions
      html = `<div class="muted small" style="margin-bottom:4px;">Preview Post</div>` + html;
      preview.innerHTML = html;
    });
  }

  // oEmbed autofill for title/artist
  const f_url = box.querySelector('#f_url');
  if (f_url) {
    let lastMetaUrl = '';
    let lastAutofill = { title: '', artist: '' };
    const f_title = box.querySelector('#f_title');
    const f_artist = box.querySelector('#f_artist');
    let userEdited = { title: false, artist: false };

    f_title.addEventListener('input', () => { userEdited.title = true; });
    f_artist.addEventListener('input', () => { userEdited.artist = true; });

    f_url.addEventListener('input', async () => {
      const url = f_url.value.trim();
      if (!url || url === lastMetaUrl) return;
      lastMetaUrl = url;

      const { fetchOEmbed } = await import('../features/oembed.js');
      const meta = await fetchOEmbed(url);
      if (meta) {
        let ytArtist = '', ytTitle = '';
        if (/youtube\.com|youtu\.be/.test(url)) {
          const { parseYouTubeTitle } = await import('../features/yt_title_parse.js');
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

  // Captcha
  function setCaptcha() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    box.querySelector('#captchaBox').textContent = `Captcha: What is ${a} + ${b}?`;
    box.querySelector('#captchaBox').dataset.answer = (a + b).toString();
    box.querySelector('#f_captcha').value = '';
  }
  setCaptcha();

  // Post submit + reset captcha
  const postForm = box.querySelector('#postForm');
  if (postForm) {
    postForm.addEventListener('submit', (e) => onCreatePost(e, state, DB, render));
    postForm.addEventListener('resetCaptcha', setCaptcha);
  }

  // Tag suggestions
  const f_tags = box.querySelector('#f_tags');
  const tagSuggestions = box.querySelector('#tagSuggestions');
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
      const filtered = filter ? tags.filter(t => t.toLowerCase().includes(filter.toLowerCase())) : tags;
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
    f_tags.addEventListener('blur', () => setTimeout(() => { tagSuggestions.style.display = 'none'; }, 100));
    tagSuggestions.addEventListener('mousedown', (e) => e.preventDefault());
    tagSuggestions.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-suggestion')) {
        let current = f_tags.value.trim();
        let tag = e.target.textContent.replace(/^#/, '');
        let tags = current.split(/[, ]+/).map(t => t.trim()).filter(Boolean);
        if (!tags.includes(tag)) tags.push(tag);
        f_tags.value = tags.join(' ') + ' ';
        f_tags.dispatchEvent(new Event('input'));
        f_tags.focus();
      }
    });
    tagSuggestions.style.display = 'none';
  }
}