// コアゲーム定数（バージョン・インベントリ・アイテム分類）
import { BlockType } from '../blocks.js';

export const GAME_VERSION = '5.2.0';
export const SETTINGS_STORAGE_KEY = 'aicraft_settings_v1';
export const SAVE_STORAGE_KEY = 'aicraft_save_slot_1';
export const SAVE_SCHEMA_VERSION = 2;

// インベントリスロット数
export const HOTBAR_SIZE      = 9;   // ホットバー（1〜9キー）
export const INVENTORY_SIZE   = 18;  // バックパック（インベントリ画面）
export const TOTAL_SLOTS      = HOTBAR_SIZE + INVENTORY_SIZE; // 27

export const AUTO_SAVE_INTERVAL_MS = 30 * 1000;
export const CHEST_AUTO_CLOSE_DISTANCE = 6; // この距離（ブロック数）を超えたらチェストを自動で閉じる
export const CHEST_STORAGE_LIMIT = 90;
export const PLACE_COOLDOWN = 150;

// スタック上限
export const STACK_LIMIT = 64;

// ツール類はスタック上限 1（耐久値管理のため）
export const ITEM_STACK_LIMITS = {
  [BlockType.PICKAXE]:          1,
  [BlockType.AXE]:              1,
  [BlockType.SHOVEL]:           1,
  [BlockType.STONE_PICKAXE]:    1,
  [BlockType.STONE_AXE]:        1,
  [BlockType.STONE_SHOVEL]:     1,
  [BlockType.IRON_PICKAXE]:     1,
  [BlockType.IRON_AXE]:         1,
  [BlockType.IRON_SHOVEL]:      1,
  [BlockType.DIAMOND_PICKAXE]:  1,
  [BlockType.DIAMOND_AXE]:      1,
  [BlockType.DIAMOND_SHOVEL]:   1,
  [BlockType.BOW]:              1,
  // 防具もスタック1
  [BlockType.LEATHER_HELMET]:     1,
  [BlockType.LEATHER_CHESTPLATE]: 1,
  [BlockType.LEATHER_LEGGINGS]:   1,
  [BlockType.LEATHER_BOOTS]:      1,
  [BlockType.IRON_HELMET]:        1,
  [BlockType.IRON_CHESTPLATE]:    1,
  [BlockType.IRON_LEGGINGS]:      1,
  [BlockType.IRON_BOOTS]:         1,
  [BlockType.DIAMOND_HELMET]:     1,
  [BlockType.DIAMOND_CHESTPLATE]: 1,
  [BlockType.DIAMOND_LEGGINGS]:   1,
  [BlockType.DIAMOND_BOOTS]:      1,
};

export function getStackLimit(type) {
  return ITEM_STACK_LIMITS[type] ?? STACK_LIMIT;
}

// 食料アイテムのセット（設置不可・右クリックで食べる）
export const FOOD_ITEMS = new Set([
  BlockType.APPLE, BlockType.BEEF, BlockType.COOKED_BEEF,
  BlockType.PORK_CHOP, BlockType.COOKED_PORK,
  BlockType.CHICKEN, BlockType.COOKED_CHICKEN, BlockType.MUSHROOM_STEW,
]);

// 設置不可アイテムのセット（ツール類 + 素材アイテム + 防具）
export const TOOL_ITEMS = new Set([
  BlockType.PICKAXE,       BlockType.AXE,       BlockType.SHOVEL,
  BlockType.STONE_PICKAXE, BlockType.STONE_AXE, BlockType.STONE_SHOVEL,
  BlockType.IRON_PICKAXE,  BlockType.IRON_AXE,  BlockType.IRON_SHOVEL,
  BlockType.DIAMOND_PICKAXE, BlockType.DIAMOND_AXE, BlockType.DIAMOND_SHOVEL,
  BlockType.BOW, BlockType.ARROW,
  BlockType.IRON_INGOT, BlockType.COAL, BlockType.GOLD_INGOT, BlockType.DIAMOND,
  BlockType.LEATHER, BlockType.BONE, BlockType.STRING,
  BlockType.AMETHYST, BlockType.WOOL, BlockType.FEATHER,
  BlockType.LAVA, // 溶岩は設置不可（液体は破壊のみ）
  // 防具
  BlockType.LEATHER_HELMET, BlockType.LEATHER_CHESTPLATE, BlockType.LEATHER_LEGGINGS, BlockType.LEATHER_BOOTS,
  BlockType.IRON_HELMET,    BlockType.IRON_CHESTPLATE,    BlockType.IRON_LEGGINGS,    BlockType.IRON_BOOTS,
  BlockType.DIAMOND_HELMET, BlockType.DIAMOND_CHESTPLATE, BlockType.DIAMOND_LEGGINGS, BlockType.DIAMOND_BOOTS,
]);

