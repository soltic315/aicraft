// Game constants and utility functions
import * as THREE from 'three';
import { BlockType } from './blocks.js';

export const GAME_VERSION = '3.21.0';
export const SETTINGS_STORAGE_KEY = 'aicraft_settings_v1';
export const SAVE_STORAGE_KEY = 'aicraft_save_slot_1';
export const SAVE_SCHEMA_VERSION = 2;

// インベントリスロット数
export const HOTBAR_SIZE      = 9;   // ホットバー（1〜9キー）
export const INVENTORY_SIZE   = 18;  // バックパック（インベントリ画面）
export const TOTAL_SLOTS      = HOTBAR_SIZE + INVENTORY_SIZE; // 27

// チェスト・回収に使うアイテム種別一覧
export const ALL_ITEM_TYPES = [
  BlockType.GRASS, BlockType.DIRT, BlockType.STONE, BlockType.WOOD,
  BlockType.LEAVES, BlockType.SAND, BlockType.WATER, BlockType.PLANK,
  BlockType.GLASS, BlockType.CRAFTING_TABLE, BlockType.CHEST,
  BlockType.COBBLESTONE, BlockType.IRON_ORE, BlockType.IRON_INGOT,
  BlockType.APPLE, BlockType.BEEF, BlockType.COOKED_BEEF,
  BlockType.FURNACE,
  BlockType.PICKAXE, BlockType.AXE, BlockType.SHOVEL,
  BlockType.STONE_PICKAXE, BlockType.STONE_AXE, BlockType.STONE_SHOVEL,
  BlockType.IRON_PICKAXE, BlockType.IRON_AXE, BlockType.IRON_SHOVEL,
];
export const AUTO_SAVE_INTERVAL_MS = 30 * 1000;
export const CHEST_AUTO_CLOSE_DISTANCE = 6; // この距離（ブロック数）を超えたらチェストを自動で閉じる

export const SPRINT_SPEED_MULTIPLIER = 1.3;
export const SNEAK_SPEED_MULTIPLIER = 0.4;

// 水中移動
export const WATER_SPEED_MULTIPLIER = 0.4;
export const WATER_GRAVITY = 5;
export const SWIM_FORCE = 4;

// 溺れダメージ
export const DROWNING_GRACE_PERIOD = 10;
export const DROWNING_DAMAGE_INTERVAL = 1;
export const DROWNING_DAMAGE = 2;

// 窒息ダメージ
export const SUFFOCATION_DAMAGE_INTERVAL = 0.5;
export const SUFFOCATION_DAMAGE = 1;

// 空腹システム
export const HUNGER_MAX = 20;
export const HUNGER_DRAIN_IDLE = 0.04;
export const HUNGER_DRAIN_MOVE = 0.22;
export const HUNGER_DRAIN_SPRINT = 0.42;
export const HUNGER_LOW_THRESHOLD = 6;
export const HUNGER_STARVE_DAMAGE_INTERVAL = 2;
export const HUNGER_STARVE_DAMAGE = 1;
export const APPLE_HUNGER_RESTORE = 4;
export const BEEF_HUNGER_RESTORE = 3;
export const COOKED_BEEF_HUNGER_RESTORE = 6;

// 食料ごとのステータス
export const FOOD_STATS = {
  [BlockType.APPLE]:       { restore: 4, name: 'リンゴ' },
  [BlockType.BEEF]:        { restore: 3, name: '生肉' },
  [BlockType.COOKED_BEEF]: { restore: 6, name: '焼き肉' },
};

export const FALL_DAMAGE_SAFE_SPEED = 12;
export const FALL_DAMAGE_HEAVY_SPEED = 16;
export const FALL_DAMAGE_LIGHT_SCALE = 1.2;
export const FALL_DAMAGE_HEAVY_SCALE = 1.9;
export const DAY_NIGHT_CYCLE_SECONDS = 240;
export const CHEST_STORAGE_LIMIT = 90;
export const PLACE_COOLDOWN = 150;

