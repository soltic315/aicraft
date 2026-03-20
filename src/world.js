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
    // チャンクロード後に境界メッシュを修正するための再構築キュー
    this.pendingBorderRebuilds = new Set();

    // Frustum culling helpers
    this._frustum = new THREE.Frustum();
    this._projScreenMatrix = new THREE.Matrix4();
    this._hasFrustum = false;

    // Chunk-level edits applied after terrain generation.
    // Keyed by chunk key ("cx,cz") and contains an array of {x,y,z,type} edits.
    this.chunkEdits = new Map();
    // ブロック編集によりメッシュ再構築が必要なチャンクのキュー（次フレームで処理）
    this.dirtyChunks = new Set();

    // チャンクデータ生成用ワーカープール（メインスレッドのフレームをブロックしない）
    this._inFlightChunks = new Set();    // ワーカーで生成中のチャンクキー
    this._pendingMeshBuilds = [];        // { cx, cz, flatBlocks } メッシュ構築待ち
    this._lastPcx = 0;
    this._lastPcz = 0;
    const workerCount = Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 4) - 1));
    this._workers = [];
    this._freeWorkerIndices = [];
    for (let i = 0; i < workerCount; i++) {
      const idx = i;
      const worker = new Worker(new URL('./chunkWorker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        const { cx, cz, flatBlocks, maxY } = data;
        const key = this._chunkKey(cx, cz);
        this._inFlightChunks.delete(key);
        this._freeWorkerIndices.push(idx);
        if (!this.chunks.has(key)) {
          this._pendingMeshBuilds.push({ cx, cz, flatBlocks, maxY });
        }
        this._dispatchToFreeWorkers(this._lastPcx, this._lastPcz);
      };
      this._workers.push(worker);
      this._freeWorkerIndices.push(i);
    }

    // メッシュ構築用ワーカープール（ジオメトリ計算をメインスレッドから分離）
    this._pendingMeshDispatch = [];   // { cx, cz } メッシュワーカーへの送信待ちキュー
    this._inFlightMeshes = new Set(); // メッシュワーカーで処理中のチャンクキー
    this._completedMeshes = [];       // { cx, cz, geoData } 完成したジオメトリ
    const meshWorkerCount = Math.max(1, Math.min(2, Math.floor((navigator.hardwareConcurrency ?? 4) / 2)));
    this._meshWorkers = [];
    this._freeMeshWorkerIndices = [];
    for (let i = 0; i < meshWorkerCount; i++) {
      const midx = i;
      const mw = new Worker(new URL('./meshWorker.js', import.meta.url), { type: 'module' });
      mw.onmessage = ({ data }) => {
        const { cx, cz, geoData } = data;
        const key = this._chunkKey(cx, cz);
        this._inFlightMeshes.delete(key);
        this._freeMeshWorkerIndices.push(midx);
        this._completedMeshes.push({ cx, cz, geoData });
        this._dispatchToFreeMeshWorkers();
      };
      this._meshWorkers.push(mw);
      this._freeMeshWorkerIndices.push(i);
    }

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
    this.pendingBorderRebuilds.clear();
    this.dirtyChunks.clear();
    this.treePlaced.clear();
    this._inFlightChunks.clear();
    this._pendingMeshBuilds = [];
    this._pendingMeshDispatch = [];
    this._inFlightMeshes.clear();
    this._completedMeshes = [];

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

  // ゲーム開始前にローディング画面中で全チャンクを一括生成する。
  // フェーズ1でデータ生成、フェーズ2でメッシュ構築を行い、
  // 4チャンクごとにメインスレッドへ制御を返してUIを応答可能に保つ。
  async preloadAllChunks(playerX, playerZ, onProgress) {
    const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    // 描画距離内の全チャンク座標を収集
    const coords = [];
    for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
        coords.push({ cx: pcx + dx, cz: pcz + dz });
      }
    }

    const total = coords.length;

    // フェーズ1: 全チャンクのブロックデータを生成（メッシュなし）
    // 全データが揃ってからメッシュを構築することで境界が正しく描画される
    for (let i = 0; i < coords.length; i++) {
      const { cx, cz } = coords[i];
      const key = this._chunkKey(cx, cz);
      if (!this.chunks.has(key)) {
        const data = this._generateChunkData(cx, cz);
        const boundingBox = new THREE.Box3(
          new THREE.Vector3(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE),
          new THREE.Vector3((cx + 1) * CHUNK_SIZE, WORLD_HEIGHT, (cz + 1) * CHUNK_SIZE)
        );
        this.chunks.set(key, { ...data, mesh: null, boundingBox });
        this.pendingChunkSet.delete(key);
      }
      if (onProgress) onProgress(i + 1, total * 2, `地形生成中... ${i + 1} / ${total}`);
      // 4チャンクごとにメインスレッドへ制御を返す
      if (i % 4 === 3) await yieldToMain();
    }

    // フェーズ2: 全チャンクのメッシュを構築
    // 隣接データが揃った状態で行うため境界面の欠けが発生しない
    for (let i = 0; i < coords.length; i++) {
      const { cx, cz } = coords[i];
      this._rebuildChunkMesh(cx, cz, false);
      if (onProgress) onProgress(total + i + 1, total * 2, `メッシュ構築中... ${i + 1} / ${total}`);
      if (i % 4 === 3) await yieldToMain();
    }

    // プリロード完了後は境界再構築キューが不要（全メッシュ済み）
    this.pendingBorderRebuilds.clear();
    // ロード済みチャンクをペンディングキューから除去
    this.pendingChunkLoads = this.pendingChunkLoads.filter(
      item => !this.chunks.has(item.key)
    );
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
    if (this.chunks.has(key) || this.pendingChunkSet.has(key) || this._inFlightChunks.has(key)) return;
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

  // 空きワーカーへチャンク生成ジョブをディスパッチする
  _dispatchToFreeWorkers(pcx, pcz) {
    while (this._freeWorkerIndices.length > 0 && this.pendingChunkLoads.length > 0) {
      const next = this._dequeueNearestChunkLoad(pcx, pcz);
      if (!next) break;
      const workerIdx = this._freeWorkerIndices.pop();
      this._inFlightChunks.add(next.key);
      const chunkEditsMap = this.chunkEdits.get(next.key);
      const chunkEdits = chunkEditsMap ? [...chunkEditsMap.values()] : null;
      this._workers[workerIdx].postMessage({ cx: next.cx, cz: next.cz, seed: this.seed, chunkEdits });
    }
  }

  // ワーカーから受け取ったフラット Uint8Array をチャンクの blocks 構造へ変換する
  _unflattenBlocks(flat) {
    const blocks = new Array(CHUNK_SIZE);
    const strideX = WORLD_HEIGHT * CHUNK_SIZE;
    const strideY = CHUNK_SIZE;
    for (let x = 0; x < CHUNK_SIZE; x++) {
      blocks[x] = new Array(WORLD_HEIGHT);
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const offset = x * strideX + y * strideY;
        blocks[x][y] = flat.subarray(offset, offset + CHUNK_SIZE);
      }
    }
    return blocks;
  }

  // チャンクのフラット Uint8Array を取得（なければ 3D blocks から遅延生成してキャッシュ）
  _getChunkFlatBlocks(cx, cz) {
    const chunk = this.chunks.get(this._chunkKey(cx, cz));
    if (!chunk) return null;
    if (chunk.flatBlocks) return chunk.flatBlocks;
    // プリロードパスのチャンクは flatBlocks を持たないため変換して保存
    const flat = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        flat.set(chunk.blocks[x][y], x * WORLD_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE);
      }
    }
    chunk.flatBlocks = flat;
    return flat;
  }

  // 空きメッシュワーカーへジオメトリ構築ジョブをディスパッチする
  _dispatchToFreeMeshWorkers() {
    const stillPending = [];
    for (const item of this._pendingMeshDispatch) {
      if (this._freeMeshWorkerIndices.length === 0) {
        stillPending.push(item);
        continue;
      }
      const { cx, cz } = item;
      const key = this._chunkKey(cx, cz);

      if (!this.chunks.has(key)) continue; // 範囲外になったので破棄

      if (this._inFlightMeshes.has(key)) {
        stillPending.push(item); // 処理中 → 後回し
        continue;
      }

      const chunk = this.chunks.get(key);
      const workerIdx = this._freeMeshWorkerIndices.pop();
      this._inFlightMeshes.add(key);

      // 各チャンクのフラット配列をコピーして転送（元のバッファは保持）
      const selfFlat  = this._getChunkFlatBlocks(cx, cz).slice();
      const rightFlat = this._getChunkFlatBlocks(cx + 1, cz)?.slice() ?? null;
      const leftFlat  = this._getChunkFlatBlocks(cx - 1, cz)?.slice() ?? null;
      const frontFlat = this._getChunkFlatBlocks(cx, cz + 1)?.slice() ?? null;
      const backFlat  = this._getChunkFlatBlocks(cx, cz - 1)?.slice() ?? null;

      const transfers = [selfFlat.buffer];
      if (rightFlat) transfers.push(rightFlat.buffer);
      if (leftFlat)  transfers.push(leftFlat.buffer);
      if (frontFlat) transfers.push(frontFlat.buffer);
      if (backFlat)  transfers.push(backFlat.buffer);

      this._meshWorkers[workerIdx].postMessage({
        cx, cz,
        maxY:        chunk.maxY,
        selfBlocks:  selfFlat,
        rightBlocks: rightFlat,
        leftBlocks:  leftFlat,
        frontBlocks: frontFlat,
        backBlocks:  backFlat,
      }, transfers);
    }
    this._pendingMeshDispatch = stillPending;
  }

  // メッシュワーカーから受け取ったジオメトリデータを Three.js メッシュに変換してシーンへ追加
  _applyGeoData(cx, cz, geoData) {
    const key = this._chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }

    if (!geoData || geoData.positions.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(geoData.positions, 3));
    geometry.setAttribute('normal',   new THREE.BufferAttribute(geoData.normals,   3));
    geometry.setAttribute('uv',       new THREE.BufferAttribute(geoData.uvs,       2));
    geometry.setAttribute('color',    new THREE.BufferAttribute(geoData.colors,    3));
    geometry.setIndex(new THREE.BufferAttribute(geoData.indices, 1));

    for (const g of geoData.groups) {
      geometry.addGroup(g.start, g.count, g.materialIndex);
    }

    const FACE_BRIGHTNESS = {
      top: 1.0, front: 0.85, back: 0.85, right: 0.75, left: 0.75, bottom: 0.60,
    };

    const materials = geoData.materialKeys.map(mkey => {
      const [typeStr, face] = mkey.split('_');
      const type = Number(typeStr);
      const faceKey = (face === 'top' || face === 'bottom') ? face : 'side';
      const baseMat = this.blockMaterials[type]?.[faceKey] || this.blockMaterials[BlockType.STONE].side;
      const brightness = FACE_BRIGHTNESS[face] ?? 1.0;
      if (brightness === 1.0) return baseMat;
      const cacheKey = `${mkey}_dim`;
      if (this._dimmedMaterialCache.has(cacheKey)) return this._dimmedMaterialCache.get(cacheKey);
      const mat = baseMat.clone();
      mat.color.setRGB(brightness, brightness, brightness);
      this._dimmedMaterialCache.set(cacheKey, mat);
      return mat;
    });

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.name = `chunk_${cx}_${cz}`;
    chunk.mesh = mesh;

    if (chunk.boundingBox && this._hasFrustum) {
      mesh.visible = this._frustum.intersectsBox(chunk.boundingBox);
    }
    this.scene.add(mesh);
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
    // flatBlocks が存在する場合は同期して更新（メッシュワーカーが参照するため）
    if (chunk.flatBlocks) {
      chunk.flatBlocks[lx * WORLD_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz] = type;
    }

    // メッシュ再構築をキューへ（同期実行するとフリーズするため次フレームで処理）
    this.dirtyChunks.add(this._chunkKey(cx, cz));
    if (lx === 0)               this.dirtyChunks.add(this._chunkKey(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1)  this.dirtyChunks.add(this._chunkKey(cx + 1, cz));
    if (lz === 0)               this.dirtyChunks.add(this._chunkKey(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1)  this.dirtyChunks.add(this._chunkKey(cx, cz + 1));
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

  _buildChunkMesh(cx, cz) {
    const key = this._chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return null;

    // 最高非空気Y+2 までしか走査しない（空気のみの上部をスキップ）
    const meshMaxY = Math.min((chunk.maxY ?? WORLD_HEIGHT - 1) + 2, WORLD_HEIGHT - 1);

    // 隣接チャンクを事前取得して Map ルックアップを最小化
    const cRight = this.chunks.get(this._chunkKey(cx + 1, cz));
    const cLeft  = this.chunks.get(this._chunkKey(cx - 1, cz));
    const cFront = this.chunks.get(this._chunkKey(cx, cz + 1));
    const cBack  = this.chunks.get(this._chunkKey(cx, cz - 1));

    // キャッシュ済みチャンク参照を使った高速ブロック取得
    const getBlock = (wx, wy, wz) => {
      if (wy < 0 || wy >= WORLD_HEIGHT) return BlockType.AIR;
      const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const bcx = Math.floor(wx / CHUNK_SIZE);
      const bcz = Math.floor(wz / CHUNK_SIZE);
      let ch;
      if (bcx === cx) {
        if (bcz === cz)      ch = chunk;
        else if (bcz === cz + 1) ch = cFront;
        else if (bcz === cz - 1) ch = cBack;
        else ch = this.chunks.get(this._chunkKey(bcx, bcz));
      } else if (bcz === cz) {
        if (bcx === cx + 1)  ch = cRight;
        else if (bcx === cx - 1) ch = cLeft;
        else ch = this.chunks.get(this._chunkKey(bcx, bcz));
      } else {
        ch = this.chunks.get(this._chunkKey(bcx, bcz));
      }
      if (!ch) return BlockType.AIR;
      return ch.blocks[lx][wy][lz];
    };

    const groups = {};

    // AO計算ヘルパー
    const isSolid = (wx, wy, wz) => {
      const b = getBlock(wx, wy, wz);
      return b !== BlockType.AIR && b !== BlockType.WATER && b != null;
    };
    // 隣接ブロックがこれらの場合は面を描画する（透明・半透明ブロック）
    const isTransparentNeighbor = (b) =>
      b === BlockType.AIR || b === BlockType.WATER ||
      b === BlockType.ICE || b === BlockType.GLASS;
    const aoVal = (s1, s2, c) => {
      if (s1 && s2) return 0;
      return 3 - (s1 ? 1 : 0) - (s2 ? 1 : 0) - (c ? 1 : 0);
    };
    // AO値(0-3)を明るさ(0.72-1.0)に変換
    const toBright = (v) => 0.72 + 0.28 * (v / 3);

    const computeAO = (blockType, face, x, y, z) => {
      if (blockType === BlockType.WATER || blockType === BlockType.GLASS ||
          blockType === BlockType.LEAVES) {
        return [1, 1, 1, 1];
      }
      switch (face) {
        case 'top':
          return [
            toBright(aoVal(isSolid(x-1,y,z),   isSolid(x,y,z-1),   isSolid(x-1,y,z-1))),
            toBright(aoVal(isSolid(x-1,y,z),   isSolid(x,y,z+1),   isSolid(x-1,y,z+1))),
            toBright(aoVal(isSolid(x+1,y,z),   isSolid(x,y,z+1),   isSolid(x+1,y,z+1))),
            toBright(aoVal(isSolid(x+1,y,z),   isSolid(x,y,z-1),   isSolid(x+1,y,z-1))),
          ];
        case 'bottom':
          return [1, 1, 1, 1]; // 底面はAOなし（ほぼ見えない）
        case 'front': // +Z
          return [
            toBright(aoVal(isSolid(x-1,y,z+1), isSolid(x,y-1,z+1), isSolid(x-1,y-1,z+1))),
            toBright(aoVal(isSolid(x+1,y,z+1), isSolid(x,y-1,z+1), isSolid(x+1,y-1,z+1))),
            toBright(aoVal(isSolid(x+1,y,z+1), isSolid(x,y+1,z+1), isSolid(x+1,y+1,z+1))),
            toBright(aoVal(isSolid(x-1,y,z+1), isSolid(x,y+1,z+1), isSolid(x-1,y+1,z+1))),
          ];
        case 'back': // -Z
          return [
            toBright(aoVal(isSolid(x+1,y,z),   isSolid(x,y-1,z),   isSolid(x+1,y-1,z))),
            toBright(aoVal(isSolid(x-1,y,z),   isSolid(x,y-1,z),   isSolid(x-1,y-1,z))),
            toBright(aoVal(isSolid(x-1,y,z),   isSolid(x,y+1,z),   isSolid(x-1,y+1,z))),
            toBright(aoVal(isSolid(x+1,y,z),   isSolid(x,y+1,z),   isSolid(x+1,y+1,z))),
          ];
        case 'right': // +X
          return [
            toBright(aoVal(isSolid(x+1,y,z+1), isSolid(x+1,y-1,z), isSolid(x+1,y-1,z+1))),
            toBright(aoVal(isSolid(x+1,y,z-1), isSolid(x+1,y-1,z), isSolid(x+1,y-1,z-1))),
            toBright(aoVal(isSolid(x+1,y,z-1), isSolid(x+1,y+1,z), isSolid(x+1,y+1,z-1))),
            toBright(aoVal(isSolid(x+1,y,z+1), isSolid(x+1,y+1,z), isSolid(x+1,y+1,z+1))),
          ];
        case 'left': // -X
          return [
            toBright(aoVal(isSolid(x,y,z-1),   isSolid(x,y-1,z),   isSolid(x,y-1,z-1))),
            toBright(aoVal(isSolid(x,y,z+1),   isSolid(x,y-1,z),   isSolid(x,y-1,z+1))),
            toBright(aoVal(isSolid(x,y,z+1),   isSolid(x,y+1,z),   isSolid(x,y+1,z+1))),
            toBright(aoVal(isSolid(x,y,z-1),   isSolid(x,y+1,z),   isSolid(x,y+1,z-1))),
          ];
        default:
          return [1, 1, 1, 1];
      }
    };

    const addQuad = (blockType, face, x, y, z, w, h) => {
      const groupKey = `${blockType}_${face}`;
      if (!groups[groupKey]) {
        groups[groupKey] = { positions: [], normals: [], uvs: [], colors: [], indices: [], blockType, face };
      }
      const g = groups[groupKey];
      const vi = g.positions.length / 3;
      const aoValues = computeAO(blockType, face, x, y, z);
      this._addQuad(g, x, y, z, w, h, face, vi, aoValues);
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

    // Top / bottom faces（meshMaxY より上はスキップ）
    for (let y = 0; y <= meshMaxY; y++) {
      const topMask = Array.from({ length: CHUNK_SIZE }, () => new Array(CHUNK_SIZE).fill(null));
      const bottomMask = Array.from({ length: CHUNK_SIZE }, () => new Array(CHUNK_SIZE).fill(null));

      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wx = cx * CHUNK_SIZE + lx;
          const wz = cz * CHUNK_SIZE + lz;
          const block = chunk.blocks[lx][y][lz];
          if (block === BlockType.AIR || block === BlockType.WATER) continue;

          if (isTransparentNeighbor(getBlock(wx, y + 1, wz))) topMask[lx][lz] = block;
          if (isTransparentNeighbor(getBlock(wx, y - 1, wz))) bottomMask[lx][lz] = block;
        }
      }

      emitMaskFaces(topMask, CHUNK_SIZE, CHUNK_SIZE, (lx, lz, blockType) => {
        addQuad(blockType, 'top', cx * CHUNK_SIZE + lx, y, cz * CHUNK_SIZE + lz, 1, 1);
      });
      emitMaskFaces(bottomMask, CHUNK_SIZE, CHUNK_SIZE, (lx, lz, blockType) => {
        addQuad(blockType, 'bottom', cx * CHUNK_SIZE + lx, y, cz * CHUNK_SIZE + lz, 1, 1);
      });
    }

    // Front / back faces（meshMaxY より上はスキップ）
    const yCount = meshMaxY + 1;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const frontMask = Array.from({ length: CHUNK_SIZE }, () => new Array(yCount).fill(null));
      const backMask  = Array.from({ length: CHUNK_SIZE }, () => new Array(yCount).fill(null));
      const wz = cz * CHUNK_SIZE + lz;

      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let y = 0; y < yCount; y++) {
          const wx = cx * CHUNK_SIZE + lx;
          const block = chunk.blocks[lx][y][lz];
          if (block === BlockType.AIR || block === BlockType.WATER) continue;

          if (isTransparentNeighbor(getBlock(wx, y, wz + 1))) frontMask[lx][y] = block;
          if (isTransparentNeighbor(getBlock(wx, y, wz - 1))) backMask[lx][y]  = block;
        }
      }

      emitMaskFaces(frontMask, CHUNK_SIZE, yCount, (lx, y, blockType) => {
        addQuad(blockType, 'front', cx * CHUNK_SIZE + lx, y, wz, 1, 1);
      });
      emitMaskFaces(backMask, CHUNK_SIZE, yCount, (lx, y, blockType) => {
        addQuad(blockType, 'back', cx * CHUNK_SIZE + lx, y, wz, 1, 1);
      });
    }

    // Right / left faces（meshMaxY より上はスキップ）
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const rightMask = Array.from({ length: CHUNK_SIZE }, () => new Array(yCount).fill(null));
      const leftMask  = Array.from({ length: CHUNK_SIZE }, () => new Array(yCount).fill(null));
      const wx = cx * CHUNK_SIZE + lx;

      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 0; y < yCount; y++) {
          const wz = cz * CHUNK_SIZE + lz;
          const block = chunk.blocks[lx][y][lz];
          if (block === BlockType.AIR || block === BlockType.WATER) continue;

          if (isTransparentNeighbor(getBlock(wx + 1, y, wz))) rightMask[lz][y] = block;
          if (isTransparentNeighbor(getBlock(wx - 1, y, wz))) leftMask[lz][y]  = block;
        }
      }

      emitMaskFaces(rightMask, CHUNK_SIZE, yCount, (lz, y, blockType) => {
        addQuad(blockType, 'right', wx, y, cz * CHUNK_SIZE + lz, 1, 1);
      });
      emitMaskFaces(leftMask, CHUNK_SIZE, yCount, (lz, y, blockType) => {
        addQuad(blockType, 'left', wx, y, cz * CHUNK_SIZE + lz, 1, 1);
      });
    }

    // Water surfaces（meshMaxY より上はスキップ）
    for (let y = 0; y <= meshMaxY; y++) {
      const waterMask = Array.from({ length: CHUNK_SIZE }, () => new Array(CHUNK_SIZE).fill(null));
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wx = cx * CHUNK_SIZE + lx;
          const wz = cz * CHUNK_SIZE + lz;
          if (chunk.blocks[lx][y][lz] !== BlockType.WATER) continue;
          if (getBlock(wx, y + 1, wz) === BlockType.AIR) waterMask[lx][lz] = BlockType.WATER;
        }
      }
      emitMaskFaces(waterMask, CHUNK_SIZE, CHUNK_SIZE, (lx, lz) => {
        addQuad(BlockType.WATER, 'top', cx * CHUNK_SIZE + lx, y - 0.1, cz * CHUNK_SIZE + lz, 1, 1);
      });
    }

    // Water side/bottom faces（meshMaxY より上はスキップ）
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        for (let y = 0; y <= meshMaxY; y++) {
          if (chunk.blocks[lx][y][lz] !== BlockType.WATER) continue;
          if (getBlock(wx, y, wz + 1) === BlockType.AIR) addQuad(BlockType.WATER, 'front', wx, y, wz, 1, 1);
          if (getBlock(wx, y, wz - 1) === BlockType.AIR) addQuad(BlockType.WATER, 'back',  wx, y, wz, 1, 1);
          if (getBlock(wx + 1, y, wz) === BlockType.AIR) addQuad(BlockType.WATER, 'right', wx, y, wz, 1, 1);
          if (getBlock(wx - 1, y, wz) === BlockType.AIR) addQuad(BlockType.WATER, 'left',  wx, y, wz, 1, 1);
          if (getBlock(wx, y - 1, wz) === BlockType.AIR) addQuad(BlockType.WATER, 'bottom',wx, y, wz, 1, 1);
        }
      }
    }

    // Combine into single geometry with material groups
    if (Object.keys(groups).length === 0) return null;

    const geometry = new THREE.BufferGeometry();
    const allPositions = [];
    const allNormals = [];
    const allUvs = [];
    const allColors = [];
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
      allColors.push(...g.colors);

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
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(allColors, 3));
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

  _addQuad(g, x, y, z, w, h, dir, vi, aoValues) {
    const p = g.positions;
    const n = g.normals;
    const u = g.uvs;
    const c = g.colors;
    const idx = g.indices;

    // 頂点カラー（AO暗化）: 4頂点分を RGB で格納
    const [ao0, ao1, ao2, ao3] = aoValues ?? [1, 1, 1, 1];
    // colors は後で _addQuad の各 case の後にまとめて追加する

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

    // 頂点カラー（AO）: 各頂点に RGB (ao, ao, ao) を格納
    c.push(
      ao0, ao0, ao0,
      ao1, ao1, ao1,
      ao2, ao2, ao2,
      ao3, ao3, ao3,
    );
  }

  _addFace(g, x, y, z, dir, vi) {
    this._addQuad(g, x, y, z, 1, 1, dir, vi, [1, 1, 1, 1]);
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
    // ワーカーのコールバックで使用するため最新のプレイヤーチャンク位置を記憶
    this._lastPcx = pcx;
    this._lastPcz = pcz;

    // ブロック編集によるダーティチャンクを最優先で再構築（フレーム先頭で処理）
    for (const key of this.dirtyChunks) {
      const [cx, cz] = key.split(',').map(Number);
      this._rebuildChunkMesh(cx, cz, false);
    }
    this.dirtyChunks.clear();

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

    // チャンクワーカーが完了したデータをチャンクマップに登録し、メッシュワーカーへディスパッチ
    // （毎フレーム最大4件: チャンク登録は軽量なので増やしてもフレームに影響しない）
    const CHUNK_REGISTERS_PER_FRAME = 4;
    let regCount = 0;
    while (regCount < CHUNK_REGISTERS_PER_FRAME && this._pendingMeshBuilds.length > 0) {
      const { cx, cz, flatBlocks, maxY } = this._pendingMeshBuilds.shift();
      const key = this._chunkKey(cx, cz);
      // すでにロード済み or 描画範囲外になった場合はスキップ
      if (this.chunks.has(key)) continue;
      if (Math.abs(cx - pcx) > this.renderDistance + 1 || Math.abs(cz - pcz) > this.renderDistance + 1) continue;
      const blocks = this._unflattenBlocks(flatBlocks);
      const boundingBox = new THREE.Box3(
        new THREE.Vector3(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE),
        new THREE.Vector3((cx + 1) * CHUNK_SIZE, WORLD_HEIGHT, (cz + 1) * CHUNK_SIZE)
      );
      // flatBlocks をチャンクに保存（メッシュワーカーへのディスパッチ時に使用）
      this.chunks.set(key, { blocks, flatBlocks, mesh: null, boundingBox, maxY: maxY ?? WORLD_HEIGHT - 1 });
      // メッシュ構築をワーカーへ委譲
      this._pendingMeshDispatch.push({ cx, cz });
      // 隣接チャンクの境界メッシュも再構築キューへ
      for (const [ndx, ndz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nKey = this._chunkKey(cx + ndx, cz + ndz);
        if (this.chunks.has(nKey)) this.pendingBorderRebuilds.add(nKey);
      }
      regCount++;
    }

    // 完了したメッシュジオメトリをシーンへ適用（毎フレーム最大4件）
    const MESH_APPLIES_PER_FRAME = 4;
    let applyCount = 0;
    while (applyCount < MESH_APPLIES_PER_FRAME && this._completedMeshes.length > 0) {
      const { cx, cz, geoData } = this._completedMeshes.shift();
      this._applyGeoData(cx, cz, geoData);
      applyCount++;
    }

    // 新チャンクをチャンクワーカーへディスパッチ
    this._dispatchToFreeWorkers(pcx, pcz);
    // メッシュワーカーへもディスパッチ（登録済みジョブを処理）
    this._dispatchToFreeMeshWorkers();

    // 境界再構築キューをメッシュワーカーへ委譲（毎フレーム最大4件）
    // ワーカーが既に処理中のチャンクは _dispatchToFreeMeshWorkers 内でスキップされる
    const BORDER_REBUILDS_PER_FRAME = 4;
    let borderCount = 0;
    for (const key of this.pendingBorderRebuilds) {
      if (borderCount >= BORDER_REBUILDS_PER_FRAME) break;
      this.pendingBorderRebuilds.delete(key);
      const [bx, bz] = key.split(',').map(Number);
      if (this.chunks.has(key)) this._pendingMeshDispatch.push({ cx: bx, cz: bz });
      borderCount++;
    }
    // 境界再構築ジョブをメッシュワーカーへ送信
    if (borderCount > 0) this._dispatchToFreeMeshWorkers();

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
