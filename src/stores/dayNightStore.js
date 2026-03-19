import { create } from 'zustand';

export const useDayNightStore = create((set) => ({
  cycleRatio: 0,
  isDay: true,

  update(cycleRatio, isDay) {
    set({ cycleRatio, isDay });
  },
}));
