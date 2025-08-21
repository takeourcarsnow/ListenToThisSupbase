import DB from './db.js';
import { $ } from './utils.js';
import { loadPrefs, PREF_KEY } from '../auth/prefs.js';
import { SESSION_KEY, GUEST_KEY, isGuestMode } from '../auth/session.js';
import { currentUser } from '../auth/auth.js';
import { bindHelpOverlay } from '../views/overlays.js';
import { renderMain } from '../views/main_view.js';
import { renderLogin } from '../views/login_view.js';
import { onActionClick, onDelegatedSubmit } from '../features/actions.js';
import { onKey } from '../auth/keyboard.js';
import { seedDemo } from '../features/seed.js';

const state = {
  user: null,
  queue: [],
  qIndex: 0,
  pageSize: 30,
  page: 1,
  forceLogin: false
};

async function renderApp() {
  state.user = await currentUser(DB);
  const prefs = loadPrefs();

  const root = $('#app');
  const banner = document.getElementById('ascii-banner');
  const body = document.body;


  root.innerHTML = '';
  if (state.forceLogin) {
    state.forceLogin = false;
    if (banner) banner.style.display = 'none';
    body.classList.remove('show-header');
    renderLogin(root, DB, renderApp);
    return;
  }
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
  // Also bind action clicks in help overlay
  const help = document.getElementById('help');
  if (help) {
    help.addEventListener('click', (e) => onActionClick(e, state, DB, renderApp));
  }
  document.addEventListener('keydown', (e) => onKey(e, state));

  // Double click to like, prevent text selection
  document.addEventListener('dblclick', (e) => {
    const card = e.target.closest('.post');
    if (!card) return;
    // Prevent text selection on double click
    if (window.getSelection) {
      const sel = window.getSelection();
      if (sel && sel.type === 'Range') sel.removeAllRanges();
    }
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

// Add header, main containers, and help overlay on DOMContentLoaded
import { renderHeader, renderMainContainers } from './header.js';
import { renderHelpOverlay } from './help.js';

window.addEventListener('DOMContentLoaded', function() {
  renderHeader();
  renderMainContainers();
  renderHelpOverlay();
  document.body.classList.add('header-logo-ready');
});