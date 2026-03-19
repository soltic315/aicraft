// Keyboard and mouse input capture
import { HOTBAR_SIZE } from './config.js';

export class InputManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.isBreaking = false;
    this._setupListeners();
  }

  _setupListeners() {
    document.addEventListener('mousedown', (e) => {
      this.eventBus.emit('mousedown', e);
      if (e.button === 0) {
        this.isBreaking = true;
      } else if (e.button === 2) {
        this.eventBus.emit('place-requested');
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      this.isBreaking = false;
      this.eventBus.emit('break-cancelled');
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== document.body) {
        this.isBreaking = false;
        this.eventBus.emit('pointer-unlocked');
      }
    });

    window.addEventListener('blur', () => {
      this.isBreaking = false;
      this.eventBus.emit('break-cancelled');
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      // Slot selection: 1-9 keys (ホットバーは9スロット固定)
      const num = Number.parseInt(e.key, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= Math.min(HOTBAR_SIZE, 9)) {
        this.eventBus.emit('slot-selected', num - 1);
        return;
      }

      // Panel toggles and interactions
      if (e.code === 'KeyP') this.eventBus.emit('toggle-settings');
      if (e.code === 'KeyC') this.eventBus.emit('toggle-craft');
      if (e.code === 'KeyI') this.eventBus.emit('toggle-inventory');
      if (e.code === 'KeyE') this.eventBus.emit('interact-chest');
    });

    document.addEventListener('wheel', (e) => {
      this.eventBus.emit('slot-scroll', e.deltaY);
    });
  }
}
