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
  // Removed velocity/momentum variables
  let dragStarted = false;
  // Instantly start drag on mobile for best responsiveness
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const DRAG_THRESHOLD = isMobile ? 0 : 5; // px

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
  dragStarted = isMobile ? true : false;
  tagCloud.classList.add('dragging');
  tagCloudRect = tagCloud.getBoundingClientRect();
  startX = e.touches[0].pageX - tagCloudRect.left;
  scrollLeft = tagCloud.scrollLeft;
  e.preventDefault();
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
  e.preventDefault();
  }, { passive: false });
  tagCloud.addEventListener('touchend', () => {
  isDown = false;
  tagCloud.classList.remove('dragging');
  tagCloudRect = null;
  dragStarted = false;
  // Prevent native scroll/momentum
  event?.preventDefault && event.preventDefault();
  });
}
