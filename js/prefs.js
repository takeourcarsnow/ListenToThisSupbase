// js/prefs.js
import { safeClone, applyAccent, applyDensity } from './utils.js';

export const PREF_KEY = 'ascii.fm/prefs@v2';

export const defaultPrefs = {
  autoScroll: true,
  sort: 'new', // new | likes | comments
  search: '',
  filterTag: null,
  accent: '#8ab4ff',
  density: 'cozy',
  shuffle: false,
  repeat: 'off' // off | all | one
};

let PREFS = null;

export function loadPrefs() {
  if (PREFS) return PREFS;
  const raw = localStorage.getItem(PREF_KEY);
  if (!raw) {
    PREFS = safeClone(defaultPrefs);
  } else {
    try {
      PREFS = { ...defaultPrefs, ...JSON.parse(raw) };
    } catch {
      PREFS = safeClone(defaultPrefs);
    }
  }
  applyAccent(PREFS.accent);
  applyDensity(PREFS.density);
  return PREFS;
}

export function savePrefs(patch) {
  PREFS = { ...loadPrefs(), ...patch };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(PREFS)); } catch {}
  if ('accent' in patch) applyAccent(PREFS.accent);
  if ('density' in patch) applyDensity(PREFS.density);
}

// Small UI helper to pick accent color
export function pickAccent() {
  const colors = ['#8ab4ff','#ff79c6','#7ab6ff','#7bd389','#ffd166','#ff6b6b','#c792ea','#64d2ff','#f4a261','#00e5ff'];
  const palette = document.createElement('div');
  palette.className = 'box';
  palette.style.position='fixed';
  palette.style.right='16px';
  palette.style.top='16px';
  palette.style.zIndex='9999';
  palette.innerHTML = `
    <div class="small muted">choose accent</div>
    <div class="hstack" style="margin-top:6px; flex-wrap:wrap">
      ${colors.map(c=>`<button class="btn" data-color="${c}" style="background:${c}20;border-color:${c}80;color:${c}">●</button>`).join('')}
      <button class="btn btn-ghost" data-close="1">[ close ]</button>
    </div>
  `;
  document.body.appendChild(palette);
  palette.addEventListener('click', (e)=>{
    const b = e.target.closest('button');
    if(!b) return;
    if(b.dataset.close){ palette.remove(); return; }
    const c = b.dataset.color;
    savePrefs({ accent: c });
    applyAccent(c);
  });
}