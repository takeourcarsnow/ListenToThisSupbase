import { $, esc, toast, liveSay, copyText, uid } from '../core/utils.js';
import { parseProvider, buildEmbed } from './providers.js';
import { loadPrefs, savePrefs, PREF_KEY, resetPrefsCache } from '../auth/prefs.js';
import { SESSION_KEY, GUEST_KEY, setGuestMode, clearSession } from '../auth/session.js';
import { renderFeed, renderPostHTML, renderCommentHTML } from './feed.js';
import { containsBannedWords, looksLikeSpam } from './automod.js';
import { openEditInline } from './posts.js';
import { showUserProfile } from '../views/profile.js';
import { supabase } from '../core/supabase_client.js';
import { pickAccent } from '../auth/theme.js';
import { updateDock, queuePrev, queueNext, markNowPlaying, getActiveQueueId } from './queue.js';
import { openHelpOverlay } from '../views/overlays.js';

export async function onActionClick(e, state, DB, render) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const root = $('#app');
  const card = e.target.closest('.post');
  const postId = card ? card.dataset.post : null;

  if (action === 'toggle-player' && postId) {
    const pl = document.getElementById('player-' + postId);
    const active = pl.classList.contains('active');
    if (active) {
      pl.classList.remove('active');
      try { pl._cleanup && pl._cleanup(); } catch {}
      pl.innerHTML = '';
      card.classList.remove('is-playing');
    } else {
      // Close any other active players
      document.querySelectorAll('.player.active').forEach(otherPl => {
        if (otherPl !== pl) {
          otherPl.classList.remove('active');
          try { otherPl._cleanup && otherPl._cleanup(); } catch {}
          otherPl.innerHTML = '';
          const otherCard = otherPl.closest('.post');
          if (otherCard) otherCard.classList.remove('is-playing');
        }
      });
      pl.classList.add('active');
      const db = DB.getAll();
      const p = db.posts.find(x => x.id === postId);
      if (!p || (!p.url && !(p.provider && p.provider.id))) {
        toast(card || root, 'Could not load post for playback', true);
        return;
      }
      console.log('Attempting to build embed:', { post: p, playerDiv: pl });
      buildEmbed(p, pl, { autoplay: true, onEnded: () => queueNext(true, state, DB) });
      console.log('Embed built. Player div innerHTML:', pl.innerHTML);
      markNowPlaying(postId, state, DB);
      if (loadPrefs().autoScroll) card.scrollIntoView({ block: 'center' });
    }
    return;
  }

  if (action === 'like' && postId) {
    if (!state.user) { toast(card || root, 'login to like', true); return; }
    const updated = await DB.toggleLike(postId, state.user.id);
    if (updated && card) {
      // Find the like button before updating
      const likeBtn = card.querySelector('[data-action="like"]');
      if (likeBtn) {
        likeBtn.classList.remove('like-animate');
        // Force reflow to restart animation
        void likeBtn.offsetWidth;
        likeBtn.classList.add('like-animate');
        if ((updated.likes || []).includes(state.user.id)) {
          likeBtn.classList.add('like-on');
          likeBtn.setAttribute('aria-pressed', 'true');
        } else {
          likeBtn.classList.remove('like-on');
          likeBtn.setAttribute('aria-pressed', 'false');
        }
        likeBtn.innerHTML = `[ ♥ ${(updated.likes ? updated.likes.length : 0)} ]`;
      }
    }
    return;
  }
