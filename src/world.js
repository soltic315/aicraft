// World generation and chunk management
import * as THREE from 'three';
import { BlockType } from './blocks.js';
import { Noise } from './noise.js';

const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 128;
const SEA_LEVEL = 40;
const DEFAULT_RENDER_DISTANCE = 5;
const CHUNK_LOADS_PER_FRAME = 2;

export class World {
  constructor(scene, blockMaterials, options = {}) {
    this.scene = scene;
    this.blockMaterials = blockMaterials;
    this.chunks = new Map();
    this.seed = Number.isFinite(options.seed) ? options.seed : Math.floor(Math.random() * 100000);
    this.noise = new Noise(this.seed);
    this.treeNoise = new Noise(this.noise.perm[0] * 1000 + 7);
    this.oreNoise = new Noise(this.seed * 7 + 37);
    this.caveNoise = new Noise(this.seed * 13 + 91);
    this.tempNoise = new Noise(this.seed * 19 + 53);     // バイオーム温度ノイズ
    this.humidNoise = new Noise(this.seed * 23 + 137);   // バイオーム湿度ノイズ
    this.treePlaced = new Set();
    this.renderDistance = options.renderDistance ?? DEFAULT_RENDER_DISTANCE;
    this.pendingChunkLoads = [];
    this.pendingChunkSet = new Set();

    // Frustum culling helpers
    this._frustum = new THREE.Frustum();
    this._projScreenMatrix = new THREE.Matrix4();
    this._hasFrustum = false;

    // Chunk-level edits applied after terrain generation.
    // Keyed by chunk key ("cx,cz") and contains an array of {x,y,z,type} edits.
    this.chunkEdits = new Map();

    // 面方向別明るさを適用したマテリアルのキャッシュ
    this._dimmedMaterialCache = new Map();
  }

  // 全チャンクを破棄してワールドを初期状態に戻す
  reset() {
    // 全チャンクメッシュをシーンから除去
    for (const chunk of this.chunks.values()) {
      if (chunk.mesh) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
      }
    }
    this.chunks.clear();
    this.chunkEdits.clear();
    this.pendingChunkLoads = [];
    this.pendingChunkSet.clear();
    this.treePlaced.clear();

