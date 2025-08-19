// js/seed.js
import DB from './db.js';
import { parseProvider } from './providers.js';
import { uid } from './utils.js';
import { state } from './state.js';
import { setSession } from './session.js';
import { render } from './render.js';

export async function seedDemo(){
  const me = state.user || await DB.ensureUser('demo');
  if(!state.user) { setSession({userId: me.id}); state.user = me; }

  const samples = [
    {
      title:'Selected Ambient Works 85 - 92', artist:'Aphex Twin',
      url:'https://www.youtube.com/watch?v=Xw5AiRVqfqk',
      tags:['idm','electronic','techno'], body:'Richard D James early work. A must hear.',
    },
    {
      title:'Šlamantys', artist:'Mesijus',
      url:'https://open.spotify.com/track/64rMCuIiJVT49SjLhmrHdW',
      tags:['hiphop','rap','lithuanian'], body:'Lithuanian version of MF Doom.'
    },
    {
      title:'Pints of Guiness Make You Strong', artist:'Against Me!',
      url:'https://againstme.bandcamp.com/track/pints-of-guiness-make-you-strong',
      tags:['punk','folk'], body:'The punk classic!'
    },
    {
      title:'Giant Steps',
      artist:'John Coltrane',
      url:'https://www.youtube.com/watch?v=xy_fxxj1mMY',
      tags:['jazz','bebop'],
      body:'One of the greatest jazz albums of all time.'
    },
    {
      title:'Mania',
      artist:'ChildsMind',
      url:'https://soundcloud.com/childsmindmusic/mania',
      tags:['electronic','techno'], body:'Some fun techno from Soundcloud.'
    }
  ];

  // Clear posts, keep users (remote: replaceAll clears both so preserve users)
  if(DB.isRemote && DB.replaceAll){
    const users = DB.getAll().users;
    await DB.replaceAll({ users, posts: [] });
  } else if(DB.getAll && DB.getAll().posts) {
    DB.getAll().posts.length = 0;
    await DB.refresh();
  }

  let firstId = null;
  for(const [i, s] of samples.entries()){
    const provider = parseProvider(s.url);
    const post = {
      id: uid('p'),
      userId: me.id,
      title: s.title, artist: s.artist, url: s.url,
      provider, tags: s.tags, body: s.body,
      likes:[], comments:[], createdAt: Date.now()
    };
    if(i === 0) firstId = post.id;
    await DB.createPost(post);
  }
  await DB.refresh();
  await render();
  setTimeout(() => {
    const btn = document.querySelector(`#post-${firstId} [data-action="toggle-player"]`);
    if(btn) btn.click();
  }, 600);
}