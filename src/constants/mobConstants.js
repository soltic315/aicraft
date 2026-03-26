// モブ系定数（スポーン・AI・ステータス）

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

// スケルトン
export const SKELETON_HP                = 8;
export const SKELETON_SPEED             = 1.5;   // ブロック/秒（弓を使うので遅め）
export const SKELETON_VIEW_RANGE        = 20;    // 追尾開始距離（ブロック）
export const SKELETON_ATTACK_RANGE      = 16;    // 弓の射程（ブロック）
export const SKELETON_ATTACK_DAMAGE     = 2;     // 矢1本のダメージ
export const SKELETON_ATTACK_INTERVAL   = 2.5;   // 射撃間隔（秒）
export const SKELETON_BURN_DAMAGE_PER_SEC = 4;   // 昼間の日光ダメージ（HP/秒）
export const SKELETON_SAFE_RANGE        = 5;     // この距離以内は後退する（近づかれないため）

// クリーパー
export const CREEPER_HP                 = 8;
export const CREEPER_SPEED              = 2.2;   // ブロック/秒
export const CREEPER_VIEW_RANGE         = 14;    // 追尾開始距離
export const CREEPER_FUSE_RANGE         = 2.5;   // 起爆開始距離（ブロック）
export const CREEPER_FUSE_TIME          = 1.5;   // 起爆までの時間（秒）
export const CREEPER_EXPLOSION_RADIUS   = 3;     // 爆発半径（ブロック）
export const CREEPER_EXPLOSION_DAMAGE   = 6;     // 爆発ダメージ（プレイヤーへ）

// クモ
export const SPIDER_HP                  = 8;
export const SPIDER_SPEED               = 2.8;   // ブロック/秒（速め）
export const SPIDER_VIEW_RANGE          = 18;    // 追尾開始距離（ブロック）
export const SPIDER_ATTACK_RANGE        = 1.5;   // 攻撃射程（ブロック）
export const SPIDER_ATTACK_DAMAGE       = 2;     // 1回の攻撃ダメージ
export const SPIDER_ATTACK_INTERVAL     = 2.0;   // 攻撃間隔（秒）
export const SPIDER_NEUTRAL_RANGE_DAY   = 5;     // 昼間はこの距離内に近づくと攻撃

// 羊
export const SHEEP_HP                   = 8;
export const SHEEP_SPEED                = 1.3;   // 通常移動速度（ブロック/秒）
export const SHEEP_FLEE_SPEED           = 2.8;   // 逃走速度（ブロック/秒）
export const SHEEP_FLEE_DURATION        = 3.5;   // 逃走継続時間（秒）
export const SHEEP_WANDER_INTERVAL      = 3.0;   // 方向転換間隔（秒）

// ニワトリ
export const CHICKEN_HP                 = 4;
export const CHICKEN_SPEED              = 1.8;   // 通常移動速度（ブロック/秒）
export const CHICKEN_FLEE_SPEED         = 3.5;   // 逃走速度（ブロック/秒）
export const CHICKEN_FLEE_DURATION      = 2.5;   // 逃走継続時間（秒）
export const CHICKEN_WANDER_INTERVAL    = 2.0;   // 方向転換間隔（秒）

// 豚
export const PIG_HP                     = 10;
export const PIG_SPEED                  = 1.5;   // 通常移動速度（ブロック/秒）
export const PIG_FLEE_SPEED             = 3.0;   // 逃走速度（ブロック/秒）
export const PIG_FLEE_DURATION          = 4.0;   // 逃走継続時間（秒）
export const PIG_WANDER_INTERVAL        = 3.0;   // 方向転換間隔（秒）

// ゾンビ
export const ZOMBIE_HP                  = 10;
export const ZOMBIE_SPEED               = 2.0;   // ブロック/秒
export const ZOMBIE_VIEW_RANGE          = 16;    // 追尾開始距離（ブロック）
export const ZOMBIE_ATTACK_RANGE        = 1.5;   // 攻撃射程（ブロック）
export const ZOMBIE_ATTACK_DAMAGE       = 2;     // 1回の攻撃ダメージ
export const ZOMBIE_ATTACK_INTERVAL     = 1.5;   // 攻撃間隔（秒）
export const ZOMBIE_BURN_DAMAGE_PER_SEC = 4;     // 昼間の日光ダメージ（HP/秒）
