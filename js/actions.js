// js/actions.js
import DB from './db.js';
import { parseProvider, buildEmbed } from './providers.js';
import { $, copyText, toast, liveSay } from './utils.js';
import { loadPrefs, savePrefs, pickAccent } from './prefs.js';
import { state } from './state.js';
import { renderFeed, renderTags, renderPostHTML, getFilteredPosts } from './feed.js';
import { updateDock, queuePrev, queueNext, markNowPlaying } from './queue.js';
import { clearSession } from './session.js';
import { render } from './render.js';

export async function onActionClick(e){
  const btn = e.target.closest('[data-action]');
  if(!btn) return;
  const action = btn.dataset.action;
  const card = e.target.closest('.post');
  const postId = card ? card.dataset.post : null;

  // Player toggle
  if(action==='toggle-player' && postId){
    const pl = document.getElementById('player-'+postId);
    const active = pl.classList.contains('active');
    if(active){
      pl.classList.remove('active');
      try { pl._cleanup && pl._cleanup(); } catch {}
      pl.innerHTML='';
      card.classList.remove('is-playing');
    }else{
      pl.classList.add('active');
      const db = DB.getAll();
      const p = db.posts.find(x=>x.id===postId);
      buildEmbed(p, pl, { autoplay:true, onEnded: ()=> queueNext(true) });
      markNowPlaying(postId);
      if(loadPrefs().autoScroll){
        card.scrollIntoView({block:'center'});
      }
    }
  }

  if(action==='like' && postId){
    const updated = await DB.toggleLike(postId, state.user.id);
    if(updated && card) card.outerHTML = renderPostHTML(updated);
  }

  if(action==='comment' && postId){
    const cbox = document.getElementById('cbox-'+postId);
    cbox.classList.toggle('active');
    if(cbox.classList.contains('active')){
      const inp = cbox.querySelector('input.field'); inp.focus();
    }
  }

  if(action==='share'){
    const perma = btn.dataset.perma || (location.pathname+'#post-'+postId);
    const db = DB.getAll();
    const p = postId ? db.posts.find(x=>x.id===postId) : null;
    const title = p ? `${p.title}${p.artist? ' — '+p.artist:''}` : 'ascii.fm';
    if(navigator.share){
      navigator.share({ title, url: perma }).catch(()=> copyText(perma));
    }else{
      copyText(perma)
        .then(()=> toast(card||$('#app'), 'permalink copied to clipboard'))
        .catch(()=> toast(card||$('#app'), 'copy failed', true));
    }
  }

  if(action==='queue' && postId){
    if(!state.queue.includes(postId)) state.queue.push(postId);
    updateDock(true);
    toast(card, 'added to queue');
  }

  if(action==='filter-tag'){
    const t = btn.dataset.tag;
    savePrefs({ filterTag: t, search: '' });
    state.page = 1;
    await render();
  }

  if(action==='clear-tag'){
    savePrefs({filterTag: null});
    state.page = 1;
    await render();
  }

  if(action==='q-prev'){ queuePrev(); }
  if(action==='q-next'){ queueNext(false); }
  if(action==='q-clear'){ state.queue=[]; state.qIndex=0; updateDock(); }
  if(action==='q-shuffle'){ savePrefs({shuffle: !loadPrefs().shuffle}); updateDock(); }
  if(action==='q-repeat'){
    const order = ['off','all','one'];
    const cur = loadPrefs().repeat;
    const next = order[(order.indexOf(cur)+1)%order.length];
    savePrefs({repeat: next});
    updateDock();
  }

  if(action==='play-all'){
    const ids = getFilteredPosts().map(p=>p.id);
    state.queue = ids;
    state.qIndex = 0;
    updateDock(true);
    // jump handled by clicking first play if needed
    const first = ids[0];
    if(first){
      const firstBtn = document.querySelector(`#post-${first} [data-action="toggle-player"]`);
      firstBtn?.click();
    }
  }

  if(action==='edit' && postId){ openEditInline(postId); }

  if(action==='delete' && postId){
    const db = DB.getAll();
    const p = db.posts.find(x=>x.id===postId);
    if(!p) return;
    if(p.userId !== state.user.id){
      toast(card, 'you can only delete your posts', true); return;
    }
    if(confirm('Delete this post? This cannot be undone.')){
      await DB.deletePost(postId);
      state.queue = state.queue.filter(id=> id!==postId);
      renderFeed($('#feed'), $('#pager'));
      updateDock();
    }
  }

  if(action==='export'){
    const blob = new Blob([DB.exportJSON()], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ascii.fm-export-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }

  if(action==='reset'){
    if(DB.isRemote){
      alert('Reset all is only for local mode. For Supabase, use Import to replace remote data.');
      return;
    }
    if(confirm('Reset all ascii.fm data (posts, users, prefs)? This cannot be undone.')){
      localStorage.removeItem('ascii.fm/db@v2');
      localStorage.removeItem('ascii.fm/v1');
      localStorage.removeItem('ascii.fm/prefs@v2');
      localStorage.removeItem('ascii.fm/session@v1');
      state.queue = [];
      state.qIndex = 0;
      await DB.init();
      await render();
    }
  }

  if(action==='accent-pick'){ pickAccent(); }
  if(action==='toggle-density'){
    const cur = loadPrefs().density;
    const next = cur === 'cozy' ? 'compact' : 'cozy';
    savePrefs({density: next});
    await render();
  }
  if(action==='load-more'){
    state.page++;
    renderFeed($('#feed'), $('#pager'));
  }
  if(action==='show-help'){
    document.getElementById('help')?.classList.add('active');
  }
  if(action==='logout'){
    clearSession();
    await render();
  }
}

export async function onDelegatedSubmit(e){
  const form = e.target.closest('form[data-action="comment-form"], form[data-action="edit-form"]');
  if(!form) return;
  e.preventDefault();
  const pid = form.dataset.post;

  if(form.dataset.action === 'comment-form'){
    const input = form.querySelector('input');
    const text = input.value.trim();
    if(!text) return;
    const c = { id: crypto.randomUUID ? crypto.randomUUID() : 'c_' + Math.random().toString(36).slice(2),
                userId: state.user.id, text, createdAt: Date.now() };
    await DB.addComment(pid, c);
    input.value = '';
    const p = DB.getAll().posts.find(x=>x.id===pid);
    const cwrap = document.getElementById('comments-'+pid);
    cwrap.innerHTML = (p.comments||[]).map(x=>renderPostHTML({ ...p, comments: p.comments })).join(''); // will override below anyway
    const commentsHtml = (p.comments||[]).map(x=>`<div class="comment small"> <span class="muted">${new Date(x.createdAt).toLocaleString()}</span> <b></b>: </div>`);
    // Simpler: rerender only comments area
    const commentsEl = document.getElementById('comments-'+pid);
    if (commentsEl) {
      commentsEl.innerHTML = (p.comments||[]).map(x=>`<div class="comment small"> <span class="muted">${new Date(x.createdAt).toLocaleString()}</span> <b></b>: </div>`).join('');
    }
    liveSay('comment added');
    // Better: just rebuild comments using feed helper:
    const cwrap2 = document.getElementById('comments-'+pid);
    if (cwrap2) {
      cwrap2.innerHTML = (p.comments||[]).map(x=>`<div class="comment small"> <span class="muted">${new Date(x.createdAt).toLocaleString()}</span> <b></b>: </div>`).join('');
    }
    return;
  }

  if(form.dataset.action === 'edit-form'){
    const title = form.querySelector('[name=title]').value.trim();
    const artist = form.querySelector('[name=artist]').value.trim();
    const url = form.querySelector('[name=url]').value.trim();
    const body = form.querySelector('[name=body]').value.trim();
    const tagsRaw = form.querySelector('[name=tags]').value.trim();
    const tags = tagsRaw.split(/[#,\s]+/g).map(t=>t.trim().toLowerCase()).filter(Boolean).slice(0,12);
    const provider = parseProvider(url);
    const updated = await DB.updatePost(pid, { title, artist, url, body, tags, provider });
    const card = document.getElementById('post-'+pid);
    if(card && updated) card.outerHTML = renderPostHTML(updated);
    liveSay('post updated');
    return;
  }
}

function openEditInline(postId){
  const db = DB.getAll();
  const p = db.posts.find(x=>x.id===postId);
  if(!p) return;
  if(p.userId !== state.user.id){ toast($('#app'), 'you can only edit your posts', true); return; }
  const card = document.getElementById('post-'+postId);
  if(!card) return;
  const editBoxId = 'editbox-'+postId;
  const opened = card.querySelector('#'+editBoxId);
  if(opened){ opened.remove(); return; }
  const edit = document.createElement('div');
  edit.className = 'box';
  edit.id = editBoxId;
  edit.style.marginTop = '8px';
  edit.innerHTML = `
    <div class="muted small">edit post</div>
    <form class="stack" data-action="edit-form" data-post="${p.id}">
      <input class="field" name="title" value="${p.title}" required maxlength="120"/>
      <input class="field" name="artist" value="${p.artist||''}"/>
      <input class="field" name="url" value="${p.url}" required/>
      <input class="field" name="tags" value="${(p.tags||[]).join(' ')}" placeholder="#tag another"/>
      <textarea class="field" name="body" rows="4">${p.body||''}</textarea>
      <div class="hstack">
        <button class="btn" type="submit">[ save ]</button>
        <button class="btn btn-ghost" type="button" data-action="toggle-player">[ preview ]</button>
      </div>
    </form>
  `;
  card.appendChild(edit);
}