// プレイヤー攻撃
export const PLAYER_ATTACK_REACH        = 3.5;  // 攻撃リーチ（ブロック）
export const PLAYER_ATTACK_DAMAGE_BASE  = 1;    // 素手ダメージ
export const PLAYER_ATTACK_DAMAGE_TOOL  = 3;    // ツール装備時ダメージ
export const PLAYER_ATTACK_COOLDOWN     = 0.5;  // 攻撃クールダウン（秒）

// ノックバック
export const KNOCKBACK_MOB_FORCE        = 8;    // モブへのノックバック水平力（m/s）
export const KNOCKBACK_PLAYER_FORCE     = 6;    // プレイヤーへのノックバック水平力（m/s）
export const KNOCKBACK_PLAYER_VERTICAL  = 3;    // プレイヤーへのノックバック上向き力（m/s）

// モブシステム
export const MOB_MAX_COUNT          = 8;    // 同時存在できるモブの最大数
export const MOB_SPAWN_INTERVAL     = 15;   // スポーン試行間隔（秒）
export const MOB_SPAWN_MIN_DIST     = 8;    // スポーン最小距離（ブロック）
export const MOB_SPAWN_MAX_DIST     = 24;   // スポーン最大距離（ブロック）
export const MOB_DESPAWN_DIST       = 64;   // デスポーン距離（ブロック）
export const MOB_SEA_LEVEL_MIN      = 20;   // この高度以下にはスポーンしない

// 動物（友好モブ）
export const ANIMAL_MAX_COUNT       = 5;    // 同時存在できる動物の最大数
export const ANIMAL_SPAWN_INTERVAL  = 20;   // スポーン試行間隔（秒）
export const COW_HP                 = 10;
export const COW_SPEED              = 1.2;  // 通常移動速度（ブロック/秒）
export const COW_FLEE_SPEED         = 2.5;  // 逃走速度（ブロック/秒）
export const COW_FLEE_DURATION      = 3.0;  // 逃走継続時間（秒）
export const COW_WANDER_INTERVAL    = 3.0;  // 方向転換間隔（秒）

// ゾンビ
export const ZOMBIE_HP                  = 10;
export const ZOMBIE_SPEED               = 2.0;   // ブロック/秒
export const ZOMBIE_VIEW_RANGE          = 16;    // 追尾開始距離（ブロック）
export const ZOMBIE_ATTACK_RANGE        = 1.5;   // 攻撃射程（ブロック）
export const ZOMBIE_ATTACK_DAMAGE       = 2;     // 1回の攻撃ダメージ
export const ZOMBIE_ATTACK_INTERVAL     = 1.5;   // 攻撃間隔（秒）
export const ZOMBIE_BURN_DAMAGE_PER_SEC = 4;     // 昼間の日光ダメージ（HP/秒）

export const DAY_SKY_COLOR = new THREE.Color(0x87CEEB);
export const NIGHT_SKY_COLOR = new THREE.Color(0x071020);
export const DAY_FOG_COLOR = new THREE.Color(0x87CEEB);
export const NIGHT_FOG_COLOR = new THREE.Color(0x12182F);
export const DAY_AMBIENT_COLOR = new THREE.Color(0xffffff);
export const NIGHT_AMBIENT_COLOR = new THREE.Color(0x7d88b0);
export const DAY_SUN_COLOR = new THREE.Color(0xfff5db);
export const NIGHT_MOON_COLOR = new THREE.Color(0x8ea0d0);

export const DEFAULT_SETTINGS = {
  sensitivity: 0.002,
  bgmVolume: 0.35,
  seVolume: 0.55,
  renderDistance: 5,
  uiScale: 1,
  highContrast: false,
  showDebugInfo: false,
};

// スタック上限
export const STACK_LIMIT = 64;

