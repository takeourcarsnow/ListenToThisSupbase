// js/app.js (new, tiny entry)
import DB from './db.js';
import { $ } from './utils.js';
import { render } from './render.js';
import { onActionClick, onDelegatedSubmit } from './actions.js';
import { onCreatePost } from './posts.js';
import { installKeyboardShortcuts } from './keyboard.js';
import { PREF_KEY } from './prefs.js';
import { SESSION_KEY } from './session.js';
import { seedDemo } from './seed.js';

async function boot() {
  await DB.init();
  installKeyboardShortcuts();

  // Delegated events (attach once)
  const root = document.getElementById('app');
  root.addEventListener('click', onActionClick);
  root.addEventListener('submit', (e)=>{
    if (e.target && e.target.id === 'postForm') {
      onCreatePost(e);
    } else {
      onDelegatedSubmit(e);
    }
  });
  // Import handled inside views/main.js (direct listener on #importFile)

  // Cross-tab sync
  window.addEventListener('storage', async (ev)=>{
    if(ev.key === PREF_KEY || ev.key === SESSION_KEY){
      await DB.refresh();
      render();
    }
  });

  // Expose demo seeder
  window.seedDemo = seedDemo;

  await render();
}

boot();