// ...existing code...

  if (action === 'delete' && postId) {
    const db = DB.getAll();
    const p = db.posts.find(x => x.id === postId);
    if (!p) return;
    if (!state.user || p.userId !== state.user.id) { toast(card || root, 'you can only delete your posts', true); return; }
    if (confirm('Delete this post?')) {
      await DB.deletePost(postId);
      render();
    }
    return;
  }


  if (action === 'comment' && postId) {
    // Close any open edit form first
    if (window.editingPostId) {
      const lastCard = document.getElementById('post-' + window.editingPostId);
      const lastEditBoxId = 'editbox-' + window.editingPostId;
      const lastOpened = lastCard ? lastCard.querySelector('#' + lastEditBoxId) : null;
      if (lastOpened) {
        lastOpened.classList.remove('fade-in');
        lastOpened.classList.add('fade-out');
        setTimeout(() => {
          if (lastOpened.parentNode) lastOpened.parentNode.removeChild(lastOpened);
          if (window.editingPostId == lastEditBoxId.replace('editbox-', '')) window.editingPostId = null;
        }, 180);
      } else {
        window.editingPostId = null;
      }
    }
    // Close any other open comment box first
    if (window.openCommentId && window.openCommentId !== postId) {
      const lastCbox = document.getElementById('cbox-' + window.openCommentId);
      if (lastCbox && lastCbox.classList.contains('active')) {
        lastCbox.classList.remove('fade-in');
        lastCbox.classList.add('fade-out');
        setTimeout(() => {
          lastCbox.classList.remove('active');
          lastCbox.classList.remove('fade-out');
        }, 180);
      }
      window.openCommentId = null;
    }
    const cbox = document.getElementById('cbox-' + postId);
    if (cbox.classList.contains('active')) {
      // Animate out
      cbox.classList.remove('fade-in');
      cbox.classList.add('fade-out');
      setTimeout(() => {
        cbox.classList.remove('active');
        cbox.classList.remove('fade-out');
      }, 180);
      window.openCommentId = null;
    } else {
      cbox.classList.add('active');
      cbox.classList.remove('fade-out');
      cbox.classList.add('fade-in');
      window.openCommentId = postId;
      if (state.user) {
        // Focus input after animation
        setTimeout(() => {
          const inp = cbox.querySelector('input.field');
          if (inp) inp.focus();
        }, 180);
      }
    }
    return;
  }

  if (action === 'delete-comment') {
    const pid = btn.dataset.post || postId;
    const cid = btn.dataset.comment;
    if (!pid || !cid) return;
    if (!state.user) { toast(card || root, 'login to delete comments', true); return; }
    const db = DB.getAll();
    const p = db.posts.find(x => x.id === pid);
    if (!p) return;
    const com = (p.comments || []).find(c => c.id === cid);
    if (!com) return;
    if (com.userId !== state.user.id) { toast(card || root, 'you can only delete your comments', true); return; }
    if (confirm('Delete this comment?')) {
      await DB.deleteComment(pid, cid);
      const updated = DB.getAll().posts.find(x => x.id === pid);
      const cwrap = document.getElementById('comments-' + pid);
      cwrap.innerHTML = (updated?.comments || []).map(x => renderCommentHTML(x, pid, state, DB)).join('');
      liveSay('comment deleted');
    }
  }

  if (action === 'go-login') {
    setGuestMode(false);
    state.forceLogin = true;
    render();
    return;
  }

  if (action === 'share') {
    const perma = btn.dataset.perma || (location.pathname + '#post-' + postId);
    const db = DB.getAll();
    const p = postId ? db.posts.find(x => x.id === postId) : null;
    const title = p ? `${p.title}${p.artist ? ' — ' + p.artist : ''}` : 'tunedIn.space';
    if (navigator.share) {
      navigator.share({ title, url: perma }).catch(() => copyText(perma));
    } else {
      copyText(perma)
        .then(() => toast(card || root, 'permalink copied to clipboard'))
        .catch(() => toast(card || root, 'copy failed', true));
    }
  }

  if (action === 'queue' && postId) {
    if (!state.queue.includes(postId)) state.queue.push(postId);
    updateDock(true, state, DB);
    toast(card, 'added to queue');
  }

  if (action === 'filter-tag') {
    const t = btn.dataset.tag;
    // Prevent default anchor or button scroll behavior
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    savePrefs({ filterTag: t, search: '' });
    state.page = 1;
    render();
    // Do not scroll the page
    return;
  }
  if (action === 'clear-tag') {
    // Prevent default anchor or button scroll behavior
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    savePrefs({ filterTag: null });
    state.page = 1;
    render();
    // Do not scroll the page
    return;
  }

  if (action === 'q-prev') queuePrev(state, DB);
  if (action === 'q-next') queueNext(false, state, DB);
  if (action === 'q-clear') { state.queue = []; state.qIndex = 0; updateDock(false, state, DB); }
  if (action === 'q-shuffle') { savePrefs({ shuffle: !loadPrefs().shuffle }); updateDock(false, state, DB); }
  if (action === 'q-repeat') {
    const order = ['off', 'all', 'one'];
    const cur = loadPrefs().repeat || 'off';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    savePrefs({ repeat: next });
    updateDock(false, state, DB);
  }

  if (action === 'reset') {
    if (DB.isRemote) {
      alert('Reset all is only for local mode. For Supabase, use Import to replace remote data.');
      return;
    }
    if (confirm('Reset all tunedIn.space data (posts, users, prefs)? This cannot be undone.')) {
      localStorage.removeItem('tunedIn.space/db@v2');
      localStorage.removeItem('tunedIn.space/v1');
      localStorage.removeItem(PREF_KEY);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(GUEST_KEY);
      resetPrefsCache();
      state.queue = [];
      state.qIndex = 0;
      await DB.init();
      render();
    }
  }

  if (action === 'accent-pick') pickAccent();
  if (action === 'toggle-density') {
    const cur = loadPrefs().density;
    const next = cur === 'cozy' ? 'compact' : 'cozy';
    savePrefs({ density: next });
    render();
  }
  if (action === 'load-more') {
    state.page++;
    renderFeed($('#feed'), $('#pager'), state, DB, loadPrefs());
  }

  if (action === 'show-help') openHelpOverlay();

  if (action === 'view-user') { e.preventDefault(); const uid = btn.dataset.uid; if (uid) showUserProfile(uid, DB); }

  if (action === 'go-edit-profile') {
    document.getElementById('profile')?.remove();
    document.getElementById('aboutMe')?.focus();
  }

  if (action === 'play-all') {
    // Build queue from current feed
    const posts = document.querySelectorAll('#feed .post');
    state.queue = Array.from(posts).map(n => n.dataset.post);
    state.qIndex = 0;
    updateDock(true, state, DB);
    // start first
    const first = state.queue[0];
    if (first) {
      const btn = document.querySelector(`#post-${first} [data-action="toggle-player"]`);
      btn?.click();
    }
  }

  if (action === 'logout') {
    clearSession();
    setGuestMode(false);
    render();
  }
}