// 防具アイテムのセット（クリックで装備できる）
export const ARMOR_ITEMS = new Set([
  BlockType.LEATHER_HELMET, BlockType.LEATHER_CHESTPLATE, BlockType.LEATHER_LEGGINGS, BlockType.LEATHER_BOOTS,
  BlockType.IRON_HELMET,    BlockType.IRON_CHESTPLATE,    BlockType.IRON_LEGGINGS,    BlockType.IRON_BOOTS,
  BlockType.DIAMOND_HELMET, BlockType.DIAMOND_CHESTPLATE, BlockType.DIAMOND_LEGGINGS, BlockType.DIAMOND_BOOTS,
]);

// チェスト・回収に使うアイテム種別一覧
export const ALL_ITEM_TYPES = [
  BlockType.GRASS, BlockType.DIRT, BlockType.STONE, BlockType.WOOD,
  BlockType.LEAVES, BlockType.SAND, BlockType.WATER, BlockType.PLANK,
  BlockType.GLASS, BlockType.CRAFTING_TABLE, BlockType.CHEST,
  BlockType.COBBLESTONE, BlockType.IRON_ORE, BlockType.IRON_INGOT,
  BlockType.COAL_ORE, BlockType.GOLD_ORE, BlockType.DIAMOND_ORE,
  BlockType.COAL, BlockType.GOLD_INGOT, BlockType.DIAMOND,
  BlockType.LAVA,
  BlockType.APPLE, BlockType.BEEF, BlockType.COOKED_BEEF,
  BlockType.FURNACE,
  BlockType.PICKAXE, BlockType.AXE, BlockType.SHOVEL,
  BlockType.STONE_PICKAXE, BlockType.STONE_AXE, BlockType.STONE_SHOVEL,
  BlockType.IRON_PICKAXE, BlockType.IRON_AXE, BlockType.IRON_SHOVEL,
  BlockType.LEATHER, BlockType.BONE, BlockType.ARROW, BlockType.BOW,
  BlockType.DIAMOND_PICKAXE, BlockType.DIAMOND_AXE, BlockType.DIAMOND_SHOVEL,
  BlockType.JUNGLE_WOOD, BlockType.JUNGLE_LEAVES,
  BlockType.PORK_CHOP, BlockType.COOKED_PORK, BlockType.STRING,
  BlockType.SANDSTONE, BlockType.MOSSY_COBBLESTONE,
  BlockType.ACACIA_WOOD, BlockType.ACACIA_LEAVES,
  BlockType.CHERRY_WOOD, BlockType.CHERRY_LEAVES,
  BlockType.DEEPSLATE, BlockType.AMETHYST_ORE, BlockType.AMETHYST,
  BlockType.WOOL, BlockType.FEATHER,
  BlockType.CHICKEN, BlockType.COOKED_CHICKEN, BlockType.MUSHROOM_STEW,
  // 防具
  BlockType.LEATHER_HELMET, BlockType.LEATHER_CHESTPLATE, BlockType.LEATHER_LEGGINGS, BlockType.LEATHER_BOOTS,
  BlockType.IRON_HELMET,    BlockType.IRON_CHESTPLATE,    BlockType.IRON_LEGGINGS,    BlockType.IRON_BOOTS,
  BlockType.DIAMOND_HELMET, BlockType.DIAMOND_CHESTPLATE, BlockType.DIAMOND_LEGGINGS, BlockType.DIAMOND_BOOTS,
  BlockType.ENCHANTING_TABLE,
];

// デフォルト設定
export const DEFAULT_SETTINGS = {
  sensitivity: 0.002,
  bgmVolume: 0.35,
  seVolume: 0.55,
  renderDistance: 5,
  uiScale: 1,
  highContrast: false,
  showDebugInfo: false,
  showMinimap: true,
  fov: 75, // 視野角（度）
  targetFps: 60,
};

// 難易度設定
export const DIFFICULTY = {
  EASY:   'easy',
  NORMAL: 'normal',
  HARD:   'hard',
};

// 難易度ごとのパラメーター倍率
export const DIFFICULTY_SETTINGS = {
  [DIFFICULTY.EASY]: {
    label: 'イージー',
    description: '敵が弱く、空腹消費も少ない。初心者向け。',
    mobDamageMult:   0.5,   // モブの攻撃力倍率
    mobHpMult:       0.7,   // モブのHP倍率
    mobSpeedMult:    0.8,   // モブの移動速度倍率
    mobMaxCount:     5,     // 最大モブ数
    hungerDrainMult: 0.6,   // 空腹消費倍率
    playerRegenRate: 1.5,   // 自然回復倍率
  },
  [DIFFICULTY.NORMAL]: {
    label: 'ノーマル',
    description: 'バランスの取れた標準難易度。',
    mobDamageMult:   1.0,
    mobHpMult:       1.0,
    mobSpeedMult:    1.0,
    mobMaxCount:     8,
    hungerDrainMult: 1.0,
    playerRegenRate: 1.0,
  },
  [DIFFICULTY.HARD]: {
    label: 'ハード',
    description: '敵が強く、空腹消費も多い。上級者向け。',
    mobDamageMult:   1.5,   // 攻撃力1.5倍
    mobHpMult:       1.4,   // HP1.4倍
    mobSpeedMult:    1.2,   // 速度1.2倍
    mobMaxCount:     12,    // 最大12体
    hungerDrainMult: 1.5,   // 空腹消費1.5倍
    playerRegenRate: 0.6,   // 自然回復60%
  },
};

