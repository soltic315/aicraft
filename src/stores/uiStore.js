import { create } from 'zustand';

export const useUIStore = create((set, get) => ({
  settingsOpen: false,
  craftOpen: false,
  chestOpen: false,
  resumeHintVisible: false,
  waterOverlay: false,
  actionFeedback: '',
  feedbackTimer: null,

  toggleSettings() {
    const isNow = !get().settingsOpen;
    set({ settingsOpen: isNow });
    return isNow;
  },

  toggleCraft() {
    const isNow = !get().craftOpen;
    set({ craftOpen: isNow });
    return isNow;
  },

  setChestOpen(open) {
    set({ chestOpen: open });
  },

  setResumeHint(visible) {
    set({ resumeHintVisible: visible });
  },

  setWaterOverlay(visible) {
    set({ waterOverlay: visible });
  },

  showFeedback(message, durationMs = 1200) {
    const prev = get().feedbackTimer;
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      set({ actionFeedback: '', feedbackTimer: null });
    }, durationMs);
    set({ actionFeedback: message, feedbackTimer: timer });
  },
}));
