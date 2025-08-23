// Enable mouse drag-to-scroll for .tag-cloud on desktop
export function enableTagCloudDragScroll(tagCloud) {
  if (!tagCloud) tagCloud = document.querySelector('.tag-cloud');
  if (!tagCloud) return;
// Attach to window for global use
if (typeof window !== 'undefined') {
  window.enableTagCloudDragScroll = enableTagCloudDragScroll;
}
  let isDown = false;
  let startX;
  let scrollLeft;
  let tagCloudRect;
  let lastX = 0;
  let lastMoveTime = 0;
  let velocity = 0;
  let momentumFrame = null;
  let dragStarted = false;
  // Lower drag threshold for mobile to reduce delay
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const DRAG_THRESHOLD = isMobile ? 1 : 5; // px

  // Mouse events
  tagCloud.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left mouse button
    isDown = true;
    tagCloud.classList.add('dragging');
    tagCloudRect = tagCloud.getBoundingClientRect();
    startX = e.pageX - tagCloudRect.left;
    scrollLeft = tagCloud.scrollLeft;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    if (!tagCloudRect) tagCloudRect = tagCloud.getBoundingClientRect();
    const x = e.pageX - tagCloudRect.left;
    const walk = (x - startX) * 1.2; // scroll speed for mouse
    tagCloud.scrollLeft = scrollLeft - walk;
  });
  document.addEventListener('mouseup', () => {
    isDown = false;
    tagCloud.classList.remove('dragging');
    tagCloudRect = null;
  });

  // Touch events (1:1 mapping, more natural, with momentum)
  tagCloud.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    isDown = true;
    dragStarted = false;
    tagCloud.classList.add('dragging');
    tagCloudRect = tagCloud.getBoundingClientRect();
    startX = e.touches[0].pageX - tagCloudRect.left;
    scrollLeft = tagCloud.scrollLeft;
    lastX = startX;
    lastMoveTime = Date.now();
    velocity = 0;
    if (momentumFrame) {
      cancelAnimationFrame(momentumFrame);
      momentumFrame = null;
    }
  }, { passive: false });
  tagCloud.addEventListener('touchmove', (e) => {
    if (!isDown || e.touches.length !== 1) return;
    if (!tagCloudRect) tagCloudRect = tagCloud.getBoundingClientRect();
    const x = e.touches[0].pageX - tagCloudRect.left;
    if (!dragStarted) {
      if (Math.abs(x - startX) > DRAG_THRESHOLD) {
        dragStarted = true;
        // Re-anchor drag to current position for immediate follow
        startX = x;
        scrollLeft = tagCloud.scrollLeft;
      } else {
        return; // Don't scroll until threshold passed
      }
    }
    const walk = (x - startX); // 1:1 for touch
    tagCloud.scrollLeft = scrollLeft - walk;
    // Calculate velocity for momentum
    const now = Date.now();
    velocity = (x - lastX) / (now - lastMoveTime + 1e-6); // px/ms
    lastX = x;
    lastMoveTime = now;
    e.preventDefault();
  }, { passive: false });
  tagCloud.addEventListener('touchend', () => {
    isDown = false;
    tagCloud.classList.remove('dragging');
    tagCloudRect = null;
    dragStarted = false;
    // Momentum/inertia
    let momentum = velocity * 16; // px per frame (16ms)
    function momentumScroll() {
      if (Math.abs(momentum) < 0.5) return;
      tagCloud.scrollLeft -= momentum;
      momentum *= 0.92; // friction
      momentumFrame = requestAnimationFrame(momentumScroll);
    }
    if (Math.abs(momentum) > 1) {
      momentumFrame = requestAnimationFrame(momentumScroll);
    }
  });
}
