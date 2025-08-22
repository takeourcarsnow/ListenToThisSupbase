// js/views/main_view_compose.js
import { PROMPTS } from '../core/constants.js';
import { $, esc } from '../core/utils.js';
import { onCreatePost } from '../features/posts.js';
import { parseProvider } from '../features/providers.js';

function getComposePrompt() {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}

export function renderComposeBox(right, state, DB, render) {
  const me = state.user;

  if (!me) {
    const guest = document.createElement('div');
    guest.className = 'box';
    guest.innerHTML = `
      <div class="muted small" id="composePromptGuest"></div>
      <div class="notice small">You are in guest read-only mode. Login to post, like, or comment.</div>
      <button class="btn btn-ghost" data-action="go-login">[ login / register ]</button>
    `;
    right.appendChild(guest);
    // Looping prompt for guest
    const promptDiv = guest.querySelector('#composePromptGuest');
    let lastPrompt = '';
    function setPrompt() {
      let prompt;
      do { prompt = getComposePrompt(); } while (prompt === lastPrompt && PROMPTS.length > 1);
      lastPrompt = prompt;
      // Typewriter effect
      let i = 0;
      promptDiv.textContent = '';
      promptDiv.classList.remove('fadein', 'fadeout');
      function typeWriter() {
        if (i < prompt.length) {
          promptDiv.textContent += prompt.charAt(i);
          i++;
          // Simulate human typing: random delay, longer on spaces/punctuation
          let delay = 28 + Math.random() * 40;
          if (/[.,!?]/.test(prompt.charAt(i-1))) delay += 80 + Math.random() * 60;
          if (prompt.charAt(i-1) === ' ') delay += 30;
          setTimeout(typeWriter, delay);
        }
      }
      typeWriter();
    }
    setPrompt();
    setInterval(setPrompt, 10000);
    return;
  }

  const box = document.createElement('div');
  box.className = 'box';
  box.innerHTML = `
    <div class="muted small typewriter" id="composePrompt" style="margin-bottom:18px;"></div>
    <form id="postForm" class="stack" autocomplete="off">
      <input class="field" id="f_url" placeholder="Link (YouTube / Spotify / Bandcamp, etc)" required/>
  <div class="muted small" id="autofillMsg" style="margin-bottom:2px; display:none;">&#8593; Auto-fills artist & title.</div>
      <input class="field" id="f_artist" placeholder="Artist" maxlength="120" style="margin-top:8px;" />
      <input class="field" id="f_title" placeholder="Title (song or album)" required maxlength="120" />
      <input class="field" id="f_tags" placeholder="#Tags go here"/>
      <div id="tagSuggestions" class="hstack" style="flex-wrap:wrap; gap:4px; margin:4px 0 0 0;"></div>
      <div style="position:relative;">
        <textarea class="field" id="f_body" rows="4" placeholder="Share something about this track, a memory, or the vibe it gives you." maxlength="200" oninput="document.getElementById('bodyCounter').textContent = this.value.length + '/200';"></textarea>
        <span class="muted small" id="bodyCounter" style="position:absolute; bottom:6px; right:10px; pointer-events:none;">0/200</span>
      </div>
      <div class="hstack" style="justify-content:space-between; align-items:center; margin-bottom:4px;">
        <div class="muted small" id="captchaBox" style="margin:0;"></div>
      </div>
      <input class="field" id="f_captcha" placeholder="Enter captcha answer" autocomplete="off" style="margin-bottom:2px;" />
      <div id="postFormError" class="muted small" style="color:#c00;min-height:18px;"></div>
      <div class="hstack" style="justify-content:center; margin-top:1px; gap:10px;">
        <button class="btn" type="submit" id="postBtn">[ post ]</button>
        <button class="btn btn-ghost" type="button" id="previewBtn">[ preview ]</button>
      </div>
      <div id="preview" class="player" aria-live="polite"></div>
      <div id="postCooldown" class="muted small" style="text-align:center;margin-top:8px;"></div>
    </form>
  `;
  // Cooldown logic: disable post button and show timer if user posted in last 24h
  function updateCooldown() {
    const db = DB.getAll();
    const me = state.user;
    const postBtn = box.querySelector('#postBtn');
    const cooldownDiv = box.querySelector('#postCooldown');
    if (!me) return;
    const now = Date.now();
    const lastPost = db.posts
      .filter(p => p.userId === me.id)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (lastPost && now - lastPost.createdAt < 24 * 60 * 60 * 1000) {
      const timeLeft = 24 * 60 * 60 * 1000 - (now - lastPost.createdAt);
      const hours = Math.floor(timeLeft / (60 * 60 * 1000));
      const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
      if (postBtn) postBtn.disabled = true;
      if (cooldownDiv) cooldownDiv.textContent = `You can post again in ${hours}h ${minutes}m ${seconds}s.`;
    } else {
      if (postBtn) postBtn.disabled = false;
      if (cooldownDiv) cooldownDiv.textContent = '';
    }
  }
  setInterval(updateCooldown, 1000);
  updateCooldown();
  // Looping prompt for logged-in user, but only if not focused in any composer field
  const promptDiv = box.querySelector('#composePrompt');
  let lastPrompt = '';
  const composerFields = [
    box.querySelector('#f_url'),
    box.querySelector('#f_title'),
    box.querySelector('#f_artist'),
    box.querySelector('#f_tags'),
    box.querySelector('#f_body')
  ];
  let promptTimeouts = [];
  function clearPromptTimeouts() {
    promptTimeouts.forEach(t => clearTimeout(t));
    promptTimeouts = [];
  }
  function setPrompt() {
    clearPromptTimeouts();
    let prompt;
    do { prompt = getComposePrompt(); } while (prompt === lastPrompt && PROMPTS.length > 1);
    lastPrompt = prompt;
    // Typewriter + backspace effect
    let i = 0;
    promptDiv.textContent = '';
    promptDiv.classList.remove('fadein', 'fadeout');
    if (!promptDiv.classList.contains('typewriter')) promptDiv.classList.add('typewriter');
    function typeWriter() {
      if (i < prompt.length) {
        promptDiv.textContent += prompt.charAt(i);
        i++;
        // More human-like: variable speed, longer pauses, random short pauses
        let delay = 16 + Math.random() * 32;
        if (/[.,!?]/.test(prompt.charAt(i-1))) delay += 90 + Math.random() * 60;
        if (prompt.charAt(i-1) === ' ') delay += 18 + Math.random() * 10;
        // Occasionally pause for a bit longer (simulate thinking)
        if (Math.random() < 0.07) delay += 80 + Math.random() * 120;
        promptTimeouts.push(setTimeout(typeWriter, delay));
      } else {
        // After finished, wait longer, then backspace
        promptTimeouts.push(setTimeout(() => {
          let del = prompt.length;
          let stopAt = 0;
          if (prompt.startsWith('> ')) stopAt = 2;
          function backspace() {
            if (del > stopAt) {
              promptDiv.textContent = promptDiv.textContent.slice(0, -1);
              del--;
              let delay = 13 + Math.random() * 22;
              if (promptDiv.textContent.endsWith(' ')) delay += 12;
              // Occasionally pause while erasing
              if (Math.random() < 0.05) delay += 60 + Math.random() * 80;
              promptTimeouts.push(setTimeout(backspace, delay));
            } else {
              // Wait, then start new prompt
              promptTimeouts.push(setTimeout(setPrompt, 900));
            }
          }
          backspace();
        }, 2600 + Math.random() * 700));
      }
    }
    typeWriter();
  }
  setPrompt();
  // Show autofill message only when user is interacting with the composer
  const autofillMsg = box.querySelector('#autofillMsg');
  composerFields.forEach(field => {
    if (field) {
      field.addEventListener('focus', () => {
        const urlField = composerFields.find(f => f && f.id === 'f_url');
        if (urlField && !urlField.value) {
          autofillMsg.style.display = 'block';
        } else {
          autofillMsg.style.display = 'none';
        }
      });
      if (field.id === 'f_url') {
        field.addEventListener('input', () => {
          if (field.value) {
            autofillMsg.style.display = 'none';
          } else {
            autofillMsg.style.display = 'block';
          }
        });
      }
      field.addEventListener('blur', () => {
        setTimeout(() => {
          // Only hide if no composer field is focused
          if (!composerFields.some(f => f && document.activeElement === f)) {
            autofillMsg.style.display = 'none';
          }
        }, 50);
        // Also, if user leaves all fields, allow prompt to update again
        setTimeout(() => {
          if (!composerFields.some(f => f && document.activeElement === f)) setPrompt();
        }, 60);
      });
    }
  });
  right.appendChild(box);

  // Full post preview
  const previewBtn = box.querySelector('#previewBtn');
  if (previewBtn) {
    previewBtn.addEventListener('click', async () => {
      const preview = $('#preview');
      const title = $('#f_title').value.trim();
      const artist = $('#f_artist').value.trim();
      const url = $('#f_url').value.trim();
      const tags = ($('#f_tags').value || '').split(/[#\s,]+/g).map(t => t.trim().toLowerCase()).filter(Boolean);
      const body = $('#f_body').value.trim();
      const pv = parseProvider(url);
      const fakePost = {
        id: 'preview',
        userId: (state.user && state.user.id) || 'preview',
        title, artist, url, provider: pv, tags, body,
        likes: [], comments: [], createdAt: Date.now(),
      };

      const mod = await import('../features/feed.js');
      preview.classList.add('active');
      let html = mod.renderPostHTML(fakePost, state, DB);
      html = html.replace(/<div class="actions[\s\S]*?<\/div>/, ''); // strip actions
      html = `<div class="muted small" style="margin-bottom:4px;">Preview Post</div>` + html;
      preview.innerHTML = html;
    });
  }

  // oEmbed autofill for title/artist
  const f_url = box.querySelector('#f_url');
  if (f_url) {
    let lastMetaUrl = '';
    let lastAutofill = { title: '', artist: '' };
    const f_title = box.querySelector('#f_title');
    const f_artist = box.querySelector('#f_artist');
    let userEdited = { title: false, artist: false };

    // Helper: reset autofill state if all fields are empty
    function maybeResetAutofill() {
      if (!f_url.value.trim() && !f_title.value.trim() && !f_artist.value.trim()) {
        lastMetaUrl = '';
        lastAutofill = { title: '', artist: '' };
        userEdited = { title: false, artist: false };
      }
    }

    f_title.addEventListener('input', () => { userEdited.title = true; });
    f_artist.addEventListener('input', () => { userEdited.artist = true; });

    // Reset autofill state if any of the three fields are cleared
    [f_url, f_title, f_artist].forEach(field => {
      field.addEventListener('input', maybeResetAutofill);
    });

    f_url.addEventListener('input', async () => {
      const url = f_url.value.trim();
      if (!url) {
        lastMetaUrl = '';
        return;
      }
      if (url === lastMetaUrl) return;
      lastMetaUrl = url;

      const { fetchOEmbed } = await import('../features/oembed.js');
      const meta = await fetchOEmbed(url);
      if (meta) {
        let ytArtist = '', ytTitle = '';
        if (/youtube\.com|youtu\.be/.test(url)) {
          const { parseYouTubeTitle } = await import('../features/yt_title_parse.js');
          const parsed = parseYouTubeTitle(meta);
          ytArtist = parsed.artist;
          ytTitle = parsed.title;
          // Clean up artist if it ends with ' - Topic'
          if (ytArtist && ytArtist.endsWith(' - Topic')) {
            ytArtist = ytArtist.replace(/ - Topic$/, '').trim();
          }
        }
        // Prefer parsed title/artist, fallback to oEmbed
        let autofillTitle = ytTitle || meta.title;
        let autofillArtist = ytArtist || meta.author_name || '';
        // Clean up oEmbed author_name if it ends with ' - Topic'
        if (!ytArtist && autofillArtist.endsWith(' - Topic')) {
          autofillArtist = autofillArtist.replace(/ - Topic$/, '').trim();
        }
        if ((autofillTitle) && (!userEdited.title || f_title.value === lastAutofill.title)) {
          f_title.value = autofillTitle;
          lastAutofill.title = f_title.value;
          userEdited.title = false;
        }
        if ((autofillArtist) && (!userEdited.artist || f_artist.value === lastAutofill.artist)) {
          f_artist.value = autofillArtist;
          lastAutofill.artist = f_artist.value;
          userEdited.artist = false;
        }
      }
    });
  }

  // Captcha
  function setCaptcha() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    box.querySelector('#captchaBox').textContent = `Captcha: What is ${a} + ${b}?`;
    box.querySelector('#captchaBox').dataset.answer = (a + b).toString();
    box.querySelector('#f_captcha').value = '';
  }
  setCaptcha();

  // Post submit + reset captcha
  const postForm = box.querySelector('#postForm');
  if (postForm) {
    postForm.addEventListener('submit', (e) => onCreatePost(e, state, DB, render));
    postForm.addEventListener('resetCaptcha', setCaptcha);
  }

  // Tag suggestions
  const f_tags = box.querySelector('#f_tags');
  const tagSuggestions = box.querySelector('#tagSuggestions');
  if (f_tags && tagSuggestions) {
    // Helper to deduplicate tags in the input
    function dedupeTagsInput() {
      let val = f_tags.value;
      // Split by space/comma, remove empty, lowercase, keep #
      let tags = val.split(/[#\s,]+/g).map(t => t.trim().toLowerCase()).filter(Boolean);
      // Remove duplicates, preserve order
      let seen = new Set();
      let deduped = [];
      for (let t of tags) {
        if (!seen.has(t)) {
          seen.add(t);
          deduped.push('#' + t);
        }
      }
      // Join with space, add trailing space if input had it
      let trailing = /[\s,]$/.test(val) ? ' ' : '';
      f_tags.value = deduped.join(' ') + trailing;
    }
  function getPopularTags() {
      const db = DB.getAll();
      const m = new Map();
      db.posts.forEach(p => (p.tags || []).forEach(t => m.set(t, (m.get(t) || 0) + 1)));
      return Array.from(m.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 20)
        .map(([t]) => t);
    }
    function renderTagSuggestions(filter = '') {
      const tags = getPopularTags();
      // Get tags already used in the input (ignore #, split by space/comma)
      const usedTags = (f_tags.value || '').split(/[#\s,]+/g).map(t => t.trim().toLowerCase()).filter(Boolean);
      // Filter out used tags
      let filtered = tags.filter(t => !usedTags.includes(t.toLowerCase()));
      // Further filter by input if needed
      if (filter) filtered = filtered.filter(t => t.toLowerCase().includes(filter.toLowerCase()));
      if (filtered.length === 0) {
        tagSuggestions.innerHTML = '';
        tagSuggestions.style.display = 'none';
        return;
      }
      tagSuggestions.innerHTML = filtered.map(t => `<span class="tag small tag-suggestion" style="cursor:pointer;">#${esc(t)}</span>`).join(' ');
      tagSuggestions.style.display = 'flex';
    }
    function maybeShowSuggestions() {
      const val = f_tags.value;
      if (document.activeElement === f_tags || val.length > 0) {
        const last = val.split(/[, ]/).pop().replace(/^#/, '');
        renderTagSuggestions(last);
      } else {
        tagSuggestions.style.display = 'none';
      }
    }
    f_tags.addEventListener('input', () => {
      dedupeTagsInput();
      maybeShowSuggestions();
    });
    f_tags.addEventListener('focus', maybeShowSuggestions);
    f_tags.addEventListener('blur', () => setTimeout(() => { tagSuggestions.style.display = 'none'; }, 100));
    tagSuggestions.addEventListener('mousedown', (e) => e.preventDefault());
    tagSuggestions.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-suggestion')) {
        let current = f_tags.value;
        let tag = e.target.textContent.replace(/^#/, '');
        // Find the last partial tag (after last space/comma)
        let before = current.slice(0, f_tags.selectionStart).replace(/[#]*([^#\s,]*)$/, '');
        let after = current.slice(f_tags.selectionStart);
        // Remove any trailing spaces in before
        before = before.replace(/[\s,]*$/, '');
        // Compose new value: before + space + #tag + (space if after is empty or whitespace)
        let newVal = before;
        if (newVal && !/\s$/.test(newVal)) newVal += ' ';
        newVal += '#' + tag;
        // If after is not empty and not just whitespace, add a space
        if (after && !/^\s*$/.test(after)) newVal += ' ';
        // Add the after part if it exists and is not just whitespace
        if (after && !/^\s*$/.test(after)) newVal += after;
        f_tags.value = newVal.trim() + ' ';
        f_tags.dispatchEvent(new Event('input'));
        f_tags.focus();
      }
    });
    tagSuggestions.style.display = 'none';
  }
}