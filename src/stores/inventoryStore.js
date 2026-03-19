import { create } from 'zustand';
import {
  HOTBAR_BLOCKS,
  STARTER_INVENTORY,
  CRAFT_RECIPES,
} from '../config.js';

export const useInventoryStore = create((set, get) => ({
  selectedSlot: 0,
  counts: Object.fromEntries(
    HOTBAR_BLOCKS.map((type) => [type, STARTER_INVENTORY[type] ?? 0]),
  ),

  setSlot(slot) {
    set({ selectedSlot: slot });
  },

  scrollSlot(deltaY) {
    const { selectedSlot } = get();
    if (deltaY > 0) {
      set({ selectedSlot: (selectedSlot + 1) % HOTBAR_BLOCKS.length });
    } else {
      set({ selectedSlot: (selectedSlot - 1 + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length });
    }
  },

  getCount(type) {
    return get().counts[type] ?? 0;
  },

  addItem(type, amount = 1) {
    set((state) => {
      if (!Object.hasOwn(state.counts, type)) return state;
      return { counts: { ...state.counts, [type]: state.counts[type] + amount } };
    });
  },

  consumeItem(type, amount = 1) {
    const { counts } = get();
    if (!Object.hasOwn(counts, type)) return false;
    if (counts[type] < amount) return false;
    set({ counts: { ...counts, [type]: counts[type] - amount } });
    return true;
  },

  hasRecipeIngredients(recipe) {
    const { counts } = get();
    return Object.entries(recipe.consumes).every(
      ([type, amount]) => (counts[Number(type)] ?? 0) >= amount,
    );
  },

  craftRecipe(recipe) {
    const state = get();
    if (!state.hasRecipeIngredients(recipe)) return false;

    const newCounts = { ...state.counts };
    for (const [type, amount] of Object.entries(recipe.consumes)) {
      newCounts[Number(type)] -= amount;
    }
    for (const [type, amount] of Object.entries(recipe.produces)) {
      newCounts[Number(type)] = (newCounts[Number(type)] ?? 0) + amount;
    }
    set({ counts: newCounts });
    return true;
  },

  restoreFromSave(savedInventory, savedSlot) {
    if (savedInventory && typeof savedInventory === 'object') {
      const newCounts = { ...get().counts };
      Object.entries(savedInventory).forEach(([type, count]) => {
        const t = Number(type);
        if (!Number.isNaN(t) && Object.hasOwn(newCounts, t)) {
          newCounts[t] = Math.max(0, Math.floor(Number(count) || 0));
        }
      });
      set({ counts: newCounts });
    }
    if (Number.isFinite(savedSlot)) {
      set({ selectedSlot: savedSlot });
    }
  },

  reset() {
    set({
      selectedSlot: 0,
      counts: Object.fromEntries(
        HOTBAR_BLOCKS.map((type) => [type, STARTER_INVENTORY[type] ?? 0]),
      ),
    });
  },
}));