    // 新しいシードで地形ノイズを再生成
    this.seed = Math.floor(Math.random() * 100000);
    this.noise = new Noise(this.seed);
    this.treeNoise = new Noise(this.noise.perm[0] * 1000 + 7);
    this.oreNoise = new Noise(this.seed * 7 + 37);
    this.caveNoise = new Noise(this.seed * 13 + 91);
    this.tempNoise = new Noise(this.seed * 19 + 53);
    this.humidNoise = new Noise(this.seed * 23 + 137);
    this._hasFrustum = false;
  }

  setRenderDistance(distance) {
    const next = Math.floor(Number(distance));
    if (!Number.isFinite(next)) return;
    this.renderDistance = Math.min(Math.max(next, 2), 8);
  }

  applyChunkEdits(edits = []) {
    this.chunkEdits.clear();
    for (const edit of edits) {
      if (!edit || typeof edit !== 'object') continue;
      const { x, y, z, type } = edit;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(type)) continue;
      this.recordChunkEdit(x, y, z, type);
    }
  }

  recordChunkEdit(x, y, z, type) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = this._chunkKey(cx, cz);
    let chunkMap = this.chunkEdits.get(key);
    if (!chunkMap) {
      chunkMap = new Map();
      this.chunkEdits.set(key, chunkMap);
    }
    const posKey = `${x},${y},${z}`;
    chunkMap.set(posKey, { x, y, z, type });
  }

  exportChunkEdits() {
    const edits = [];
    for (const chunkMap of this.chunkEdits.values()) {
      for (const edit of chunkMap.values()) {
        edits.push(edit);
      }
    }
    return edits;
  }

  _chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  _queueChunkLoad(cx, cz) {
    const key = this._chunkKey(cx, cz);
    if (this.chunks.has(key) || this.pendingChunkSet.has(key)) return;
    this.pendingChunkLoads.push({ cx, cz, key });
    this.pendingChunkSet.add(key);
  }

  _dequeueNearestChunkLoad(pcx, pcz) {
    if (this.pendingChunkLoads.length === 0) return null;

    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < this.pendingChunkLoads.length; i++) {
      const item = this.pendingChunkLoads[i];
      const distance = Math.abs(item.cx - pcx) + Math.abs(item.cz - pcz);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const [next] = this.pendingChunkLoads.splice(nearestIndex, 1);
    this.pendingChunkSet.delete(next.key);
    return next;
  }

  // バイオームを取得（温度・湿度ノイズで分類）
  // 戻り値: 'plains' | 'forest' | 'desert' | 'tundra' | 'mountain'
  getBiome(x, z) {
    const scale = 0.006; // 低スケールで広いバイオームを生成
    const temp  = this.tempNoise.noise2D(x * scale, z * scale);    // -1 〜 +1
    const humid = this.humidNoise.noise2D(x * scale + 100, z * scale + 100); // -1 〜 +1

    if (temp < -0.3) return 'tundra';
    if (temp > 0.35 && humid < -0.1) return 'desert';
    if (temp > 0.2 && humid > 0.25) return 'mountain';
    if (humid > 0.15) return 'forest';
    return 'plains';
  }

  // Get terrain height at world (x, z)
  getHeight(x, z) {
    const scale = 0.02;
    const n = this.noise.fbm(x * scale, z * scale, 5, 2, 0.5);
    const biome = this.getBiome(x, z);

    // バイオームごとに高さを調整
    let heightScale = 22;
    let heightOffset = 0;
    if (biome === 'mountain') { heightScale = 36; heightOffset = 8; }
    else if (biome === 'desert') { heightScale = 12; heightOffset = -4; }
    else if (biome === 'tundra') { heightScale = 18; }
    else if (biome === 'forest') { heightScale = 20; }

    return Math.floor(SEA_LEVEL + n * heightScale + heightOffset);
  }

  // Get block type at world position
  getBlock(x, y, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = this._chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return BlockType.AIR;

    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    if (y < 0 || y >= WORLD_HEIGHT) return BlockType.AIR;
    return chunk.blocks[lx][y][lz];
  }

  // Set block at world position
  setBlock(x, y, z, type) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = this._chunkKey(cx, cz);
    let chunk = this.chunks.get(key);

    if (!chunk) return;

    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    if (y < 0 || y >= WORLD_HEIGHT) return;
    chunk.blocks[lx][y][lz] = type;

    // Rebuild this chunk and adjacent if on border
    this._rebuildChunkMesh(cx, cz);
    if (lx === 0) this._rebuildChunkMesh(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this._rebuildChunkMesh(cx + 1, cz);
    if (lz === 0) this._rebuildChunkMesh(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this._rebuildChunkMesh(cx, cz + 1);
  }

  setBlockWithDiff(x, y, z, type) {
    this.setBlock(x, y, z, type);
    this.recordChunkEdit(x, y, z, type);
  }

  _generateChunkData(cx, cz) {
    const blocks = new Array(CHUNK_SIZE);
    for (let x = 0; x < CHUNK_SIZE; x++) {
      blocks[x] = new Array(WORLD_HEIGHT);
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        blocks[x][y] = new Uint8Array(CHUNK_SIZE);
      }
    }

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const height = this.getHeight(wx, wz);
        const biome = this.getBiome(wx, wz);

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          if (y === 0) {
            blocks[lx][y][lz] = BlockType.BEDROCK;
          } else if (y < height - 4) {
            // 鉱石生成（Y位置・ノイズ閾値で分布を制御）
            const oreVal = this.oreNoise.noise2D(wx * 0.6 + 0.5, y * 0.9 + wz * 0.55);
            const oreVal2 = this.oreNoise.noise2D(wx * 0.7 + 33.1, y * 1.1 + wz * 0.65 + 17.3);
            if (y < 20 && oreVal > 0.94 && oreVal2 > 0.88) {
              // ダイヤモンド: Y<20 に極まれに生成（~1%）
              blocks[lx][y][lz] = BlockType.DIAMOND_ORE;
            } else if (y < 30 && oreVal > 0.92) {
              // 金鉱石: Y<30 に稀に生成（~2%）
              blocks[lx][y][lz] = BlockType.GOLD_ORE;
            } else if (y < 55 && oreVal > 0.88) {
              // 鉄鉱石: Y<55 に生成（~4%）
              blocks[lx][y][lz] = BlockType.IRON_ORE;
            } else if (oreVal2 > 0.82) {
              // 石炭鉱石: 全深度に生成（~9%）
              blocks[lx][y][lz] = BlockType.COAL_ORE;
            } else {
              blocks[lx][y][lz] = BlockType.STONE;
            }
          } else if (y < height) {
            blocks[lx][y][lz] = BlockType.DIRT;
          } else if (y === height) {
            if (height <= SEA_LEVEL) {
              blocks[lx][y][lz] = BlockType.SAND;
            } else if (biome === 'desert') {
              blocks[lx][y][lz] = BlockType.SAND;
            } else if (biome === 'tundra') {
              blocks[lx][y][lz] = BlockType.SNOW;
            } else if (biome === 'mountain' && height > SEA_LEVEL + 22) {
              blocks[lx][y][lz] = BlockType.STONE; // 高山の頂上は石
            } else {
              blocks[lx][y][lz] = BlockType.GRASS;
            }
          } else if (y <= SEA_LEVEL) {
            blocks[lx][y][lz] = biome === 'tundra' ? BlockType.ICE : BlockType.WATER;
          } else {
            blocks[lx][y][lz] = BlockType.AIR;
          }
        }

        // バイオームごとの地上装飾（木・サボテン）
        if (height > SEA_LEVEL + 1) {
          const treeVal = this.treeNoise.noise2D(wx * 0.5, wz * 0.5);
          // バイオーム別の生成閾値・条件
          const isForest  = biome === 'forest';
          const isDesert  = biome === 'desert';
          const isTundra  = biome === 'tundra';
          const isMountain = biome === 'mountain';
          const treeThreshold = isForest ? 0.15 : isTundra ? 0.55 : isMountain ? 0.60 : 0.35;

          if (isDesert) {
            // 砂漠: サボテン（稀に）
            if (treeVal > 0.65 && lx > 0 && lx < CHUNK_SIZE - 1 && lz > 0 && lz < CHUNK_SIZE - 1) {
              const cactusKey = `${wx},${wz}`;
              if (!this.treePlaced.has(cactusKey)) {
                this.treePlaced.add(cactusKey);
                const cactusHeight = 2 + Math.floor(Math.abs(this.treeNoise.noise2D(wx * 8, wz * 8)) * 2);
                for (let cy = 1; cy <= cactusHeight && height + cy < WORLD_HEIGHT; cy++) {
                  blocks[lx][height + cy][lz] = BlockType.CACTUS;
                }
              }
            }
          } else if (treeVal > treeThreshold && lx > 2 && lx < CHUNK_SIZE - 3 && lz > 2 && lz < CHUNK_SIZE - 3) {
            // バイオーム別樹木生成
            const treeKey = `${wx},${wz}`;
            if (!this.treePlaced.has(treeKey)) {
              this.treePlaced.add(treeKey);
              const rndH = Math.abs(this.treeNoise.noise2D(wx * 10, wz * 10));
              const maxTrunkH = Math.max(1, WORLD_HEIGHT - height - 5);

              const placeLeaf = (nlx, ny, nlz) => {
                if (nlx >= 0 && nlx < CHUNK_SIZE && nlz >= 0 && nlz < CHUNK_SIZE && ny >= 0 && ny < WORLD_HEIGHT) {
                  if (blocks[nlx][ny][nlz] === BlockType.AIR) blocks[nlx][ny][nlz] = BlockType.LEAVES;
                }
              };

              if (isTundra || isMountain) {
                // トウヒ型: 細い幹＋円錐状の葉（上ほど細い）
                const trunkH = Math.min(6 + Math.floor(rndH * 3), maxTrunkH);
                for (let ty = 1; ty <= trunkH && height + ty < WORLD_HEIGHT; ty++) {
                  blocks[lx][height + ty][lz] = BlockType.WOOD;
                }
                // 下から各層で半径が狭まる円錐
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
                // 頂点
                placeLeaf(lx, height + trunkH + 1, lz);
              } else if (isForest) {
                // 大オーク型: 太い幹＋大きな球状の葉
                const trunkH = Math.min(5 + Math.floor(rndH * 4), maxTrunkH);
                for (let ty = 1; ty <= trunkH && height + ty < WORLD_HEIGHT; ty++) {
                  blocks[lx][height + ty][lz] = BlockType.WOOD;
                }
                const leafStart = trunkH - 1;
                const leafEnd = trunkH + 3;
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
                  blocks[lx][height + ty][lz] = BlockType.WOOD;
                }
                const leafStart = trunkH - 1;
                const leafEnd = trunkH + 2;
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

    // 地表装飾（草・花・キノコ）の配置
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const height = this.getHeight(wx, wz);
        const biome = this.getBiome(wx, wz);
        const surface = blocks[lx][height][lz];
        const above   = height + 1 < WORLD_HEIGHT ? blocks[lx][height + 1][lz] : BlockType.AIR;

        // 地表が草か雪で、直上が空気のときのみ
        if (above !== BlockType.AIR) continue;
        if (surface !== BlockType.GRASS && surface !== BlockType.SNOW) continue;

        const decVal = this.treeNoise.noise2D(wx * 3.5 + 500, wz * 3.5 + 500);
        const decVal2 = this.treeNoise.noise2D(wx * 5.1 + 800, wz * 5.1 + 200);

        if (biome === 'tundra') {
          // 雪原: キノコを稀に
          if (decVal > 0.72) blocks[lx][height + 1][lz] = BlockType.MUSHROOM;
        } else if (biome === 'forest') {
          // 森林: 草と花とキノコ
          if (decVal > 0.0) blocks[lx][height + 1][lz] = BlockType.TALL_GRASS;
          if (decVal > 0.55 && decVal2 > 0.3) blocks[lx][height + 1][lz] = BlockType.FLOWER;
          if (decVal > 0.78 && decVal2 < -0.2) blocks[lx][height + 1][lz] = BlockType.MUSHROOM;
        } else {
          // 平原・山: 草と花を疎らに
          if (decVal > 0.3) blocks[lx][height + 1][lz] = BlockType.TALL_GRASS;
          if (decVal > 0.65 && decVal2 > 0.4) blocks[lx][height + 1][lz] = BlockType.FLOWER;
        }
      }
    }

    // 洞窟生成: 3D ノイズで地下をくり抜く
    // 2 つのノイズ値を組み合わせてワーム状の洞窟を作る（Minecraft 方式）
    const CAVE_SCALE_H = 0.045; // 水平スケール（小さいほど大きな洞窟）
    const CAVE_SCALE_V = 0.06;  // 垂直スケール（小さいほど縦長の洞窟）
    const CAVE_THRESHOLD = 0.20; // ノイズ絶対値がこれ以下の領域をくり抜く（大きいほど洞窟多）
    const CAVE_MAX_Y = 75;       // この高度以下にのみ洞窟を生成
    const CAVE_SURFACE_MARGIN = 6; // 地表からこの深さ以上のみ洞窟化

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const surfaceHeight = this.getHeight(wx, wz);

        for (let y = 1; y < Math.min(CAVE_MAX_Y, surfaceHeight - CAVE_SURFACE_MARGIN); y++) {
          const block = blocks[lx][y][lz];
          if (block !== BlockType.STONE && block !== BlockType.IRON_ORE &&
              block !== BlockType.COAL_ORE && block !== BlockType.GOLD_ORE &&
              block !== BlockType.DIAMOND_ORE) continue;

          // 2 つの独立したノイズ値がどちらも閾値内ならくり抜く（ワーム洞窟）
          const n1 = this.caveNoise.noise3D(wx * CAVE_SCALE_H, y * CAVE_SCALE_V, wz * CAVE_SCALE_H);
          const n2 = this.caveNoise.noise3D(
            wx * CAVE_SCALE_H + 100.5,
            y * CAVE_SCALE_V + 33.7,
            wz * CAVE_SCALE_H + 77.3
          );
          if (Math.abs(n1) < CAVE_THRESHOLD && Math.abs(n2) < CAVE_THRESHOLD) {
            blocks[lx][y][lz] = BlockType.AIR;
          }
        }
      }
    }

    // 地下湖・溶岩湖: 洞窟の床に液体を配置
    // AIR ブロックの真下が固体ブロックの場合、そのフロア付近に液体を張る
    const WATER_LAKE_MAX_Y = 35;  // 地下水が溜まる最大高度
    const LAVA_LAKE_MAX_Y  = 15;  // 溶岩が溜まる最大高度

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        for (let y = 1; y < WATER_LAKE_MAX_Y; y++) {
          if (blocks[lx][y][lz] !== BlockType.AIR) continue;
          if (blocks[lx][y - 1][lz] === BlockType.AIR) continue; // フロアがない
          // ノイズで液体の広がりを決定
          const lakeVal = this.caveNoise.noise2D(wx * 0.08 + 200.5, wz * 0.08 + 100.3);
          if (y < LAVA_LAKE_MAX_Y && lakeVal > 0.3) {
            blocks[lx][y][lz] = BlockType.LAVA;
          } else if (lakeVal > 0.15) {
            blocks[lx][y][lz] = BlockType.WATER;
          }
        }
      }
    }

    // Apply saved chunk edits (diffs) to override generated terrain.
    const chunkKey = this._chunkKey(cx, cz);
    const editsMap = this.chunkEdits.get(chunkKey);
    if (editsMap) {
      for (const edit of editsMap.values()) {
        const lx = ((edit.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((edit.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        if (edit.y >= 0 && edit.y < WORLD_HEIGHT) {
          blocks[lx][edit.y][lz] = edit.type;
        }
      }
    }

    return { blocks };
  }

  _buildChunkMesh(cx, cz) {
    const key = this._chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return null;

    const groups = {};

    const addQuad = (blockType, face, x, y, z, w, h) => {
      const groupKey = `${blockType}_${face}`;
      if (!groups[groupKey]) {
        groups[groupKey] = { positions: [], normals: [], uvs: [], indices: [], blockType, face };
      }
      const g = groups[groupKey];
      const vi = g.positions.length / 3;
      this._addQuad(g, x, y, z, w, h, face, vi);
    };

    const emitMaskFaces = (mask, sizeX, sizeY, emitFace) => {
      for (let i = 0; i < sizeX; i++) {
        for (let j = 0; j < sizeY; j++) {
          const blockType = mask[i][j];
          if (!blockType) continue;
          emitFace(i, j, blockType);
        }
      }
    };

    // Top / bottom faces
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      const topMask = Array.from({ length: CHUNK_SIZE }, () => new Array(CHUNK_SIZE).fill(null));
      const bottomMask = Array.from({ length: CHUNK_SIZE }, () => new Array(CHUNK_SIZE).fill(null));

      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wx = cx * CHUNK_SIZE + lx;
          const wz = cz * CHUNK_SIZE + lz;
          const block = chunk.blocks[lx][y][lz];
          if (block === BlockType.AIR || block === BlockType.WATER) continue;

          const above = this.getBlock(wx, y + 1, wz);
          if (above === BlockType.AIR || above === BlockType.WATER) {
            topMask[lx][lz] = block;
          }

          const below = this.getBlock(wx, y - 1, wz);
          if (below === BlockType.AIR || below === BlockType.WATER) {
            bottomMask[lx][lz] = block;
          }
        }
      }

      emitMaskFaces(topMask, CHUNK_SIZE, CHUNK_SIZE, (lx, lz, blockType) => {
        addQuad(blockType, 'top', cx * CHUNK_SIZE + lx, y, cz * CHUNK_SIZE + lz, 1, 1);
      });
      emitMaskFaces(bottomMask, CHUNK_SIZE, CHUNK_SIZE, (lx, lz, blockType) => {
        addQuad(blockType, 'bottom', cx * CHUNK_SIZE + lx, y, cz * CHUNK_SIZE + lz, 1, 1);
      });
    }

    // Front / back faces
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const frontMask = Array.from({ length: CHUNK_SIZE }, () => new Array(WORLD_HEIGHT).fill(null));
      const backMask = Array.from({ length: CHUNK_SIZE }, () => new Array(WORLD_HEIGHT).fill(null));
      const wz = cz * CHUNK_SIZE + lz;

      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const wx = cx * CHUNK_SIZE + lx;
          const block = chunk.blocks[lx][y][lz];
          if (block === BlockType.AIR || block === BlockType.WATER) continue;

          const frontNeighbor = this.getBlock(wx, y, wz + 1);
          if (frontNeighbor === BlockType.AIR || frontNeighbor === BlockType.WATER) {
            frontMask[lx][y] = block;
          }

          const backNeighbor = this.getBlock(wx, y, wz - 1);
          if (backNeighbor === BlockType.AIR || backNeighbor === BlockType.WATER) {
            backMask[lx][y] = block;
          }
        }
      }

      emitMaskFaces(frontMask, CHUNK_SIZE, WORLD_HEIGHT, (lx, y, blockType) => {
        addQuad(blockType, 'front', cx * CHUNK_SIZE + lx, y, wz, 1, 1);
      });
      emitMaskFaces(backMask, CHUNK_SIZE, WORLD_HEIGHT, (lx, y, blockType) => {
        addQuad(blockType, 'back', cx * CHUNK_SIZE + lx, y, wz, 1, 1);
      });
    }

    // Right / left faces
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const rightMask = Array.from({ length: CHUNK_SIZE }, () => new Array(WORLD_HEIGHT).fill(null));
      const leftMask = Array.from({ length: CHUNK_SIZE }, () => new Array(WORLD_HEIGHT).fill(null));
      const wx = cx * CHUNK_SIZE + lx;

      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const wz = cz * CHUNK_SIZE + lz;
          const block = chunk.blocks[lx][y][lz];
          if (block === BlockType.AIR || block === BlockType.WATER) continue;

          const rightNeighbor = this.getBlock(wx + 1, y, wz);
          if (rightNeighbor === BlockType.AIR || rightNeighbor === BlockType.WATER) {
            rightMask[lz][y] = block;
          }

          const leftNeighbor = this.getBlock(wx - 1, y, wz);
          if (leftNeighbor === BlockType.AIR || leftNeighbor === BlockType.WATER) {
            leftMask[lz][y] = block;
          }
        }
      }

      emitMaskFaces(rightMask, CHUNK_SIZE, WORLD_HEIGHT, (lz, y, blockType) => {
        addQuad(blockType, 'right', wx, y, cz * CHUNK_SIZE + lz, 1, 1);
      });
      emitMaskFaces(leftMask, CHUNK_SIZE, WORLD_HEIGHT, (lz, y, blockType) => {
        addQuad(blockType, 'left', wx, y, cz * CHUNK_SIZE + lz, 1, 1);
      });
    }

    // Water surfaces
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      const waterMask = Array.from({ length: CHUNK_SIZE }, () => new Array(CHUNK_SIZE).fill(null));
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wx = cx * CHUNK_SIZE + lx;
          const wz = cz * CHUNK_SIZE + lz;
          if (chunk.blocks[lx][y][lz] !== BlockType.WATER) continue;
          const above = this.getBlock(wx, y + 1, wz);
          if (above === BlockType.AIR) {
            waterMask[lx][lz] = BlockType.WATER;
          }
        }
      }
      emitMaskFaces(waterMask, CHUNK_SIZE, CHUNK_SIZE, (lx, lz) => {
        addQuad(BlockType.WATER, 'top', cx * CHUNK_SIZE + lx, y - 0.1, cz * CHUNK_SIZE + lz, 1, 1);
      });
    }

    // Water side/bottom faces（AIRに隣接する場合のみ側面・底面を表示）
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          if (chunk.blocks[lx][y][lz] !== BlockType.WATER) continue;
          if (this.getBlock(wx, y, wz + 1) === BlockType.AIR) addQuad(BlockType.WATER, 'front', wx, y, wz, 1, 1);
          if (this.getBlock(wx, y, wz - 1) === BlockType.AIR) addQuad(BlockType.WATER, 'back', wx, y, wz, 1, 1);
          if (this.getBlock(wx + 1, y, wz) === BlockType.AIR) addQuad(BlockType.WATER, 'right', wx, y, wz, 1, 1);
          if (this.getBlock(wx - 1, y, wz) === BlockType.AIR) addQuad(BlockType.WATER, 'left', wx, y, wz, 1, 1);
          if (this.getBlock(wx, y - 1, wz) === BlockType.AIR) addQuad(BlockType.WATER, 'bottom', wx, y, wz, 1, 1);
        }
      }
    }

    // Combine into single geometry with material groups
    if (Object.keys(groups).length === 0) return null;

    const geometry = new THREE.BufferGeometry();
    const allPositions = [];
    const allNormals = [];
    const allUvs = [];
    const allIndices = [];
    const materialList = [];
    const geoGroups = [];
    let vertexOffset = 0;
    let indexOffset = 0;

    for (const [, g] of Object.entries(groups)) {
      const matKey = `${g.blockType}_${g.face}`;
      let matIndex = materialList.indexOf(matKey);
      if (matIndex === -1) {
        materialList.push(matKey);
        matIndex = materialList.length - 1;
      }

      allPositions.push(...g.positions);
      allNormals.push(...g.normals);
      allUvs.push(...g.uvs);

      const reindexed = g.indices.map(i => i + vertexOffset);
      allIndices.push(...reindexed);

      geoGroups.push({
        start: indexOffset,
        count: g.indices.length,
        materialIndex: matIndex,
      });

      vertexOffset += g.positions.length / 3;
      indexOffset += g.indices.length;
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(allNormals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(allUvs, 2));
    geometry.setIndex(allIndices);

    for (const g of geoGroups) {
      geometry.addGroup(g.start, g.count, g.materialIndex);
    }

    // 面方向別の明るさ係数（上面が最明るく、底面が最暗い）
    const FACE_BRIGHTNESS = {
      top:    1.0,
      front:  0.85,
      back:   0.85,
      right:  0.75,
      left:   0.75,
      bottom: 0.60,
    };

    // Build materials array
    const materials = materialList.map(key => {
      const [typeStr, face] = key.split('_');
      const type = Number(typeStr);
      const faceKey = (face === 'top' || face === 'bottom') ? face : 'side';
      const baseMat = this.blockMaterials[type]?.[faceKey] || this.blockMaterials[BlockType.STONE].side;
      const brightness = FACE_BRIGHTNESS[face] ?? 1.0;
      if (brightness === 1.0) return baseMat;
      // クローンして明るさを適用（既存のマテリアルを変更しないようにクローン）
      const cacheKey = `${key}_dim`;
      if (this._dimmedMaterialCache.has(cacheKey)) return this._dimmedMaterialCache.get(cacheKey);
      const mat = baseMat.clone();
      mat.color.setRGB(brightness, brightness, brightness);
      this._dimmedMaterialCache.set(cacheKey, mat);
      return mat;
    });

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.name = `chunk_${cx}_${cz}`;
    return mesh;
  }

  _addQuad(g, x, y, z, w, h, dir, vi) {
    const p = g.positions;
    const n = g.normals;
    const u = g.uvs;
    const idx = g.indices;

    switch (dir) {
      case 'top':
        p.push(
          x, y + 1, z,
          x, y + 1, z + h,
          x + w, y + 1, z + h,
          x + w, y + 1, z
        );
        n.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        u.push(0, 0, w, 0, w, h, 0, h);
        break;
      case 'bottom':
        p.push(
          x, y, z,
          x + w, y, z,
          x + w, y, z + h,
          x, y, z + h
        );
        n.push(0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0);
        u.push(0, 0, w, 0, w, h, 0, h);
        break;
      case 'front':
        p.push(
          x, y, z + 1,
          x + w, y, z + 1,
          x + w, y + h, z + 1,
          x, y + h, z + 1
        );
        n.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
        u.push(0, 0, w, 0, w, h, 0, h);
        break;
      case 'back':
        p.push(
          x + w, y, z,
          x, y, z,
          x, y + h, z,
          x + w, y + h, z
        );
        n.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
        u.push(0, 0, w, 0, w, h, 0, h);
        break;
      case 'right':
        p.push(
          x + 1, y, z + w,
          x + 1, y, z,
          x + 1, y + h, z,
          x + 1, y + h, z + w
        );
        n.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
        u.push(0, 0, w, 0, w, h, 0, h);
        break;
      case 'left':
        p.push(
          x, y, z,
          x, y, z + w,
          x, y + h, z + w,
          x, y + h, z
        );
        n.push(-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0);
        u.push(0, 0, w, 0, w, h, 0, h);
        break;
    }

    idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
  }

  _addFace(g, x, y, z, dir, vi) {
    this._addQuad(g, x, y, z, 1, 1, dir, vi);
  }

  _rebuildChunkMesh(cx, cz, rebuildNeighbors = true) {
    const key = this._chunkKey(cx, cz);
    if (!this.chunks.has(key)) return;

    const chunk = this.chunks.get(key);
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }

    const mesh = this._buildChunkMesh(cx, cz);
    if (mesh) {
      chunk.mesh = mesh;

      // Frustum culling: only render chunks visible to the camera (if computed)
      if (chunk.boundingBox && this._hasFrustum) {
        mesh.visible = this._frustum.intersectsBox(chunk.boundingBox);
      }

      this.scene.add(mesh);
    }

    // Rebuild adjacent loaded chunks when needed (e.g., block edits on chunk borders).
    // During bulk chunk loading this is skipped to avoid rebuild storms and frame hitches.
    if (!rebuildNeighbors) return;

    const rebuildNeighborMesh = (nx, nz) => {
      const nKey = this._chunkKey(nx, nz);
      const neighborChunk = this.chunks.get(nKey);
      if (!neighborChunk) return;

      if (neighborChunk.mesh) {
        this.scene.remove(neighborChunk.mesh);
        neighborChunk.mesh.geometry.dispose();
        neighborChunk.mesh = null;
      }

      const neighborMesh = this._buildChunkMesh(nx, nz);
      if (neighborMesh) {
        neighborChunk.mesh = neighborMesh;
        this.scene.add(neighborMesh);
      }
    };

    rebuildNeighborMesh(cx - 1, cz);
    rebuildNeighborMesh(cx + 1, cz);
    rebuildNeighborMesh(cx, cz - 1);
    rebuildNeighborMesh(cx, cz + 1);
  }

  update(playerX, playerZ, camera = null) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    // Compute view frustum if camera is provided (used for culling chunks outside view)
    let frustum = null;
    this._hasFrustum = false;
    if (camera) {
      camera.updateMatrixWorld();
      this._projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this._frustum.setFromProjectionMatrix(this._projScreenMatrix);
      frustum = this._frustum;
      this._hasFrustum = true;
    }

    // Queue chunks in range
    for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        this._queueChunkLoad(cx, cz);
      }
    }

    // Drop queued chunks that are no longer relevant.
    this.pendingChunkLoads = this.pendingChunkLoads.filter((item) => {
      const inRange =
        Math.abs(item.cx - pcx) <= this.renderDistance + 1 &&
        Math.abs(item.cz - pcz) <= this.renderDistance + 1;
      if (!inRange) this.pendingChunkSet.delete(item.key);
      return inRange;
    });

    // Load a small fixed number per frame to prevent generation spikes.
    for (let i = 0; i < CHUNK_LOADS_PER_FRAME; i++) {
      const next = this._dequeueNearestChunkLoad(pcx, pcz);
      if (!next) break;
      if (this.chunks.has(next.key)) continue;

      const data = this._generateChunkData(next.cx, next.cz);
      const boundingBox = new THREE.Box3(
        new THREE.Vector3(next.cx * CHUNK_SIZE, 0, next.cz * CHUNK_SIZE),
        new THREE.Vector3((next.cx + 1) * CHUNK_SIZE, WORLD_HEIGHT, (next.cz + 1) * CHUNK_SIZE)
      );

      this.chunks.set(next.key, { ...data, mesh: null, boundingBox });
      this._rebuildChunkMesh(next.cx, next.cz, false);
    }

    // Update chunk visibility based on frustum
    if (frustum) {
      let visibleChunkCount = 0;
      for (const chunk of this.chunks.values()) {
        if (!chunk.mesh || !chunk.boundingBox) continue;
        chunk.mesh.visible = frustum.intersectsBox(chunk.boundingBox);
        if (chunk.mesh.visible) visibleChunkCount++;
      }

      // Safety net: avoid a fully black frame if frustum state becomes invalid.
      if (visibleChunkCount === 0) {
        for (const chunk of this.chunks.values()) {
          if (!chunk.mesh) continue;
          chunk.mesh.visible = true;
        }
      }
    }

    // Unload far chunks (aggressively unload one chunk beyond render distance)
    for (const [key, chunk] of this.chunks) {
      const [cx, cz] = key.split(',').map(Number);
      if (
        Math.abs(cx - pcx) > this.renderDistance + 1 ||
        Math.abs(cz - pcz) > this.renderDistance + 1
      ) {
        if (chunk.mesh) {
          this.scene.remove(chunk.mesh);
          chunk.mesh.geometry.dispose();
        }
        this.chunks.delete(key);
        this.pendingChunkSet.delete(key);
      }
    }
  }

  // Raycast to find block being looked at
  raycast(origin, direction, maxDist = 8) {
    const step = 0.05;
    const dir = direction.clone().normalize();
    const pos = origin.clone();
    let prevX = Math.floor(pos.x);
    let prevY = Math.floor(pos.y);
    let prevZ = Math.floor(pos.z);

    for (let d = 0; d < maxDist; d += step) {
      pos.addScaledVector(dir, step);
      const bx = Math.floor(pos.x);
      const by = Math.floor(pos.y);
      const bz = Math.floor(pos.z);

      if (bx !== prevX || by !== prevY || bz !== prevZ) {
        const block = this.getBlock(bx, by, bz);
        if (block !== BlockType.AIR && block !== BlockType.WATER) {
          return {
            blockPos: { x: bx, y: by, z: bz },
            placePos: { x: prevX, y: prevY, z: prevZ },
            blockType: block,
          };
        }
        prevX = bx;
        prevY = by;
        prevZ = bz;
      }
    }
    return null;
  }

  getSpawnHeight(x, z) {
    return this.getHeight(x, z) + 2;
  }
}
