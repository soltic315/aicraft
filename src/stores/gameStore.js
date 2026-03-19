import { create } from 'zustand';

export const useGameStore = create((set) => ({
  gameStarted: false,
  fps: 0,
  loading: false,
  loadingMessage: '',
  isDead: false,

  startGame() {
    set({ gameStarted: true });
  },

  setFps(fps) {
    set({ fps });
  },

  setLoading(loading, message = '') {
    set({ loading, loadingMessage: message });
  },

  setDead(isDead) {
    set({ isDead });
  },
}));
