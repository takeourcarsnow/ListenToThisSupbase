// js/views/main.js
import DB from '../db.js';
import { state } from '../state.js';
import { loadPrefs, savePrefs } from '../prefs.js';
import { parseProvider, buildEmbed } from '../providers.js';
import { $, esc, debounce } from '../utils.js';
import { renderFeed, renderTags } from '../feed.js';
import { updateDock } from '../queue.js';
import { storageInfo, onImport } from '../importExport.js';

export async function renderMain(root){
  const db = DB.getAll();
  const me = state.user; // already resolved in render()
  const prefs = loadPrefs();

  const top = document.createElement('div');
  top.className = 'topbar';
  top.innerHTML = `
    <div class="hstack toolbar">
      <span class="pill" title="current user">user: ${esc(me.name)}</span>
      ${prefs.filterTag ? `<span class="pill">tag: #${esc(prefs.filterTag)} <a href="#" data-action="clear-tag" title="clear tag">✕</a></span>` : ''}
      <span class="pill" title="total posts">posts: ${db.posts.length}</span>
      <span class="pill" title="keyboard shortcuts">keys: <span class="kbd">/</span> <span class="kbd">n</span> <span class="kbd">j</span>/<span class="kbd">k</span> <span class="kbd">?</span></span>
    </div>
    <div class="hstack toolbar">
      <input class="field" id="search" type="search" placeholder="search title/artist/tags..." style="width:240px" value="${esc(prefs.search)}" aria-label="search"/>
      <select class="field" id="sort" style="width:150px" aria-label="sort order">
        <option value="new" ${prefs.sort==='new'?'selected':''}>sort: newest</option>
        <option value="likes" ${prefs.sort==='likes'?'selected':''}>sort: most liked</option>
        <option value="comments" ${prefs.sort==='comments'?'selected':''}>sort: most commented</option>
      </select>
      <button class="btn icon" title="accent color" data-action="accent-pick">🎨</button>
      <button class="btn icon" title="density" data-action="toggle-density">${prefs.density==='compact'?'▥':'▤'}</button>
      <button class="btn btn-ghost" data-action="logout" title="logout">[ logout ]</button>
    </div>
  `;
  root.appendChild(top);

  const grid = document.createElement('div');
  grid.className = 'grid';

  const left = document.createElement('div');
  left.innerHTML = `
    <div class="box">
      <div class="hstack" style="justify-content:space-between">
        <div class="muted">feed</div>
        <div class="hstack">
          <button class="btn btn-ghost" data-action="play-all">[ play all ${prefs.filterTag?('#'+esc(prefs.filterTag)):(prefs.search?('(search)'):'(all)')} ]</button>
          <button class="btn btn-ghost" data-action="show-help" title="keyboard shortcuts">[ help ]</button>
        </div>
      </div>
      <div id="feed"></div>
      <div id="pager" class="hstack" style="justify-content:center; margin-top:8px"></div>
    </div>
    <div class="dock" id="dock" style="display:none">
      <div class="hstack" style="justify-content:space-between; align-items:center">
        <div class="hstack">
          <button class="btn" data-action="q-prev" title="previous in queue (k)">[ prev ]</button>
          <button class="btn" data-action="q-next" title="next in queue (j)">[ next ]</button>
          <button class="btn" data-action="q-shuffle" aria-pressed="${prefs.shuffle}" title="shuffle">[ shuffle ]</button>
          <button class="btn" data-action="q-repeat" title="repeat">[ repeat: ${prefs.repeat} ]</button>
          <button class="btn btn-ghost" data-action="q-clear" title="clear queue">[ clear ]</button>
          <label class="small muted" title="auto-scroll to playing">
            <input type="checkbox" id="autoScroll" ${prefs.autoScroll?'checked':''}/> auto-scroll
          </label>
        </div>
        <div class="small">
          <span id="nowPlaying" class="muted"></span> · queue <span id="qPos">0</span>/<span id="qLen">0</span>${prefs.filterTag? ` · tag: #${esc(prefs.filterTag)}`:''}
        </div>
      </div>
    </div>
  `;
  grid.appendChild(left);

  const right = document.createElement('div');
  const sInfo = await storageInfo();
  right.innerHTML = `
    <div class="box">
      <div class="muted small">compose</div>
      <form id="postForm" class="stack" autocomplete="off">
        <input class="field" id="f_title" placeholder="Title (song or album)" required maxlength="120" />
        <input class="field" id="f_artist" placeholder="Artist" maxlength="120"/>
        <input class="field" id="f_url" placeholder="Link (YouTube / Spotify / Bandcamp / SoundCloud / direct .mp3)" required/>
        <input class="field" id="f_tags" placeholder="tags (space/comma or #tag #chill #2020)"/>
        <textarea class="field" id="f_body" rows="4" placeholder="Why should we listen?"></textarea>
        <div class="hstack">
          <button class="btn" type="submit">[ post ]</button>
          <button class="btn btn-ghost" type="button" id="previewBtn">[ preview player ]</button>
        </div>
        <div id="preview" class="player" aria-live="polite"></div>
      </form>
    </div>
    <div class="box" id="tagsBox">
      <div class="hstack" style="justify-content:space-between; align-items:center">
        <div class="muted small">tags</div>
        ${prefs.filterTag ? `<button class="btn btn-ghost small" data-action="clear-tag">[ clear tag ]</button>`: ''}
      </div>
      <div id="tags" class="hstack" style="margin-top:6px; flex-wrap:wrap"></div>
    </div>
    <div class="box">
      <div class="muted small">data & settings</div>
      <div class="hstack" style="margin-top:6px; flex-wrap:wrap">
        <button class="btn" data-action="export">[ export json ]</button>
        <label class="btn btn-ghost">
          <input type="file" id="importFile" accept="application/json" class="sr-only" />
          <span>[ import (replace) ]</span>
        </label>
        <button class="btn btn-ghost" data-action="reset">[ reset all ]</button>
      </div>
      <div class="small muted" style="margin-top:8px">${sInfo.text}</div>
      ${sInfo.percent !== null ?
        `<div class="meter" style="margin-top:6px"><span style="width:${sInfo.percent}%"></span></div>` : ''
      }
    </div>
    <div class="notice small">
      Tip: Works with YouTube (watch / youtu.be / shorts), Spotify (tracks/albums/playlists), Bandcamp (page or EmbeddedPlayer URL), SoundCloud, or direct audio files. ${DB.isRemote ? 'Data is synced with Supabase.' : 'Everything stays in LocalStorage.'}
    </div>
  `;
  grid.appendChild(right);

  root.appendChild(grid);

  // FEED
  state.page = 1;
  renderFeed($('#feed'), $('#pager'));
  renderTags($('#tags'));

  // Dock initial
  updateDock();

  // Search/sort
  $('#search').addEventListener('input', debounce((e)=>{
    savePrefs({search: e.target.value});
    state.page = 1;
    renderFeed($('#feed'), $('#pager'));
  }, 120));

  $('#sort').addEventListener('change', (e)=>{
    savePrefs({sort: e.target.value});
    state.page = 1;
    renderFeed($('#feed'), $('#pager'));
  });

  // Preview button
  right.querySelector('#previewBtn').addEventListener('click', ()=>{
    const url = $('#f_url').value.trim();
    const preview = $('#preview');
    if(!url){ preview.classList.remove('active'); preview.innerHTML=''; return; }
    preview.classList.add('active');
    const fakePost = { provider: parseProvider(url), url };
    buildEmbed(fakePost, preview);
  });

  // Autofill metadata from oEmbed on URL input
  const f_url = right.querySelector('#f_url');
  let lastMetaUrl = '';
  let lastAutofill = { title: '', artist: '' };
  const f_title = right.querySelector('#f_title');
  const f_artist = right.querySelector('#f_artist');

  // Track if user has manually edited fields after autofill
  let userEdited = { title: false, artist: false };
  f_title.addEventListener('input', () => { userEdited.title = true; });
  f_artist.addEventListener('input', () => { userEdited.artist = true; });

  f_url.addEventListener('input', async () => {
    const url = f_url.value.trim();
    if (!url || url === lastMetaUrl) return;
    lastMetaUrl = url;
    const { fetchOEmbed } = await import('../oembed.js');
    const meta = await fetchOEmbed(url);
    if (meta) {
      let ytArtist = '', ytTitle = '';
      if (/youtube\.com|youtu\.be/.test(url)) {
        const { parseYouTubeTitle } = await import('../yt_title_parse.js');
        const parsed = parseYouTubeTitle(meta);
        ytArtist = parsed.artist;
        ytTitle = parsed.title;
      }
      if ((ytTitle || meta.title) && (!userEdited.title || f_title.value === lastAutofill.title)) {
        f_title.value = ytTitle || meta.title;
        lastAutofill.title = f_title.value;
        userEdited.title = false;
      }
      if ((ytArtist || meta.author_name) && (!userEdited.artist || f_artist.value === lastAutofill.artist)) {
        f_artist.value = ytArtist || meta.author_name;
        lastAutofill.artist = f_artist.value;
        userEdited.artist = false;
      }
    }
  });

  // Import (delegated here)
  right.querySelector('#importFile').addEventListener('change', onImport);

  // Auto-scroll toggle
  const chk = $('#autoScroll'); if(chk){ chk.onchange = () => savePrefs({autoScroll: chk.checked}); }

  // Help overlay close
  document.querySelector('[data-close-help]')?.addEventListener('click', ()=> document.getElementById('help').classList.remove('active'));
  document.getElementById('help')?.addEventListener('click', (e)=>{ if(e.target.id==='help') document.getElementById('help').classList.remove('active'); });
}