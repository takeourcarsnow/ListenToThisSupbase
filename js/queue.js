import { loadPrefs } from './prefs.js';
import { $ } from './utils.js';

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
    if (id) {
      const db = DB.getAll();
      const p = db.posts.find(x => x.id === id);
      const now = document.getElementById('nowPlaying');
      if (now) now.textContent = p ? `now: ${p.title}${p.artist ? ' — ' + p.artist : ''}` : '';
    } else {
      const now = document.getElementById('nowPlaying');
      if (now) now.textContent = '';
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