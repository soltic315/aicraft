import { create } from 'zustand';
import { BlockType } from '../blocks.js';

// 防具スロット定義
export const ARMOR_SLOTS = ['helmet', 'chestplate', 'leggings', 'boots'];

// BlockType数値 → 防具キー文字列
export const BLOCK_TO_ARMOR_KEY = {
  [BlockType.LEATHER_HELMET]:     'leather_helmet',
  [BlockType.LEATHER_CHESTPLATE]: 'leather_chestplate',
  [BlockType.LEATHER_LEGGINGS]:   'leather_leggings',
  [BlockType.LEATHER_BOOTS]:      'leather_boots',
  [BlockType.IRON_HELMET]:        'iron_helmet',
  [BlockType.IRON_CHESTPLATE]:    'iron_chestplate',
  [BlockType.IRON_LEGGINGS]:      'iron_leggings',
  [BlockType.IRON_BOOTS]:         'iron_boots',
  [BlockType.DIAMOND_HELMET]:     'diamond_helmet',
  [BlockType.DIAMOND_CHESTPLATE]: 'diamond_chestplate',
  [BlockType.DIAMOND_LEGGINGS]:   'diamond_leggings',
  [BlockType.DIAMOND_BOOTS]:      'diamond_boots',
};

// 防具キー文字列 → BlockType数値
export const ARMOR_KEY_TO_BLOCK = {};
for (const [k, v] of Object.entries(BLOCK_TO_ARMOR_KEY)) {
  ARMOR_KEY_TO_BLOCK[v] = Number(k);
}

// 防具ごとの防御ポイント（1ポイント = 4%ダメージ軽減）
export const ARMOR_DEFENSE = {
  leather_helmet:     1,
  leather_chestplate: 3,
  leather_leggings:   2,
  leather_boots:      1,
  iron_helmet:        2,
  iron_chestplate:    6,
  iron_leggings:      5,
  iron_boots:         2,
  diamond_helmet:     3,
  diamond_chestplate: 8,
  diamond_leggings:   6,
  diamond_boots:      3,
};

// 防具スロット → 対応できる防具キー
export const ARMOR_SLOT_TYPES = {
  helmet:     ['leather_helmet',     'iron_helmet',     'diamond_helmet'],
  chestplate: ['leather_chestplate', 'iron_chestplate', 'diamond_chestplate'],
  leggings:   ['leather_leggings',   'iron_leggings',   'diamond_leggings'],
  boots:      ['leather_boots',      'iron_boots',      'diamond_boots'],
};

// 防具キー → スロット
export const ARMOR_TYPE_TO_SLOT = {};
for (const [slot, types] of Object.entries(ARMOR_SLOT_TYPES)) {
  for (const t of types) ARMOR_TYPE_TO_SLOT[t] = slot;
}

// 装備中の防具から合計防御ポイントを計算
function calcTotalDefense(equipped) {
  return ARMOR_SLOTS.reduce((sum, slot) => {
    const type = equipped[slot];
    return sum + (type ? (ARMOR_DEFENSE[type] ?? 0) : 0);
  }, 0);
}

export const useArmorStore = create((set, get) => ({
  equipped: {
    helmet:     null,
    chestplate: null,
    leggings:   null,
    boots:      null,
  },
  totalDefense: 0,

  // 防具を装備する（前の装備はインベントリに戻す必要あり → 呼び出し元で処理）
  equip(slot, armorType) {
    const equipped = { ...get().equipped, [slot]: armorType };
    set({ equipped, totalDefense: calcTotalDefense(equipped) });
  },

  // 防具を外す
  unequip(slot) {
    const equipped = { ...get().equipped, [slot]: null };
    set({ equipped, totalDefense: calcTotalDefense(equipped) });
  },

  // スロットに対応する防具タイプを自動判定して装備（BlockType数値 or キー文字列）
  equipAutoSlot(armorTypeOrKey) {
    // BlockType数値をキー文字列に変換
    const key = typeof armorTypeOrKey === 'number'
      ? BLOCK_TO_ARMOR_KEY[armorTypeOrKey]
      : armorTypeOrKey;
    const slot = ARMOR_TYPE_TO_SLOT[key];
    if (!slot) return false;
    const equipped = { ...get().equipped, [slot]: key };
    set({ equipped, totalDefense: calcTotalDefense(equipped) });
    return slot;
  },

  restoreFromSave(savedEquipped) {
    if (!savedEquipped || typeof savedEquipped !== 'object') return;
    const equipped = {
      helmet:     ARMOR_DEFENSE[savedEquipped.helmet]     != null ? savedEquipped.helmet     : null,
      chestplate: ARMOR_DEFENSE[savedEquipped.chestplate] != null ? savedEquipped.chestplate : null,
      leggings:   ARMOR_DEFENSE[savedEquipped.leggings]   != null ? savedEquipped.leggings   : null,
      boots:      ARMOR_DEFENSE[savedEquipped.boots]      != null ? savedEquipped.boots       : null,
    };
    set({ equipped, totalDefense: calcTotalDefense(equipped) });
  },

  reset() {
    set({ equipped: { helmet: null, chestplate: null, leggings: null, boots: null }, totalDefense: 0 });
  },
}));
