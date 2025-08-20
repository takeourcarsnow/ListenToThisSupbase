import DB from './db.js';
import { $ } from './utils.js';
import { loadPrefs, PREF_KEY } from './prefs.js';
import { SESSION_KEY, GUEST_KEY, isGuestMode } from './session.js';
import { currentUser } from './auth.js';
import { bindHelpOverlay } from './overlays.js';
import { renderMain } from './main_view.js';
import { renderLogin } from './login_view.js';
import { onActionClick, onDelegatedSubmit } from './actions.js';
import { onKey } from './keyboard.js';
import { seedDemo } from './seed.js';

const state = {
  user: null,
  queue: [],
  qIndex: 0,
  pageSize: 30,
  page: 1
};

async function renderApp() {
  state.user = await currentUser(DB);
  const prefs = loadPrefs();

  const root = $('#app');
  const banner = document.getElementById('ascii-banner');
  const body = document.body;

  root.innerHTML = '';
  if (!state.user && !isGuestMode()) {
    if (banner) banner.style.display = 'none';
    body.classList.remove('show-header');
    renderLogin(root, DB, renderApp);
  } else {
    if (banner) banner.style.display = '';
    body.classList.add('show-header');
    renderMain(root, state, DB, renderApp);
  }

  bindHelpOverlay();
}

// Global delegated events (bind once)
function bindGlobalHandlers() {
  const root = $('#app');
  root.addEventListener('click', (e) => onActionClick(e, state, DB, renderApp));
  root.addEventListener('submit', (e) => onDelegatedSubmit(e, state, DB, renderApp));
  document.addEventListener('keydown', (e) => onKey(e, state));

  // Double click to like
  document.addEventListener('dblclick', (e) => {
    const card = e.target.closest('.post');
    if (!card) return;
    const likeBtn = card.querySelector('[data-action="like"]');
    likeBtn?.click();
  });

  // Cross-tab sync
  window.addEventListener('storage', async (ev) => {
    if (ev.key === PREF_KEY || ev.key === SESSION_KEY || ev.key === GUEST_KEY) {
      await DB.refresh();
      renderApp();
    }
  });
}

async function boot() {
  await DB.init();
  bindGlobalHandlers();
  await renderApp();
  // expose seed helper
  window.seedDemo = () => seedDemo(DB, state, renderApp);
}

boot();