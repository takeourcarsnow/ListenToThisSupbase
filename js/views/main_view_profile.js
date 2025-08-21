// js/views/main_view_profile.js
import { esc } from '../core/utils.js';

export function renderProfileBox(right, state, DB, render) {
  const db = DB.getAll();
  const me = state.user;
  if (!me) return;

  const meUser = db.users.find(u => u.id === me.id) || null;
  const myAbout = meUser?.about || '';
  const myAvatar = meUser?.avatarUrl || '/favicon-32x32.png';
  const socials = {
    facebook: meUser?.facebook || '',
    instagram: meUser?.instagram || '',
    twitter: meUser?.twitter || '',
    bandcamp: meUser?.bandcamp || '',
    soundcloud: meUser?.soundcloud || '',
    youtube: meUser?.youtube || ''
  };

  function renderSocialLinks(s) {
    const icons = { facebook: '🌐', instagram: '📸', twitter: '🐦', bandcamp: '🎵', soundcloud: '☁️', youtube: '▶️' };
    return Object.entries(s)
      .filter(([_, v]) => v)
      .map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener" class="social-link" title="${k}">${icons[k]}</a>`)
      .join(' ');
  }

  const box = document.createElement('div');
  box.className = 'box';
  box.id = 'aboutBox';
  box.innerHTML = `
    <div class="muted small">> my profile</div>
    <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:8px;">
      <img class="profile-avatar-small" src="${esc(myAvatar)}" alt="avatar" />
    </div>
    <div id="aboutCollapsed" style="display:flex; flex-direction:column; gap:8px; min-height:38px;">
      <div id="aboutText" class="about-preview">${
        myAbout ? esc(myAbout).replace(/\n/g, '<br>') : '<span class="muted small">no about yet.</span>'
      }</div>
      <div id="aboutSocials">${renderSocialLinks(socials) || '<span class="muted small">no social links</span>'}</div>
      <button class="btn btn-ghost small" id="editAboutBtn" type="button">[ edit ]</button>
    </div>
    <form class="stack" id="aboutEditForm" data-action="profile-form" autocomplete="off" style="display:none; margin-top:8px;" enctype="multipart/form-data">
      <label class="muted small" style="margin-bottom:4px;">Change avatar:</label>
      <input class="field" type="file" id="avatarFile" name="avatar" accept="image/*" style="margin-bottom:8px;" />
      <textarea class="field" id="aboutMe" name="about" rows="3" maxlength="500" placeholder="Write a short bio...">${esc(myAbout)}</textarea>
      <input class="field" type="text" id="socialFacebook" name="facebook" placeholder="Facebook username or URL" value="${esc(socials.facebook)}" />
      <input class="field" type="text" id="socialInstagram" name="instagram" placeholder="Instagram username or URL" value="${esc(socials.instagram)}" />
      <input class="field" type="text" id="socialTwitter" name="twitter" placeholder="Twitter username or URL" value="${esc(socials.twitter)}" />
      <input class="field" type="text" id="socialBandcamp" name="bandcamp" placeholder="Bandcamp username or URL" value="${esc(socials.bandcamp)}" />
      <input class="field" type="text" id="socialSoundcloud" name="soundcloud" placeholder="SoundCloud username or URL" value="${esc(socials.soundcloud)}" />
      <input class="field" type="text" id="socialYoutube" name="youtube" placeholder="YouTube username or URL" value="${esc(socials.youtube)}" />
      <div class="muted small" style="margin-top:4px;">You can enter just your username (e.g. <b>nefotografija</b>) or a full URL for each social field.</div>
      <div class="hstack">
        <button class="btn" type="submit">[ save about ]</button>
        <button class="btn btn-ghost small" id="cancelAboutBtn" type="button">[ cancel ]</button>
        <span class="muted small" id="profileMsg"></span>
      </div>
    </form>
  `;
  right.appendChild(box);

  const aboutCollapsed = box.querySelector('#aboutCollapsed');
  const aboutEditForm = box.querySelector('#aboutEditForm');
  const editBtn = box.querySelector('#editAboutBtn');
  const cancelBtn = box.querySelector('#cancelAboutBtn');

  editBtn.addEventListener('click', () => {
    aboutCollapsed.style.display = 'none';
    aboutEditForm.style.display = '';
    aboutEditForm.querySelector('#aboutMe').focus();
  });
  cancelBtn.addEventListener('click', () => {
    aboutEditForm.style.display = 'none';
    aboutCollapsed.style.display = 'flex';
  });

  function formatSocial(val, type) {
    const input = (val || '').trim();
    if (!input) return '';
    if (/^https?:\/\//i.test(input)) return input;
    switch (type) {
      case 'facebook': return 'https://facebook.com/' + input.replace(/^@/, '');
      case 'instagram': return 'https://instagram.com/' + input.replace(/^@/, '');
      case 'twitter': return 'https://twitter.com/' + input.replace(/^@/, '');
      case 'bandcamp': return 'https://' + input.replace(/^https?:\/\//, '').replace(/\/$/, '') + '.bandcamp.com/';
      case 'soundcloud': return 'https://soundcloud.com/' + input.replace(/^@/, '');
      case 'youtube': return 'https://youtube.com/' + input.replace(/^@/, '');
      default: return input;
    }
  }

  aboutEditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = aboutEditForm;
    const about = form.querySelector('#aboutMe').value;
    const facebook = formatSocial(form.querySelector('#socialFacebook').value, 'facebook');
    const instagram = formatSocial(form.querySelector('#socialInstagram').value, 'instagram');
    const twitter = formatSocial(form.querySelector('#socialTwitter').value, 'twitter');
    const bandcamp = formatSocial(form.querySelector('#socialBandcamp').value, 'bandcamp');
    const soundcloud = formatSocial(form.querySelector('#socialSoundcloud').value, 'soundcloud');
    const youtube = formatSocial(form.querySelector('#socialYoutube').value, 'youtube');

    await DB.updateUser(me.id, { about, facebook, instagram, twitter, bandcamp, soundcloud, youtube });
    setTimeout(() => {
      aboutEditForm.style.display = 'none';
      aboutCollapsed.style.display = 'flex';
      if (typeof render === 'function') render();
    }, 100);
  });
}