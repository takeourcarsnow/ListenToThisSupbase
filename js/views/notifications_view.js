// UI component for notifications (simple toast system)
// Usage: import notificationsView from './notifications_view.js'; notificationsView.init();
import notifications from '../core/notifications.js';


const containerId = 'notifications-popup-container';

const notificationsView = {
  container: null,
  currentTimeout: null,
  init() {
    if (document.getElementById(containerId)) return;
    this.container = document.createElement('div');
    this.container.id = containerId;
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.zIndex = '9999';
    this.container.style.width = '100%';
    this.container.style.maxWidth = '400px';
    this.container.style.pointerEvents = 'none';
    this.container.style.display = 'flex';
    this.container.style.justifyContent = 'center';
    this.container.style.alignItems = 'flex-start';
    this.container.style.background = 'none';
    this.container.style.border = 'none';
    this.container.style.boxShadow = 'none';
    this.container.style.transition = 'none';
    document.body.appendChild(this.container);
    notifications.subscribe(this.render.bind(this));
    this.render(notifications.list);
  },
  render(list) {
    if (!this.container) return;
    this.container.innerHTML = '';
    if (!list.length) return;
    // Only show the most recent notification
    const n = list[list.length - 1];
    const el = document.createElement('div');
    el.textContent = n.message;
    el.className = `notification-popup ${n.type}`;
  el.style.pointerEvents = 'auto';
  el.style.minWidth = '180px';
  el.style.maxWidth = '360px';
  el.style.margin = '0 auto';
  el.style.marginTop = '16px';
  el.style.padding = '12px 24px';
  el.style.borderRadius = '8px';
  el.style.background = n.type === 'success' ? '#4caf50' : n.type === 'error' ? '#f44336' : '#222e3a';
  el.style.color = '#fff';
  el.style.fontWeight = '500';
  el.style.fontSize = '1.08em';
  el.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)';
  el.style.opacity = '0';
  el.style.transform = 'translateY(-32px)';
  el.style.transition = 'opacity 0.3s cubic-bezier(.4,0,.2,1), transform 0.3s cubic-bezier(.4,0,.2,1)';
  el.style.textAlign = 'center';
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 10);
    el.onclick = () => notifications.remove(n.id);
    this.container.appendChild(el);
    // Auto-hide after timeout if not already removed
    if (this.currentTimeout) clearTimeout(this.currentTimeout);
    this.currentTimeout = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-32px)';
      setTimeout(() => notifications.remove(n.id), 300);
    }, 4000);
  }
};

export default notificationsView;
