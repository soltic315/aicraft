// ブロック型定義・メタデータ
// テクスチャ生成は BlockTextureGenerator.js に分離

export const BlockType = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  WATER: 7,
  PLANK: 8,
  GLASS: 9,
  CRAFTING_TABLE: 10,
  REPAIR_TABLE: 42,
  CHEST: 11,
  APPLE: 12,
  PICKAXE: 13,
  AXE: 14,
  SHOVEL: 15,
  // 食料
  BEEF: 25,
  COOKED_BEEF: 27,
  // 設備ブロック
  FURNACE: 26,
  // 液体
  LAVA: 34,
  // 装飾・バイオームブロック
  SNOW: 35,
  CACTUS: 36,
  TALL_GRASS: 37,
  FLOWER: 38,
  MUSHROOM: 39,
  ICE: 40,
  // 特殊ブロック
  BEDROCK: 41,
  // 追加鉱石・素材
  COAL_ORE: 28,
  GOLD_ORE: 29,
  DIAMOND_ORE: 30,
  COAL: 31,
  GOLD_INGOT: 32,
  DIAMOND: 33,
  // 石・鉄ティア素材
  COBBLESTONE: 16,
  IRON_ORE: 17,
  IRON_INGOT: 18,
  // 石ツール
  STONE_PICKAXE: 19,
  STONE_AXE: 20,
  STONE_SHOVEL: 21,
  // 鉄ツール
  IRON_PICKAXE: 22,
  IRON_AXE: 23,
  IRON_SHOVEL: 24,
  // 新素材アイテム
  LEATHER: 43,   // 革（牛からドロップ）
  BONE: 44,      // 骨（スケルトンからドロップ）
  ARROW: 45,     // 矢（スケルトンからドロップ）
  BOW: 46,       // 弓（クラフト可能）
  // ダイヤモンドティアツール
  DIAMOND_PICKAXE: 47,
  DIAMOND_AXE: 48,
  DIAMOND_SHOVEL: 49,
  // バイオームブロック
  JUNGLE_WOOD: 50,    // ジャングル木材
  JUNGLE_LEAVES: 51,  // ジャングル葉
  // 豚肉・調理済み豚肉
  PORK_CHOP: 52,      // 豚肉（豚からドロップ）
  COOKED_PORK: 53,    // 焼き豚肉（かまどで精錬）
  // 糸（クモからドロップ）
  STRING: 54,
  // 追加バイオームブロック
  SANDSTONE: 55,      // 砂岩（砂漠の地下）
  MOSSY_COBBLESTONE: 56, // 苔石（沼地）
  // サバンナバイオームブロック
  ACACIA_WOOD: 57,    // アカシア木材（サバンナ）
  ACACIA_LEAVES: 58,  // アカシアの葉
  // 桜バイオームブロック
  CHERRY_WOOD: 59,    // 桜木材
  CHERRY_LEAVES: 60,  // 桜の葉（ピンク）
  // 深層ブロック
  DEEPSLATE: 61,      // 深層岩（深いY座標）
  AMETHYST_ORE: 62,   // アメジスト鉱石（深層）
  // 素材アイテム
  AMETHYST: 63,       // アメジスト（アメジスト鉱石からドロップ）
  WOOL: 64,           // 羊毛（羊からドロップ）
  FEATHER: 65,        // 羽根（ニワトリからドロップ）
  // 食料
  CHICKEN: 66,        // 生チキン（ニワトリからドロップ）
  COOKED_CHICKEN: 67, // 焼きチキン（かまどで精錬）
  MUSHROOM_STEW: 68,  // きのこシチュー（キノコからクラフト）
  // 防具（革）
  LEATHER_HELMET:     69,
  LEATHER_CHESTPLATE: 70,
  LEATHER_LEGGINGS:   71,
  LEATHER_BOOTS:      72,
  // 防具（鉄）
  IRON_HELMET:        73,
  IRON_CHESTPLATE:    74,
  IRON_LEGGINGS:      75,
  IRON_BOOTS:         76,
  // 防具（ダイヤモンド）
  DIAMOND_HELMET:     77,
  DIAMOND_CHESTPLATE: 78,
  DIAMOND_LEGGINGS:   79,
  DIAMOND_BOOTS:      80,
  // 設備ブロック
  ENCHANTING_TABLE:   81,
  // 光源ブロック
  TORCH:              82,
  // 燃料素材
  CHARCOAL:           83,
};

