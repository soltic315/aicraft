// Block type definitions and texture generation

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
};

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

// Color palettes for each block type (top, side, bottom)
const BLOCK_COLORS = {
  [BlockType.GRASS]: {
    top: '#5d9e3e',
    side: '#8B6914',
    bottom: '#8B6914',
    topDetail: '#4a8030',
    sideDetail: '#7a5c10',
  },
  [BlockType.DIRT]: {
    top: '#8B6914',
    side: '#8B6914',
    bottom: '#8B6914',
    topDetail: '#7a5c10',
    sideDetail: '#7a5c10',
  },
  [BlockType.STONE]: {
    top: '#808080',
    side: '#808080',
    bottom: '#808080',
    topDetail: '#6e6e6e',
    sideDetail: '#6e6e6e',
  },
  [BlockType.WOOD]: {
    top: '#a67c52',
    side: '#6b4226',
    bottom: '#a67c52',
    topDetail: '#8b6840',
    sideDetail: '#5a3620',
  },
  [BlockType.LEAVES]: {
    top: '#3a7a20',
    side: '#3a7a20',
    bottom: '#3a7a20',
    topDetail: '#2d6018',
    sideDetail: '#2d6018',
  },
  [BlockType.SAND]: {
    top: '#e8d68a',
    side: '#e0cc7a',
    bottom: '#d8c470',
    topDetail: '#d4c278',
    sideDetail: '#ccba68',
  },
  [BlockType.WATER]: {
    top: '#3070c0',
    side: '#2860b0',
    bottom: '#2050a0',
    topDetail: '#2860b0',
    sideDetail: '#2050a0',
  },
  [BlockType.PLANK]: {
    top: '#c79a63',
    side: '#b88952',
    bottom: '#c79a63',
    topDetail: '#ab7f48',
    sideDetail: '#9f7441',
  },
  [BlockType.GLASS]: {
    top: '#9fd6e9',
    side: '#8ac8de',
    bottom: '#88c3d8',
    topDetail: '#d5f0fb',
    sideDetail: '#c2e6f6',
  },
  [BlockType.CRAFTING_TABLE]: {
    top: '#9b6d3f',
    side: '#7b4d29',
    bottom: '#a67949',
    topDetail: '#d7b26e',
    sideDetail: '#5f3a1f',
  },
  [BlockType.CHEST]: {
    top: '#b27a3f',
    side: '#8f5b2d',
    bottom: '#7a4a24',
    topDetail: '#d49c5d',
    sideDetail: '#5f3518',
  },
  [BlockType.REPAIR_TABLE]: {
    top: '#9b6d3f',
    side: '#7b4d29',
    bottom: '#a67949',
    topDetail: '#d7b26e',
    sideDetail: '#5f3a1f',
  },
  [BlockType.COBBLESTONE]: {
    top: '#686868',
    side: '#686868',
    bottom: '#686868',
    topDetail: '#505050',
    sideDetail: '#505050',
  },
  [BlockType.IRON_ORE]: {
    top: '#808080',
    side: '#808080',
    bottom: '#808080',
    topDetail: '#c48040',
    sideDetail: '#a06030',
  },
  [BlockType.FURNACE]: {
    top: '#686868',
    side: '#505050',
    bottom: '#686868',
    topDetail: '#505050',
    sideDetail: '#382820',
  },
  [BlockType.COAL_ORE]: {
    top: '#808080',
    side: '#808080',
    bottom: '#808080',
    topDetail: '#1a1a1a',
    sideDetail: '#1a1a1a',
  },
  [BlockType.GOLD_ORE]: {
    top: '#808080',
    side: '#808080',
    bottom: '#808080',
    topDetail: '#d4a010',
    sideDetail: '#b88800',
  },
  [BlockType.DIAMOND_ORE]: {
    top: '#808080',
    side: '#808080',
    bottom: '#808080',
    topDetail: '#20c8d0',
    sideDetail: '#10a8b0',
  },
  [BlockType.LAVA]: {
    top: '#e04010',
    side: '#c83000',
    bottom: '#b02000',
    topDetail: '#f07020',
    sideDetail: '#a02000',
  },
  [BlockType.SNOW]: {
    top: '#f4f4f8',
    side: '#e8e8f0',
    bottom: '#dcdce4',
    topDetail: '#dcdce4',
    sideDetail: '#d0d0d8',
  },
  [BlockType.TALL_GRASS]: {
    top: '#4a9a30',
    side: '#4a9a30',
    bottom: '#4a9a30',
    topDetail: '#3a7a20',
    sideDetail: '#3a7a20',
  },
  [BlockType.FLOWER]: {
    top: '#e84030',
    side: '#e84030',
    bottom: '#e84030',
    topDetail: '#ffd020',
    sideDetail: '#3a8020',
  },
  [BlockType.MUSHROOM]: {
    top: '#c05020',
    side: '#c05020',
    bottom: '#c05020',
    topDetail: '#f0e8e0',
    sideDetail: '#905018',
  },
  [BlockType.CACTUS]: {
    top: '#2d7a20',
    side: '#2a6a1c',
    bottom: '#2d7a20',
    topDetail: '#1e5a14',
    sideDetail: '#1e5a14',
  },
  [BlockType.ICE]: {
    top: '#a0d8ef',
    side: '#90c8df',
    bottom: '#80b8cf',
    topDetail: '#c8ecff',
    sideDetail: '#b0d8f0',
  },
  [BlockType.BEDROCK]: {
    top: '#1e1e1e',
    side: '#1a1a1a',
    bottom: '#161616',
    topDetail: '#323232',
    sideDetail: '#2a2a2a',
  },
  [BlockType.JUNGLE_WOOD]: {
    top: '#8a6040',
    side: '#4e2e18',
    bottom: '#8a6040',
    topDetail: '#6e4c30',
    sideDetail: '#3a2010',
  },
  [BlockType.JUNGLE_LEAVES]: {
    top: '#1a6018',
    side: '#1a6018',
    bottom: '#1a6018',
    topDetail: '#0e4a0e',
    sideDetail: '#0e4a0e',
  },
  [BlockType.SANDSTONE]: {
    top: '#d4b870',
    side: '#c8aa5a',
    bottom: '#c0a050',
    topDetail: '#b89040',
    sideDetail: '#a87c30',
  },
  [BlockType.MOSSY_COBBLESTONE]: {
    top: '#5a7040',
    side: '#566840',
    bottom: '#525e38',
    topDetail: '#3e5028',
    sideDetail: '#3a4820',
  },
  [BlockType.ACACIA_WOOD]: {
    top: '#b07840',
    side: '#9a5a28',
    bottom: '#b07840',
    topDetail: '#8c6030',
    sideDetail: '#7a4418',
  },
  [BlockType.ACACIA_LEAVES]: {
    top: '#7ab830',
    side: '#7ab830',
    bottom: '#7ab830',
    topDetail: '#5a9020',
    sideDetail: '#5a9020',
  },
  [BlockType.CHERRY_WOOD]: {
    top: '#d08060',
    side: '#b85840',
    bottom: '#d08060',
    topDetail: '#b06848',
    sideDetail: '#984030',
  },
  [BlockType.CHERRY_LEAVES]: {
    top: '#f880b0',
    side: '#f070a0',
    bottom: '#f060a0',
    topDetail: '#e05090',
    sideDetail: '#e04080',
  },
  [BlockType.DEEPSLATE]: {
    top: '#3a3a50',
    side: '#303048',
    bottom: '#2a2a40',
    topDetail: '#4a4a60',
    sideDetail: '#3c3c54',
  },
  [BlockType.AMETHYST_ORE]: {
    top: '#3a3a50',
    side: '#303048',
    bottom: '#2a2a40',
    topDetail: '#a060d8',
    sideDetail: '#8040c0',
  },
};

