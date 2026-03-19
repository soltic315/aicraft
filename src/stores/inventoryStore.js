import { create } from 'zustand';
import { HOTBAR_SIZE, TOTAL_SLOTS } from '../config.js';

// スロットの初期状態（空）を生成
const emptySlots = () => Array.from({ length: TOTAL_SLOTS }, () => ({ type: null, count: 0 }));

export const useInventoryStore = create((set, get) => ({
  slots: emptySlots(),
  selectedSlot: 0,

  setSlot(slot) {
    set({ selectedSlot: slot });
  },

  scrollSlot(deltaY) {
    const { selectedSlot } = get();
    if (deltaY > 0) {
      set({ selectedSlot: (selectedSlot + 1) % HOTBAR_SIZE });
    } else {
      set({ selectedSlot: (selectedSlot - 1 + HOTBAR_SIZE) % HOTBAR_SIZE });
    }
  },

  swapSlots(fromIdx, toIdx) {
    const { slots } = get();
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= slots.length || toIdx >= slots.length) return;
    const newSlots = slots.map((s) => ({ ...s }));
    const temp = newSlots[fromIdx];
    newSlots[fromIdx] = newSlots[toIdx];
    newSlots[toIdx] = temp;
    set({ slots: newSlots });
  },

  getCount(type) {
    return get().slots.reduce((sum, s) => (s.type === type ? sum + s.count : sum), 0);
  },

  addItem(type, amount = 1) {
    set((state) => {
      const newSlots = state.slots.map((s) => ({ ...s }));
      let remaining = amount;

      // 既存の同種スロットにスタック
      for (let i = 0; i < newSlots.length && remaining > 0; i++) {
        if (newSlots[i].type === type) {
          newSlots[i].count += remaining;
          remaining = 0;
        }
      }

      // 空きスロットに格納（ホットバー優先）
      for (let i = 0; i < newSlots.length && remaining > 0; i++) {
        if (newSlots[i].type === null) {
          newSlots[i] = { type, count: remaining };
          remaining = 0;
        }
      }

      return { slots: newSlots };
    });
  },

  consumeItem(type, amount = 1) {
    const { slots } = get();
    const total = slots.reduce((sum, s) => (s.type === type ? sum + s.count : sum), 0);
    if (total < amount) return false;

    set((state) => {
      const newSlots = state.slots.map((s) => ({ ...s }));
      let remaining = amount;
      for (let i = 0; i < newSlots.length && remaining > 0; i++) {
        if (newSlots[i].type === type) {
          const take = Math.min(newSlots[i].count, remaining);
          newSlots[i].count -= take;
          remaining -= take;
          if (newSlots[i].count === 0) {
            newSlots[i] = { type: null, count: 0 };
          }
        }
      }
      return { slots: newSlots };
    });
    return true;
  },

  hasRecipeIngredients(recipe) {
    const state = get();
    return Object.entries(recipe.consumes).every(
      ([type, amount]) => state.getCount(Number(type)) >= amount,
    );
  },

  craftRecipe(recipe) {
    const state = get();
    if (!state.hasRecipeIngredients(recipe)) return false;

    const newSlots = state.slots.map((s) => ({ ...s }));

    // 素材を消費
    for (const [type, amount] of Object.entries(recipe.consumes)) {
      const t = Number(type);
      let remaining = amount;
      for (let i = 0; i < newSlots.length && remaining > 0; i++) {
        if (newSlots[i].type === t) {
          const take = Math.min(newSlots[i].count, remaining);
          newSlots[i].count -= take;
          remaining -= take;
          if (newSlots[i].count === 0) newSlots[i] = { type: null, count: 0 };
        }
      }
    }

    // アイテムを生産
    for (const [type, amount] of Object.entries(recipe.produces)) {
      const t = Number(type);
      let remaining = amount;
      for (let i = 0; i < newSlots.length && remaining > 0; i++) {
        if (newSlots[i].type === t) {
          newSlots[i].count += remaining;
          remaining = 0;
        }
      }
      for (let i = 0; i < newSlots.length && remaining > 0; i++) {
        if (newSlots[i].type === null) {
          newSlots[i] = { type: t, count: remaining };
          remaining = 0;
        }
      }
    }

    set({ slots: newSlots });
    return true;
  },

  restoreFromSave(savedSlots, savedSlot) {
    if (Array.isArray(savedSlots)) {
      const newSlots = emptySlots();
      savedSlots.forEach((s, i) => {
        if (i < newSlots.length && s && typeof s === 'object') {
          const type = s.type == null ? null : Number(s.type);
          const count = Math.max(0, Math.floor(Number(s.count) || 0));
          if (type === null || Number.isFinite(type)) {
            newSlots[i] = { type: count > 0 ? type : null, count: count > 0 ? count : 0 };
          }
        }
      });
      set({ slots: newSlots });
    }
    if (Number.isFinite(savedSlot)) {
      set({ selectedSlot: Math.max(0, Math.min(savedSlot, HOTBAR_SIZE - 1)) });
    }
  },

  reset() {
    set({ slots: emptySlots(), selectedSlot: 0 });
  },
}));
