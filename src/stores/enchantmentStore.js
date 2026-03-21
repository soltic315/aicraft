import { create } from 'zustand';

// エンチャントタイプの定義
export const ENCHANT_TYPES = {
  EFFICIENCY:  { id: 'efficiency',  name: '効率強化',   maxLevel: 3, icon: '⚡', color: '#ffe066' },
  UNBREAKING:  { id: 'unbreaking',  name: '耐久強化',   maxLevel: 3, icon: '🛡', color: '#66d9ff' },
  FORTUNE:     { id: 'fortune',     name: '幸運',       maxLevel: 3, icon: '🍀', color: '#66ff88' },
  SHARPNESS:   { id: 'sharpness',   name: '鋭さ',       maxLevel: 3, icon: '⚔️', color: '#ff6666' },
  PROTECTION:  { id: 'protection',  name: '保護',       maxLevel: 3, icon: '🔰', color: '#8888ff' },
  FIRE_ASPECT: { id: 'fire_aspect', name: '火炎',       maxLevel: 2, icon: '🔥', color: '#ff9933' },
  LOOTING:     { id: 'looting',     name: '略奪',       maxLevel: 3, icon: '💰', color: '#ffd700' },
};

// ツールに適用できるエンチャント
export const TOOL_ENCHANTS = ['efficiency', 'unbreaking', 'fortune'];
// 武器に適用できるエンチャント
export const WEAPON_ENCHANTS = ['sharpness', 'unbreaking', 'fire_aspect', 'looting'];
// 防具に適用できるエンチャント
export const ARMOR_ENCHANTS = ['protection', 'unbreaking'];

// アイテムがどのカテゴリか判定
export function getEnchantableCategory(blockType) {
  const { BlockType } = window.__aicraft_blocks || {};
  if (!BlockType) return null;
  const PICKAXES = [BlockType.PICKAXE, BlockType.STONE_PICKAXE, BlockType.IRON_PICKAXE, BlockType.DIAMOND_PICKAXE];
  const AXES    = [BlockType.AXE, BlockType.STONE_AXE, BlockType.IRON_AXE, BlockType.DIAMOND_AXE];
  const SHOVELS = [BlockType.SHOVEL, BlockType.STONE_SHOVEL, BlockType.IRON_SHOVEL, BlockType.DIAMOND_SHOVEL];
  const WEAPONS = [BlockType.BOW];
  const ARMORS  = [
    BlockType.LEATHER_HELMET, BlockType.LEATHER_CHESTPLATE, BlockType.LEATHER_LEGGINGS, BlockType.LEATHER_BOOTS,
    BlockType.IRON_HELMET,    BlockType.IRON_CHESTPLATE,    BlockType.IRON_LEGGINGS,    BlockType.IRON_BOOTS,
    BlockType.DIAMOND_HELMET, BlockType.DIAMOND_CHESTPLATE, BlockType.DIAMOND_LEGGINGS, BlockType.DIAMOND_BOOTS,
  ];

  if (PICKAXES.includes(blockType) || AXES.includes(blockType) || SHOVELS.includes(blockType)) return 'tool';
  if (WEAPONS.includes(blockType)) return 'weapon';
  if (ARMORS.includes(blockType)) return 'armor';
  return null;
}

// エンチャントがアイテムに適用可能か確認
export function getAvailableEnchants(blockType) {
  const category = getEnchantableCategory(blockType);
  if (!category) return [];
  if (category === 'tool')   return TOOL_ENCHANTS;
  if (category === 'weapon') return WEAPON_ENCHANTS;
  if (category === 'armor')  return ARMOR_ENCHANTS;
  return [];
}

// エンチャントの効果値を計算
export function getEnchantEffect(enchants, type) {
  if (!enchants) return 0;
  const e = enchants.find(e => e.type === type);
  return e ? e.level : 0;
}

// エンチャントのXPコスト
export function getEnchantCost(type, level) {
  const costs = { efficiency: 10, unbreaking: 15, fortune: 25, sharpness: 15, protection: 20, fire_aspect: 20, looting: 30 };
  return (costs[type] || 10) * level;
}

export const useEnchantmentStore = create((set, get) => ({
  // key: "slot_N" → [{ type, level }]
  enchantments: {},
  enchantPanelOpen: false,

  getEnchants(slotKey) {
    return get().enchantments[slotKey] || [];
  },

  hasEnchant(slotKey, type) {
    return (get().enchantments[slotKey] || []).some(e => e.type === type);
  },

  getEnchantLevel(slotKey, type) {
    const e = (get().enchantments[slotKey] || []).find(e => e.type === type);
    return e ? e.level : 0;
  },

  applyEnchant(slotKey, type, level) {
    const current = get().enchantments[slotKey] || [];
    const existing = current.findIndex(e => e.type === type);
    let next;
    if (existing >= 0) {
      next = [...current];
      next[existing] = { type, level };
    } else {
      next = [...current, { type, level }];
    }
    set(s => ({ enchantments: { ...s.enchantments, [slotKey]: next } }));
  },

  removeEnchants(slotKey) {
    set(s => {
      const e = { ...s.enchantments };
      delete e[slotKey];
      return { enchantments: e };
    });
  },

  // スロット移動時にエンチャントも追随させる
  moveEnchants(fromKey, toKey) {
    set(s => {
      const e = { ...s.enchantments };
      if (e[fromKey]) {
        e[toKey] = e[fromKey];
        delete e[fromKey];
      }
      return { enchantments: e };
    });
  },

  openEnchantPanel() { set({ enchantPanelOpen: true }); },
  closeEnchantPanel() { set({ enchantPanelOpen: false }); },

  restoreFromSave(saved) {
    if (saved && typeof saved === 'object') {
      set({ enchantments: saved });
    }
  },

  reset() {
    set({ enchantments: {}, enchantPanelOpen: false });
  },

  toJSON() {
    return get().enchantments;
  },
}));
