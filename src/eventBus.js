// Simple Pub/Sub event system for loose coupling between modules
export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
  }

  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (!listeners) return;
    const index = listeners.indexOf(callback);
    if (index !== -1) listeners.splice(index, 1);
  }

  emit(event, ...args) {
    const listeners = this._listeners.get(event);
    if (!listeners) return;
    for (const callback of listeners) {
      callback(...args);
    }
  }
}
