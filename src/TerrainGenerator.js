// 地形生成クラス - ノイズ生成・バイオーム・チャンクデータ生成を担当
import { Noise } from './noise.js';
import { BlockType } from './blocks.js';

const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 128;
const SEA_LEVEL = 40;

export class TerrainGenerator {
  constructor(seed) {
    this._init(seed);
  }

  _init(seed) {
    this.seed = seed;
    this.noise = new Noise(seed);
    this.treeNoise = new Noise(this.noise.perm[0] * 1000 + 7);
    this.oreNoise = new Noise(seed * 7 + 37);
    this.caveNoise = new Noise(seed * 13 + 91);
    this.tempNoise = new Noise(seed * 19 + 53);
    this.humidNoise = new Noise(seed * 23 + 137);
    this.treePlaced = new Set();
  }

  reset(newSeed) {
    this._init(newSeed);
  }

  // バイオームを取得（温度・湿度ノイズで分類）
  // 戻り値: 'plains' | 'forest' | 'desert' | 'tundra' | 'mountain' | 'jungle' | 'swamp' | 'savanna' | 'cherry'
  getBiome(x, z) {
    const scale = 0.006; // 低スケールで広いバイオームを生成
    const temp  = this.tempNoise.noise2D(x * scale, z * scale);    // -1 〜 +1
    const humid = this.humidNoise.noise2D(x * scale + 100, z * scale + 100); // -1 〜 +1

    if (temp < -0.3) return 'tundra';
    if (temp > 0.3 && humid > 0.4) return 'jungle';      // 高温多湿 → ジャングル
    if (temp > 0.35 && humid < -0.2) return 'desert';    // 高温乾燥 → 砂漠
    if (temp > 0.3 && humid < 0.1) return 'savanna';     // 高温・中程度乾燥 → サバンナ
    if (temp > 0.2 && humid > 0.35) return 'mountain';   // 温暖多湿・高地 → 山岳
    if (temp > 0.1 && humid > 0.2 && humid <= 0.4) return 'cherry'; // 温暖・中湿度 → 桜の森
    if (humid > 0.5) return 'swamp';                      // 高湿度 → 沼地
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
    else if (biome === 'jungle') { heightScale = 24; heightOffset = 2; }
    else if (biome === 'swamp') { heightScale = 8; heightOffset = -3; } // 低地・平坦
    else if (biome === 'savanna') { heightScale = 14; heightOffset = -1; } // 平坦な乾燥地
    else if (biome === 'cherry') { heightScale = 18; heightOffset = 1; }   // 穏やかな丘

    return Math.floor(SEA_LEVEL + n * heightScale + heightOffset);
  }