// モブ討伐XP報酬
export const MOB_XP_REWARDS = {
  'ゾンビ':     5,
  'スケルトン': 7,
  'クリーパー': 12,
  'クモ':       5,
  '牛':         1,
  '豚':         1,
  '羊':         2,
  'ニワトリ':   1,
};

// 全アイテムを 0 から開始（ブロック破壊・クラフトで入手）
export const STARTER_INVENTORY = {
  [BlockType.GRASS]: 0,
  [BlockType.DIRT]: 0,
  [BlockType.STONE]: 0,
  [BlockType.WOOD]: 0,
  [BlockType.LEAVES]: 0,
  [BlockType.SAND]: 0,
  [BlockType.WATER]: 0,
  [BlockType.PLANK]: 0,
  [BlockType.GLASS]: 0,
  [BlockType.CRAFTING_TABLE]: 0,
  [BlockType.CHEST]: 0,
  [BlockType.APPLE]: 0,
  [BlockType.BEEF]: 0,
  [BlockType.COOKED_BEEF]: 0,
  [BlockType.FURNACE]: 0,
  [BlockType.ENCHANTING_TABLE]: 0,
  [BlockType.PICKAXE]: 0,
  [BlockType.AXE]: 0,
  [BlockType.SHOVEL]: 0,
  [BlockType.COBBLESTONE]: 0,
  [BlockType.IRON_ORE]: 0,
  [BlockType.IRON_INGOT]: 0,
  [BlockType.COAL_ORE]: 0,
  [BlockType.GOLD_ORE]: 0,
  [BlockType.DIAMOND_ORE]: 0,
  [BlockType.COAL]: 0,
  [BlockType.GOLD_INGOT]: 0,
  [BlockType.DIAMOND]: 0,
  [BlockType.STONE_PICKAXE]: 0,
  [BlockType.STONE_AXE]: 0,
  [BlockType.STONE_SHOVEL]: 0,
  [BlockType.IRON_PICKAXE]: 0,
  [BlockType.IRON_AXE]: 0,
  [BlockType.IRON_SHOVEL]: 0,
  [BlockType.LEATHER]: 0,
  [BlockType.BONE]: 0,
  [BlockType.ARROW]: 0,
  [BlockType.BOW]: 0,
  [BlockType.DIAMOND_PICKAXE]: 0,
  [BlockType.DIAMOND_AXE]: 0,
  [BlockType.DIAMOND_SHOVEL]: 0,
  [BlockType.JUNGLE_WOOD]: 0,
  [BlockType.JUNGLE_LEAVES]: 0,
  [BlockType.PORK_CHOP]: 0,
  [BlockType.COOKED_PORK]: 0,
  [BlockType.STRING]: 0,
  [BlockType.SANDSTONE]: 0,
  [BlockType.MOSSY_COBBLESTONE]: 0,
  [BlockType.ACACIA_WOOD]: 0,
  [BlockType.ACACIA_LEAVES]: 0,
  [BlockType.CHERRY_WOOD]: 0,
  [BlockType.CHERRY_LEAVES]: 0,
  [BlockType.DEEPSLATE]: 0,
  [BlockType.AMETHYST_ORE]: 0,
  [BlockType.AMETHYST]: 0,
  [BlockType.WOOL]: 0,
  [BlockType.FEATHER]: 0,
  [BlockType.CHICKEN]: 0,
  [BlockType.COOKED_CHICKEN]: 0,
  [BlockType.MUSHROOM_STEW]: 0,
  // 防具
  [BlockType.LEATHER_HELMET]: 0,     [BlockType.LEATHER_CHESTPLATE]: 0,
  [BlockType.LEATHER_LEGGINGS]: 0,   [BlockType.LEATHER_BOOTS]: 0,
  [BlockType.IRON_HELMET]: 0,        [BlockType.IRON_CHESTPLATE]: 0,
  [BlockType.IRON_LEGGINGS]: 0,      [BlockType.IRON_BOOTS]: 0,
  [BlockType.DIAMOND_HELMET]: 0,     [BlockType.DIAMOND_CHESTPLATE]: 0,
  [BlockType.DIAMOND_LEGGINGS]: 0,   [BlockType.DIAMOND_BOOTS]: 0,
};
