// js/render.js
import DB from './db.js';
import { state } from './state.js';
import { loadPrefs } from './prefs.js';
import { currentUser } from './session.js';
import { renderLogin } from './views/login.js';
import { renderMain } from './views/main.js';

export async function render() {
  // Ensure user is resolved
  state.user = await currentUser();
  loadPrefs(); // applies accent/density
  const root = document.getElementById('app');
  root.innerHTML = '';
  if (!state.user) {
    renderLogin(root, { onAuthed: render });
  } else {
    await renderMain(root);
  }
}