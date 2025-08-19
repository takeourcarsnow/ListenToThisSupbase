import { safeClone } from './utils.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, USE_SUPABASE } from './config.js';

const DB_KEY_V2 = 'ascii.fm/db@v2';
const DB_KEY_V1 = 'ascii.fm/v1';

const defaultDB = { users:[], posts:[], createdAt: Date.now(), version: 2 };

class LocalAdapter {
  constructor(){ this.cache = null; this.isRemote = false; }

  async init(){
    if(this.cache) return this.cache;
    const v2 = localStorage.getItem(DB_KEY_V2);
    if(v2){
      try { this.cache = JSON.parse(v2); }
      catch { this.cache = safeClone(defaultDB); }
      return this.cache;
    }
    const v1 = localStorage.getItem(DB_KEY_V1);
    if(v1){
      try{
        const old = JSON.parse(v1);
        this.cache = { ...defaultDB, ...old, version:2 };
        await this._save();
      }catch{
        this.cache = safeClone(defaultDB);
      }
      return this.cache;
    }
    this.cache = safeClone(defaultDB);
    return this.cache;
  }
  getAll(){ return this.cache || defaultDB; }
  async refresh(){ return this.cache; }
  async _save(){ try{ localStorage.setItem(DB_KEY_V2, JSON.stringify(this.cache)); }catch{} }

  async ensureUser(name, email, password) {
    await this.init();
    let u = this.cache.users.find(x => x.name.toLowerCase() === name.toLowerCase() || (email && x.email === email));
    if (!u) {
      u = {
        id: crypto.randomUUID ? crypto.randomUUID() : 'u_' + Math.random().toString(36).slice(2),
        name: name.trim(),
        email: email || '',
        password: password || '', // Not secure, demo only
        createdAt: Date.now()
      };
      this.cache.users.push(u); await this._save();
    }
    return u;
  }

  async loginUser(email, password) {
    await this.init();
    return this.cache.users.find(u => u.email === email && u.password === password) || null;
  }
  getUserById(id){ return (this.cache?.users || []).find(u=>u.id===id) || null; }

  async createPost(p){ await this.init(); this.cache.posts.push(p); await this._save(); return p; }
  async updatePost(id, patch){
    await this.init();
    const i = this.cache.posts.findIndex(x=>x.id===id);
    if(i<0) return null;
    this.cache.posts[i] = { ...this.cache.posts[i], ...patch };
    await this._save();
    return this.cache.posts[i];
  }
  async deletePost(id){
    await this.init();
    const i = this.cache.posts.findIndex(x=>x.id===id);
    if(i<0) return;
    this.cache.posts.splice(i,1);
    await this._save();
  }
  async toggleLike(id, userId){
    await this.init();
    const p = this.cache.posts.find(x=>x.id===id);
    if(!p) return null;
    p.likes = p.likes || [];
    const i = p.likes.indexOf(userId);
    if(i>=0) p.likes.splice(i,1); else p.likes.push(userId);
    await this._save();
    return p;
  }
  async addComment(id, c){
    await this.init();
    const p = this.cache.posts.find(x=>x.id===id);
    if(!p) return null;
    p.comments = p.comments || [];
    p.comments.push(c);
    await this._save();
    return p.comments;
  }
  async replaceAll(data){
    this.cache = { version:2, createdAt: Date.now(), users: data.users||[], posts: data.posts||[] };
    await this._save();
  }
  exportJSON(){
    return JSON.stringify(this.cache || defaultDB, null, 2);
  }
}

