import { savePrefs } from './prefs.js';
import { applyAccent } from './utils.js';

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
  palette.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.close) { palette.remove(); return; }
    const c = b.dataset.color;
    savePrefs({ accent: c });
    applyAccent(c);
  });
}