// Simple seeded random for texture generation
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateFaceTexture(color, detailColor, size, seed, pattern) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(seed);

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  // Add pixel noise
  const pixelSize = size / 16;
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 16; y++) {
      if (rand() > 0.6) {
        const brightness = rand() * 0.15 - 0.075;
        ctx.fillStyle = adjustBrightness(detailColor, brightness);
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    }
  }

  // Pattern-specific details
  if (pattern === 'grass_top') {
    for (let i = 0; i < 20; i++) {
      const px = Math.floor(rand() * 16) * pixelSize;
      const py = Math.floor(rand() * 16) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#4a8530' : '#6ab348';
      ctx.fillRect(px, py, pixelSize, pixelSize);
    }
  } else if (pattern === 'grass_side') {
    // Green top strip on side of grass
    for (let x = 0; x < 16; x++) {
      const h = 2 + Math.floor(rand() * 2);
      for (let y = 0; y < h; y++) {
        ctx.fillStyle = rand() > 0.4 ? '#5d9e3e' : '#4a8030';
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    }
  } else if (pattern === 'wood_side') {
    // Bark lines
    for (let y = 0; y < 16; y++) {
      if (y % 3 === 0) {
        ctx.fillStyle = '#5a3620';
        ctx.fillRect(0, y * pixelSize, size, pixelSize * 0.6);
      }
    }
  } else if (pattern === 'wood_top') {
    // Rings
    ctx.strokeStyle = '#5a3620';
    ctx.lineWidth = 1;
    for (let r = 2; r < 8; r += 2) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, r * pixelSize, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (pattern === 'stone') {
    // Crack-like features
    for (let i = 0; i < 8; i++) {
      const sx = Math.floor(rand() * 14) * pixelSize;
      const sy = Math.floor(rand() * 14) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#707070' : '#909090';
      ctx.fillRect(sx, sy, pixelSize * 2, pixelSize);
    }
  } else if (pattern === 'leaves') {
    for (let i = 0; i < 30; i++) {
      const px = Math.floor(rand() * 16) * pixelSize;
      const py = Math.floor(rand() * 16) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#2d6018' : '#48a228';
      ctx.fillRect(px, py, pixelSize, pixelSize);
    }
  } else if (pattern === 'plank') {
    for (let y = 0; y < 16; y++) {
      if (y % 4 === 0) {
        ctx.fillStyle = '#9f7441';
        ctx.fillRect(0, y * pixelSize, size, Math.max(1, pixelSize * 0.6));
      }
    }
    for (let i = 0; i < 16; i++) {
      const px = Math.floor(rand() * 16) * pixelSize;
      const py = Math.floor(rand() * 16) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#d1a36a' : '#ae824c';
      ctx.fillRect(px, py, pixelSize, pixelSize);
    }
  } else if (pattern === 'glass') {
    ctx.strokeStyle = 'rgba(235, 248, 255, 0.7)';
    ctx.lineWidth = Math.max(1, pixelSize * 0.5);
    ctx.strokeRect(pixelSize * 1.5, pixelSize * 1.5, size - pixelSize * 3, size - pixelSize * 3);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(pixelSize * 3, pixelSize * 4);
    ctx.lineTo(pixelSize * 7, pixelSize * 2);
    ctx.stroke();
  } else if (pattern === 'crafting_top') {
    for (let x = 0; x < 16; x += 4) {
      for (let y = 0; y < 16; y += 4) {
        ctx.fillStyle = (x + y) % 8 === 0 ? '#c79a63' : '#8b5f34';
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize * 4, pixelSize * 4);
      }
    }
    ctx.strokeStyle = '#5a3620';
    ctx.lineWidth = Math.max(1, pixelSize * 0.6);
    ctx.strokeRect(0, 0, size, size);
  } else if (pattern === 'crafting_side') {
    for (let y = 1; y < 16; y += 3) {
      ctx.fillStyle = y % 2 === 0 ? '#6f4526' : '#8b5d34';
      ctx.fillRect(0, y * pixelSize, size, Math.max(1, pixelSize * 0.8));
    }
    ctx.fillStyle = '#4f2f18';
    ctx.fillRect(pixelSize * 2, pixelSize * 5, pixelSize * 12, pixelSize * 6);
  } else if (pattern === 'chest_top') {
    for (let y = 2; y < 16; y += 4) {
      ctx.fillStyle = y % 8 === 2 ? '#c79151' : '#9b6733';
      ctx.fillRect(0, y * pixelSize, size, Math.max(1, pixelSize * 0.8));
    }
    ctx.strokeStyle = '#4f2b13';
    ctx.lineWidth = Math.max(1, pixelSize * 0.6);
    ctx.strokeRect(0, 0, size, size);
  } else if (pattern === 'cobblestone') {
    // 丸石: 石よりやや濃いパッチとクラック
    for (let i = 0; i < 10; i++) {
      const sx = Math.floor(rand() * 13) * pixelSize;
      const sy = Math.floor(rand() * 13) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#4e4e4e' : '#7a7a7a';
      ctx.fillRect(sx, sy, pixelSize * (2 + Math.floor(rand() * 2)), pixelSize * (2 + Math.floor(rand() * 2)));
    }
    ctx.fillStyle = '#3e3e3e';
    for (let i = 0; i < 4; i++) {
      const sx = Math.floor(rand() * 12) * pixelSize;
      const sy = Math.floor(rand() * 12) * pixelSize;
      ctx.fillRect(sx, sy, pixelSize, pixelSize * (2 + Math.floor(rand() * 2)));
    }
  } else if (pattern === 'iron_ore') {
    // 鉄鉱石: 石の地に橙色の鉱脈スポット
    for (let i = 0; i < 8; i++) {
      const px = Math.floor(rand() * 13) * pixelSize;
      const py = Math.floor(rand() * 13) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#c48040' : '#9e6028';
      ctx.fillRect(px, py, pixelSize * (1 + Math.floor(rand() * 2)), pixelSize * (1 + Math.floor(rand() * 2)));
    }
    for (let i = 0; i < 4; i++) {
      const px = Math.floor(rand() * 13) * pixelSize;
      const py = Math.floor(rand() * 13) * pixelSize;
      ctx.fillStyle = '#706060';
      ctx.fillRect(px, py, pixelSize * 2, pixelSize);
    }
  } else if (pattern === 'furnace_side') {
    // かまど側面: 暗い石に炎の口
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(pixelSize * 4, pixelSize * 6, pixelSize * 8, pixelSize * 6);
    // 炎の色（橙→黄）
    ctx.fillStyle = '#e06010';
    ctx.fillRect(pixelSize * 5, pixelSize * 7, pixelSize * 6, pixelSize * 4);
    ctx.fillStyle = '#f8b010';
    ctx.fillRect(pixelSize * 6, pixelSize * 8, pixelSize * 4, pixelSize * 2);
    // 上部の煙突穴
    ctx.fillStyle = '#181818';
    ctx.fillRect(pixelSize * 7, pixelSize * 1, pixelSize * 2, pixelSize * 3);
  } else if (pattern === 'cactus_side') {
    // サボテン側面: 縦線と横の刺
    for (let y = 0; y < 16; y += 2) {
      ctx.fillStyle = '#1e5a14';
      ctx.fillRect(0, y * pixelSize, size, Math.max(1, pixelSize * 0.6));
    }
    // トゲ
    ctx.fillStyle = '#3a8a28';
    for (let y = 3; y < 16; y += 4) {
      ctx.fillRect(0, y * pixelSize, pixelSize * 2, pixelSize);
      ctx.fillRect(size - pixelSize * 2, y * pixelSize, pixelSize * 2, pixelSize);
    }
  } else if (pattern === 'coal_ore') {
    // 石炭鉱石: 黒いドット
    for (let i = 0; i < 10; i++) {
      const px = Math.floor(rand() * 13) * pixelSize;
      const py = Math.floor(rand() * 13) * pixelSize;
      ctx.fillStyle = rand() > 0.4 ? '#1a1a1a' : '#2e2e2e';
      ctx.fillRect(px, py, pixelSize * (1 + Math.floor(rand() * 2)), pixelSize * (1 + Math.floor(rand() * 2)));
    }
  } else if (pattern === 'gold_ore') {
    // 金鉱石: 黄色の鉱脈スポット
    for (let i = 0; i < 8; i++) {
      const px = Math.floor(rand() * 13) * pixelSize;
      const py = Math.floor(rand() * 13) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#d4a010' : '#b88800';
      ctx.fillRect(px, py, pixelSize * (1 + Math.floor(rand() * 2)), pixelSize * (1 + Math.floor(rand() * 2)));
    }
  } else if (pattern === 'diamond_ore') {
    // ダイヤ鉱石: 水色の結晶スポット
    for (let i = 0; i < 7; i++) {
      const px = Math.floor(rand() * 13) * pixelSize;
      const py = Math.floor(rand() * 13) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#20c8d0' : '#10a8b8';
      ctx.fillRect(px, py, pixelSize * (1 + Math.floor(rand() * 2)), pixelSize * (1 + Math.floor(rand() * 2)));
    }
  } else if (pattern === 'jungle_wood_side') {
    // ジャングル木材側面: 暗い縦縞
    for (let y = 0; y < 16; y++) {
      if (y % 3 === 0) {
        ctx.fillStyle = '#3a2010';
        ctx.fillRect(0, y * pixelSize, size, pixelSize * 0.6);
      }
    }
    ctx.fillStyle = '#2a1008';
    ctx.fillRect(pixelSize * 6, 0, pixelSize * 2, size);
  } else if (pattern === 'jungle_leaves') {
    // ジャングル葉: 濃い緑のランダムパターン
    for (let i = 0; i < 35; i++) {
      const px = Math.floor(rand() * 16) * pixelSize;
      const py = Math.floor(rand() * 16) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#0e4a0e' : '#268026';
      ctx.fillRect(px, py, pixelSize, pixelSize);
    }
  } else if (pattern === 'sandstone_top') {
    // 砂岩上面: 砂粒パターン＋水平ライン
    for (let i = 0; i < 12; i++) {
      const px = Math.floor(rand() * 14) * pixelSize;
      const py = Math.floor(rand() * 14) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#c8a848' : '#e0c070';
      ctx.fillRect(px, py, pixelSize * (1 + Math.floor(rand() * 2)), pixelSize);
    }
    for (let y = 4; y < 16; y += 4) {
      ctx.fillStyle = '#a88830';
      ctx.fillRect(0, y * pixelSize, size, Math.max(1, pixelSize * 0.5));
    }
  } else if (pattern === 'sandstone_side') {
    // 砂岩側面: 横ストライプ
    for (let y = 0; y < 16; y += 2) {
      ctx.fillStyle = y % 4 === 0 ? '#b89040' : '#caa850';
      ctx.fillRect(0, y * pixelSize, size, Math.max(1, pixelSize * 0.8));
    }
    for (let i = 0; i < 6; i++) {
      const px = Math.floor(rand() * 14) * pixelSize;
      const py = Math.floor(rand() * 14) * pixelSize;
      ctx.fillStyle = '#a07828';
      ctx.fillRect(px, py, pixelSize, pixelSize);
    }
  } else if (pattern === 'acacia_wood_side') {
    // アカシア側面: 対比の強い縦縞
    for (let y = 0; y < 16; y++) {
      if (y % 3 === 0) {
        ctx.fillStyle = '#7a4418';
        ctx.fillRect(0, y * pixelSize, size, pixelSize * 0.7);
      }
    }
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(pixelSize * 5, 0, pixelSize * 2, size);
    ctx.fillRect(pixelSize * 11, 0, pixelSize * 2, size);
  } else if (pattern === 'acacia_leaves') {
    // アカシア葉: 黄緑のランダムパターン
    for (let i = 0; i < 28; i++) {
      const px = Math.floor(rand() * 16) * pixelSize;
      const py = Math.floor(rand() * 16) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#5a9020' : '#7ac030';
      ctx.fillRect(px, py, pixelSize, pixelSize);
    }
  } else if (pattern === 'cherry_wood_side') {
    // 桜木材側面: 淡いピンク系縦縞
    for (let y = 0; y < 16; y++) {
      if (y % 3 === 0) {
        ctx.fillStyle = '#984030';
        ctx.fillRect(0, y * pixelSize, size, pixelSize * 0.7);
      }
    }
    ctx.fillStyle = '#7a2820';
    ctx.fillRect(pixelSize * 6, 0, pixelSize * 2, size);
  } else if (pattern === 'cherry_leaves') {
    // 桜葉: ピンクのランダムパターン
    for (let i = 0; i < 30; i++) {
      const px = Math.floor(rand() * 16) * pixelSize;
      const py = Math.floor(rand() * 16) * pixelSize;
      ctx.fillStyle = rand() > 0.4 ? '#e04080' : '#f890c0';
      ctx.fillRect(px, py, pixelSize, pixelSize);
    }
    // 白い花びら点
    for (let i = 0; i < 8; i++) {
      const px = Math.floor(rand() * 16) * pixelSize;
      const py = Math.floor(rand() * 16) * pixelSize;
      ctx.fillStyle = '#fff0f8';
      ctx.fillRect(px, py, pixelSize, pixelSize);
    }
  } else if (pattern === 'deepslate') {
    // 深層岩: 暗青灰色の石パターン
    for (let i = 0; i < 8; i++) {
      const sx = Math.floor(rand() * 14) * pixelSize;
      const sy = Math.floor(rand() * 14) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#3c3c54' : '#4a4a64';
      ctx.fillRect(sx, sy, pixelSize * 2, pixelSize);
    }
    for (let i = 0; i < 4; i++) {
      const sx = Math.floor(rand() * 12) * pixelSize;
      const sy = Math.floor(rand() * 12) * pixelSize;
      ctx.fillStyle = '#252535';
      ctx.fillRect(sx, sy, pixelSize, pixelSize * 2);
    }
  } else if (pattern === 'amethyst_ore') {
    // アメジスト鉱石: 深層岩に紫の結晶
    for (let i = 0; i < 8; i++) {
      const sx = Math.floor(rand() * 14) * pixelSize;
      const sy = Math.floor(rand() * 14) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#3c3c54' : '#4a4a64';
      ctx.fillRect(sx, sy, pixelSize * 2, pixelSize);
    }
    for (let i = 0; i < 7; i++) {
      const px = Math.floor(rand() * 13) * pixelSize;
      const py = Math.floor(rand() * 13) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#a060d8' : '#c080f0';
      ctx.fillRect(px, py, pixelSize * (1 + Math.floor(rand() * 2)), pixelSize * (1 + Math.floor(rand() * 2)));
    }
  } else if (pattern === 'mossy_cobblestone') {
    // 苔石: 丸石に苔色のスポット
    for (let i = 0; i < 10; i++) {
      const sx = Math.floor(rand() * 13) * pixelSize;
      const sy = Math.floor(rand() * 13) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#4e4e4e' : '#7a7a7a';
      ctx.fillRect(sx, sy, pixelSize * (2 + Math.floor(rand() * 2)), pixelSize * (2 + Math.floor(rand() * 2)));
    }
    // 苔スポット（緑）
    for (let i = 0; i < 8; i++) {
      const px = Math.floor(rand() * 13) * pixelSize;
      const py = Math.floor(rand() * 13) * pixelSize;
      ctx.fillStyle = rand() > 0.5 ? '#3a6028' : '#508040';
      ctx.fillRect(px, py, pixelSize * (1 + Math.floor(rand() * 2)), pixelSize * (1 + Math.floor(rand() * 2)));
    }
  } else if (pattern === 'chest_side') {
    for (let y = 1; y < 16; y += 3) {
      ctx.fillStyle = y % 2 === 0 ? '#7f4f26' : '#9a6532';
      ctx.fillRect(0, y * pixelSize, size, Math.max(1, pixelSize * 0.85));
    }
    ctx.fillStyle = '#3b250f';
    ctx.fillRect(pixelSize * 1.5, pixelSize * 6, pixelSize * 13, pixelSize * 1.6);
    ctx.fillStyle = '#c9a15c';
    ctx.fillRect(pixelSize * 7.2, pixelSize * 5.3, pixelSize * 1.6, pixelSize * 2.2);
  }

  return canvas;
}

