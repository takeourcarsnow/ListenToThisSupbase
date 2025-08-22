// UI component for notifications (simple toast system)
// Usage: import notificationsView from './notifications_view.js'; notificationsView.init();
import notifications from '../core/notifications.js';

const containerId = 'notifications-container';

const notificationsView = {
  container: null,
  init() {
    if (document.getElementById(containerId)) return;
    this.container = document.createElement('div');
    this.container.id = containerId;
    this.container.style.position = 'fixed';
    this.container.style.top = '20px';
    this.container.style.right = '20px';
    this.container.style.zIndex = '9999';
    this.container.style.maxWidth = '350px';
    document.body.appendChild(this.container);
    notifications.subscribe(this.render.bind(this));
    this.render(notifications.list);
  },
  render(list) {
    if (!this.container) return;
    this.container.innerHTML = '';
    list.forEach(n => {
      const el = document.createElement('div');
      el.textContent = n.message;
      el.className = `notification ${n.type}`;
      el.style.marginBottom = '10px';
      el.style.padding = '12px 18px';
      el.style.borderRadius = '6px';
      el.style.background = n.type === 'success' ? '#4caf50' : n.type === 'error' ? '#f44336' : '#2196f3';
      el.style.color = '#fff';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      el.style.cursor = 'pointer';
      el.onclick = () => notifications.remove(n.id);
      this.container.appendChild(el);
    });
  }
};

export default notificationsView;