// ツール類はスタック上限 1（耐久値管理のため）
export const ITEM_STACK_LIMITS = {
  [BlockType.PICKAXE]:       1,
  [BlockType.AXE]:           1,
  [BlockType.SHOVEL]:        1,
  [BlockType.STONE_PICKAXE]: 1,
  [BlockType.STONE_AXE]:     1,
  [BlockType.STONE_SHOVEL]:  1,
  [BlockType.IRON_PICKAXE]:  1,
  [BlockType.IRON_AXE]:      1,
  [BlockType.IRON_SHOVEL]:   1,
};

export function getStackLimit(type) {
  return ITEM_STACK_LIMITS[type] ?? STACK_LIMIT;
}

// 食料アイテムのセット（設置不可・右クリックで食べる）
export const FOOD_ITEMS = new Set([BlockType.APPLE, BlockType.BEEF, BlockType.COOKED_BEEF]);

// 設置不可アイテムのセット（ツール類 + 素材アイテム）
export const TOOL_ITEMS = new Set([
  BlockType.PICKAXE,       BlockType.AXE,       BlockType.SHOVEL,
  BlockType.STONE_PICKAXE, BlockType.STONE_AXE, BlockType.STONE_SHOVEL,
  BlockType.IRON_PICKAXE,  BlockType.IRON_AXE,  BlockType.IRON_SHOVEL,
  BlockType.IRON_INGOT,
]);

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
  [BlockType.PICKAXE]: 0,
  [BlockType.AXE]: 0,
  [BlockType.SHOVEL]: 0,
  [BlockType.COBBLESTONE]: 0,
  [BlockType.IRON_ORE]: 0,
  [BlockType.IRON_INGOT]: 0,
  [BlockType.STONE_PICKAXE]: 0,
  [BlockType.STONE_AXE]: 0,
  [BlockType.STONE_SHOVEL]: 0,
  [BlockType.IRON_PICKAXE]: 0,
  [BlockType.IRON_AXE]: 0,
  [BlockType.IRON_SHOVEL]: 0,
};