export const BLOCK_NAMES = {
  [BlockType.GRASS]: '草ブロック',
  [BlockType.DIRT]: '土',
  [BlockType.STONE]: '石',
  [BlockType.WOOD]: '木材',
  [BlockType.LEAVES]: '葉',
  [BlockType.SAND]: '砂',
  [BlockType.WATER]: '水',
  [BlockType.PLANK]: '板材',
  [BlockType.GLASS]: 'ガラス',
  [BlockType.CRAFTING_TABLE]: '作業台',
  [BlockType.REPAIR_TABLE]: '修理台',
  [BlockType.ENCHANTING_TABLE]: 'エンチャント台',
  [BlockType.CHEST]: 'チェスト',
  [BlockType.APPLE]: 'リンゴ',
  [BlockType.BEEF]: '生肉',
  [BlockType.PICKAXE]: 'ツルハシ（木）',
  [BlockType.AXE]: '斧（木）',
  [BlockType.SHOVEL]: 'シャベル（木）',
  [BlockType.FURNACE]: 'かまど',
  [BlockType.COOKED_BEEF]: '焼き肉',
  [BlockType.LAVA]: '溶岩',
  [BlockType.SNOW]: '雪ブロック',
  [BlockType.CACTUS]: 'サボテン',
  [BlockType.ICE]: '氷',
  [BlockType.BEDROCK]: '岩盤',
  [BlockType.TALL_GRASS]: '草',
  [BlockType.FLOWER]: '花',
  [BlockType.MUSHROOM]: 'キノコ',
  [BlockType.COAL_ORE]: '石炭鉱石',
  [BlockType.GOLD_ORE]: '金鉱石',
  [BlockType.DIAMOND_ORE]: 'ダイヤモンド鉱石',
  [BlockType.COAL]: '石炭',
  [BlockType.GOLD_INGOT]: '金インゴット',
  [BlockType.DIAMOND]: 'ダイヤモンド',
  [BlockType.COBBLESTONE]: '丸石',
  [BlockType.IRON_ORE]: '鉄鉱石',
  [BlockType.IRON_INGOT]: '鉄インゴット',
  [BlockType.STONE_PICKAXE]: 'ツルハシ（石）',
  [BlockType.STONE_AXE]: '斧（石）',
  [BlockType.STONE_SHOVEL]: 'シャベル（石）',
  [BlockType.IRON_PICKAXE]: 'ツルハシ（鉄）',
  [BlockType.IRON_AXE]: '斧（鉄）',
  [BlockType.IRON_SHOVEL]: 'シャベル（鉄）',
  [BlockType.LEATHER]: '革',
  [BlockType.BONE]: '骨',
  [BlockType.ARROW]: '矢',
  [BlockType.BOW]: '弓',
  [BlockType.DIAMOND_PICKAXE]: 'ツルハシ（ダイヤ）',
  [BlockType.DIAMOND_AXE]: '斧（ダイヤ）',
  [BlockType.DIAMOND_SHOVEL]: 'シャベル（ダイヤ）',
  [BlockType.JUNGLE_WOOD]: 'ジャングル木材',
  [BlockType.JUNGLE_LEAVES]: 'ジャングルの葉',
  [BlockType.PORK_CHOP]: '豚肉',
  [BlockType.COOKED_PORK]: '焼き豚肉',
  [BlockType.STRING]: '糸',
  [BlockType.SANDSTONE]: '砂岩',
  [BlockType.MOSSY_COBBLESTONE]: '苔石',
  [BlockType.ACACIA_WOOD]: 'アカシア木材',
  [BlockType.ACACIA_LEAVES]: 'アカシアの葉',
  [BlockType.CHERRY_WOOD]: '桜木材',
  [BlockType.CHERRY_LEAVES]: '桜の葉',
  [BlockType.DEEPSLATE]: '深層岩',
  [BlockType.AMETHYST_ORE]: 'アメジスト鉱石',
  [BlockType.AMETHYST]: 'アメジスト',
  [BlockType.WOOL]: '羊毛',
  [BlockType.FEATHER]: '羽根',
  [BlockType.CHICKEN]: '生チキン',
  [BlockType.COOKED_CHICKEN]: '焼きチキン',
  [BlockType.MUSHROOM_STEW]: 'きのこシチュー',
  // 防具
  [BlockType.LEATHER_HELMET]:     '革のヘルメット',
  [BlockType.LEATHER_CHESTPLATE]: '革のチェストプレート',
  [BlockType.LEATHER_LEGGINGS]:   '革のレギンス',
  [BlockType.LEATHER_BOOTS]:      '革のブーツ',
  [BlockType.IRON_HELMET]:        '鉄のヘルメット',
  [BlockType.IRON_CHESTPLATE]:    '鉄のチェストプレート',
  [BlockType.IRON_LEGGINGS]:      '鉄のレギンス',
  [BlockType.IRON_BOOTS]:         '鉄のブーツ',
  [BlockType.DIAMOND_HELMET]:     'ダイヤのヘルメット',
  [BlockType.DIAMOND_CHESTPLATE]: 'ダイヤのチェストプレート',
  [BlockType.DIAMOND_LEGGINGS]:   'ダイヤのレギンス',
  [BlockType.DIAMOND_BOOTS]:      'ダイヤのブーツ',
  [BlockType.TORCH]:              'たいまつ',
  [BlockType.CHARCOAL]:           '木炭',
};