  generateChunkData(cx, cz, chunkEdits) {
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
            } else if (y < 18 && oreVal > 0.95 && oreVal2 > 0.92) {
              // アメジスト鉱石: Y<18 に極まれに生成（~0.5%）
              blocks[lx][y][lz] = BlockType.AMETHYST_ORE;
            } else if (y < 30 && oreVal > 0.92) {
              // 金鉱石: Y<30 に稀に生成（~2%）
              blocks[lx][y][lz] = BlockType.GOLD_ORE;
            } else if (y < 55 && oreVal > 0.88) {
              // 鉄鉱石: Y<55 に生成（~4%）
              blocks[lx][y][lz] = BlockType.IRON_ORE;
            } else if (oreVal2 > 0.82) {
              // 石炭鉱石: 全深度に生成（~9%）
              blocks[lx][y][lz] = BlockType.COAL_ORE;
            } else if (y < 20) {
              // 深層岩: Y<20 の基盤部分
              blocks[lx][y][lz] = BlockType.DEEPSLATE;
            } else {
              blocks[lx][y][lz] = BlockType.STONE;
            }
          } else if (y < height) {
            // 砂漠の地下は砂岩が混じる
            if (biome === 'desert' && y >= height - 4) {
              blocks[lx][y][lz] = BlockType.SANDSTONE;
            // 沼地の地下は苔石が混じる
            } else if (biome === 'swamp' && y < height - 1 && y >= height - 4 && this.oreNoise.noise2D(wx * 0.3 + 77, wz * 0.3 + 77) > 0.6) {
              blocks[lx][y][lz] = BlockType.MOSSY_COBBLESTONE;
            } else {
              blocks[lx][y][lz] = BlockType.DIRT;
            }
          } else if (y === height) {
            if (height <= SEA_LEVEL) {
              blocks[lx][y][lz] = BlockType.SAND;
            } else if (biome === 'desert') {
              blocks[lx][y][lz] = BlockType.SAND;
            } else if (biome === 'tundra') {
              blocks[lx][y][lz] = BlockType.SNOW;
            } else if (biome === 'mountain' && height > SEA_LEVEL + 22) {
              blocks[lx][y][lz] = BlockType.STONE; // 高山の頂上は石
            } else if (biome === 'swamp') {
              blocks[lx][y][lz] = BlockType.GRASS; // 沼地も草
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
          const isForest   = biome === 'forest';
          const isDesert   = biome === 'desert';
          const isTundra   = biome === 'tundra';
          const isMountain = biome === 'mountain';
          const isJungle   = biome === 'jungle';
          const isSwamp    = biome === 'swamp';
          const isSavanna  = biome === 'savanna';
          const isCherry   = biome === 'cherry';
          const treeThreshold = isForest ? 0.15 : isTundra ? 0.55 : isMountain ? 0.60 : isJungle ? 0.05 : isSavanna ? 0.50 : isCherry ? 0.25 : 0.35;

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
          } else if (isSwamp && treeVal > 0.4 && lx > 1 && lx < CHUNK_SIZE - 2 && lz > 1 && lz < CHUNK_SIZE - 2) {
            // 沼地: 低い木（通常の木材・葉）とキノコ
            const swampKey = `${wx},${wz}`;
            if (!this.treePlaced.has(swampKey)) {
              this.treePlaced.add(swampKey);
              if (treeVal > 0.7) {
                // 小さな木
                const trunkH = 3 + Math.floor(Math.abs(this.treeNoise.noise2D(wx * 10, wz * 10)) * 2);
                for (let ty = 1; ty <= trunkH && height + ty < WORLD_HEIGHT; ty++) {
                  blocks[lx][height + ty][lz] = BlockType.WOOD;
                }
                const placeLeaf = (nlx, ny, nlz) => {
                  if (nlx >= 0 && nlx < CHUNK_SIZE && nlz >= 0 && nlz < CHUNK_SIZE && ny >= 0 && ny < WORLD_HEIGHT) {
                    if (blocks[nlx][ny][nlz] === BlockType.AIR) blocks[nlx][ny][nlz] = BlockType.LEAVES;
                  }
                };
                for (let ly = trunkH - 1; ly <= trunkH + 1; ly++) {
                  const radius = ly === trunkH + 1 ? 1 : 2;
                  for (let dx = -radius; dx <= radius; dx++) {
                    for (let dz = -radius; dz <= radius; dz++) {
                      if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
                      placeLeaf(lx + dx, height + ly, lz + dz);
                    }
                  }
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

              const leafType = isJungle ? BlockType.JUNGLE_LEAVES
                            : isSavanna ? BlockType.ACACIA_LEAVES
                            : isCherry  ? BlockType.CHERRY_LEAVES
                            : BlockType.LEAVES;
              const trunkType = isJungle  ? BlockType.JUNGLE_WOOD
                              : isSavanna ? BlockType.ACACIA_WOOD
                              : isCherry  ? BlockType.CHERRY_WOOD
                              : BlockType.WOOD;
              const placeLeaf = (nlx, ny, nlz) => {
                if (nlx >= 0 && nlx < CHUNK_SIZE && nlz >= 0 && nlz < CHUNK_SIZE && ny >= 0 && ny < WORLD_HEIGHT) {
                  if (blocks[nlx][ny][nlz] === BlockType.AIR) blocks[nlx][ny][nlz] = leafType;
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
              } else if (isJungle) {
                // ジャングル型: 非常に背が高い幹 + ジャングル木材 + ジャングル葉
                const trunkH = Math.min(9 + Math.floor(rndH * 6), maxTrunkH);
                for (let ty = 1; ty <= trunkH && height + ty < WORLD_HEIGHT; ty++) {
                  blocks[lx][height + ty][lz] = trunkType;
                  // 太い幹（2x2）
                  if (lx + 1 < CHUNK_SIZE) blocks[lx + 1][height + ty][lz] = trunkType;
                }
                // ジャングル葉の球状配置
                const leafStart = trunkH - 2;
                const leafEnd = trunkH + 2;
                for (let ly = leafStart; ly <= leafEnd; ly++) {
                  const radius = ly >= leafEnd - 1 ? 1 : 4;
                  for (let dx = -radius; dx <= radius; dx++) {
                    for (let dz = -radius; dz <= radius; dz++) {
                      if (dx === 0 && dz === 0 && ly < leafEnd) continue;
                      if (dx * dx + dz * dz > (radius + 0.5) * (radius + 0.5)) continue;
                      placeLeaf(lx + dx, height + ly, lz + dz);
                    }
                  }
                }
              } else if (isSavanna) {
                // アカシア型: 短い幹＋傘状に広がる葉（サバンナ特有）
                const trunkH = Math.min(3 + Math.floor(rndH * 2), maxTrunkH);
                for (let ty = 1; ty <= trunkH && height + ty < WORLD_HEIGHT; ty++) {
                  blocks[lx][height + ty][lz] = trunkType;
                }
                // 傘状の葉（上部に広く、薄い層）
                for (let ly = trunkH - 1; ly <= trunkH + 1; ly++) {
                  const radius = ly === trunkH - 1 ? 1 : ly === trunkH ? 3 : 2;
                  for (let dx = -radius; dx <= radius; dx++) {
                    for (let dz = -radius; dz <= radius; dz++) {
                      if (dx === 0 && dz === 0 && ly <= trunkH) continue;
                      if (dx * dx + dz * dz > (radius + 0.5) * (radius + 0.5)) continue;
                      placeLeaf(lx + dx, height + ly, lz + dz);
                    }
                  }
                }
              } else if (isCherry) {
                // 桜型: 中程度の高さ＋ふんわりした球状の葉（ピンク）
                const trunkH = Math.min(4 + Math.floor(rndH * 3), maxTrunkH);
                for (let ty = 1; ty <= trunkH && height + ty < WORLD_HEIGHT; ty++) {
                  blocks[lx][height + ty][lz] = trunkType;
                }
                const leafStart = trunkH - 1;
                const leafEnd = trunkH + 2;
                for (let ly = leafStart; ly <= leafEnd; ly++) {
                  const radius = ly === leafEnd ? 1 : 2;
                  for (let dx = -radius; dx <= radius; dx++) {
                    for (let dz = -radius; dz <= radius; dz++) {
                      if (dx === 0 && dz === 0 && ly < leafEnd) continue;
                      if (dx * dx + dz * dz > (radius + 0.8) * (radius + 0.8)) continue;
                      placeLeaf(lx + dx, height + ly, lz + dz);
                    }
                  }
                }
              } else if (isForest) {
                // 大オーク型: 太い幹＋大きな球状の葉
                const trunkH = Math.min(5 + Math.floor(rndH * 4), maxTrunkH);
                for (let ty = 1; ty <= trunkH && height + ty < WORLD_HEIGHT; ty++) {
                  blocks[lx][height + ty][lz] = trunkType;
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
                  blocks[lx][height + ty][lz] = trunkType;
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
        } else if (biome === 'jungle') {
          // ジャングル: 密な草と花
          if (decVal > -0.3) blocks[lx][height + 1][lz] = BlockType.TALL_GRASS;
          if (decVal > 0.4 && decVal2 > 0.2) blocks[lx][height + 1][lz] = BlockType.FLOWER;
        } else if (biome === 'swamp') {
          // 沼地: キノコと草
          if (decVal > 0.3) blocks[lx][height + 1][lz] = BlockType.TALL_GRASS;
          if (decVal > 0.6) blocks[lx][height + 1][lz] = BlockType.MUSHROOM;
        } else if (biome === 'savanna') {
          // サバンナ: まばらな草のみ（乾燥した景観）
          if (decVal > 0.55) blocks[lx][height + 1][lz] = BlockType.TALL_GRASS;
        } else if (biome === 'cherry') {
          // 桜の森: 花と草が豊か
          if (decVal > 0.1) blocks[lx][height + 1][lz] = BlockType.TALL_GRASS;
          if (decVal > 0.35 && decVal2 > 0.0) blocks[lx][height + 1][lz] = BlockType.FLOWER;
          if (decVal > 0.65 && decVal2 > 0.4) blocks[lx][height + 1][lz] = BlockType.FLOWER;
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
              block !== BlockType.DIAMOND_ORE && block !== BlockType.DEEPSLATE &&
              block !== BlockType.AMETHYST_ORE) continue;

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

    // ---- ダンジョン生成: 地下に丸石の小部屋を生成 ----
    // チャンクごとに低確率でダンジョンを配置
    const dungeonNoise = this.oreNoise.noise2D(cx * 7.3 + 11.1, cz * 7.3 + 33.7);
    if (dungeonNoise > 0.85) {
      // 部屋の位置をチャンク中央付近に配置
      const roomCenterX = Math.floor(CHUNK_SIZE / 2) + Math.floor((dungeonNoise * 100) % 4) - 2;
      const roomCenterZ = Math.floor(CHUNK_SIZE / 2) + Math.floor((dungeonNoise * 137) % 4) - 2;
      const roomFloorY = 18 + Math.floor(Math.abs(dungeonNoise * 100) % 18); // Y=18〜35
      const roomW = 5; // 幅
      const roomD = 5; // 奥行き
      const roomH = 4; // 高さ

      // 丸石の壁・床・天井で部屋を形成
      for (let rx = -1; rx <= roomW; rx++) {
        for (let rz = -1; rz <= roomD; rz++) {
          for (let ry = -1; ry <= roomH; ry++) {
            const bx = roomCenterX + rx;
            const bz = roomCenterZ + rz;
            const by = roomFloorY + ry;
            if (bx < 0 || bx >= CHUNK_SIZE || bz < 0 || bz >= CHUNK_SIZE || by < 0 || by >= WORLD_HEIGHT) continue;
            const isWall = rx < 0 || rx === roomW || rz < 0 || rz === roomD || ry < 0 || ry === roomH;
            if (isWall) {
              blocks[bx][by][bz] = BlockType.COBBLESTONE;
            } else {
              blocks[bx][by][bz] = BlockType.AIR;
            }
          }
        }
      }

      // 入り口（北側の壁に2ブロックの穴）
      const doorX = roomCenterX + 2;
      const doorZ = roomCenterZ - 1;
      if (doorX >= 0 && doorX < CHUNK_SIZE && doorZ >= 0 && doorZ < CHUNK_SIZE) {
        if (roomFloorY >= 0 && roomFloorY < WORLD_HEIGHT) blocks[doorX][roomFloorY][doorZ] = BlockType.AIR;
        if (roomFloorY + 1 < WORLD_HEIGHT) blocks[doorX][roomFloorY + 1][doorZ] = BlockType.AIR;
      }

      // 部屋中央にチェストを設置
      const chestX = roomCenterX + 2;
      const chestZ = roomCenterZ + 2;
      if (chestX >= 0 && chestX < CHUNK_SIZE && chestZ >= 0 && chestZ < CHUNK_SIZE && roomFloorY >= 0 && roomFloorY < WORLD_HEIGHT) {
        blocks[chestX][roomFloorY][chestZ] = BlockType.CHEST;
      }

      // 床に鉱石を散りばめる（探索報酬）
      const oreType = dungeonNoise > 0.92 ? BlockType.DIAMOND_ORE :
                      dungeonNoise > 0.88 ? BlockType.GOLD_ORE : BlockType.IRON_ORE;
      for (let rx = 0; rx < roomW; rx++) {
        for (let rz = 0; rz < roomD; rz++) {
          if (Math.abs(this.oreNoise.noise2D(cx * 3.1 + rx, cz * 3.7 + rz)) > 0.7) {
            const bx = roomCenterX + rx;
            const bz = roomCenterZ + rz;
            if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && roomFloorY - 1 >= 0) {
              blocks[bx][roomFloorY - 1][bz] = oreType;
            }
          }
        }
      }
    }

    // ---- 村の生成: 平原・森林バイオームに家と井戸を配置 ----
    const centerWX = cx * CHUNK_SIZE + 7;
    const centerWZ = cz * CHUNK_SIZE + 7;
    const villageBiome = this.getBiome(centerWX, centerWZ);
    const isVillageBiome = villageBiome === 'plains' || villageBiome === 'forest';
    const villageNoise = this.oreNoise.noise2D(cx * 11.7 + 5.3, cz * 11.7 + 8.9);

    if (isVillageBiome && villageNoise > 0.78) {
      const placeV = (lx, ly, lz, type) => {
        if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && ly >= 0 && ly < WORLD_HEIGHT) {
          blocks[lx][ly][lz] = type;
        }
      };

      // 家の左上角を決定（チャンク内に収まる範囲）
      const houseLX = 2 + Math.floor(Math.abs(villageNoise * 100) % 3);
      const houseLZ = 2 + Math.floor(Math.abs(villageNoise * 137) % 3);
      const houseFloorY = this.getHeight(cx * CHUNK_SIZE + houseLX + 2, cz * CHUNK_SIZE + houseLZ + 2);
      const HOUSE_W = 6; // X方向
      const HOUSE_D = 6; // Z方向
      const HOUSE_H = 3; // 壁の高さ

      // 床（プランク）と床下を埋める
      for (let rx = 0; rx < HOUSE_W; rx++) {
        for (let rz = 0; rz < HOUSE_D; rz++) {
          placeV(houseLX + rx, houseFloorY, houseLZ + rz, BlockType.PLANK);
          // 床より上の内部空間をクリア（草・木を除去）
          for (let ry = 1; ry <= HOUSE_H + 2; ry++) {
            const inside = rx > 0 && rx < HOUSE_W - 1 && rz > 0 && rz < HOUSE_D - 1;
            if (inside) placeV(houseLX + rx, houseFloorY + ry, houseLZ + rz, BlockType.AIR);
          }
        }
      }

      // 壁（プランク・ガラス窓・入口）
      for (let ry = 1; ry <= HOUSE_H; ry++) {
        for (let rx = 0; rx < HOUSE_W; rx++) {
          for (let rz = 0; rz < HOUSE_D; rz++) {
            const isWall = rx === 0 || rx === HOUSE_W - 1 || rz === 0 || rz === HOUSE_D - 1;
            if (!isWall) continue;
            // 入口（手前中央の1・2段目）
            if (rz === 0 && rx === 2 && (ry === 1 || ry === 2)) continue;
            // 窓（側面の2段目）
            if (ry === 2 && (rx === 0 || rx === HOUSE_W - 1) && (rz === 2)) {
              placeV(houseLX + rx, houseFloorY + ry, houseLZ + rz, BlockType.GLASS);
              continue;
            }
            placeV(houseLX + rx, houseFloorY + ry, houseLZ + rz, BlockType.PLANK);
          }
        }
      }

      // 屋根（プランク1層・壁より1マス広い）
      for (let rx = -1; rx <= HOUSE_W; rx++) {
        for (let rz = -1; rz <= HOUSE_D; rz++) {
          placeV(houseLX + rx, houseFloorY + HOUSE_H + 1, houseLZ + rz, BlockType.PLANK);
        }
      }

      // 室内: チェスト＋たいまつ
      placeV(houseLX + 1, houseFloorY + 1, houseLZ + 1, BlockType.CHEST);
      placeV(houseLX + 1, houseFloorY + HOUSE_H, houseLZ + HOUSE_D - 2, BlockType.TORCH);
      placeV(houseLX + HOUSE_W - 2, houseFloorY + HOUSE_H, houseLZ + HOUSE_D - 2, BlockType.TORCH);

      // --- 井戸（家の横） ---
      const wellLX = houseLX + HOUSE_W + 2;
      const wellLZ = houseLZ + 1;
      const wellFloorY = this.getHeight(cx * CHUNK_SIZE + wellLX + 1, cz * CHUNK_SIZE + wellLZ + 1);
      if (wellLX + 2 < CHUNK_SIZE) {
        // 外周（3×3丸石）
        for (let rx = 0; rx < 3; rx++) {
          for (let rz = 0; rz < 3; rz++) {
            if (rx === 1 && rz === 1) {
              // 中央: 水
              placeV(wellLX + rx, wellFloorY,     wellLZ + rz, BlockType.WATER);
              placeV(wellLX + rx, wellFloorY - 1, wellLZ + rz, BlockType.WATER);
              placeV(wellLX + rx, wellFloorY - 2, wellLZ + rz, BlockType.COBBLESTONE);
            } else {
              placeV(wellLX + rx, wellFloorY, wellLZ + rz, BlockType.COBBLESTONE);
            }
            // 角柱（2段）
            if ((rx === 0 || rx === 2) && (rz === 0 || rz === 2)) {
              placeV(wellLX + rx, wellFloorY + 1, wellLZ + rz, BlockType.COBBLESTONE);
              placeV(wellLX + rx, wellFloorY + 2, wellLZ + rz, BlockType.COBBLESTONE);
            }
          }
        }
        // 井戸の屋根（十字プランク）
        for (let rx = 0; rx < 3; rx++) placeV(wellLX + rx, wellFloorY + 3, wellLZ + 1, BlockType.PLANK);
        for (let rz = 0; rz < 3; rz++) placeV(wellLX + 1, wellFloorY + 3, wellLZ + rz, BlockType.PLANK);
      }
    }

    // Apply saved chunk edits (diffs) to override generated terrain.
    const chunkKey = `${cx},${cz}`;
    const editsMap = chunkEdits.get(chunkKey);
    if (editsMap) {
      for (const edit of editsMap.values()) {
        const lx = ((edit.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((edit.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        if (edit.y >= 0 && edit.y < WORLD_HEIGHT) {
          blocks[lx][edit.y][lz] = edit.type;
        }
      }
    }

    // 最高非空気ブロックのY座標を計算（メッシュ構築のY走査上限に使用）
    let maxY = 0;
    outer: for (let y = WORLD_HEIGHT - 1; y > 0; y--) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          if (blocks[lx][y][lz] !== BlockType.AIR) {
            maxY = y;
            break outer;
          }
        }
      }
    }

    return { blocks, maxY };
  }
}
