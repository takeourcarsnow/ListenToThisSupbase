import notificationsView from '../views/notifications_view.js';
import notifications from './notifications.js';

// Initialize notifications UI and show a test notification on DOMContentLoaded
window.addEventListener('DOMContentLoaded', function() {
  notificationsView.init();
  notifications.add('Test notification: If you see this, notifications are working!', 'info', 5000);
});
