import { create } from 'zustand';
import { DIFFICULTY } from '../config.js';

export const useGameStore = create((set) => ({
  gameStarted: false,
  fps: 0,
  loading: false,
  loadingMessage: '',
  isDead: false,
  paused: false,
  difficulty: DIFFICULTY.NORMAL, // 難易度（デフォルト: ノーマル）

  startGame() {
    set({ gameStarted: true });
  },

  returnToTitle() {
    set({ gameStarted: false, isDead: false, paused: false });
  },

  setPaused(paused) {
    set({ paused });
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

  setDifficulty(difficulty) {
    set({ difficulty });
  },
}));