export const CRAFT_RECIPES = [
  {
    id: 'plank_from_wood',
    label: '木材 x1 -> 板材 x4',
    consumes: { [BlockType.WOOD]: 1 },
    produces: { [BlockType.PLANK]: 4 },
  },
  {
    id: 'glass_from_sand',
    label: '砂 x2 -> ガラス x1',
    consumes: { [BlockType.SAND]: 2 },
    produces: { [BlockType.GLASS]: 1 },
  },
  {
    id: 'crafting_table_from_plank',
    label: '板材 x4 -> 作業台 x1',
    consumes: { [BlockType.PLANK]: 4 },
    produces: { [BlockType.CRAFTING_TABLE]: 1 },
  },
  {
    id: 'chest_from_plank',
    label: '板材 x8 -> チェスト x1',
    consumes: { [BlockType.PLANK]: 8 },
    produces: { [BlockType.CHEST]: 1 },
  },
  {
    id: 'pickaxe_from_plank',
    label: '板材 x2 -> ツルハシ x1',
    consumes: { [BlockType.PLANK]: 2 },
    produces: { [BlockType.PICKAXE]: 1 },
  },
  {
    id: 'axe_from_plank',
    label: '板材 x2 -> 斧 x1',
    consumes: { [BlockType.PLANK]: 2 },
    produces: { [BlockType.AXE]: 1 },
  },
  {
    id: 'shovel_from_plank',
    label: '板材 x2 -> シャベル x1',
    consumes: { [BlockType.PLANK]: 2 },
    produces: { [BlockType.SHOVEL]: 1 },
  },
  // 木ツール修理レシピ（板材 x1 消費で耐久値 +30）
  {
    id: 'repair_pickaxe',
    label: 'ツルハシ（木）修理（板材 x1 -> 耐久 +30）',
    consumes: { [BlockType.PICKAXE]: 1, [BlockType.PLANK]: 1 },
    produces: { [BlockType.PICKAXE]: 1 },
    repairTool: 'pickaxe',
    repairAmount: 30,
  },
  {
    id: 'repair_axe',
    label: '斧（木）修理（板材 x1 -> 耐久 +30）',
    consumes: { [BlockType.AXE]: 1, [BlockType.PLANK]: 1 },
    produces: { [BlockType.AXE]: 1 },
    repairTool: 'axe',
    repairAmount: 30,
  },
  {
    id: 'repair_shovel',
    label: 'シャベル（木）修理（板材 x1 -> 耐久 +30）',
    consumes: { [BlockType.SHOVEL]: 1, [BlockType.PLANK]: 1 },
    produces: { [BlockType.SHOVEL]: 1 },
    repairTool: 'shovel',
    repairAmount: 30,
  },
  // 石ツールレシピ（丸石 x2）
  {
    id: 'stone_pickaxe',
    label: '丸石 x2 -> ツルハシ（石） x1',
    consumes: { [BlockType.COBBLESTONE]: 2 },
    produces: { [BlockType.STONE_PICKAXE]: 1 },
  },
  {
    id: 'stone_axe',
    label: '丸石 x2 -> 斧（石） x1',
    consumes: { [BlockType.COBBLESTONE]: 2 },
    produces: { [BlockType.STONE_AXE]: 1 },
  },
  {
    id: 'stone_shovel',
    label: '丸石 x2 -> シャベル（石） x1',
    consumes: { [BlockType.COBBLESTONE]: 2 },
    produces: { [BlockType.STONE_SHOVEL]: 1 },
  },
  // 石ツール修理レシピ（丸石 x1 消費で耐久値 +66）
  {
    id: 'repair_stone_pickaxe',
    label: 'ツルハシ（石）修理（丸石 x1 -> 耐久 +66）',
    consumes: { [BlockType.STONE_PICKAXE]: 1, [BlockType.COBBLESTONE]: 1 },
    produces: { [BlockType.STONE_PICKAXE]: 1 },
    repairTool: 'stone_pickaxe',
    repairAmount: 66,
  },
  {
    id: 'repair_stone_axe',
    label: '斧（石）修理（丸石 x1 -> 耐久 +66）',
    consumes: { [BlockType.STONE_AXE]: 1, [BlockType.COBBLESTONE]: 1 },
    produces: { [BlockType.STONE_AXE]: 1 },
    repairTool: 'stone_axe',
    repairAmount: 66,
  },
  {
    id: 'repair_stone_shovel',
    label: 'シャベル（石）修理（丸石 x1 -> 耐久 +66）',
    consumes: { [BlockType.STONE_SHOVEL]: 1, [BlockType.COBBLESTONE]: 1 },
    produces: { [BlockType.STONE_SHOVEL]: 1 },
    repairTool: 'stone_shovel',
    repairAmount: 66,
  },
  // 鉄ツールレシピ（鉄インゴット x2）
  {
    id: 'iron_pickaxe',
    label: '鉄インゴット x2 -> ツルハシ（鉄） x1',
    consumes: { [BlockType.IRON_INGOT]: 2 },
    produces: { [BlockType.IRON_PICKAXE]: 1 },
  },
  {
    id: 'iron_axe',
    label: '鉄インゴット x2 -> 斧（鉄） x1',
    consumes: { [BlockType.IRON_INGOT]: 2 },
    produces: { [BlockType.IRON_AXE]: 1 },
  },
  {
    id: 'iron_shovel',
    label: '鉄インゴット x2 -> シャベル（鉄） x1',
    consumes: { [BlockType.IRON_INGOT]: 2 },
    produces: { [BlockType.IRON_SHOVEL]: 1 },
  },
  // 鉄ツール修理レシピ（鉄インゴット x1 消費で耐久値 +125）
  {
    id: 'repair_iron_pickaxe',
    label: 'ツルハシ（鉄）修理（鉄インゴット x1 -> 耐久 +125）',
    consumes: { [BlockType.IRON_PICKAXE]: 1, [BlockType.IRON_INGOT]: 1 },
    produces: { [BlockType.IRON_PICKAXE]: 1 },
    repairTool: 'iron_pickaxe',
    repairAmount: 125,
  },
  {
    id: 'repair_iron_axe',
    label: '斧（鉄）修理（鉄インゴット x1 -> 耐久 +125）',
    consumes: { [BlockType.IRON_AXE]: 1, [BlockType.IRON_INGOT]: 1 },
    produces: { [BlockType.IRON_AXE]: 1 },
    repairTool: 'iron_axe',
    repairAmount: 125,
  },
  {
    id: 'repair_iron_shovel',
    label: 'シャベル（鉄）修理（鉄インゴット x1 -> 耐久 +125）',
    consumes: { [BlockType.IRON_SHOVEL]: 1, [BlockType.IRON_INGOT]: 1 },
    produces: { [BlockType.IRON_SHOVEL]: 1 },
    repairTool: 'iron_shovel',
    repairAmount: 125,
  },
  // かまどクラフト（丸石 x4）
  {
    id: 'furnace_from_cobblestone',
    label: '丸石 x4 -> かまど x1',
    consumes: { [BlockType.COBBLESTONE]: 4 },
    produces: { [BlockType.FURNACE]: 1 },
  },
];

