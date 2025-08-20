import { parseProvider } from './providers.js';
import { uid, esc, toast } from './utils.js';

export async function onCreatePost(e, state, DB, render) {
  e.preventDefault();
  const db = DB.getAll();
  const me = state.user;
  if (!me) { toast(document.getElementById('app'), 'login to post', true); return; }

  const title = document.getElementById('f_title').value.trim();
  const artist = document.getElementById('f_artist').value.trim();
  let url = document.getElementById('f_url').value.trim();
  const body = document.getElementById('f_body').value.trim();
  let tags = (document.getElementById('f_tags').value || '').trim();
  const errorDiv = document.getElementById('postFormError');
  if (errorDiv) errorDiv.textContent = '';
  if (!title || !url) return;

  if (!tags) {
    if (errorDiv) errorDiv.textContent = 'Please enter at least one tag.';
    return;
  }
  if (!body) {
    if (errorDiv) errorDiv.textContent = 'Please enter a description (why should we listen?).';
    return;
  }

  // Strip YouTube query params
  if (/youtube\.com|youtu\.be/.test(url)) {
    const qm = url.indexOf('?');
    if (qm !== -1) url = url.slice(0, qm);
  }

  const provider = parseProvider(url);
  tags = tags.split(/[#,\s]+/g).map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 12);

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

export function openEditInline(postId, state, DB) {
  const db = DB.getAll();
  const p = db.posts.find(x => x.id === postId);
  if (!p) return;
  if (!state.user || p.userId !== state.user.id) { toast(document.getElementById('app'), 'you can only edit your posts', true); return; }
  const card = document.getElementById('post-' + postId);
  if (!card) return;
  const editBoxId = 'editbox-' + postId;
  const opened = card.querySelector('#' + editBoxId);
  if (opened) { opened.remove(); return; }
  const edit = document.createElement('div');
  edit.className = 'box';
  edit.id = editBoxId;
  edit.style.marginTop = '8px';
  edit.innerHTML = `
    <div class="muted small">edit post</div>
    <form class="stack" data-action="edit-form" data-post="${p.id}">
      <input class="field" name="title" value="${esc(p.title)}" required maxlength="120"/>
      <input class="field" name="artist" value="${esc(p.artist || '')}"/>
      <input class="field" name="url" value="${esc(p.url)}" required/>
      <input class="field" name="tags" value="${esc((p.tags || []).join(' '))}" placeholder="#tag another"/>
      <textarea class="field" name="body" rows="4">${esc(p.body || '')}</textarea>
      <div class="hstack">
        <button class="btn" type="submit">[ save ]</button>
        <button class="btn btn-ghost" type="button" data-action="toggle-player">[ preview ]</button>
      </div>
    </form>
  `;
  card.appendChild(edit);
}