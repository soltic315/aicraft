import { create } from 'zustand';

export const useUIStore = create((set, get) => ({
  settingsOpen: false,
  craftOpen: false,
  craftMode: 'basic',
  chestOpen: false,
  furnaceOpen: false,
  inventoryOpen: false,
  resumeHintVisible: false,
  waterOverlay: false,
  hitFlashCount: 0,   // インクリメントするたびに被弾エフェクトが再生される
  actionFeedback: '',
  feedbackTimer: null,

  toggleSettings() {
    const isNow = !get().settingsOpen;
    set({ settingsOpen: isNow });
    return isNow;
  },

  toggleCraft() {
    const isNow = !get().craftOpen;
    set({ craftOpen: isNow, craftMode: 'basic' });
    return isNow;
  },

  openCraftPanel(mode = 'basic') {
    set({ craftOpen: true, craftMode: mode });
  },

  closeCraftPanel() {
    set({ craftOpen: false, craftMode: 'basic' });
  },

  toggleInventory() {
    const isNow = !get().inventoryOpen;
    set({ inventoryOpen: isNow });
    return isNow;
  },

  // Tab: インベントリ＋クラフトをまとめて開閉
  toggleInventoryWithCraft() {
    const willOpen = !get().inventoryOpen;
    set({ inventoryOpen: willOpen, craftOpen: willOpen, craftMode: 'basic', chestOpen: false });
    return willOpen;
  },

  openChestPanel() {
    set({ chestOpen: true });
  },

  openFurnacePanel() {
    set({ furnaceOpen: true });
  },

  closeFurnacePanel() {
    set({ furnaceOpen: false });
  },
  // インベントリ・クラフト・チェスト・かまどをまとめて閉じる
  closeInventoryPanels() {
    set({ inventoryOpen: false, craftOpen: false, chestOpen: false, furnaceOpen: false, craftMode: 'basic' });
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

  /** 被弾時に呼ぶ。カウンターをインクリメントして HitOverlay をリトリガーする。 */
  showHitFlash() {
    set((s) => ({ hitFlashCount: s.hitFlashCount + 1 }));
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
