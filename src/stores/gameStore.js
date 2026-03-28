import { create } from 'zustand';
import { DIFFICULTY } from '../config.js';

export const useGameStore = create((set) => ({
  gameStarted: false,
  fps: 0,
  loading: false,
  loadingMessage: '',
  loadingProgress: 0, // 読み込み進捗（0〜100）
  isDead: false,
  paused: false,
  difficulty: DIFFICULTY.NORMAL, // 難易度（デフォルト: ノーマル）
  isCreative: false,            // クリエイティブモード（飛行・即破壊・無限HP）
  weatherType: 'clear',         // 天候: 'clear' | 'rain' | 'snow'

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

  setLoading(loading, message = '', progress = 0) {
    set({ loading, loadingMessage: message, loadingProgress: progress });
  },

  setDead(isDead) {
    set({ isDead });
  },

  setDifficulty(difficulty) {
    set({ difficulty });
  },

  setCreative(isCreative) {
    set({ isCreative });
  },

  setWeather(weatherType) {
    set({ weatherType });
  },
}));
