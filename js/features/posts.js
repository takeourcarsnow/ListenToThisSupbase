import { parseProvider } from './providers.js';
import { uid, esc, toast } from '../core/utils.js';
import { checkPostModeration, containsBannedWords, looksLikeSpam } from './automod.js';

export async function onCreatePost(e, state, DB, render) {
  e.preventDefault();
  const db = DB.getAll();
  const me = state.user;
  if (!me) { toast(document.getElementById('app'), 'login to post', true); return; }

  // Restrict to 1 post per 24h
  const now = Date.now();
  const lastPost = db.posts
    .filter(p => p.userId === me.id)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (lastPost && now - lastPost.createdAt < 24 * 60 * 60 * 1000) {
    const timeLeft = 24 * 60 * 60 * 1000 - (now - lastPost.createdAt);
    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
    const errorDiv = document.getElementById('postFormError');
    if (errorDiv) errorDiv.textContent = `You can post again in ${hours}h ${minutes}m ${seconds}s.`;
    return;
  }


  const title = document.getElementById('f_title').value.trim();
  const artist = document.getElementById('f_artist').value.trim();
  let url = document.getElementById('f_url').value.trim();
  let body = document.getElementById('f_body').value.trim();
  if (body.length > 200) body = body.slice(0, 200);
  let tags = (document.getElementById('f_tags').value || '').trim();
  const errorDiv = document.getElementById('postFormError');
  if (errorDiv) errorDiv.textContent = '';
  // Captcha check
  const captchaBox = document.getElementById('captchaBox');
  const captchaInput = document.getElementById('f_captcha');
  if (captchaBox && captchaInput) {
    const answer = captchaBox.dataset.answer;
    if (captchaInput.value.trim() !== answer) {
      if (errorDiv) errorDiv.textContent = 'Captcha incorrect. Please try again.';
      captchaInput.value = '';
      // Reset captcha
      const evt = new Event('resetCaptcha');
      document.getElementById('postForm').dispatchEvent(evt);
      return;
    }
  }
  if (!title || !url) return;

  if (!tags) {
    if (errorDiv) errorDiv.textContent = 'Please enter at least one tag.';
    return;
  }
  if (!body) {
    if (errorDiv) errorDiv.textContent = "Don't be shy! Tell us what makes this track stand out.";
    return;
  }

  // Automoderation check (title, artist, body, tags)
  const tagsArr = tags.split(/[#,\s]+/g).map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 12);
  if (
    containsBannedWords(title) ||
    containsBannedWords(artist) ||
    containsBannedWords(body) ||
    tagsArr.some(containsBannedWords)
  ) {
    if (errorDiv) errorDiv.textContent = 'Your post contains banned words.';
    return;
  }
  if (
    looksLikeSpam(title) ||
    looksLikeSpam(artist) ||
    looksLikeSpam(body)
  ) {
    if (errorDiv) errorDiv.textContent = 'Your post looks like spam.';
    return;
  }

  // Do not strip YouTube query params; preserve full video URLs

  const provider = parseProvider(url);
  tags = tagsArr;

  const dup = db.posts.find(p =>
    p.url.trim() === url ||
    (p.provider && provider && p.provider.provider === provider.provider && p.provider.id === provider.id && p.provider.kind === provider.kind)
  );
  if (dup) {
    if (!confirm('This link looks like a duplicate. Add anyway?')) {
      setTimeout(() => {
        const el = document.getElementById('post-' + dup.id);
        if (el) {
          el.classList.add('highlight');
          el.scrollIntoView({ block: 'start' });
          setTimeout(() => el.classList.remove('highlight'), 1500);
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

  document.getElementById('f_title').value = '';
  document.getElementById('f_artist').value = '';
  document.getElementById('f_url').value = '';
  document.getElementById('f_tags').value = '';
  document.getElementById('f_body').value = '';
  if (errorDiv) errorDiv.textContent = '';
  const preview = document.getElementById('preview');
  preview.classList.remove('active'); preview.innerHTML = '';
  // Reset captcha after successful post
  const evt = new Event('resetCaptcha');
  document.getElementById('postForm').dispatchEvent(evt);

  render();
  setTimeout(() => {
    const el = document.getElementById('post-' + post.id);
    if (el) {
      el.classList.add('highlight');
      el.scrollIntoView({ block: 'start' });
      setTimeout(() => el.classList.remove('highlight'), 1500);
    }
  }, 10);
}

export function openEditInline(postId, state, DB, opts = {}) {
  window.editingPostId = postId;
  const db = DB.getAll();
  const p = db.posts.find(x => x.id === postId);
  if (!p) return;
  if (!state.user || p.userId !== state.user.id) { toast(document.getElementById('app'), 'you can only edit your posts', true); return; }
  const card = document.getElementById('post-' + postId);
  if (!card) return;
  const editBoxId = 'editbox-' + postId;
  const opened = card.querySelector('#' + editBoxId);
  if (opened) {
    // Already open, do nothing
    return;
  }
  const edit = document.createElement('div');
  edit.className = 'box' + (opts.noAnimation ? '' : ' fade-in');
  edit.id = editBoxId;
  edit.style.marginTop = '8px';
  edit.innerHTML = `
    <div class="muted small">edit post</div>
    <form class="stack" data-action="edit-form" data-post="${p.id}">
    <input class="field" name="title" value="${esc(p.title)}" required maxlength="120" placeholder="Title (song or album)"/>
    <input class="field" name="artist" value="${esc(p.artist || '')}" placeholder="Artist"/>
    <input class="field" name="url" value="${esc(p.url)}" required readonly placeholder="Link (YouTube / Spotify / Bandcamp, etc)"/>
    <input class="field" name="tags" value="${esc((p.tags || []).join(' '))}" placeholder="#Tags go here"/>
  <textarea class="field" name="body" rows="4" maxlength="200" oninput="this.nextElementSibling.textContent = this.value.length + '/200';" placeholder="Share something about this track, a memory, or the vibe it gives you.">${esc(p.body || '')}</textarea>
  <div class="muted small" style="text-align:right">${(p.body||'').length}/200</div>
      <div class="hstack">
        <button class="btn" type="submit">[ save ]</button>
        <button class="btn btn-ghost" type="button" data-action="toggle-player">[ preview ]</button>
      </div>
    </form>
  `;
  card.appendChild(edit);

  // Save draft on every input
  if (!window.editingPostDrafts) window.editingPostDrafts = {};
  const form = edit.querySelector('form[data-action="edit-form"]');
  if (form) {
    const saveDraft = () => {
      window.editingPostDrafts[postId] = {
        title: form.title?.value,
        artist: form.artist?.value,
        url: form.url?.value,
        tags: form.tags?.value,
        body: form.body?.value
      };
    };
    form.addEventListener('input', saveDraft);
    // Restore draft if present
    const draft = window.editingPostDrafts[postId];
    if (draft) {
      if (draft.title !== undefined) form.title.value = draft.title;
      if (draft.artist !== undefined) form.artist.value = draft.artist;
      if (draft.url !== undefined) form.url.value = draft.url;
      if (draft.tags !== undefined) form.tags.value = draft.tags;
      if (draft.body !== undefined) form.body.value = draft.body;
    }
  }

  // Attach to window for feed.js to call
  if (!window.openEditInline) window.openEditInline = openEditInline;
// Ensure editingPostId is cleared on save (form submit)
document.addEventListener('submit', function(e) {
  const form = e.target;
  if (form && form.matches('form[data-action="edit-form"]')) {
    const postId = form.getAttribute('data-post');
    if (window.editingPostId == postId) window.editingPostId = null;
  }
});
}