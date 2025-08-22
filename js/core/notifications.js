// Core notification logic for in-app notifications
// Usage: notifications.add('Message', 'success'|'error'|'info');

const notifications = {
  list: [],
  add(message, type = 'info', timeout = 4000) {
    const id = Date.now() + Math.random();
    this.list.push({ id, message, type });
    this._notifyChange();
    if (timeout > 0) {
      setTimeout(() => this.remove(id), timeout);
    }
    return id;
  },
  remove(id) {
    this.list = this.list.filter(n => n.id !== id);
    this._notifyChange();
  },
  clear() {
    this.list = [];
    this._notifyChange();
  },
  _listeners: [],
  subscribe(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  },
  _notifyChange() {
    this._listeners.forEach(fn => fn(this.list));
  }
};

export default notifications;
