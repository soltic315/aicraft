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
  CHEST: 11,
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
  [BlockType.CHEST]: 'チェスト',
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
  [BlockType.CHEST]: 1.1,
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
    [BlockType.CHEST]: {
      top: 'chest_top',
      side: 'chest_side',
      bottom: 'plank',
    },
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

// Generate a small icon canvas for hotbar display
export function generateBlockIcon(type) {
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
