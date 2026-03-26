// 設定値バリデーション・正規化ユーティリティ
import { clamp } from './math.js';
import { DEFAULT_SETTINGS } from '../constants/gameConstants.js';

export function sanitizeSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const highContrast = raw.highContrast === true || raw.highContrast === 'true';
  const showDebugInfo = raw.showDebugInfo === true || raw.showDebugInfo === 'true';
  const showMinimap = raw.showMinimap === false || raw.showMinimap === 'false' ? false : true;
  return {
    sensitivity: clamp(Number(raw.sensitivity) || DEFAULT_SETTINGS.sensitivity, 0.0005, 0.004),
    bgmVolume: clamp(Number(raw.bgmVolume) || 0, 0, 1),
    seVolume: clamp(Number(raw.seVolume) || 0, 0, 1),
    renderDistance: clamp(Math.floor(Number(raw.renderDistance) || DEFAULT_SETTINGS.renderDistance), 2, 8),
    uiScale: clamp(Number(raw.uiScale) || DEFAULT_SETTINGS.uiScale, 0.7, 2),
    fov: clamp(Math.floor(Number(raw.fov) || DEFAULT_SETTINGS.fov), 50, 120),
    targetFps: clamp(Math.floor(Number(raw.targetFps) || DEFAULT_SETTINGS.targetFps), 30, 144),
    highContrast,
    showDebugInfo,
    showMinimap,
  };
}
