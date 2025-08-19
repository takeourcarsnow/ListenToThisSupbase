
// --- Modern robust provider detection ---
export function parseProvider(url) {
  const u = url.trim();
  const l = u.toLowerCase();

  // Direct audio
  if (/\.(mp3|ogg|wav|m4a)($|\?)/i.test(l)) return { provider: 'audio', id: u };

  // YouTube
  let m = l.match(/[?&]v=([a-z0-9_-]{11})/i)
    || l.match(/youtu\.be\/([a-z0-9_-]{11})/i)
    || l.match(/\/shorts\/([a-z0-9_-]{11})/i);
  if (m) return { provider: 'youtube', id: m[1] };
  m = l.match(/[?&]list=([a-z0-9_-]+)/i);
  if (l.includes('youtube.com') && m) return { provider: 'youtube_playlist', id: m[1] };

  // Spotify
  m = l.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-z0-9]+)/i);
  if (m) return { provider: 'spotify', kind: m[1].toLowerCase(), id: m[2] };

  // Bandcamp (track or album page)
  if (/bandcamp\.com\//.test(l)) return { provider: 'bandcamp', id: u };

  // SoundCloud
  if (/soundcloud\.com\//.test(l)) return { provider: 'soundcloud', id: u };

  // Fallback
  return { provider: 'link', id: u };
}

// --- Modern robust embedder ---
export function buildEmbed(post, container, opts = {}) {
  const p = post.provider;
  const wrap = container;
  wrap.innerHTML = '';
  const autoplay = !!opts.autoplay;

  // YouTube video
  if (p.provider === 'youtube') {
    const src = `https://www.youtube.com/embed/${encodeURIComponent(p.id)}?rel=0&modestbranding=1${autoplay ? '&autoplay=1' : ''}`;
    wrap.innerHTML = `<iframe class="yt" src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" style="width:100%;aspect-ratio:16/9;"></iframe>`;
    return;
  }
  // YouTube playlist
  if (p.provider === 'youtube_playlist') {
    const src = `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(p.id)}`;
    wrap.innerHTML = `<iframe class="yt" src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" style="width:100%;aspect-ratio:16/9;"></iframe>`;
    return;
  }
  // Spotify
  if (p.provider === 'spotify') {
    const src = `https://open.spotify.com/embed/${p.kind}/${p.id}`;
    wrap.innerHTML = `<iframe class="sp" src="${src}" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" style="width:100%;min-height:80px;"></iframe>`;
    return;
  }
  // Bandcamp (oEmbed)
  if (p.provider === 'bandcamp') {
    // Use Bandcamp's oEmbed endpoint
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
  fallbackLink(p.id, wrap, p.id);
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