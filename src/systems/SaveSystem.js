// セーブ/ロードシステム: ゲーム状態のLocalStorage永続化を管理する
import {
  SAVE_STORAGE_KEY,
  SAVE_SCHEMA_VERSION,
  AUTO_SAVE_INTERVAL_MS,
} from '../config.js';
import { useInventoryStore } from '../stores/inventoryStore.js';
import { useToolStore } from '../stores/toolStore.js';
import { useChestStore } from '../stores/chestStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';
import { useHungerStore } from '../stores/hungerStore.js';
import { useDurabilityStore } from '../stores/durabilityStore.js';
import { useArmorStore } from '../stores/armorStore.js';
import { useXpStore } from '../stores/xpStore.js';
import { useAchievementStore } from '../stores/achievementStore.js';
import { useUIStore } from '../stores/uiStore.js';

export class SaveSystem {
  /**
   * @param {{ position: THREE.Vector3, yaw: number, pitch: number }} player
   * @param {{ exportChunkEdits: () => any }} world
   * @param {() => number} getWorldSeed
   */
  constructor(player, world, getWorldSeed) {
    this.player = player;
    this.world = world;
    this.getWorldSeed = getWorldSeed;
    this._autoSaveIntervalId = null;
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION) {
        console.info('保存データのスキーマが一致しません（', parsed.schemaVersion, '!=', SAVE_SCHEMA_VERSION, '）。新規ワールドを生成します。');
        return null;
      }
      return parsed;
    } catch (e) {
      console.warn('保存データの読み込みに失敗しました:', e);
      return null;
    }
  }

  save({ showFeedback = true } = {}) {
    try {
      const { slots, selectedSlot } = useInventoryStore.getState();
      const { selectedTool } = useToolStore.getState();
      const chestState = useChestStore.getState().exportForSave();
      const settings = useSettingsStore.getState();
      const { hunger } = useHungerStore.getState();
      const { durability } = useDurabilityStore.getState();
      const { equipped: armorEquipped } = useArmorStore.getState();
      const { xp } = useXpStore.getState();
      const { unlocked: achievements } = useAchievementStore.getState();

      const data = {
        schemaVersion: SAVE_SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        worldSeed: this.getWorldSeed(),
        player: {
          position: {
            x: this.player.position.x,
            y: this.player.position.y,
            z: this.player.position.z,
          },
          yaw: this.player.yaw,
          pitch: this.player.pitch,
          inventory: slots.map((s) => ({ type: s.type, count: s.count })),
          selectedSlot,
          selectedTool,
          hunger,
          toolDurability: { ...durability },
          armorEquipped: { ...armorEquipped },
          xp,
        },
        achievements: [...achievements],
        settings: {
          sensitivity: settings.sensitivity,
          bgmVolume: settings.bgmVolume,
          seVolume: settings.seVolume,
          renderDistance: settings.renderDistance,
          uiScale: settings.uiScale,
          fov: settings.fov,
          targetFps: settings.targetFps,
          highContrast: settings.highContrast,
          showDebugInfo: settings.showDebugInfo,
        },
        chunkDiffs: this.world.exportChunkEdits(),
        chestStorage: chestState,
      };

      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
      if (showFeedback) useUIStore.getState().showFeedback('ゲームをセーブしました', 800);
    } catch (e) {
      console.warn('Failed to save game:', e);
      if (showFeedback) useUIStore.getState().showFeedback('セーブに失敗しました', 1000);
    }
  }

  startAutoSave() {
    if (this._autoSaveIntervalId) return;
    this._autoSaveIntervalId = setInterval(() => {
      this.save({ showFeedback: false });
    }, AUTO_SAVE_INTERVAL_MS);
  }

  stopAutoSave() {
    if (this._autoSaveIntervalId) {
      clearInterval(this._autoSaveIntervalId);
      this._autoSaveIntervalId = null;
    }
  }
}
