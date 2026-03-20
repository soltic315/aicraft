// Web Worker: メインスレッドをブロックせずにチャンクブロックデータを生成する
import { Noise } from './noise.js';
import { BlockType } from './blocks.js';

const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 128;
const SEA_LEVEL = 40;

// ノイズインスタンスをシードごとにキャッシュ（同じシードで再初期化を避ける）
let currentSeed = null;
let noise = null;
let treeNoise = null;
let oreNoise = null;
let caveNoise = null;
let tempNoise = null;
let humidNoise = null;

// シードが変わったときのみノイズを再初期化する
function initNoise(seed) {
  if (seed === currentSeed) return;
  currentSeed = seed;
  noise     = new Noise(seed);
  treeNoise = new Noise(noise.perm[0] * 1000 + 7);
  oreNoise  = new Noise(seed * 7 + 37);
  caveNoise = new Noise(seed * 13 + 91);
  tempNoise = new Noise(seed * 19 + 53);
  humidNoise = new Noise(seed * 23 + 137);
}

// フラット配列のインデックス計算（lx * WORLD_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz）
function B(lx, y, lz) {
  return lx * WORLD_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz;
}

// バイオームを取得（温度・湿度ノイズで分類）
function getBiome(x, z) {
  const scale = 0.006;
  const temp  = tempNoise.noise2D(x * scale, z * scale);
  const humid = humidNoise.noise2D(x * scale + 100, z * scale + 100);
  if (temp < -0.3) return 'tundra';
  if (temp > 0.35 && humid < -0.1) return 'desert';
  if (temp > 0.2 && humid > 0.25) return 'mountain';
  if (humid > 0.15) return 'forest';
  return 'plains';
}

// ワールド座標 (x, z) における地表高度を返す
function getHeight(x, z) {
  const scale = 0.02;
  const n = noise.fbm(x * scale, z * scale, 5, 2, 0.5);
  const biome = getBiome(x, z);
  let heightScale = 22;
  let heightOffset = 0;
  if (biome === 'mountain') { heightScale = 36; heightOffset = 8; }
  else if (biome === 'desert') { heightScale = 12; heightOffset = -4; }
  else if (biome === 'tundra') { heightScale = 18; }
  else if (biome === 'forest') { heightScale = 20; }
  return Math.floor(SEA_LEVEL + n * heightScale + heightOffset);
}

