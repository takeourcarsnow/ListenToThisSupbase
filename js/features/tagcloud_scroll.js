// Enable mouse drag-to-scroll for .tag-cloud on desktop
export function enableTagCloudDragScroll() {
  const tagCloud = document.querySelector('.tag-cloud');
  if (!tagCloud) return;
  let isDown = false;
  let startX;
  let scrollLeft;

  tagCloud.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left mouse button
    isDown = true;
    tagCloud.classList.add('dragging');
    startX = e.pageX - tagCloud.offsetLeft;
    scrollLeft = tagCloud.scrollLeft;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const x = e.pageX - tagCloud.offsetLeft;
    const walk = (x - startX) * 1.2; // scroll speed
    tagCloud.scrollLeft = scrollLeft - walk;
  });
  document.addEventListener('mouseup', () => {
    isDown = false;
    tagCloud.classList.remove('dragging');
  });
}
