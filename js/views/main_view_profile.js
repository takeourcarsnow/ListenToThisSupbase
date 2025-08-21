// js/views/main_view_profile.js
import { esc } from '../core/utils.js';

export function renderProfileBox(right, state, DB, render) {
  // Extract username from URL or return as-is if already a username
  function getSocialUsername(val, type) {
    if (!val) return '';
    let v = val.trim();
    if (!v) return '';
    // Remove protocol
    v = v.replace(/^https?:\/\//i, '');
    switch (type) {
      case 'facebook':
        v = v.replace(/^(www\.)?facebook\.com\//i, '');
        break;
      case 'instagram':
        v = v.replace(/^(www\.)?instagram\.com\//i, '');
        break;
      case 'twitter':
        v = v.replace(/^(www\.)?twitter\.com\//i, '');
        break;
      case 'bandcamp':
        v = v.replace(/^(www\.)?([^\.]+)\.bandcamp\.com.*/i, '$2');
        break;
      case 'soundcloud':
        v = v.replace(/^(www\.)?soundcloud\.com\//i, '');
        break;
      case 'youtube':
        v = v.replace(/^(www\.)?youtube\.com\//i, '');
        break;
      default:
        break;
    }
    // Remove trailing slashes and @, then add @ for display
    v = v.replace(/^@/, '').replace(/\/$/, '');
    return v ? '@' + v : '';
  }
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
      <fieldset class="social-links-group" style="border:1px dashed var(--line); border-radius:8px; padding:12px; margin:12px 0;">
        <legend class="muted small" style="padding:0 8px;">Social Links</legend>
        <div class="social-fields" style="display:grid; grid-template-columns:1fr; gap:8px;">
          <label><span class="sr-only">Facebook</span>
            <input class="field" type="text" id="socialFb" name="fb_user" placeholder="Facebook username or URL" value="${esc(getSocialUsername(socials.facebook, 'facebook'))}" autocomplete="username" />
          </label>
          <label><span class="sr-only">Instagram</span>
            <input class="field" type="text" id="socialInsta" name="insta_user" placeholder="Instagram username or URL" value="${esc(getSocialUsername(socials.instagram, 'instagram'))}" autocomplete="username" />
          </label>
          <label><span class="sr-only">Twitter</span>
            <input class="field" type="text" id="socialTwtr" name="twtr_user" placeholder="Twitter username or URL" value="${esc(getSocialUsername(socials.twitter, 'twitter'))}" autocomplete="username" />
          </label>
          <label><span class="sr-only">Bandcamp</span>
            <input class="field" type="text" id="socialBandcamp" name="bc_user" placeholder="Bandcamp username or URL" value="${esc(getSocialUsername(socials.bandcamp, 'bandcamp'))}" autocomplete="username" />
          </label>
          <label><span class="sr-only">SoundCloud</span>
            <input class="field" type="text" id="socialSoundcloud" name="sc_user" placeholder="SoundCloud username or URL" value="${esc(getSocialUsername(socials.soundcloud, 'soundcloud'))}" autocomplete="username" />
          </label>
          <label><span class="sr-only">YouTube</span>
            <input class="field" type="text" id="socialYoutube" name="yt_user" placeholder="YouTube username or URL" value="${esc(getSocialUsername(socials.youtube, 'youtube'))}" autocomplete="username" />
          </label>
        </div>
        <div class="muted small" style="margin-top:8px;">You can enter just your username (e.g. <b>nefotografija</b>) or a full URL for each social field.</div>
      </fieldset>
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
    // Prevent auto-focus on mobile devices (avoid keyboard pop-up)
    if (!/Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
      aboutEditForm.querySelector('#aboutMe').focus();
    }
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