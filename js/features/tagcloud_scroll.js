// Enable mouse drag-to-scroll for .tag-cloud on desktop
export function enableTagCloudDragScroll(tagCloud) {
  if (!tagCloud) tagCloud = document.querySelector('.tag-cloud');
  if (!tagCloud) return;
  // Restore scroll position if saved
  if (typeof window !== 'undefined' && typeof window._tagCloudScrollLeft === 'number') {
    tagCloud.scrollLeft = window._tagCloudScrollLeft;
    // Only restore once
    delete window._tagCloudScrollLeft;
  }
// Attach to window for global use
if (typeof window !== 'undefined') {
  window.enableTagCloudDragScroll = enableTagCloudDragScroll;
}
  let isDown = false;
  let startX, startY;
  let scrollLeft;
  let tagCloudRect;
  let downTag = null;
  let drag = false;
  let pointerId = null;
  const DRAG_THRESHOLD = 5; // px, same for all devices for consistency

  function pointerDown(e) {
    // Only left mouse button or single touch
    if ((e.type === 'mousedown' && e.button !== 0) || (e.type === 'pointerdown' && e.pointerType === 'mouse' && e.button !== 0)) return;
    isDown = true;
    drag = false;
    pointerId = e.pointerId || null;
    tagCloud.classList.add('dragging');
    tagCloudRect = tagCloud.getBoundingClientRect();
    if (e.type.startsWith('touch')) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    } else {
      startX = e.clientX;
      startY = e.clientY;
    }
    scrollLeft = tagCloud.scrollLeft;
    // Track tag under pointer down
    let el = e.target;
    if (el && el.classList && el.classList.contains('tag')) {
      downTag = el;
    } else if (el && el.closest && el.closest('.tag')) {
      downTag = el.closest('.tag');
    } else {
      downTag = null;
    }
    // Prevent the event from bubbling to parent handlers (like tab swipe)
    e.stopPropagation && e.stopPropagation();
    e.preventDefault && e.preventDefault();

    // For pointer events, capture the pointer so moves outside the element
    // still target us and won't trigger parent gestures.
    try {
      if (e.pointerId && tagCloud.setPointerCapture) tagCloud.setPointerCapture(e.pointerId);
    } catch (err) {
      // ignore setPointerCapture errors on some browsers
    }
  }

  function pointerMove(e) {
    if (!isDown) return;
    let clientX, clientY;
    if (e.type.startsWith('touch')) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const dx = clientX - startX;
    const dy = clientY - startY;
    if (!drag && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
      drag = true;
    }
    if (!tagCloudRect) tagCloudRect = tagCloud.getBoundingClientRect();
    const x = clientX - tagCloudRect.left;
    tagCloud.scrollLeft = scrollLeft - (x - (startX - tagCloudRect.left));
  e.stopPropagation && e.stopPropagation();
  e.preventDefault && e.preventDefault();
  }

  function pointerUp(e) {
    if (!isDown) return;
    let clientX, clientY;
    if (e.type.startsWith('touch')) {
      clientX = (e.changedTouches && e.changedTouches[0].clientX) || startX;
      clientY = (e.changedTouches && e.changedTouches[0].clientY) || startY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const dx = clientX - startX;
    const dy = clientY - startY;
    // Only select if no drag and pointer up is on the same tag as pointer down
    if (!drag && downTag) {
      const el = document.elementFromPoint(clientX, clientY);
      let tagEl = null;
      if (el && el.classList && el.classList.contains('tag')) {
        tagEl = el;
      } else if (el && el.closest && el.closest('.tag')) {
        tagEl = el.closest('.tag');
      }
        if (tagEl === downTag) {
          // Toggle tag selection: if already selected, unselect
          if (window && window.prefs && typeof window.prefs.filterTag !== 'undefined') {
            const tag = tagEl.getAttribute('data-tag');
            if (window.prefs.filterTag === tag) {
              window.prefs.filterTag = '';
              if (typeof window.renderApp === 'function') window.renderApp();
              return;
            } else {
              window.prefs.filterTag = tag;
            }
          }
          if (typeof window.onActionClick === 'function') {
            const evt = new Event('click', { bubbles: true, cancelable: true });
            Object.defineProperty(evt, 'target', { value: tagEl, enumerable: true });
            window.onActionClick(evt, window.state, window.DB, window.renderApp);
          } else {
            tagEl.click();
          }
          if (typeof window.renderApp === 'function') {
            window.renderApp();
          }
      }
    }
    // Release pointer capture if we captured it
    try {
      if (pointerId && tagCloud.releasePointerCapture) tagCloud.releasePointerCapture(pointerId);
    } catch (err) {
      // ignore
    }

    isDown = false;
    downTag = null;
    drag = false;
    pointerId = null;
    tagCloud.classList.remove('dragging');
    tagCloudRect = null;
    e.stopPropagation && e.stopPropagation();
    e.preventDefault && e.preventDefault();
  }

  // Use pointer events if available, else fallback to mouse/touch
  if (window.PointerEvent) {
    tagCloud.addEventListener('pointerdown', pointerDown, { passive: false });
    tagCloud.addEventListener('pointermove', pointerMove, { passive: false });
    tagCloud.addEventListener('pointerup', pointerUp, { passive: false });
    tagCloud.addEventListener('pointercancel', pointerUp, { passive: false });
  } else {
    tagCloud.addEventListener('mousedown', pointerDown, { passive: false });
    document.addEventListener('mousemove', pointerMove, { passive: false });
    document.addEventListener('mouseup', pointerUp, { passive: false });
    tagCloud.addEventListener('touchstart', pointerDown, { passive: false });
    tagCloud.addEventListener('touchmove', pointerMove, { passive: false });
    tagCloud.addEventListener('touchend', pointerUp, { passive: false });
    tagCloud.addEventListener('touchcancel', pointerUp, { passive: false });
  }
}
