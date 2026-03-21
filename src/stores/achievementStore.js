import { create } from 'zustand';

export const ACHIEVEMENTS = {
  first_wood:    { id: 'first_wood',    title: '木こりの第一歩', desc: '初めて木材を入手した',   icon: '🪵' },
  first_stone:   { id: 'first_stone',   title: '掘り師の目覚め', desc: '初めて石を採掘した',     icon: '⛏️' },
  first_iron:    { id: 'first_iron',    title: '鉄の時代',      desc: '初めて鉄インゴットを入手した', icon: '🔩' },
  first_diamond: { id: 'first_diamond', title: 'ダイヤの輝き',  desc: 'ダイヤモンドを入手した', icon: '💎' },
  first_kill:    { id: 'first_kill',    title: '戦士の誕生',    desc: '初めてモブを倒した',     icon: '⚔️' },
  first_armor:   { id: 'first_armor',   title: '防具の目覚め',  desc: '初めて防具を装備した',   icon: '🛡️' },
  first_craft:   { id: 'first_craft',   title: '職人の始まり',  desc: '初めてクラフトした',     icon: '🔨' },
  first_furnace: { id: 'first_furnace', title: 'かまどの炎',    desc: '初めてかまどを使った',   icon: '🔥' },
  reach_level5:  { id: 'reach_level5',  title: '中級者',        desc: 'レベル5に到達した',      icon: '⭐' },
  reach_level10: { id: 'reach_level10', title: '達人',          desc: 'レベル10（最大）に到達した', icon: '🌟' },
  night_survive: { id: 'night_survive', title: '夜の生存者',    desc: '夜を生き延びた',         icon: '🌙' },
  explorer:      { id: 'explorer',      title: '探検家',        desc: '生まれた場所から遠く離れた', icon: '🗺️' },
  full_armor:    { id: 'full_armor',    title: '完全武装',      desc: '全スロットに防具を装備した', icon: '⚜️' },
};

export const useAchievementStore = create((set, get) => ({
  unlocked: [],
  pendingToast: null, // 表示待ちの実績

  unlock(id) {
    const { unlocked } = get();
    if (unlocked.includes(id)) return false;
    const achievement = ACHIEVEMENTS[id];
    if (!achievement) return false;
    set({ unlocked: [...unlocked, id], pendingToast: achievement });
    return true;
  },

  isUnlocked(id) {
    return get().unlocked.includes(id);
  },

  clearToast() {
    set({ pendingToast: null });
  },

  restoreFromSave(savedUnlocked) {
    if (!Array.isArray(savedUnlocked)) return;
    const valid = savedUnlocked.filter((id) => ACHIEVEMENTS[id]);
    set({ unlocked: valid, pendingToast: null });
  },

  reset() {
    set({ unlocked: [], pendingToast: null });
  },
}));
