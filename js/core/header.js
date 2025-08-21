// Header module: injects the header HTML into the page
export function renderHeader() {
  // Use Unicode box-drawing for perfect frame, and wrap with invisible comment markers
  const headerHTML = `
    <img src="/assets/logo.png" alt="Logo" class="login-logo-anim header-logo-anim" style="width:44px; height:44px; object-fit:contain; display:block; margin:0 auto 8px auto;" />
    <pre id="ascii-banner" class="head ascii-banner" aria-hidden="true" style="font-family:'Fira Mono','Consolas','Menlo','Monaco','Liberation Mono',monospace !important;font-size:1.15em;line-height:1.1;letter-spacing:0;white-space:pre;overflow-x:auto;margin:0 auto 8px auto;max-width:100vw;">
<!--ascii-start-->
+------------ tunedIn.space --+
| overshare your  music taste |
+-----------------------------+
<!--ascii-end-->
    </pre>
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