// 精錬レシピ（かまどで使用）
export const SMELT_RECIPES = [
  {
    id: 'smelt_iron_ore',
    label: '鉄鉱石 -> 鉄インゴット',
    inputType: BlockType.IRON_ORE,
    inputCount: 1,
    outputType: BlockType.IRON_INGOT,
    outputCount: 1,
    fuelType: BlockType.WOOD,
    fuelCount: 1,
  },
  {
    id: 'smelt_beef',
    label: '生肉 -> 焼き肉',
    inputType: BlockType.BEEF,
    inputCount: 1,
    outputType: BlockType.COOKED_BEEF,
    outputCount: 1,
    fuelType: BlockType.WOOD,
    fuelCount: 1,
  },
];

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function calculateFallDamage(landingSpeed) {
  const speed = Math.abs(Number(landingSpeed) || 0);
  if (speed <= FALL_DAMAGE_SAFE_SPEED) return 0;

  const lightImpact = Math.min(speed, FALL_DAMAGE_HEAVY_SPEED) - FALL_DAMAGE_SAFE_SPEED;
  const heavyImpact = Math.max(0, speed - FALL_DAMAGE_HEAVY_SPEED);
  const damage = (lightImpact * FALL_DAMAGE_LIGHT_SCALE) + (heavyImpact * FALL_DAMAGE_HEAVY_SCALE);
  return Math.max(1, Math.ceil(damage));
}

export function sanitizeSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const highContrast = raw.highContrast === true || raw.highContrast === 'true';
  const showDebugInfo = raw.showDebugInfo === true || raw.showDebugInfo === 'true';
  return {
    sensitivity: clamp(Number(raw.sensitivity) || DEFAULT_SETTINGS.sensitivity, 0.0005, 0.004),
    bgmVolume: clamp(Number(raw.bgmVolume) || 0, 0, 1),
    seVolume: clamp(Number(raw.seVolume) || 0, 0, 1),
    renderDistance: clamp(Math.floor(Number(raw.renderDistance) || DEFAULT_SETTINGS.renderDistance), 2, 8),
    uiScale: clamp(Number(raw.uiScale) || DEFAULT_SETTINGS.uiScale, 0.7, 2),
    highContrast,
    showDebugInfo,
  };
}

export function getPosKey(x, y, z) {
  return `${x},${y},${z}`;
}

export function parsePosKey(key) {
  const [x, y, z] = key.split(',').map(Number);
  return { x, y, z };
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
