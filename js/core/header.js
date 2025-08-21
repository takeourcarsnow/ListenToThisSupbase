// Header module: injects the header HTML into the page
export function renderHeader() {
  const headerHTML = `
    <div class="header-modern">
      <img src="/assets/logo.png" alt="tunedIn.space logo" class="login-logo-anim header-logo-anim" style="width:44px; height:44px; object-fit:contain; display:block; margin:0 auto 8px auto;" />
      <div class="logo">tunedIn.space</div>
      <div class="subtitle">tune in to music <span class="dot">&amp;</span> community that you care about</div>
    </div>
    <div class="header-bar"></div>
  `;
  const header = document.createElement('header');
  header.setAttribute('role', 'banner');
  header.innerHTML = headerHTML;
  document.querySelector('.wrap').prepend(header);
}

// Main app container module: ensures #app and #live exist
export function renderMainContainers() {
  const wrap = document.querySelector('.wrap');
  if (!document.getElementById('app')) {
    const main = document.createElement('main');
    main.id = 'app';
    main.setAttribute('role', 'main');
    wrap.appendChild(main);
  }
  if (!document.getElementById('live')) {
    const live = document.createElement('div');
    live.id = 'live';
    live.className = 'sr-only';
    live.setAttribute('aria-live', 'polite');
    wrap.appendChild(live);
  }
}
