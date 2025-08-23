import { loadPrefs } from '../auth/prefs.js';
import { $, fmtTime } from '../core/utils.js';
import { parseProvider } from '../features/providers.js';

export function getActiveQueueId(state) {
  return state.queue[state.qIndex] || null;
}

export function updateDock(showIfHidden, state, DB) {
  const dock = $('#dock');
  if (!dock) return;
  const len = state.queue.length;
  const qLen = document.getElementById('qLen');
  const qPos = document.getElementById('qPos');
  if (qLen) qLen.textContent = String(len);
  if (qPos) qPos.textContent = String(len ? (state.qIndex + 1) : 0);
  const prefs = loadPrefs();
  const shuffleBtn = document.querySelector('[data-action="q-shuffle"]');
  if (shuffleBtn) shuffleBtn.setAttribute('aria-pressed', String(!!prefs.shuffle));
  const repeatBtn = document.querySelector('[data-action="q-repeat"]');
  if (repeatBtn) repeatBtn.textContent = `[ repeat: ${prefs.repeat} ]`;

  if (len > 0 || showIfHidden) {
    dock.style.display = 'block';
    const id = getActiveQueueId(state);
    const db = DB.getAll();
    let p = null;
    let user = null;
    let ago = '';
    let provider = '';
    if (id) {
      p = db.posts.find(x => x.id === id);
      if (p) {
        user = db.users && db.users.find(u => u.id === p.userId);
        ago = fmtTime(p.createdAt);
        const prov = parseProvider(p.url || '');
        provider = prov && prov.provider ? prov.provider : '';
      }
    }
    // Set now playing text
    const now = document.getElementById('nowPlaying');
    if (now) now.textContent = p ? `now: ${p.title}${p.artist ? ' — ' + p.artist : ''}` : '';
    // Set queue info with extra details
    const queueInfo = document.querySelector('.queue-info');
    if (queueInfo) {
      let info = `queue ${len ? (state.qIndex + 1) : 0}/${len}`;
      if (p) {
        let userStr = '';
        if (user) {
          userStr = `by <a href="#" class="dock-user-link" data-user-id="${user.id}">${user.name}</a>`;
        }
        let agoStr = ago ? `, ${ago}` : '';
        let provStr = provider ? `, source: ${provider}` : '';
        info += ` <span class="muted small">${userStr}${agoStr}${provStr}</span>`;
      }
  // Add click handler for username link in dock
  const dockUserLink = document.querySelector('.dock-user-link');
  if (dockUserLink) {
    dockUserLink.onclick = (e) => {
      e.preventDefault();
      const userId = dockUserLink.getAttribute('data-user-id');
      // Simulate a click on the username in the feed post that is currently playing
      const id = getActiveQueueId(state);
      if (id) {
        // Find the feed post element
        const postElem = document.getElementById('post-' + id);
        if (postElem) {
          // Try to find a username link inside the post
          const userLink = postElem.querySelector('.user-link, .post-user, [data-action="view-user"]');
          if (userLink) {
            userLink.click();
            return;
          }
        }
      }
      // Fallback: open modal directly
      import('../views/profile.js').then(mod => {
        if (mod && typeof mod.showUserProfile === 'function') {
          mod.showUserProfile(userId, DB);
        }
      });
    };
  }
      queueInfo.innerHTML = info;
    }
  } else {
    dock.style.display = 'none';
  }
  const chk = document.getElementById('autoScroll');
  if (chk) { chk.onchange = e => { const c = e.target; if (c) localStorage.setItem('autoScroll', c.checked ? '1' : '0'); }; }
}

export function queuePrev(state, DB) {
  if (state.queue.length === 0) return;
  const prefs = loadPrefs();
  if (prefs.repeat === 'one') {
    // stay
  } else if (state.qIndex === 0) {
    if (prefs.repeat === 'all') state.qIndex = state.queue.length - 1;
    else state.qIndex = 0;
  } else {
    state.qIndex = Math.max(0, state.qIndex - 1);
  }
  updateDock(false, state, DB);
  jumpToQueueItem(state.qIndex, state);
}

export function queueNext(auto, state, DB) {
  if (state.queue.length === 0) return;
  const prefs = loadPrefs();
  if (prefs.repeat === 'one') {
    // stay
  } else if (prefs.shuffle && state.queue.length > 1) {
    let n;
    do { n = Math.floor(Math.random() * state.queue.length); } while (n === state.qIndex);
    state.qIndex = n;
  } else if (state.qIndex >= state.queue.length - 1) {
    if (prefs.repeat === 'all') state.qIndex = 0;
    else if (auto) return;
    else state.qIndex = state.queue.length - 1;
  } else {
    state.qIndex++;
  }
  updateDock(false, state, DB);
  jumpToQueueItem(state.qIndex, state);
}

export function jumpToQueueItem(idx, state) {
  const id = state.queue[idx];
  if (!id) return;
  const card = document.getElementById('post-' + id);
  if (!card) return;
  // Save scroll position
  const scrollY = window.scrollY;
  const pl = document.getElementById('player-' + id);
  if (pl && !pl.classList.contains('active')) {
    const btn = card.querySelector('[data-action="toggle-player"]');
    if (btn) btn.click();
  }
  document.querySelectorAll('.post').forEach(p => p.classList.remove('is-playing'));
  card.classList.add('is-playing');
  // Restore scroll position
  window.scrollTo({ top: scrollY });
}

export function markNowPlaying(postId, state, DB) {
  document.querySelectorAll('.post').forEach(p => p.classList.remove('is-playing'));
  const card = document.getElementById('post-' + postId);
  if (card) card.classList.add('is-playing');
  updateDock(false, state, DB);
}