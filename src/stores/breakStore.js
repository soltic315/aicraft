import { create } from 'zustand';

export const useBreakStore = create((set) => ({
  progress: 0,
  active: false,

  setProgress(progress) {
    set({ progress, active: progress > 0 });
  },

  reset() {
    set({ progress: 0, active: false });
  },
}));