// クロス（X字スプライト）形状で描画するブロックの一覧
export const CROSS_BLOCK_TYPES = new Set([
  BlockType.TALL_GRASS,
  BlockType.FLOWER,
  BlockType.MUSHROOM,
  BlockType.TORCH,
]);

export const BLOCK_BREAK_DURATIONS = {
  [BlockType.GRASS]: 0.45,
  [BlockType.DIRT]: 0.55,
  [BlockType.STONE]: 1.4,
  [BlockType.WOOD]: 0.9,
  [BlockType.LEAVES]: 0.2,
  [BlockType.SAND]: 0.4,
  [BlockType.PLANK]: 0.5,
  [BlockType.GLASS]: 0.35,
  [BlockType.CRAFTING_TABLE]: 1.0,
  [BlockType.REPAIR_TABLE]: 1.0,
  [BlockType.ENCHANTING_TABLE]: 1.5,
  [BlockType.CHEST]: 1.1,
  [BlockType.COBBLESTONE]: 1.8,
  [BlockType.IRON_ORE]: 2.0,
  [BlockType.FURNACE]: 1.5,
  [BlockType.COAL_ORE]: 1.6,
  [BlockType.GOLD_ORE]: 2.2,
  [BlockType.DIAMOND_ORE]: 3.0,
  [BlockType.SNOW]: 0.3,
  [BlockType.CACTUS]: 0.4,
  [BlockType.TALL_GRASS]: 0.1,
  [BlockType.FLOWER]: 0.1,
  [BlockType.MUSHROOM]: 0.15,
  [BlockType.ICE]: 0.5,
  [BlockType.JUNGLE_WOOD]: 0.9,
  [BlockType.JUNGLE_LEAVES]: 0.2,
  [BlockType.SANDSTONE]: 1.2,
  [BlockType.MOSSY_COBBLESTONE]: 1.8,
  [BlockType.ACACIA_WOOD]: 0.9,
  [BlockType.ACACIA_LEAVES]: 0.2,
  [BlockType.CHERRY_WOOD]: 0.9,
  [BlockType.CHERRY_LEAVES]: 0.2,
  [BlockType.DEEPSLATE]: 2.5,
  [BlockType.AMETHYST_ORE]: 3.5,
  [BlockType.TORCH]: 0.1,
};

// ブロック破壊時のドロップアイテム上書き（デフォルトは自分自身をドロップ）
export const BLOCK_DROP_OVERRIDES = {
  [BlockType.STONE]: BlockType.COBBLESTONE,
  [BlockType.IRON_ORE]: BlockType.IRON_INGOT,
  [BlockType.COAL_ORE]: BlockType.COAL,
  [BlockType.DIAMOND_ORE]: BlockType.DIAMOND,
  [BlockType.AMETHYST_ORE]: BlockType.AMETHYST,
  [BlockType.DEEPSLATE]: BlockType.DEEPSLATE, // 深層岩は丸石にならない
  // 金鉱石はかまどで精錬が必要（鉱石自体をドロップ）
};