class SupabaseAdapter {
  constructor(url, key){
    this.isRemote = true;
    this.supabase = null;
    this.cache = { ...defaultDB };
    this.url = url;
    this.key = key;
  }
  async init(){
    if(!this.supabase){
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      this.supabase = createClient(this.url, this.key);
    }
    await this.refresh();
    return this.cache;
  }
  mapRowToPost(row){
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      artist: row.artist,
      url: row.url,
      provider: row.provider || null,
      tags: row.tags || [],
      body: row.body || '',
      likes: row.likes || [],
      comments: row.comments || [],
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    };
  }
  mapPostToRow(p){
    return {
      id: p.id,
      user_id: p.userId,
      title: p.title,
      artist: p.artist || null,
      url: p.url,
      provider: p.provider || null,
      tags: p.tags || [],
      body: p.body || null,
      likes: p.likes || [],
      comments: p.comments || [],
      created_at: new Date(p.createdAt || Date.now()).toISOString(),
    };
  }
  mapRowToUser(row){
    return { id: row.id, name: row.name, createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now() };
  }

  async refresh(){
    const [uRes, pRes] = await Promise.all([
      this.supabase.from('users').select('*').order('created_at', { ascending: true }),
      this.supabase.from('posts').select('*').order('created_at', { ascending: false }),
    ]);
    if(uRes.error) console.warn('Supabase users error', uRes.error);
    if(pRes.error) console.warn('Supabase posts error', pRes.error);
    const users = (uRes.data||[]).map(r=>this.mapRowToUser(r));
    const posts = (pRes.data||[]).map(r=>this.mapRowToPost(r));
    this.cache = { version:2, createdAt: this.cache.createdAt || Date.now(), users, posts };
    return this.cache;
  }
  getAll(){ return this.cache; }

  async ensureUser(name){
    const existing = this.cache.users.find(u=>u.name.toLowerCase() === name.toLowerCase());
    if(existing) return existing;
    const user = { id: crypto.randomUUID ? crypto.randomUUID() : 'u_'+Math.random().toString(36).slice(2), name: name.trim(), createdAt: Date.now() };
    const { error } = await this.supabase.from('users').insert({
      id: user.id, name: user.name, created_at: new Date(user.createdAt).toISOString()
    });
    if(error) console.warn('ensureUser insert failed', error);
    this.cache.users.push(user);
    return user;
  }
  getUserById(id){ return this.cache.users.find(u=>u.id===id) || null; }

  async createPost(post){
    const row = this.mapPostToRow(post);
    const { error } = await this.supabase.from('posts').insert(row);
    if(error) console.error('createPost error', error);
    await this.refresh();
    return this.cache.posts.find(p=>p.id===post.id);
  }
  async updatePost(id, patch){
    const cur = this.cache.posts.find(p=>p.id===id);
    if(!cur) return null;
    const next = { ...cur, ...patch };
    const row = this.mapPostToRow(next);
    const { error } = await this.supabase.from('posts').update(row).eq('id', id);
    if(error) console.error('updatePost error', error);
    await this.refresh();
    return this.cache.posts.find(p=>p.id===id);
  }
  async deletePost(id){
    const { error } = await this.supabase.from('posts').delete().eq('id', id);
    if(error) console.error('deletePost error', error);
    await this.refresh();
  }
  async toggleLike(id, userId){
    const cur = this.cache.posts.find(p=>p.id===id);
    if(!cur) return null;
    const likes = Array.isArray(cur.likes) ? [...cur.likes] : [];
    const i = likes.indexOf(userId);
    if(i>=0) likes.splice(i,1); else likes.push(userId);
    const { error } = await this.supabase.from('posts').update({ likes }).eq('id', id);
    if(error) console.error('toggleLike error', error);
    await this.refresh();
    return this.cache.posts.find(p=>p.id===id);
  }
  async addComment(id, c){
    const cur = this.cache.posts.find(p=>p.id===id);
    if(!cur) return null;
    const comments = Array.isArray(cur.comments) ? [...cur.comments] : [];
    comments.push(c);
    const { error } = await this.supabase.from('posts').update({ comments }).eq('id', id);
    if(error) console.error('addComment error', error);
    await this.refresh();
    const p = this.cache.posts.find(p=>p.id===id);
    return p ? p.comments : comments;
  }

  async replaceAll(data){
    // Dangerous: clears all data. Intended for import/replace.
    await this.supabase.from('posts').delete().neq('id','');
    await this.supabase.from('users').delete().neq('id','');

    const users = (data.users||[]).map(u => ({ id:u.id, name:u.name, created_at: new Date(u.createdAt||Date.now()).toISOString() }));
    if(users.length){
      const { error } = await this.supabase.from('users').upsert(users);
      if(error) console.error('replaceAll users error', error);
    }

    const posts = (data.posts||[]).map(p => ({
      ...this.mapPostToRow(p)
    }));
    if(posts.length){
      const { error } = await this.supabase.from('posts').upsert(posts);
      if(error) console.error('replaceAll posts error', error);
    }

    await this.refresh();
  }
  exportJSON(){
    return JSON.stringify(this.cache, null, 2);
  }
}

const DB = (USE_SUPABASE && SUPABASE_URL && SUPABASE_ANON_KEY)
  ? new SupabaseAdapter(SUPABASE_URL, SUPABASE_ANON_KEY)
  : new LocalAdapter();

export default DB;