// チャンク (cx, cz) のブロックデータを Uint8Array で生成して返す
function generateChunk(cx, cz, chunkEdits) {
  const flatBlocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);

  // 各呼び出しで独立した Set を使う（ワーカーはコールごとに独立）
  const treePlaced = new Set();

  // ---- フェーズ1: 地形・鉱石・地表ブロック・樹木 ----
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      const height = getHeight(wx, wz);
      const biome  = getBiome(wx, wz);

      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const idx = B(lx, y, lz);
        if (y === 0) {
          flatBlocks[idx] = BlockType.BEDROCK;
        } else if (y < height - 4) {
          // 鉱石生成（Y位置・ノイズ閾値で分布を制御）
          const oreVal  = oreNoise.noise2D(wx * 0.6 + 0.5, y * 0.9 + wz * 0.55);
          const oreVal2 = oreNoise.noise2D(wx * 0.7 + 33.1, y * 1.1 + wz * 0.65 + 17.3);
          if (y < 20 && oreVal > 0.94 && oreVal2 > 0.88) {
            flatBlocks[idx] = BlockType.DIAMOND_ORE;
          } else if (y < 30 && oreVal > 0.92) {
            flatBlocks[idx] = BlockType.GOLD_ORE;
          } else if (y < 55 && oreVal > 0.88) {
            flatBlocks[idx] = BlockType.IRON_ORE;
          } else if (oreVal2 > 0.82) {
            flatBlocks[idx] = BlockType.COAL_ORE;
          } else {
            flatBlocks[idx] = BlockType.STONE;
          }
        } else if (y < height) {
          flatBlocks[idx] = BlockType.DIRT;
        } else if (y === height) {
          if (height <= SEA_LEVEL) {
            flatBlocks[idx] = BlockType.SAND;
          } else if (biome === 'desert') {
            flatBlocks[idx] = BlockType.SAND;
          } else if (biome === 'tundra') {
            flatBlocks[idx] = BlockType.SNOW;
          } else if (biome === 'mountain' && height > SEA_LEVEL + 22) {
            flatBlocks[idx] = BlockType.STONE;
          } else {
            flatBlocks[idx] = BlockType.GRASS;
          }
        } else if (y <= SEA_LEVEL) {
          flatBlocks[idx] = biome === 'tundra' ? BlockType.ICE : BlockType.WATER;
        } else {
          flatBlocks[idx] = BlockType.AIR;
        }
      }

      // バイオームごとの地上装飾（木・サボテン）
      if (height > SEA_LEVEL + 1) {
        const treeVal = treeNoise.noise2D(wx * 0.5, wz * 0.5);
        const isForest   = biome === 'forest';
        const isDesert   = biome === 'desert';
        const isTundra   = biome === 'tundra';
        const isMountain = biome === 'mountain';
        const treeThreshold = isForest ? 0.15 : isTundra ? 0.55 : isMountain ? 0.60 : 0.35;

        // placeLeaf: チャンク内の座標のみ書き込む（AIR のときだけ）
        const placeLeaf = (nlx, ny, nlz) => {
          if (nlx >= 0 && nlx < CHUNK_SIZE && nlz >= 0 && nlz < CHUNK_SIZE && ny >= 0 && ny < WORLD_HEIGHT) {
            if (flatBlocks[B(nlx, ny, nlz)] === BlockType.AIR) {
              flatBlocks[B(nlx, ny, nlz)] = BlockType.LEAVES;
            }
          }
        };

        if (isDesert) {
          // 砂漠: サボテン（稀に）
          if (treeVal > 0.65 && lx > 0 && lx < CHUNK_SIZE - 1 && lz > 0 && lz < CHUNK_SIZE - 1) {
            const cactusKey = `${wx},${wz}`;
            if (!treePlaced.has(cactusKey)) {
              treePlaced.add(cactusKey);
              const cactusHeight = 2 + Math.floor(Math.abs(treeNoise.noise2D(wx * 8, wz * 8)) * 2);
              for (let cy = 1; cy <= cactusHeight && height + cy < WORLD_HEIGHT; cy++) {
                flatBlocks[B(lx, height + cy, lz)] = BlockType.CACTUS;
              }
            }
          }
        } else if (treeVal > treeThreshold && lx > 2 && lx < CHUNK_SIZE - 3 && lz > 2 && lz < CHUNK_SIZE - 3) {
          // バイオーム別樹木生成
          const treeKey = `${wx},${wz}`;
          if (!treePlaced.has(treeKey)) {
            treePlaced.add(treeKey);
            const rndH = Math.abs(treeNoise.noise2D(wx * 10, wz * 10));
            const maxTrunkH = Math.max(1, WORLD_HEIGHT - height - 5);

            if (isTundra || isMountain) {
              // トウヒ型: 細い幹＋円錐状の葉（上ほど細い）
              const trunkH = Math.min(6 + Math.floor(rndH * 3), maxTrunkH);
              for (let ty = 1; ty <= trunkH && height + ty < WORLD_HEIGHT; ty++) {
                flatBlocks[B(lx, height + ty, lz)] = BlockType.WOOD;
              }
              for (let ly = 1; ly <= trunkH + 1; ly++) {
                const radius = Math.max(0, Math.floor((trunkH + 2 - ly) * 0.5));
                const ny = height + ly;
                for (let dx = -radius; dx <= radius; dx++) {
                  for (let dz = -radius; dz <= radius; dz++) {
                    if (dx === 0 && dz === 0) continue;
                    if (Math.abs(dx) + Math.abs(dz) > radius + (radius > 0 ? 1 : 0)) continue;
                    placeLeaf(lx + dx, ny, lz + dz);
                  }
                }
              }
              placeLeaf(lx, height + trunkH + 1, lz);
            } else if (isForest) {
              // 大オーク型: 太い幹＋大きな球状の葉
              const trunkH = Math.min(5 + Math.floor(rndH * 4), maxTrunkH);
              for (let ty = 1; ty <= trunkH && height + ty < WORLD_HEIGHT; ty++) {
                flatBlocks[B(lx, height + ty, lz)] = BlockType.WOOD;
              }
              const leafStart = trunkH - 1;
              const leafEnd   = trunkH + 3;
              for (let ly = leafStart; ly <= leafEnd; ly++) {
                const radius = ly >= leafEnd - 1 ? 1 : 3;
                for (let dx = -radius; dx <= radius; dx++) {
                  for (let dz = -radius; dz <= radius; dz++) {
                    if (dx === 0 && dz === 0 && ly < leafEnd) continue;
                    if (dx * dx + dz * dz > (radius + 0.5) * (radius + 0.5)) continue;
                    placeLeaf(lx + dx, height + ly, lz + dz);
                  }
                }
              }
            } else {
              // 標準オーク型（plains デフォルト）
              const trunkH = Math.min(4 + Math.floor(rndH * 3), maxTrunkH);
              for (let ty = 1; ty <= trunkH && height + ty < WORLD_HEIGHT; ty++) {
                flatBlocks[B(lx, height + ty, lz)] = BlockType.WOOD;
              }
              const leafStart = trunkH - 1;
              const leafEnd   = trunkH + 2;
              for (let ly = leafStart; ly <= leafEnd; ly++) {
                const radius = ly === leafEnd ? 1 : 2;
                for (let dx = -radius; dx <= radius; dx++) {
                  for (let dz = -radius; dz <= radius; dz++) {
                    if (dx === 0 && dz === 0 && ly < leafEnd) continue;
                    if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
                    placeLeaf(lx + dx, height + ly, lz + dz);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // ---- フェーズ2: 地表装飾（草・花・キノコ）----
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      const height = getHeight(wx, wz);
      const biome  = getBiome(wx, wz);
      const surface = flatBlocks[B(lx, height, lz)];
      const aboveY  = height + 1;
      if (aboveY >= WORLD_HEIGHT) continue;
      const above   = flatBlocks[B(lx, aboveY, lz)];

      // 地表が草か雪で、直上が空気のときのみ
      if (above !== BlockType.AIR) continue;
      if (surface !== BlockType.GRASS && surface !== BlockType.SNOW) continue;

      const decVal  = treeNoise.noise2D(wx * 3.5 + 500, wz * 3.5 + 500);
      const decVal2 = treeNoise.noise2D(wx * 5.1 + 800, wz * 5.1 + 200);

      if (biome === 'tundra') {
        if (decVal > 0.72) flatBlocks[B(lx, aboveY, lz)] = BlockType.MUSHROOM;
      } else if (biome === 'forest') {
        if (decVal > 0.0) flatBlocks[B(lx, aboveY, lz)] = BlockType.TALL_GRASS;
        if (decVal > 0.55 && decVal2 > 0.3) flatBlocks[B(lx, aboveY, lz)] = BlockType.FLOWER;
        if (decVal > 0.78 && decVal2 < -0.2) flatBlocks[B(lx, aboveY, lz)] = BlockType.MUSHROOM;
      } else {
        if (decVal > 0.3) flatBlocks[B(lx, aboveY, lz)] = BlockType.TALL_GRASS;
        if (decVal > 0.65 && decVal2 > 0.4) flatBlocks[B(lx, aboveY, lz)] = BlockType.FLOWER;
      }
    }
  }

  // ---- フェーズ3: 洞窟生成 ----
  const CAVE_SCALE_H     = 0.045;
  const CAVE_SCALE_V     = 0.06;
  const CAVE_THRESHOLD   = 0.20;
  const CAVE_MAX_Y       = 75;
  const CAVE_SURFACE_MARGIN = 6;

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      const surfaceHeight = getHeight(wx, wz);

      for (let y = 1; y < Math.min(CAVE_MAX_Y, surfaceHeight - CAVE_SURFACE_MARGIN); y++) {
        const block = flatBlocks[B(lx, y, lz)];
        if (block !== BlockType.STONE && block !== BlockType.IRON_ORE &&
            block !== BlockType.COAL_ORE && block !== BlockType.GOLD_ORE &&
            block !== BlockType.DIAMOND_ORE) continue;

        const n1 = caveNoise.noise3D(wx * CAVE_SCALE_H, y * CAVE_SCALE_V, wz * CAVE_SCALE_H);
        const n2 = caveNoise.noise3D(
          wx * CAVE_SCALE_H + 100.5,
          y * CAVE_SCALE_V + 33.7,
          wz * CAVE_SCALE_H + 77.3
        );
        if (Math.abs(n1) < CAVE_THRESHOLD && Math.abs(n2) < CAVE_THRESHOLD) {
          flatBlocks[B(lx, y, lz)] = BlockType.AIR;
        }
      }
    }
  }

  // ---- フェーズ4: 地下湖・溶岩湖 ----
  const WATER_LAKE_MAX_Y = 35;
  const LAVA_LAKE_MAX_Y  = 15;

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      for (let y = 1; y < WATER_LAKE_MAX_Y; y++) {
        if (flatBlocks[B(lx, y, lz)] !== BlockType.AIR) continue;
        if (flatBlocks[B(lx, y - 1, lz)] === BlockType.AIR) continue;
        const lakeVal = caveNoise.noise2D(wx * 0.08 + 200.5, wz * 0.08 + 100.3);
        if (y < LAVA_LAKE_MAX_Y && lakeVal > 0.3) {
          flatBlocks[B(lx, y, lz)] = BlockType.LAVA;
        } else if (lakeVal > 0.15) {
          flatBlocks[B(lx, y, lz)] = BlockType.WATER;
        }
      }
    }
  }

  // ---- フェーズ5: チャンク編集（プレイヤーが変更したブロック）を適用 ----
  if (chunkEdits && chunkEdits.length > 0) {
    for (const edit of chunkEdits) {
      const lx = ((edit.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((edit.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      if (edit.y >= 0 && edit.y < WORLD_HEIGHT) {
        flatBlocks[B(lx, edit.y, lz)] = edit.type;
      }
    }
  }

  // 最高非空気ブロックのY座標を計算（メッシュ構築のY走査上限に使用）
  let maxY = 0;
  outer: for (let y = WORLD_HEIGHT - 1; y > 0; y--) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        if (flatBlocks[B(lx, y, lz)] !== BlockType.AIR) {
          maxY = y;
          break outer;
        }
      }
    }
  }

  return { flatBlocks, maxY };
}

// メインスレッドからのメッセージを受け取ってチャンクを生成する
self.onmessage = ({ data }) => {
  const { cx, cz, seed, chunkEdits } = data;
  initNoise(seed);
  const { flatBlocks, maxY } = generateChunk(cx, cz, chunkEdits);
  // バッファをトランスファラブルとして転送（コピーコストを排除）
  self.postMessage({ cx, cz, flatBlocks, maxY }, [flatBlocks.buffer]);
};
