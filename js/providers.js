// Embeds + provider parsing
export function parseProvider(url){
  const u = url.trim();
  const l = u.toLowerCase();

  if(/\.(mp3|ogg|wav|m4a)($|\?)/i.test(l)) return {provider:'audio', kind:'file', id:u};

  if(/bandcamp\.com\/embeddedplayer/i.test(l)) return {provider:'bandcamp', kind:'embed', id:u};

  if(/soundcloud\.com\//i.test(l)) return {provider:'soundcloud', kind:'oembed', id:u};

  let m = l.match(/[?&]v=([a-z0-9_-]{11})/i)
        || l.match(/youtu\.be\/([a-z0-9_-]{11})/i)
        || l.match(/\/shorts\/([a-z0-9_-]{11})/i);
  if(m) return {provider:'youtube', kind:'video', id:m[1]};

  m = l.match(/[?&]list=([a-z0-9_-]+)/i);
  if(l.includes('youtube.com') && m) return {provider:'youtube', kind:'playlist', id:m[1]};

  m = l.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-z0-9]+)(\?|$)/i);
  if(m) return {provider:'spotify', kind:m[1].toLowerCase(), id:m[2]};

  if(l.includes('bandcamp.com')) return {provider:'bandcamp', kind:'oembed', id:u};

  return {provider:'link', kind:'url', id:u};
}

export function buildEmbed(post, container, opts={}){
  const p = post.provider;
  const wrap = container;
  wrap.innerHTML = '';
  wrap.classList.remove('bc');
  const autoplay = !!opts.autoplay;

  if(p.provider==='youtube'){
    const base = (p.kind==='playlist')
      ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(p.id)}`
      : `https://www.youtube.com/embed/${encodeURIComponent(p.id)}?rel=0&modestbranding=1`;
    const src = base + (autoplay && p.kind!=='playlist' ? (base.includes('?') ? '&' : '?') + 'autoplay=1' : '');
    const ifr = document.createElement('iframe');
    ifr.className = 'yt';
    ifr.src = src;
    ifr.loading = 'lazy';
    ifr.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    ifr.referrerPolicy = 'strict-origin-when-cross-origin';
    ifr.allowFullscreen = true;
    wrap.appendChild(ifr);
  } else if(p.provider==='spotify'){
    const src = `https://open.spotify.com/embed/${p.kind}/${p.id}`;
    const ifr = document.createElement('iframe');
    ifr.className = 'sp';
    ifr.src = src;
    ifr.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    ifr.loading = 'lazy';
    ifr.referrerPolicy = 'strict-origin-when-cross-origin';
    wrap.appendChild(ifr);
  } else if(p.provider==='bandcamp' && p.kind==='oembed'){
    wrap.classList.add('bc');
    bcOEmbed('https://bandcamp.com/oembed', p.id, function(html){
      if(!html){ return fallbackLink(p.id, wrap, 'Open on Bandcamp'); }
      wrap.innerHTML = html;
      const ifr = wrap.querySelector('iframe');
      if(ifr){
        ifr.removeAttribute('width');
        ifr.removeAttribute('height');
        ifr.style.width='100%';
        ifr.style.aspectRatio = '1.9/1';
        ifr.loading = 'lazy';
        ifr.referrerPolicy = 'strict-origin-when-cross-origin';
      }
    });
  } else if(p.provider==='bandcamp' && p.kind==='embed'){
    const ifr = document.createElement('iframe');
    ifr.src = p.id;
    ifr.style.width = '100%';
    ifr.style.aspectRatio = '1.9/1';
    ifr.loading = 'lazy';
    ifr.referrerPolicy = 'strict-origin-when-cross-origin';
    wrap.appendChild(ifr);
  } else if(p.provider==='soundcloud'){
    oEmbedJSONP('https://soundcloud.com/oembed', p.id, function(html){
      if(!html){ return fallbackLink(p.id, wrap, 'Open on SoundCloud'); }
      wrap.innerHTML = html;
      const ifr = wrap.querySelector('iframe');
      if(ifr){
        ifr.loading = 'lazy';
        ifr.referrerPolicy = 'strict-origin-when-cross-origin';
        ifr.style.width='100%';
      }
    });
  } else if(p.provider==='audio'){
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.className = 'audio';
    audio.src = p.id;
    audio.preload = 'metadata';
    audio.playsInline = true;
    if(autoplay){
      setTimeout(()=> { audio.play().catch(()=>{}); }, 0);
    }
    audio.addEventListener('ended', ()=> {
      if(typeof opts.onEnded === 'function') opts.onEnded();
    });
    wrap.appendChild(audio);
  } else {
    fallbackLink(p.id, wrap, p.id);
  }
}

function fallbackLink(href, wrap, label){
  const a = document.createElement('a');
  a.href = href; a.textContent = label;
  a.target = '_blank'; a.rel = 'noopener noreferrer';
  wrap.innerHTML = '';
  wrap.appendChild(a);
}

function bcOEmbed(endpoint, url, cb){
  const cbName = 'bc_cb_' + Math.random().toString(36).slice(2);
  const s = document.createElement('script');
  s.src = `${endpoint}?format=json&url=${encodeURIComponent(url)}&callback=${cbName}`;
  let done = false;
  window[cbName] = function(data){
    done = true;
    try{ cb(data && data.html ? data.html : null); }finally{ cleanup(); }
  };
  s.onerror = function(){ if(!done) cb(null); cleanup(); };
  function cleanup(){ delete window[cbName]; s.remove(); }
  document.body.appendChild(s);
}
function oEmbedJSONP(endpoint, url, cb){
  const cbName = 'oembed_cb_' + Math.random().toString(36).slice(2);
  const s = document.createElement('script');
  s.src = `${endpoint}?format=json&url=${encodeURIComponent(url)}&callback=${cbName}`;
  let done = false;
  window[cbName] = function(data){
    done = true;
    try{ cb(data && data.html ? data.html : null); }finally{ cleanup(); }
  };
  s.onerror = function(){ if(!done) cb(null); cleanup(); };
  function cleanup(){ delete window[cbName]; s.remove(); }
  document.body.appendChild(s);
}