function adjustBrightness(hex, amount) {
  const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + amount * 255));
  const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + amount * 255));
  const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + amount * 255));
  return `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
}

export function generateBreakOverlayTextures(stageCount = 8, size = 64) {
  const segments = [];
  const rand = seededRandom(71337);

  for (let i = 0; i < 18; i++) {
    const startX = rand() * size;
    const startY = rand() * size;
    const angle = rand() * Math.PI * 2;
    const length = size * (0.14 + rand() * 0.24);
    const endX = Math.min(size, Math.max(0, startX + Math.cos(angle) * length));
    const endY = Math.min(size, Math.max(0, startY + Math.sin(angle) * length));

    segments.push({
      startX,
      startY,
      endX,
      endY,
      width: 1 + rand() * 1.4,
    });

    if (rand() > 0.35) {
      const midX = startX + (endX - startX) * (0.35 + rand() * 0.3);
      const midY = startY + (endY - startY) * (0.35 + rand() * 0.3);
      const branchAngle = angle + (rand() > 0.5 ? 1 : -1) * (0.45 + rand() * 0.7);
      const branchLength = length * (0.25 + rand() * 0.2);
      segments.push({
        startX: midX,
        startY: midY,
        endX: Math.min(size, Math.max(0, midX + Math.cos(branchAngle) * branchLength)),
        endY: Math.min(size, Math.max(0, midY + Math.sin(branchAngle) * branchLength)),
        width: 0.8 + rand(),
      });
    }
  }

  return Array.from({ length: stageCount }, (_, stageIndex) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const visibleCount = Math.max(1, Math.ceil((segments.length * (stageIndex + 1)) / stageCount));
    const opacity = 0.18 + (stageIndex / Math.max(1, stageCount - 1)) * 0.55;

    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = `rgba(30, 20, 20, ${opacity})`;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < visibleCount; i++) {
      const segment = segments[i];
      ctx.lineWidth = segment.width;
      ctx.beginPath();
      ctx.moveTo(segment.startX, segment.startY);
      ctx.lineTo(segment.endX, segment.endY);
      ctx.stroke();
    }

    return canvas;
  });
}

// Generate textures for all block types
export function generateTextures() {
  const textures = {};
  const TEX_SIZE = 64;

  const facePatterns = {
    [BlockType.GRASS]: { top: 'grass_top', side: 'grass_side', bottom: 'noise' },
    [BlockType.DIRT]: { top: 'noise', side: 'noise', bottom: 'noise' },
    [BlockType.STONE]: { top: 'stone', side: 'stone', bottom: 'stone' },
    [BlockType.WOOD]: { top: 'wood_top', side: 'wood_side', bottom: 'wood_top' },
    [BlockType.LEAVES]: { top: 'leaves', side: 'leaves', bottom: 'leaves' },
    [BlockType.SAND]: { top: 'noise', side: 'noise', bottom: 'noise' },
    [BlockType.WATER]: { top: 'noise', side: 'noise', bottom: 'noise' },
    [BlockType.PLANK]: { top: 'plank', side: 'plank', bottom: 'plank' },
    [BlockType.GLASS]: { top: 'glass', side: 'glass', bottom: 'glass' },
    [BlockType.CRAFTING_TABLE]: {
      top: 'crafting_top',
      side: 'crafting_side',
      bottom: 'plank',
    },
    [BlockType.REPAIR_TABLE]: {
      top: 'crafting_top',
      side: 'crafting_side',
      bottom: 'plank',
    },
    [BlockType.CHEST]: {
      top: 'chest_top',
      side: 'chest_side',
      bottom: 'plank',
    },
    [BlockType.COBBLESTONE]: { top: 'cobblestone', side: 'cobblestone', bottom: 'cobblestone' },
    [BlockType.IRON_ORE]: { top: 'iron_ore', side: 'iron_ore', bottom: 'iron_ore' },
    [BlockType.FURNACE]: { top: 'cobblestone', side: 'furnace_side', bottom: 'cobblestone' },
    [BlockType.LAVA]: { top: 'noise', side: 'noise', bottom: 'noise' },
    [BlockType.SNOW]: { top: 'noise', side: 'noise', bottom: 'noise' },
    [BlockType.TALL_GRASS]: { top: 'leaves', side: 'leaves', bottom: 'leaves' },
    [BlockType.FLOWER]: { top: 'noise', side: 'noise', bottom: 'noise' },
    [BlockType.MUSHROOM]: { top: 'noise', side: 'noise', bottom: 'noise' },
    [BlockType.CACTUS]: { top: 'leaves', side: 'cactus_side', bottom: 'leaves' },
    [BlockType.COAL_ORE]: { top: 'coal_ore', side: 'coal_ore', bottom: 'coal_ore' },
    [BlockType.GOLD_ORE]: { top: 'gold_ore', side: 'gold_ore', bottom: 'gold_ore' },
    [BlockType.DIAMOND_ORE]: { top: 'diamond_ore', side: 'diamond_ore', bottom: 'diamond_ore' },
    [BlockType.ICE]: { top: 'glass', side: 'glass', bottom: 'glass' },
    [BlockType.BEDROCK]: { top: 'cobblestone', side: 'cobblestone', bottom: 'cobblestone' },
    [BlockType.JUNGLE_WOOD]: { top: 'wood_top', side: 'jungle_wood_side', bottom: 'wood_top' },
    [BlockType.JUNGLE_LEAVES]: { top: 'jungle_leaves', side: 'jungle_leaves', bottom: 'jungle_leaves' },
    [BlockType.SANDSTONE]: { top: 'sandstone_top', side: 'sandstone_side', bottom: 'sandstone_top' },
    [BlockType.MOSSY_COBBLESTONE]: { top: 'mossy_cobblestone', side: 'mossy_cobblestone', bottom: 'mossy_cobblestone' },
    [BlockType.ACACIA_WOOD]: { top: 'wood_top', side: 'acacia_wood_side', bottom: 'wood_top' },
    [BlockType.ACACIA_LEAVES]: { top: 'acacia_leaves', side: 'acacia_leaves', bottom: 'acacia_leaves' },
    [BlockType.CHERRY_WOOD]: { top: 'wood_top', side: 'cherry_wood_side', bottom: 'wood_top' },
    [BlockType.CHERRY_LEAVES]: { top: 'cherry_leaves', side: 'cherry_leaves', bottom: 'cherry_leaves' },
    [BlockType.DEEPSLATE]: { top: 'deepslate', side: 'deepslate', bottom: 'deepslate' },
    [BlockType.AMETHYST_ORE]: { top: 'amethyst_ore', side: 'amethyst_ore', bottom: 'amethyst_ore' },
  };

  for (const typeStr of Object.keys(BLOCK_COLORS)) {
    const type = Number(typeStr);
    const colors = BLOCK_COLORS[type];
    const patterns = facePatterns[type];

    textures[type] = {
      top: generateFaceTexture(colors.top, colors.topDetail, TEX_SIZE, type * 100 + 1, patterns.top),
      side: generateFaceTexture(colors.side, colors.sideDetail, TEX_SIZE, type * 100 + 2, patterns.side),
      bottom: generateFaceTexture(colors.bottom, colors.topDetail, TEX_SIZE, type * 100 + 3, patterns.bottom),
    };
  }

  return textures;
}

// 生肉アイコン
function generateBeefIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  // 肉本体（赤）
  ctx.fillStyle = '#b83020';
  ctx.beginPath();
  ctx.roundRect(6, 11, 20, 13, 3);
  ctx.fill();
  // 脂の白いライン
  ctx.fillStyle = '#e8c090';
  ctx.fillRect(7, 15, 18, 3);
  // 上部のハイライト
  ctx.fillStyle = '#d04030';
  ctx.fillRect(8, 9, 14, 4);
  // 骨（白い棒）
  ctx.fillStyle = '#f2eedc';
  ctx.fillRect(6, 12, 3, 9);
  ctx.beginPath();
  ctx.arc(7.5, 12, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(7.5, 21, 3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// 焼き肉アイコン
function generateCookedBeefIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  // 肉本体（焦げ茶）
  ctx.fillStyle = '#6b2810';
  ctx.beginPath();
  ctx.roundRect(6, 11, 20, 13, 3);
  ctx.fill();
  // 焼き色のライン
  ctx.fillStyle = '#4a1808';
  ctx.fillRect(7, 15, 18, 3);
  // 表面ハイライト
  ctx.fillStyle = '#8b3818';
  ctx.fillRect(8, 9, 14, 4);
  // 骨
  ctx.fillStyle = '#f2eedc';
  ctx.fillRect(6, 12, 3, 9);
  ctx.beginPath();
  ctx.arc(7.5, 12, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(7.5, 21, 3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// リンゴ専用アイコンを描画
function generateAppleIcon() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2 + 2;
  const r = size * 0.36;

  // リンゴ本体（赤）
  ctx.fillStyle = '#d63020';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // ハイライト
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // 茎
  ctx.strokeStyle = '#3a2010';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + 1.5, cy - r - 5);
  ctx.stroke();

  // 葉
  ctx.fillStyle = '#2e7a18';
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy - r - 3, 4, 2, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

// ツルハシアイコン（headColor で素材色変更可）
function generatePickaxeIcon(headColor = '#B0BCC8') {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#7B4F2E';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(7, 25); ctx.lineTo(20, 12); ctx.stroke();
  ctx.fillStyle = headColor;
  ctx.fillRect(16, 8, 12, 4);
  ctx.fillRect(16, 12, 4, 5);
  ctx.fillRect(24, 3, 4, 5);
  return c;
}

// 斧アイコン
function generateAxeIcon(headColor = '#B0BCC8') {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#7B4F2E';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(22, 25); ctx.lineTo(12, 10); ctx.stroke();
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.moveTo(8, 5); ctx.lineTo(20, 8); ctx.lineTo(17, 20); ctx.lineTo(8, 16);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = adjustBrightness(headColor, 0.15);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(8, 5); ctx.lineTo(8, 16); ctx.stroke();
  return c;
}

// シャベルアイコン
function generateShovelIcon(headColor = '#B0BCC8') {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#7B4F2E';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(16, 4); ctx.lineTo(16, 20); ctx.stroke();
  ctx.fillStyle = headColor;
  ctx.fillRect(10, 18, 12, 8);
  ctx.beginPath();
  ctx.arc(16, 26, 6, 0, Math.PI);
  ctx.fill();
  return c;
}

// 石炭アイコン
function generateCoalIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.roundRect(8, 8, 16, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#303030';
  ctx.fillRect(10, 10, 6, 6);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(16, 16, 6, 6);
  return c;
}

// 金インゴットアイコン
function generateGoldIngotIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c89010';
  ctx.beginPath();
  ctx.moveTo(6, 22); ctx.lineTo(10, 10); ctx.lineTo(22, 10); ctx.lineTo(26, 22);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8b820';
  ctx.fillRect(10, 10, 12, 4);
  ctx.fillStyle = '#a07008';
  ctx.fillRect(6, 20, 20, 2);
  return c;
}

// ダイヤモンドアイコン
function generateDiamondIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#20c8d0';
  // ダイヤ形
  ctx.beginPath();
  ctx.moveTo(16, 5); ctx.lineTo(27, 14); ctx.lineTo(16, 27); ctx.lineTo(5, 14);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#80e8ec';
  ctx.beginPath();
  ctx.moveTo(16, 5); ctx.lineTo(22, 12); ctx.lineTo(16, 14); ctx.lineTo(10, 12);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#10a8b0';
  ctx.beginPath();
  ctx.moveTo(16, 14); ctx.lineTo(22, 12); ctx.lineTo(27, 14); ctx.lineTo(16, 27);
  ctx.closePath(); ctx.fill();
  return c;
}

// 鉄インゴットアイコン
function generateIronIngotIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  // インゴット本体（台形）
  ctx.fillStyle = '#b8c0c8';
  ctx.beginPath();
  ctx.moveTo(6, 22); ctx.lineTo(10, 10); ctx.lineTo(22, 10); ctx.lineTo(26, 22);
  ctx.closePath(); ctx.fill();
  // 上面ハイライト
  ctx.fillStyle = '#d4dce4';
  ctx.fillRect(10, 10, 12, 4);
  // 下影
  ctx.fillStyle = '#8890a0';
  ctx.fillRect(6, 20, 20, 2);
  return c;
}

// 革アイコン
function generateLeatherIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8B5A2B';
  ctx.beginPath();
  ctx.roundRect(5, 8, 22, 16, 4);
  ctx.fill();
  ctx.fillStyle = '#6B3E1E';
  ctx.fillRect(8, 11, 16, 3);
  ctx.fillRect(8, 18, 16, 3);
  ctx.fillStyle = '#A0724A';
  ctx.fillRect(6, 9, 20, 2);
  return c;
}

// 骨アイコン
function generateBoneIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f0ece0';
  // 本体（斜め棒）
  ctx.save();
  ctx.translate(16, 16);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-2, -10, 4, 20);
  ctx.restore();
  // 端の丸み
  const ends = [[7, 7], [25, 25], [7, 25], [25, 7]];
  for (const [ex, ey] of ends) {
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

// 矢アイコン
function generateArrowIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  // 矢柄（茶色）
  ctx.strokeStyle = '#8B6914';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(6, 26);
  ctx.lineTo(24, 8);
  ctx.stroke();
  // 矢じり（灰色）
  ctx.fillStyle = '#a0a8b0';
  ctx.beginPath();
  ctx.moveTo(24, 8);
  ctx.lineTo(20, 10);
  ctx.lineTo(22, 14);
  ctx.closePath();
  ctx.fill();
  // 羽根（白）
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath();
  ctx.moveTo(6, 26);
  ctx.lineTo(4, 20);
  ctx.lineTo(10, 22);
  ctx.closePath();
  ctx.fill();
  return c;
}

// 弓アイコン
function generateBowIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  // 弓本体（弧）
  ctx.strokeStyle = '#8B5E3C';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(20, 16, 12, Math.PI * 0.6, Math.PI * 1.4);
  ctx.stroke();
  // 弦（細い線）
  ctx.strokeStyle = '#e8e8d0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(11, 7);
  ctx.lineTo(11, 25);
  ctx.stroke();
  // 矢（弦に添える）
  ctx.strokeStyle = '#a0784a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(11, 16);
  ctx.lineTo(22, 16);
  ctx.stroke();
  return c;
}

// 豚肉アイコン
function generatePorkChopIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  // 肉本体（ピンク系）
  ctx.fillStyle = '#d06878';
  ctx.beginPath();
  ctx.roundRect(6, 10, 20, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#f0a8a8';
  ctx.fillRect(8, 12, 16, 4);
  ctx.fillStyle = '#b04858';
  ctx.fillRect(7, 18, 18, 4);
  // 骨
  ctx.fillStyle = '#f2eedc';
  ctx.fillRect(6, 11, 3, 10);
  ctx.beginPath();
  ctx.arc(7.5, 11, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(7.5, 21, 3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// 焼き豚肉アイコン
function generateCookedPorkIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  // 焼けた肉（暗い茶）
  ctx.fillStyle = '#703018';
  ctx.beginPath();
  ctx.roundRect(6, 10, 20, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#5a2010';
  ctx.fillRect(8, 14, 16, 4);
  ctx.fillStyle = '#8a4020';
  ctx.fillRect(7, 10, 18, 4);
  // 骨
  ctx.fillStyle = '#f2eedc';
  ctx.fillRect(6, 11, 3, 10);
  ctx.beginPath();
  ctx.arc(7.5, 11, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(7.5, 21, 3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// アメジストアイコン
function generateAmethystIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9050c8';
  // 六角形風の結晶
  ctx.beginPath();
  ctx.moveTo(16, 4);
  ctx.lineTo(24, 10);
  ctx.lineTo(24, 22);
  ctx.lineTo(16, 28);
  ctx.lineTo(8, 22);
  ctx.lineTo(8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c080f0';
  ctx.beginPath();
  ctx.moveTo(16, 4);
  ctx.lineTo(24, 10);
  ctx.lineTo(16, 14);
  ctx.lineTo(8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6030a0';
  ctx.beginPath();
  ctx.moveTo(8, 22);
  ctx.lineTo(16, 28);
  ctx.lineTo(16, 14);
  ctx.lineTo(8, 10);
  ctx.closePath();
  ctx.fill();
  return c;
}

// 羊毛アイコン
function generateWoolIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f0ece8';
  ctx.beginPath();
  ctx.roundRect(4, 8, 24, 18, 5);
  ctx.fill();
  // 毛並みの波状表現
  for (let x = 4; x < 28; x += 5) {
    ctx.fillStyle = '#d8d0c8';
    ctx.beginPath();
    ctx.arc(x + 2, 12, 4, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = '#e0dcd8';
  ctx.fillRect(5, 13, 22, 10);
  return c;
}

// 羽根アイコン
function generateFeatherIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  // 羽根の軸
  ctx.strokeStyle = '#b8a890';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(6, 26);
  ctx.lineTo(26, 6);
  ctx.stroke();
  // 羽根のウェブ（片側）
  ctx.fillStyle = '#f0ece8';
  ctx.beginPath();
  ctx.moveTo(6, 26);
  ctx.quadraticCurveTo(6, 10, 26, 6);
  ctx.quadraticCurveTo(20, 16, 6, 26);
  ctx.fill();
  ctx.fillStyle = '#d8d4d0';
  ctx.beginPath();
  ctx.moveTo(6, 26);
  ctx.quadraticCurveTo(14, 22, 26, 6);
  ctx.quadraticCurveTo(18, 20, 6, 26);
  ctx.fill();
  return c;
}

// 生チキンアイコン
function generateChickenIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  // 鶏肉本体（淡いピンク）
  ctx.fillStyle = '#e0a890';
  ctx.beginPath();
  ctx.roundRect(7, 10, 18, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#c88878';
  ctx.fillRect(8, 14, 16, 4);
  ctx.fillStyle = '#e8c0b0';
  ctx.fillRect(8, 11, 16, 4);
  // 骨
  ctx.fillStyle = '#f2eedc';
  ctx.fillRect(7, 11, 3, 10);
  ctx.beginPath();
  ctx.arc(8.5, 11, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(8.5, 21, 3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// 焼きチキンアイコン
function generateCookedChickenIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  // 焼き色（黄茶）
  ctx.fillStyle = '#c07840';
  ctx.beginPath();
  ctx.roundRect(7, 10, 18, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#a05820';
  ctx.fillRect(8, 14, 16, 4);
  ctx.fillStyle = '#d89050';
  ctx.fillRect(8, 11, 16, 4);
  // 骨
  ctx.fillStyle = '#f2eedc';
  ctx.fillRect(7, 11, 3, 10);
  ctx.beginPath();
  ctx.arc(8.5, 11, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(8.5, 21, 3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// きのこシチューアイコン
function generateMushroomStewIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  // ボウル
  ctx.fillStyle = '#8b5e3c';
  ctx.beginPath();
  ctx.moveTo(5, 14);
  ctx.lineTo(27, 14);
  ctx.lineTo(24, 26);
  ctx.lineTo(8, 26);
  ctx.closePath();
  ctx.fill();
  // スープ（赤茶）
  ctx.fillStyle = '#c04020';
  ctx.beginPath();
  ctx.moveTo(7, 16);
  ctx.lineTo(25, 16);
  ctx.lineTo(23, 24);
  ctx.lineTo(9, 24);
  ctx.closePath();
  ctx.fill();
  // キノコのかけら
  ctx.fillStyle = '#e06030';
  ctx.beginPath();
  ctx.arc(14, 18, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0e8e0';
  ctx.fillRect(12, 18, 4, 3);
  // ボウルの縁
  ctx.fillStyle = '#6a4024';
  ctx.fillRect(5, 13, 22, 3);
  return c;
}

// 糸アイコン
function generateStringIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#e8e8d8';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  // 糸を縦に3本
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 8;
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.bezierCurveTo(x - 3, 12, x + 3, 20, x, 28);
    ctx.stroke();
  }
  return c;
}

// Generate a small icon canvas for hotbar display
export function generateBlockIcon(type) {
  if (type === BlockType.APPLE)       return generateAppleIcon();
  if (type === BlockType.BEEF)        return generateBeefIcon();
  if (type === BlockType.COOKED_BEEF) return generateCookedBeefIcon();
  if (type === BlockType.PICKAXE) return generatePickaxeIcon('#B0BCC8');
  if (type === BlockType.AXE)     return generateAxeIcon('#B0BCC8');
  if (type === BlockType.SHOVEL)  return generateShovelIcon('#B0BCC8');
  if (type === BlockType.IRON_INGOT)    return generateIronIngotIcon();
  if (type === BlockType.COAL)          return generateCoalIcon();
  if (type === BlockType.GOLD_INGOT)    return generateGoldIngotIcon();
  if (type === BlockType.DIAMOND)       return generateDiamondIcon();
  if (type === BlockType.STONE_PICKAXE) return generatePickaxeIcon('#8a8a8a');
  if (type === BlockType.STONE_AXE)     return generateAxeIcon('#8a8a8a');
  if (type === BlockType.STONE_SHOVEL)  return generateShovelIcon('#8a8a8a');
  if (type === BlockType.IRON_PICKAXE)  return generatePickaxeIcon('#d0d8e0');
  if (type === BlockType.IRON_AXE)      return generateAxeIcon('#d0d8e0');
  if (type === BlockType.IRON_SHOVEL)   return generateShovelIcon('#d0d8e0');
  if (type === BlockType.LEATHER)         return generateLeatherIcon();
  if (type === BlockType.BONE)            return generateBoneIcon();
  if (type === BlockType.ARROW)           return generateArrowIcon();
  if (type === BlockType.BOW)             return generateBowIcon();
  if (type === BlockType.DIAMOND_PICKAXE) return generatePickaxeIcon('#60e8f0');
  if (type === BlockType.DIAMOND_AXE)     return generateAxeIcon('#60e8f0');
  if (type === BlockType.DIAMOND_SHOVEL)  return generateShovelIcon('#60e8f0');
  if (type === BlockType.PORK_CHOP)   return generatePorkChopIcon();
  if (type === BlockType.COOKED_PORK) return generateCookedPorkIcon();
  if (type === BlockType.STRING)      return generateStringIcon();
  if (type === BlockType.AMETHYST)      return generateAmethystIcon();
  if (type === BlockType.WOOL)          return generateWoolIcon();
  if (type === BlockType.FEATHER)       return generateFeatherIcon();
  if (type === BlockType.CHICKEN)       return generateChickenIcon();
  if (type === BlockType.COOKED_CHICKEN) return generateCookedChickenIcon();
  if (type === BlockType.MUSHROOM_STEW) return generateMushroomStewIcon();

  const colors = BLOCK_COLORS[type];
  if (!colors) return null;

  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Draw isometric block icon
  const cx = size / 2;
  const cy = size / 2;
  const s = size * 0.35;

  // Top face
  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s, cy - s * 0.4);
  ctx.lineTo(cx, cy + s * 0.2);
  ctx.lineTo(cx - s, cy - s * 0.4);
  ctx.closePath();
  ctx.fill();

  // Left face
  ctx.fillStyle = adjustBrightness(colors.side, -0.1);
  ctx.beginPath();
  ctx.moveTo(cx - s, cy - s * 0.4);
  ctx.lineTo(cx, cy + s * 0.2);
  ctx.lineTo(cx, cy + s);
  ctx.lineTo(cx - s, cy + s * 0.3);
  ctx.closePath();
  ctx.fill();

  // Right face
  ctx.fillStyle = adjustBrightness(colors.side, -0.2);
  ctx.beginPath();
  ctx.moveTo(cx + s, cy - s * 0.4);
  ctx.lineTo(cx, cy + s * 0.2);
  ctx.lineTo(cx, cy + s);
  ctx.lineTo(cx + s, cy + s * 0.3);
  ctx.closePath();
  ctx.fill();

  return canvas;
}
