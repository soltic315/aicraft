// サバイバル系定数（空腹・ダメージ・移動）
import { BlockType } from '../blocks.js';

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
  [BlockType.APPLE]:          { restore: 4, name: 'リンゴ' },
  [BlockType.BEEF]:           { restore: 3, name: '生肉' },
  [BlockType.COOKED_BEEF]:    { restore: 6, name: '焼き肉' },
  [BlockType.PORK_CHOP]:      { restore: 3, name: '豚肉' },
  [BlockType.COOKED_PORK]:    { restore: 6, name: '焼き豚肉' },
  [BlockType.CHICKEN]:        { restore: 2, name: '生チキン' },
  [BlockType.COOKED_CHICKEN]: { restore: 5, name: '焼きチキン' },
  [BlockType.MUSHROOM_STEW]:  { restore: 8, name: 'きのこシチュー' },
};

// 落下ダメージ
export const FALL_DAMAGE_SAFE_SPEED = 12;
export const FALL_DAMAGE_HEAVY_SPEED = 16;
export const FALL_DAMAGE_LIGHT_SCALE = 1.2;
export const FALL_DAMAGE_HEAVY_SCALE = 1.9;

// プレイヤー攻撃
export const PLAYER_ATTACK_REACH        = 3.5;  // 攻撃リーチ（ブロック）
export const PLAYER_ATTACK_DAMAGE_BASE  = 1;    // 素手ダメージ
export const PLAYER_ATTACK_DAMAGE_TOOL  = 3;    // ツール装備時ダメージ
export const PLAYER_ATTACK_COOLDOWN     = 0.5;  // 攻撃クールダウン（秒）

// ノックバック
export const KNOCKBACK_MOB_FORCE        = 8;    // モブへのノックバック水平力（m/s）
export const KNOCKBACK_PLAYER_FORCE     = 6;    // プレイヤーへのノックバック水平力（m/s）
export const KNOCKBACK_PLAYER_VERTICAL  = 3;    // プレイヤーへのノックバック上向き力（m/s）
