import { h } from 'preact';
import { useUIStore } from '../../stores/uiStore.js';
import { useChestStore } from '../../stores/chestStore.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { ALL_ITEM_TYPES, CHEST_STORAGE_LIMIT, parsePosKey } from '../../config.js';
import { BLOCK_NAMES } from '../../blocks.js';

export function ChestPanel() {
  const chestOpen      = useUIStore((s) => s.chestOpen);
  const openedChestKey = useChestStore((s) => s.openedChestKey);
  const storage        = useChestStore((s) => s.storage);
  const slots          = useInventoryStore((s) => s.slots);

  if (!chestOpen || !openedChestKey) return null;

  const chestData = storage.get(openedChestKey);
  if (!chestData) return null;

  const chestPos = parsePosKey(openedChestKey);
  const totalItems = Object.values(chestData).reduce((sum, v) => sum + (Number(v) || 0), 0);

  // インベントリの各アイテム数
  const getInvCount = (type) => slots.reduce((sum, s) => (s.type === type ? sum + s.count : sum), 0);

  return (
    <div id="chest-panel" style={{ display: 'block' }} aria-label="チェストパネル">
      <h2>チェスト（E で開く / 閉じる）</h2>

      <div class="chest-panel-section">
        <p class="chest-panel-title">チェスト在庫</p>
        <div id="chest-storage-list" class="chest-list">
          {ALL_ITEM_TYPES.map((type) => {
            const count = Number(chestData[type] ?? 0);
            return (
              <div key={`chest-${type}`} class="chest-row">
                <span>{BLOCK_NAMES[type]} x{count}</span>
                <button
                  type="button"
                  disabled={count <= 0}
                  onClick={() => {
                    const result = useChestStore.getState().transferFromChest(type);
                    if (result) {
                      window.__aicraft?.sound?.playPlace();
                    } else {
                      window.__aicraft?.sound?.playError();
                      useUIStore.getState().showFeedback('取り出し失敗: チェスト内の在庫が不足しています');
                    }
                  }}
                >
                  取り出す
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div class="chest-panel-section">
        <p class="chest-panel-title">所持品</p>
        <div id="chest-player-list" class="chest-list">
          {ALL_ITEM_TYPES.map((type) => {
            const count = getInvCount(type);
            return (
              <div key={`inv-${type}`} class="chest-row">
                <span>{BLOCK_NAMES[type]} x{count}</span>
                <button
                  type="button"
                  disabled={count <= 0 || totalItems >= CHEST_STORAGE_LIMIT}
                  onClick={() => {
                    const result = useChestStore.getState().transferToChest(type);
                    if (result === true) {
                      window.__aicraft?.sound?.playPlace();
                    } else if (result === 'full') {
                      window.__aicraft?.sound?.playError();
                      useUIStore.getState().showFeedback('収納失敗: チェストが満杯です');
                    } else {
                      window.__aicraft?.sound?.playError();
                      useUIStore.getState().showFeedback('収納失敗: 所持数が不足しています');
                    }
                  }}
                >
                  収納する
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <p id="chest-hint" class="chest-hint">
        {`座標: (${chestPos.x}, ${chestPos.y}, ${chestPos.z}) / 合計: ${totalItems} / ${CHEST_STORAGE_LIMIT}`}
      </p>
    </div>
  );
}
