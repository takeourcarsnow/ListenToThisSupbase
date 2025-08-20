let helpClickBound = false;

export function openHelpOverlay() {
  const help = document.getElementById('help');
  if (help) help.classList.add('active');
}

export function closeHelpOverlay() {
  const help = document.getElementById('help');
  if (help) help.classList.remove('active');
}

export function bindHelpOverlay() {
  const helpOverlay = document.getElementById('help');
  if (helpOverlay) {
    helpOverlay.onclick = function (e) {
      if (e.target === helpOverlay) closeHelpOverlay();
    };
  }
  if (!helpClickBound) {
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-close-help]')) closeHelpOverlay();
    });
    helpClickBound = true;
  }
}