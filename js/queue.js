// js/queue.js
import DB from './db.js';
import { state } from './state.js';
import { loadPrefs, savePrefs } from './prefs.js';
import { $ } from './utils.js';

export function updateDock(showIfHidden=false){
  const dock = $('#dock');
  if(!dock) return;
  const len = state.queue.length;
  $('#qLen') && ($('#qLen').textContent = String(len));
  $('#qPos') && ($('#qPos').textContent = String(len ? (state.qIndex+1) : 0));
  const prefs = loadPrefs();
  const shuffleBtn = $('[data-action="q-shuffle"]');
  if(shuffleBtn){ shuffleBtn.setAttribute('aria-pressed', String(!!prefs.shuffle)); }
  const repeatBtn = $('[data-action="q-repeat"]');
  if(repeatBtn){ repeatBtn.textContent = `[ repeat: ${prefs.repeat} ]`; }
  if(len>0 || showIfHidden){
    dock.style.display = 'block';
    const id = getActiveQueueId();
    if(id){
      const db = DB.getAll();
      const p = db.posts.find(x=>x.id===id);
      if(p){
        $('#nowPlaying').textContent = `now: ${p.title}${p.artist?' — '+p.artist:''}`;
      }else{
        $('#nowPlaying').textContent = '';
      }
    }else{
      $('#nowPlaying').textContent = '';
    }
  }else{
    dock.style.display = 'none';
  }
  const chk = $('#autoScroll');
  if(chk){ chk.onchange = () => savePrefs({autoScroll: chk.checked}); }
}

export function getActiveQueueId(){ return state.queue[state.qIndex] || null; }

export function queuePrev(){
  if(state.queue.length===0) return;
  const prefs = loadPrefs();
  if(prefs.repeat==='one'){
    // stay on same
  } else if(state.qIndex===0){
    if(prefs.repeat==='all') state.qIndex = state.queue.length-1;
    else state.qIndex = 0;
  } else {
    state.qIndex = Math.max(0, state.qIndex-1);
  }
  updateDock();
  jumpToQueueItem(state.qIndex);
}

export function queueNext(auto=false){
  if(state.queue.length===0) return;
  const prefs = loadPrefs();
  if(prefs.repeat==='one'){
    // stay on same
  } else if(prefs.shuffle && state.queue.length>1){
    let n;
    do { n = Math.floor(Math.random()*state.queue.length); } while(n===state.qIndex);
    state.qIndex = n;
  } else if(state.qIndex >= state.queue.length-1){
    if(prefs.repeat==='all') state.qIndex = 0;
    else if(auto) return;
    else state.qIndex = state.queue.length-1;
  } else {
    state.qIndex++;
  }
  updateDock();
  jumpToQueueItem(state.qIndex);
}

export function jumpToQueueItem(idx){
  const id = state.queue[idx];
  if(!id) return;
  const card = document.getElementById('post-'+id);
  if(!card) return;
  const pl = document.getElementById('player-'+id);
  if(!pl.classList.contains('active')){
    const btn = card.querySelector('[data-action="toggle-player"]');
    if(btn) btn.click();
  }
  document.querySelectorAll('.post').forEach(p=>p.classList.remove('is-playing'));
  card.classList.add('is-playing');
  if(loadPrefs().autoScroll) card.scrollIntoView({block:'center'});
}

export function markNowPlaying(postId){
  document.querySelectorAll('.post').forEach(p=>p.classList.remove('is-playing'));
  const card = document.getElementById('post-'+postId);
  if(card) card.classList.add('is-playing');
  updateDock();
}