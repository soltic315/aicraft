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
};

export const BLOCK_NAMES = {
  [BlockType.GRASS]: '草ブロック',
  [BlockType.DIRT]: '土',
  [BlockType.STONE]: '石',
  [BlockType.WOOD]: '木材',
  [BlockType.LEAVES]: '葉',
  [BlockType.SAND]: '砂',
  [BlockType.WATER]: '水',
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
  }

  return canvas;
}

function adjustBrightness(hex, amount) {
  const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + amount * 255));
  const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + amount * 255));
  const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + amount * 255));
  return `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
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
