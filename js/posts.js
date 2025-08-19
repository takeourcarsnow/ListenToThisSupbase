// js/posts.js
import DB from './db.js';
import { parseProvider } from './providers.js';
import { uid } from './utils.js';
import { state } from './state.js';
import { render } from './render.js';

export async function onCreatePost(e){
  e.preventDefault();
  const db = DB.getAll();
  const me = state.user;
  const title = document.getElementById('f_title').value.trim();
  const artist = document.getElementById('f_artist').value.trim();
  let url = document.getElementById('f_url').value.trim();
  const body = document.getElementById('f_body').value.trim();
  let tags = (document.getElementById('f_tags').value || '').trim();
  if(!title || !url){ return; }

  // Strip query params for YouTube
  if (/youtube\.com|youtu\.be/.test(url)) {
    const qm = url.indexOf('?');
    if (qm !== -1) url = url.slice(0, qm);
  }

  const provider = parseProvider(url);
  tags = tags
    .split(/[#,\s]+/g)
    .map(t=>t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0,12);

  const dup = db.posts.find(p =>
    p.url.trim() === url ||
    (p.provider && provider && p.provider.provider === provider.provider && p.provider.id === provider.id && p.provider.kind === provider.kind)
  );
  if(dup){
    if(!confirm('This link looks like a duplicate. Add anyway?')) {
      setTimeout(()=>{
        const el = document.getElementById('post-'+dup.id);
        if(el){
          el.classList.add('highlight');
          el.scrollIntoView({block:'start'});
          setTimeout(()=>el.classList.remove('highlight'), 1500);
        }
      }, 10);
      return;
    }
  }

  const post = {
    id: uid('p'),
    userId: me.id,
    title, artist, url,
    provider,
    tags,
    body,
    likes: [],
    comments: [],
    createdAt: Date.now()
  };
  await DB.createPost(post);

  // reset form and preview
  document.getElementById('f_title').value='';
  document.getElementById('f_artist').value='';
  document.getElementById('f_url').value='';
  document.getElementById('f_tags').value='';
  document.getElementById('f_body').value='';
  const preview = document.getElementById('preview');
  if (preview) { preview.classList.remove('active'); preview.innerHTML=''; }

  await render();

  setTimeout(()=>{
    const el = document.getElementById('post-'+post.id);
    if(el){
      el.classList.add('highlight');
      el.scrollIntoView({block:'start'});
      setTimeout(()=>el.classList.remove('highlight'), 1500);
    }
  }, 10);
}