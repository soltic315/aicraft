import { create } from 'zustand';
import { HUNGER_MAX } from '../config.js';

export const useHungerStore = create((set, get) => ({
  hunger: HUNGER_MAX,
  maxHunger: HUNGER_MAX,

  consumeHunger(amount) {
    const { hunger } = get();
    set({ hunger: Math.max(0, hunger - amount) });
  },

  feedHunger(amount) {
    const { hunger, maxHunger } = get();
    set({ hunger: Math.min(maxHunger, hunger + amount) });
  },

  isLow() {
    return get().hunger <= 6;
  },

  reset() {
    set({ hunger: HUNGER_MAX });
  },

  restoreFromSave(savedHunger) {
    if (Number.isFinite(savedHunger)) {
      set({ hunger: Math.max(0, Math.min(HUNGER_MAX, savedHunger)) });
    }
  },
}));