export async function onDelegatedSubmit(e, state, DB, render) {
  const form = e.target.closest('form[data-action="comment-form"], form[data-action="edit-form"], form[data-action="profile-form"]');
  if (!form) return;
  e.preventDefault();
  const pid = form.dataset.post;

  if (form.dataset.action === 'comment-form') {
    if (!state.user) { toast(document.getElementById('app'), 'login to comment', true); return; }
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    // Automoderation for comments
    if (containsBannedWords(text) || looksLikeSpam(text)) {
      // Remove any previous moderation message
      let modMsg = form.querySelector('.mod-msg');
      if (modMsg) modMsg.remove();
      // Find the send button
      const sendBtn = form.querySelector('button, input[type=submit], [data-action="send"]');
      // Create and insert the moderation message after the button
      modMsg = document.createElement('div');
      modMsg.className = 'mod-msg notice small warn';
      modMsg.textContent = 'Comment blocked by moderation.';
      if (sendBtn && sendBtn.parentNode) {
        sendBtn.parentNode.insertBefore(modMsg, sendBtn.nextSibling);
      } else {
        form.appendChild(modMsg);
      }
      return;
    }
    const c = { id: uid('c'), userId: state.user.id, text, createdAt: Date.now() };
    await DB.addComment(pid, c);
    input.value = '';
    const p = DB.getAll().posts.find(x => x.id === pid);
    const cwrap = document.getElementById('comments-' + pid);
    cwrap.innerHTML = (p.comments || []).map(x => renderCommentHTML(x, pid, state, DB)).join('');
    liveSay('comment added');
    return;
  }

  if (form.dataset.action === 'edit-form') {
    const title = form.querySelector('[name=title]').value.trim();
    const artist = form.querySelector('[name=artist]').value.trim();
    const url = form.querySelector('[name=url]').value.trim();
    const body = form.querySelector('[name=body]').value.trim();
    const tagsRaw = form.querySelector('[name=tags]').value.trim();
    const tags = tagsRaw.split(/[#,\s]+/g).map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 12);
    const provider = parseProvider(url);
    const updated = await DB.updatePost(pid, { title, artist, url, body, tags, provider });
    const card = document.getElementById('post-' + pid);
    if (card && updated) card.outerHTML = renderPostHTML(updated, state, DB);
    liveSay('post updated');
    return;
  }

  if (form.dataset.action === 'profile-form') {
    if (!state.user) {
      toast(document.getElementById('app'), 'login first', true);
      return;
    }
    const about = form.querySelector('[name=about]').value.trim();
    let avatarUrl = undefined;
    const fileInput = form.querySelector('[name=avatar]');
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (file) {
      try {
        // Check bucket existence and permissions in Supabase dashboard if this fails
        const fileExt = file.name.split('.').pop();
        const filePath = `avatars/${state.user.id}_${Date.now()}.${fileExt}`;
        const uploadRes = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
        if (uploadRes.error) {
          console.error('Avatar upload error:', uploadRes.error);
          const msg = document.getElementById('profileMsg');
          if (msg) msg.textContent = 'Avatar upload failed: ' + uploadRes.error.message;
          return;
        }
        const publicUrlRes = supabase.storage.from('avatars').getPublicUrl(filePath);
        if (publicUrlRes.error) {
          console.error('Get public URL error:', publicUrlRes.error);
          const msg = document.getElementById('profileMsg');
          if (msg) msg.textContent = 'Avatar URL error: ' + publicUrlRes.error.message;
          return;
        }
        avatarUrl = publicUrlRes.data?.publicUrl || '';
      } catch (err) {
        console.error('Unexpected avatar upload error:', err);
        const msg = document.getElementById('profileMsg');
        if (msg) msg.textContent = 'Avatar upload failed (unexpected error)';
        return;
      }
    }
    try {
      const patch = avatarUrl ? { about, avatarUrl } : { about };
      await DB.updateUser(state.user.id, patch);
      await DB.refresh();
      toast(document.getElementById('app'), 'profile updated');
      render();
    } catch (err) {
      console.error('Profile update error:', err);
      const msg = document.getElementById('profileMsg');
      if (msg) msg.textContent = 'Save failed';
    }
    return;
  }
}