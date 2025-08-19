// js/importExport.js
import DB from './db.js';
import { approxSize, fmtBytes } from './utils.js';
import { state } from './state.js';

export async function onImport(e){
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    if(!data || !Array.isArray(data.posts) || !Array.isArray(data.users)){
      alert('Invalid export file.'); return;
    }
    await DB.replaceAll({ ...data, version: 2 });
    state.queue = [];
    state.qIndex = 0;
    await DB.refresh();
    // Caller (main) will re-render after import by calling render() if desired.
    alert(DB.isRemote ? 'Imported to Supabase' : 'Imported.');
    location.reload(); // simplest way to refresh everything safely
  }catch(err){
    console.error(err);
    alert('Import failed.');
  }finally{
    e.target.value = '';
  }
}

export async function storageInfo(){
  if(DB.isRemote){
    return { text: 'Data synced with Supabase. Preferences and session are saved locally.', percent: null };
  }
  try{
    if(navigator.storage && navigator.storage.estimate){
      const est = await navigator.storage.estimate();
      const used = est.usage || 0;
      const quota = est.quota || 0;
      const pct = quota ? Math.min(100, Math.round((used/quota)*100)) : null;
      return {
        text: `Storage approx: ${fmtBytes(used)}${quota ? ' of '+fmtBytes(quota) : ''} used · Local-only.`,
        percent: pct
      };
    }
  }catch{}
  const raw = (localStorage.getItem('ascii.fm/db@v2') || '') + (localStorage.getItem('ascii.fm/prefs@v2') || '');
  return { text: 'Storage approx: ' + approxSize(raw) + ' · Local-only.', percent: null };
}