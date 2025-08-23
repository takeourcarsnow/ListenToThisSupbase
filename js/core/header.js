// Header module: injects the header HTML into the page
export function renderHeader() {
  // Use Unicode box-drawing for perfect frame, and wrap with invisible comment markers
  // Frame width: 36 chars (between | and |)
  const frameWidth = 41;
  function padLine(str) {
    // Remove any HTML tags for length calculation
    const plain = str.replace(/<[^>]*>/g, '');
    const len = plain.length;
    if (len < frameWidth) {
      const pad = frameWidth - len;
      const left = Math.floor(pad / 2);
      const right = pad - left;
      return '&nbsp;'.repeat(left) + str + '&nbsp;'.repeat(right);
    }
    return str;
  }
  const initialMsg = 'You can post once per day! Make it count!';
  const headerHTML = `
    <img src="/assets/logo.png" alt="Logo" class="login-logo-anim header-logo-anim" style="width:44px; height:44px; object-fit:contain; display:block; margin:0 auto 8px auto;" />
    <pre id="ascii-banner" class="head ascii-banner" aria-hidden="false" style="font-family:'Fira Mono','Consolas','Menlo','Monaco','Liberation Mono',monospace !important;font-size:1em;line-height:1.1;letter-spacing:0;white-space:pre;overflow-x:auto;margin:0 auto 8px auto;max-width:100vw;">
<!--ascii-start-->
●--------------------------- TunedIn.space --●
| <span id="ascii-post-limit">${padLine(initialMsg)}</span> |
●--------------------------------------------●
<!--ascii-end-->
    </pre>
  `;
  // Animate and update the ascii-post-limit line
  setTimeout(() => {
    const info = document.getElementById('ascii-post-limit');
    if (!info) return;
  let hover = false;
  let lastType = '';
  const readyMessages = [
      "Time’s up! Drop your freshest tune.",
      "The stage is yours—share your music!",
      "Ready to post? Let’s hear what you’ve got!",
      "Mic’s on. What are you listening to today?",
      "It’s posting time - bring the vibes!",
      "Your post window is open. Make it count!",
      "Go on, share your soundtrack for today.",
      "Let’s see what’s spinning in your world!",
      "You’re up! What’s your tune of the day?",
      "Spotlight’s on you—post your music pick!"
    ];
  let readyMsgIndex = 0;
  let readyMsgAnimTimer = null;
  let readyMsgFading = false;
    // Add fade animation style if not present
    if (!document.getElementById('ascii-post-limit-fade-style')) {
      const style = document.createElement('style');
      style.id = 'ascii-post-limit-fade-style';
      style.textContent = `
        #ascii-post-limit.fade { transition: opacity 0.35s cubic-bezier(.4,0,.2,1); opacity: 0.25; }
        #ascii-post-limit { font-family: inherit; }
      `;
      document.head.appendChild(style);
    }
    function getCountdown() {
      if (!window.DB || !window.state || !window.state.user) return '';
      const db = window.DB.getAll ? window.DB.getAll() : { posts: [] };
      const me = window.state.user;
      const now = Date.now();
      const lastPost = (db.posts || []).filter(p => p.userId === me.id).sort((a, b) => b.createdAt - a.createdAt)[0];
      if (lastPost && now - lastPost.createdAt < 24 * 60 * 60 * 1000) {
        const timeLeft = 24 * 60 * 60 * 1000 - (now - lastPost.createdAt);
        const hours = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
        return `${hours}h ${minutes}m ${seconds}s`;
      }
      return '';
    }
    function padLine(str) {
      // Remove any HTML tags for length calculation
      const plain = str.replace(/<[^>]*>/g, '');
      const len = plain.length;
      if (len < frameWidth) {
        const pad = frameWidth - len;
        const left = Math.floor(pad / 2);
        const right = pad - left;
        return '\u00A0'.repeat(left) + str + '\u00A0'.repeat(right);
      }
      return str;
    }
    function setTextWithFade(newText, typeChanged) {
      // Only update if changed
      if (info.innerHTML === newText) return;
      // Only fade for ready messages, not for countdown/info
      if (typeChanged && (lastType === 'ready' || typeChanged === 'ready')) {
        readyMsgFading = true;
        info.classList.add('fade');
        setTimeout(() => {
          info.innerHTML = newText;
          info.classList.remove('fade');
          setTimeout(() => { readyMsgFading = false; }, 350); // allow fade in to finish
        }, 350); // fade out duration
      } else {
        info.innerHTML = newText;
      }
    }
    function updatePostLimitInfo() {
      let newText, type;
      // If guest (no user), animate ready messages as if post window is open
      if (!window.DB || !window.state || !window.state.user) {
        // Animate ready messages for guests
        if (!readyMsgAnimTimer && lastType !== 'ready') {
          newText = padLine('You can post once per day! Make it count!');
          type = 'ready';
          readyMsgAnimTimer = setTimeout(() => {
            let nextIndex;
            do {
              nextIndex = Math.floor(Math.random() * readyMessages.length);
            } while (readyMessages.length > 1 && nextIndex === readyMsgIndex);
            readyMsgIndex = nextIndex;
            updatePostLimitInfo();
            // Start the normal animation loop
            const scheduleNext = () => {
              const nextDelay = 4500 + Math.random() * 3500;
              readyMsgAnimTimer = setTimeout(() => {
                if (!readyMsgFading) {
                  let nextIndex;
                  do {
                    nextIndex = Math.floor(Math.random() * readyMessages.length);
                  } while (readyMessages.length > 1 && nextIndex === readyMsgIndex);
                  readyMsgIndex = nextIndex;
                  updatePostLimitInfo();
                  scheduleNext();
                } else {
                  readyMsgAnimTimer = setTimeout(scheduleNext, 500);
                }
              }, nextDelay);
            };
            scheduleNext();
          }, 4500 + Math.random() * 3500);
        } else if (readyMsgAnimTimer) {
          newText = padLine(readyMessages[readyMsgIndex]);
          type = 'ready';
        }
      } else {
        const countdown = getCountdown();
        if (countdown) {
          if (readyMsgAnimTimer) {
            clearTimeout(readyMsgAnimTimer);
            readyMsgAnimTimer = null;
          }
          if (hover) {
            newText = padLine(`Time left: ${countdown}`);
            type = 'countdown';
          } else {
            newText = padLine('You can post once per day! Make it count!');
            type = 'info';
          }
        } else {
          // Show the initial message for a full interval, then start animating ready messages
          if (!readyMsgAnimTimer && lastType !== 'ready') {
            newText = padLine('You can post once per day! Make it count!');
            type = 'ready';
            // After a full interval, start the animation
            readyMsgAnimTimer = setTimeout(() => {
              let nextIndex;
              do {
                nextIndex = Math.floor(Math.random() * readyMessages.length);
              } while (readyMessages.length > 1 && nextIndex === readyMsgIndex);
              readyMsgIndex = nextIndex;
              updatePostLimitInfo();
              // Now start the normal animation loop
              const scheduleNext = () => {
                const nextDelay = 4500 + Math.random() * 3500;
                readyMsgAnimTimer = setTimeout(() => {
                  if (!readyMsgFading) {
                    let nextIndex;
                    do {
                      nextIndex = Math.floor(Math.random() * readyMessages.length);
                    } while (readyMessages.length > 1 && nextIndex === readyMsgIndex);
                    readyMsgIndex = nextIndex;
                    updatePostLimitInfo();
                    scheduleNext();
                  } else {
                    readyMsgAnimTimer = setTimeout(scheduleNext, 500);
                  }
                }, nextDelay);
              };
              scheduleNext();
            }, 4500 + Math.random() * 3500);
          } else if (readyMsgAnimTimer) {
            newText = padLine(readyMessages[readyMsgIndex]);
            type = 'ready';
          }
        }
      }
      const typeChanged = type !== lastType;
      lastType = type;
      setTextWithFade(newText, typeChanged);
    }
  info.addEventListener('mouseenter', () => { hover = true; updatePostLimitInfo(); });
  info.addEventListener('mouseleave', () => { hover = false; updatePostLimitInfo(); });
  updatePostLimitInfo();
  setInterval(updatePostLimitInfo, 1000);
  }, 0);
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
