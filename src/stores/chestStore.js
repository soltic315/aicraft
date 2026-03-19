import { create } from 'zustand';
import {
  ALL_ITEM_TYPES,
  CHEST_STORAGE_LIMIT,
  getPosKey,
  parsePosKey,
} from '../config.js';
import { useInventoryStore } from './inventoryStore.js';

export const useChestStore = create((set, get) => ({
  storage: new Map(),
  openedChestKey: null,

  getChestData(pos, createIfMissing = false) {
    const key = getPosKey(pos.x, pos.y, pos.z);
    const { storage } = get();
    let data = storage.get(key);
    if (!data && createIfMissing) {
      // 全アイテム種別を 0 で初期化
      data = Object.fromEntries(ALL_ITEM_TYPES.map((type) => [type, 0]));
      storage.set(key, data);
      set({ storage: new Map(storage) });
    }
    return data;
  },

  openChest(posKey) {
    set({ openedChestKey: posKey });
  },

  closeChest() {
    set({ openedChestKey: null });
  },

  transferToChest(type) {
    const { openedChestKey, storage } = get();
    if (!openedChestKey) return false;

    const chestData = storage.get(openedChestKey);
    if (!chestData) return false;

    const totalItems = Object.values(chestData).reduce((sum, v) => sum + (Number(v) || 0), 0);
    if (totalItems >= CHEST_STORAGE_LIMIT) return 'full';

    const inv = useInventoryStore.getState();
    if (!inv.consumeItem(type, 1)) return 'no-item';

    chestData[type] = (chestData[type] ?? 0) + 1;
    set({ storage: new Map(storage) });
    return true;
  },

  transferFromChest(type) {
    const { openedChestKey, storage } = get();
    if (!openedChestKey) return false;

    const chestData = storage.get(openedChestKey);
    if (!chestData || (chestData[type] ?? 0) <= 0) return false;

    chestData[type] -= 1;
    useInventoryStore.getState().addItem(type, 1);
    set({ storage: new Map(storage) });
    return true;
  },

  // チェストから全スタックをインベントリへ転送（空きスロット自動）
  transferAllFromChest(type) {
    const { openedChestKey, storage } = get();
    if (!openedChestKey) return false;
    const chestData = storage.get(openedChestKey);
    const count = chestData ? Math.max(0, Number(chestData[type] ?? 0)) : 0;
    if (count <= 0) return false;
    chestData[type] = 0;
    useInventoryStore.getState().addItem(type, count);
    set({ storage: new Map(storage) });
    return true;
  },

  // チェストから全スタックを指定スロットへ転送（ドラッグ&ドロップ用）
  transferFromChestToSlot(type, toSlot) {
    const { openedChestKey, storage } = get();
    if (!openedChestKey) return false;
    const chestData = storage.get(openedChestKey);
    const count = chestData ? Math.max(0, Number(chestData[type] ?? 0)) : 0;
    if (count <= 0) return false;

    const inv = useInventoryStore.getState();
    const newSlots = inv.slots.map((s) => ({ ...s }));
    const target = newSlots[toSlot];

    if (target.type == null) {
      // 空スロット: そのまま配置
      newSlots[toSlot] = { type, count };
    } else if (target.type === type) {
      // 同種: スタック加算
      newSlots[toSlot] = { type, count: target.count + count };
    } else {
      // 異種: 空き優先でインベントリに追加（スロット指定は諦めてaddItem）
      chestData[type] = 0;
      set({ storage: new Map(storage) });
      inv.addItem(type, count);
      return true;
    }

    chestData[type] = 0;
    useInventoryStore.setState({ slots: newSlots });
    set({ storage: new Map(storage) });
    return true;
  },

  // インベントリの指定スロットを全てチェストへ預ける
  depositSlot(slotIndex) {
    const { openedChestKey, storage } = get();
    if (!openedChestKey) return 'no-chest';
    const chestData = storage.get(openedChestKey);
    if (!chestData) return false;
    const inv = useInventoryStore.getState();
    const slot = inv.slots[slotIndex];
    if (!slot || slot.type == null || slot.count <= 0) return false;
    const totalItems = Object.values(chestData).reduce((sum, v) => sum + (Number(v) || 0), 0);
    if (totalItems >= CHEST_STORAGE_LIMIT) return 'full';
    const { type, count } = slot;
    chestData[type] = (chestData[type] ?? 0) + count;
    // スロットを空にする
    const newSlots = inv.slots.map((s) => ({ ...s }));
    newSlots[slotIndex] = { type: null, count: 0 };
    useInventoryStore.setState({ slots: newSlots });
    set({ storage: new Map(storage) });
    return true;
  },

  recoverChestItems(blockPos) {
    const key = getPosKey(blockPos.x, blockPos.y, blockPos.z);
    const { storage, openedChestKey } = get();
    const chestData = storage.get(key);
    if (!chestData) {
      if (openedChestKey === key) set({ openedChestKey: null });
      return 0;
    }

    let recovered = 0;
    const inv = useInventoryStore.getState();
    // チェストデータのキーを走査（0 以上の個数があるものだけ戻す）
    for (const [typeStr, cnt] of Object.entries(chestData)) {
      const count = Math.max(0, Math.floor(Number(cnt) || 0));
      if (count > 0) {
        inv.addItem(Number(typeStr), count);
        recovered += count;
      }
    }

    storage.delete(key);
    const updates = { storage: new Map(storage) };
    if (openedChestKey === key) updates.openedChestKey = null;
    set(updates);
    return recovered;
  },

  restoreFromSave(savedChestStorage) {
    if (!savedChestStorage || typeof savedChestStorage !== 'object') return;
    const storage = new Map();
    Object.entries(savedChestStorage).forEach(([posKey, contents]) => {
      if (contents && typeof contents === 'object') {
        storage.set(posKey, { ...contents });
      }
    });
    set({ storage });
  },

  exportForSave() {
    const chestState = {};
    for (const [key, contents] of get().storage.entries()) {
      chestState[key] = { ...contents };
    }
    return chestState;
  },
}));
