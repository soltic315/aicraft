import { create } from 'zustand';
import {
  SETTINGS_STORAGE_KEY,
  DEFAULT_SETTINGS,
  sanitizeSettings,
  clamp,
} from '../config.js';

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    return sanitizeSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const useSettingsStore = create((set, get) => ({
  ...loadSettings(),

  load(overrides) {
    if (overrides && typeof overrides === 'object') {
      set(sanitizeSettings(overrides));
    }
  },

  setSensitivity(value) {
    set({ sensitivity: clamp(value, 0.0005, 0.004) });
    get().persist();
  },

  setBgmVolume(value) {
    set({ bgmVolume: clamp(value, 0, 1) });
    get().persist();
  },

  setSeVolume(value) {
    set({ seVolume: clamp(value, 0, 1) });
    get().persist();
  },

  setRenderDistance(value) {
    set({ renderDistance: clamp(Math.floor(value), 2, 8) });
    get().persist();
  },

  setUiScale(value) {
    set({ uiScale: clamp(Number(value) || DEFAULT_SETTINGS.uiScale, 0.7, 2) });
    get().persist();
  },

  setFov(value) {
    set({ fov: clamp(Math.floor(Number(value) || DEFAULT_SETTINGS.fov), 50, 120) });
    get().persist();
  },

  setTargetFps(value) {
    set({ targetFps: clamp(Math.floor(Number(value) || DEFAULT_SETTINGS.targetFps), 30, 144) });
    get().persist();
  },

  setHighContrast(value) {
    set({ highContrast: Boolean(value) });
    get().persist();
  },

  setShowDebugInfo(value) {
    set({ showDebugInfo: Boolean(value) });
    get().persist();
  },

  setShowMinimap(value) {
    set({ showMinimap: Boolean(value) });
    get().persist();
  },

  persist() {
    const { sensitivity, bgmVolume, seVolume, renderDistance, uiScale, fov, targetFps, highContrast, showDebugInfo, showMinimap } = get();
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ sensitivity, bgmVolume, seVolume, renderDistance, uiScale, fov, targetFps, highContrast, showDebugInfo, showMinimap }),
    );
  },
}));
