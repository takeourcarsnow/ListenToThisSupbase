// js/keyboard.js
import { $, $$ } from './utils.js';
import { queueNext, queuePrev } from './queue.js';

export function onKey(e){
  const tag = e.target.tagName.toLowerCase();
  if(tag==='input' || tag==='textarea') return;

  const posts = $$('#app', '.post');
  const currentEl = posts[0];

  if(e.key === '/'){ e.preventDefault(); $('#search')?.focus(); return; }
  if(e.key.toLowerCase() === 'n'){ $('#f_title')?.focus(); return; }
  if(e.key.toLowerCase() === 'j'){ e.preventDefault(); queueNext(false); return; }
  if(e.key.toLowerCase() === 'k'){ e.preventDefault(); queuePrev(); return; }
  if(e.key === '?'){ document.getElementById('help')?.classList.toggle('active'); return; }
  if(e.key.toLowerCase() === 'l' && currentEl){
    const likeBtn = currentEl.querySelector('[data-action="like"]');
    likeBtn?.click(); return;
  }
  if(e.key.toLowerCase() === 'o' && currentEl){
    const playBtn = currentEl.querySelector('[data-action="toggle-player"]');
    playBtn?.click(); return;
  }
}

export function installKeyboardShortcuts(){
  document.addEventListener('keydown', onKey);
  // Double click to like
  document.addEventListener('dblclick', (e)=>{
    const card = e.target.closest('.post');
    if(!card) return;
    const likeBtn = card.querySelector('[data-action="like"]');
    likeBtn?.click();
  });
}