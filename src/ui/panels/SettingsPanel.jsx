import { h } from 'preact';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useUIStore } from '../../stores/uiStore.js';

export function SettingsPanel() {
  const open = useUIStore((s) => s.settingsOpen);
  const sensitivity = useSettingsStore((s) => s.sensitivity);
  const bgmVolume = useSettingsStore((s) => s.bgmVolume);
  const seVolume = useSettingsStore((s) => s.seVolume);
  const renderDistance = useSettingsStore((s) => s.renderDistance);
  const uiScale = useSettingsStore((s) => s.uiScale);
  const highContrast = useSettingsStore((s) => s.highContrast);

  if (!open) return null;

  const displaySens = (sensitivity * 1000).toFixed(1);

  return (
    <div id="settings-panel" style={{ display: 'block' }} aria-label="設定パネル">
      <h2>設定（P で表示切替）</h2>

      <div class="setting">
        <label for="setting-sensitivity">感度</label>
        <div>
          <input
            id="setting-sensitivity"
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            value={displaySens}
            onInput={(e) => {
              useSettingsStore.getState().setSensitivity(Number(e.currentTarget.value) / 1000);
              window.__aicraft?.applySettings?.();
            }}
          />
          <span class="setting-value">{displaySens}</span>
        </div>
      </div>

      <div class="setting">
        <label for="setting-bgm">BGM 音量</label>
        <div>
          <input
            id="setting-bgm"
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(bgmVolume * 100)}
            onInput={(e) => {
              useSettingsStore.getState().setBgmVolume(Number(e.currentTarget.value) / 100);
              window.__aicraft?.applySettings?.();
            }}
          />
          <span class="setting-value">{Math.round(bgmVolume * 100)}</span>
        </div>
      </div>

      <div class="setting">
        <label for="setting-se">SE 音量</label>
        <div>
          <input
            id="setting-se"
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(seVolume * 100)}
            onInput={(e) => {
              useSettingsStore.getState().setSeVolume(Number(e.currentTarget.value) / 100);
              window.__aicraft?.applySettings?.();
            }}
          />
          <span class="setting-value">{Math.round(seVolume * 100)}</span>
        </div>
      </div>

      <div class="setting">
        <label for="setting-render-distance">描画距離</label>
        <div>
          <input
            id="setting-render-distance"
            type="range"
            min="2"
            max="8"
            step="1"
            value={renderDistance}
            onInput={(e) => {
              useSettingsStore.getState().setRenderDistance(Number(e.currentTarget.value));
              window.__aicraft?.applySettings?.();
            }}
          />
          <span class="setting-value">{renderDistance}</span>
        </div>
      </div>

      <div class="setting">
        <label for="setting-ui-scale">表示倍率</label>
        <div>
          <input
            id="setting-ui-scale"
            type="range"
            min="0.7"
            max="2"
            step="0.1"
            value={uiScale}
            onInput={(e) => {
              useSettingsStore.getState().setUiScale(Number(e.currentTarget.value));
              window.__aicraft?.applySettings?.();
            }}
          />
          <span class="setting-value">{uiScale.toFixed(1)}x</span>
        </div>
      </div>

      <div class="setting">
        <label for="setting-high-contrast">ハイコントラスト</label>
        <div>
          <input
            id="setting-high-contrast"
            type="checkbox"
            checked={highContrast}
            onInput={(e) => {
              useSettingsStore.getState().setHighContrast(e.currentTarget.checked);
              window.__aicraft?.applySettings?.();
            }}
          />
        </div>
      </div>

      <div class="setting">
        <button
          id="save-btn"
          type="button"
          onClick={() => window.__aicraft?.eventBus?.emit('save-clicked')}
        >
          セーブ
        </button>
        <button
          id="delete-save-btn"
          type="button"
          onClick={() => window.__aicraft?.eventBus?.emit('delete-save-clicked')}
        >
          セーブ削除
        </button>
      </div>
      <p class="setting-hint">描画距離変更は負荷に応じて調整してください。</p>
    </div>
  );
}
