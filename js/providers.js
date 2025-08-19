// --- Provider detection & embed building ---

function safeURL(u) {
  try { return new URL(u); } catch { return null; }
}

function isHTTPOrigin(origin) {
  return typeof origin === 'string' && /^https?:\/\//i.test(origin);
}

// --- Modern robust provider detection ---
export function parseProvider(url) {
  const u = (url || '').trim();
  const l = u.toLowerCase();
  const parsed = safeURL(u);

  // Direct audio
  if (/\.(mp3|ogg|wav|m4a)(?:$|\?)/i.test(l)) return { provider: 'audio', id: u };

  // YouTube and Shorts
  if (parsed && /(^|\.)youtube\.com$|(^|\.)m\.youtube\.com$|(^|\.)music\.youtube\.com$|(^|\.)youtu\.be$/.test(parsed.hostname)) {
    const sp = parsed.searchParams;
    const list = sp.get('list');
    const path = parsed.pathname.replace(/\/+$/, '');

    // Playlist detection
    if (list && (/\/playlist$/i.test(path) || (!sp.get('v') && !/\/watch$/i.test(path)))) {
      return { provider: 'youtube_playlist', id: list };
    }

    // Extract video ID
    let id = sp.get('v');
    if (!id && /\/shorts\//i.test(path)) {
      id = path.split('/').filter(Boolean).pop();
    }
    if (!id && /\/embed\//i.test(path)) {
      id = path.split('/').filter(Boolean).pop();
    }
    if (!id && /youtu\.be$/i.test(parsed.hostname)) {
      id = path.split('/').filter(Boolean).shift();
    }

    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
      return { provider: 'youtube', id };
    }
    // Fallback: if list only
    if (list) return { provider: 'youtube_playlist', id: list };
  }

  // Spotify
  if (parsed && /(^|\.)open\.spotify\.com$/.test(parsed.hostname)) {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const kind = parts[0].toLowerCase(); // track|album|playlist|episode|show
      const id = parts[1];
      if (/^(track|album|playlist|episode|show)$/i.test(kind) && id) {
        return { provider: 'spotify', kind, id };
      }
    }
  }

  // Bandcamp (page or EmbeddedPlayer URL)
  if (parsed && /bandcamp\.com$/i.test(parsed.hostname) || /bandcamp\.com$/i.test(l)) {
    return { provider: 'bandcamp', id: u };
  }

  // SoundCloud
  if (parsed && /(^|\.)soundcloud\.com$/.test(parsed.hostname) || /soundcloud\.com/i.test(l)) {
    return { provider: 'soundcloud', id: u };
  }

  // Fallback
  return { provider: 'link', id: u };
}

// --- Robust embedder ---
export function buildEmbed(post, container, opts = {}) {
  const p = post.provider || parseProvider(post.url || post.id || '');
  const wrap = container;
  // cleanup any previous listeners
  try { wrap._cleanup && wrap._cleanup(); } catch {}
  wrap._cleanup = null;
  wrap.innerHTML = '';
  const autoplay = !!opts.autoplay;

  // YouTube video
  if (p.provider === 'youtube') {
    const origin = isHTTPOrigin(location.origin) ? location.origin : 'https://localhost';
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      enablejsapi: '1',
      origin,
    });
    if (autoplay) {
      params.set('autoplay', '1');
      // params.set('mute', '1'); // removed to allow sound on start
    }
    const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(p.id)}?${params.toString()}`;

    const ifr = document.createElement('iframe');
    ifr.className = 'yt';
    ifr.src = src;
    ifr.frameBorder = '0';
    ifr.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    ifr.allowFullscreen = true;
    ifr.loading = 'lazy';
    ifr.referrerPolicy = 'strict-origin-when-cross-origin';
    ifr.style.width = '100%';
    ifr.style.aspectRatio = '16/9';

    wrap.appendChild(ifr);

    // Support queueNext on end using postMessage events
    if (typeof opts.onEnded === 'function') {
      const onMessage = (ev) => {
        if (ev.source !== ifr.contentWindow) return;
        let data = ev.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch {}
        }
        if (!data || typeof data !== 'object') return;

        if (data.event === 'onStateChange' && data.info === 0) {
          // ended
          opts.onEnded();
        }
      };
      const postListening = () => {
        try {
          ifr.contentWindow && ifr.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
        } catch {}
      };
      window.addEventListener('message', onMessage);
      ifr.addEventListener('load', postListening);
      // also try after a tick
      setTimeout(postListening, 500);

      wrap._cleanup = () => {
        window.removeEventListener('message', onMessage);
      };
    }
    return;
  }

  // YouTube playlist
  if (p.provider === 'youtube_playlist') {
    const params = new URLSearchParams({ list: p.id, rel: '0', modestbranding: '1', playsinline: '1' });
    if (autoplay) params.set('autoplay', '1');
    const src = `https://www.youtube-nocookie.com/embed/videoseries?${params.toString()}`;
    wrap.innerHTML = `
      <iframe class="yt" src="${src}" frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"
        style="width:100%;aspect-ratio:16/9;"></iframe>
    `;
    return;
  }

  // Spotify
  if (p.provider === 'spotify') {
    const src = `https://open.spotify.com/embed/${p.kind}/${p.id}`;
    wrap.innerHTML = `
      <iframe class="sp" src="${src}" frameborder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy" referrerpolicy="strict-origin-when-cross-origin"
        style="width:100%;min-height:80px;"></iframe>
    `;
    return;
  }

  // Bandcamp (oEmbed)
  if (p.provider === 'bandcamp') {
    fetch(`https://bandcamp.com/oembed?format=json&url=${encodeURIComponent(post.url || p.id)}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.html) {
          wrap.innerHTML = data.html;
          const ifr = wrap.querySelector('iframe');
          if (ifr) {
            ifr.removeAttribute('width');
            ifr.removeAttribute('height');
            ifr.style.width = '100%';
            ifr.style.aspectRatio = '1.9/1';
            ifr.loading = 'lazy';
            ifr.referrerPolicy = 'strict-origin-when-cross-origin';
          }
        } else {
          fallbackLink(p.id, wrap, 'Open on Bandcamp');
        }
      })
      .catch(() => fallbackLink(p.id, wrap, 'Open on Bandcamp'));
    return;
  }

  // SoundCloud (oEmbed)
  if (p.provider === 'soundcloud') {
    fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(post.url || p.id)}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.html) {
          wrap.innerHTML = data.html;
          const ifr = wrap.querySelector('iframe');
          if (ifr) {
            ifr.style.width = '100%';
            ifr.loading = 'lazy';
            ifr.referrerPolicy = 'strict-origin-when-cross-origin';
          }
        } else {
          fallbackLink(p.id, wrap, 'Open on SoundCloud');
        }
      })
      .catch(() => fallbackLink(p.id, wrap, 'Open on SoundCloud'));
    return;
  }

  // Direct audio
  if (p.provider === 'audio') {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.className = 'audio';
    audio.src = p.id;
    audio.preload = 'metadata';
    audio.playsInline = true;
    if (autoplay) setTimeout(() => { audio.play().catch(() => {}); }, 0);
    audio.addEventListener('ended', () => { if (typeof opts.onEnded === 'function') opts.onEnded(); });
    wrap.appendChild(audio);
    return;
  }

  // Fallback: just a link
  fallbackLink(post.url || p.id, wrap, 'Open link');
}

function fallbackLink(href, wrap, label) {
  wrap.innerHTML = '';
  const a = document.createElement('a');
  a.href = href;
  a.textContent = label;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  wrap.appendChild(a);
}