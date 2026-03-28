// World generation and chunk management
import * as THREE from 'three';
import { BlockType, CROSS_BLOCK_TYPES } from './blocks.js';
import { TerrainGenerator } from './TerrainGenerator.js';

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
    this.terrain = new TerrainGenerator(this.seed);
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
    const meshWorkerCount = Math.max(1, Math.min(3, Math.floor((navigator.hardwareConcurrency ?? 4) / 2)));
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
  // seed を指定すると指定シードで地形を再生成する（省略時はランダム）
  reset(seed) {
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
    this._inFlightChunks.clear();
    this._pendingMeshBuilds = [];
    this._pendingMeshDispatch = [];
    this._inFlightMeshes.clear();
    this._completedMeshes = [];
    // 面輝度キャッシュのマテリアルを解放（メモリリーク防止）
    for (const mat of this._dimmedMaterialCache.values()) mat.dispose();
    this._dimmedMaterialCache.clear();

    // 新しいシードで地形ノイズを再生成
    const newSeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 100000);
    this.seed = newSeed;
    this.terrain.reset(newSeed);
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
      top: 1.0, front: 0.85, back: 0.85, right: 0.75, left: 0.75, bottom: 0.60, cross: 1.0,
    };

    const materials = geoData.materialKeys.map(mkey => {
      const [typeStr, face] = mkey.split('_');
      const type = Number(typeStr);
      const faceKey = (face === 'top' || face === 'bottom' || face === 'cross') ? face : 'side';
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
    // 動的シャドウ（影の投影・受け取り）
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    chunk.mesh = mesh;

    if (chunk.boundingBox && this._hasFrustum) {
      mesh.visible = this._frustum.intersectsBox(chunk.boundingBox);
    }
    this.scene.add(mesh);
  }

  // バイオームを取得（TerrainGenerator に委譲）
  getBiome(x, z) {
    return this.terrain.getBiome(x, z);
  }

  // Get terrain height at world (x, z) - TerrainGenerator に委譲
  getHeight(x, z) {
    return this.terrain.getHeight(x, z);
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
    return this.terrain.generateChunkData(cx, cz, this.chunkEdits);
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
      return b !== BlockType.AIR && b !== BlockType.WATER && b != null && !CROSS_BLOCK_TYPES.has(b);
    };
    // 隣接ブロックがこれらの場合は面を描画する（透明・半透明・クロスブロック）
    const isTransparentNeighbor = (b) =>
      b === BlockType.AIR || b === BlockType.WATER ||
      b === BlockType.ICE || b === BlockType.GLASS ||
      CROSS_BLOCK_TYPES.has(b);
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
          if (CROSS_BLOCK_TYPES.has(block)) continue; // クロスブロックは別パスで処理

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
          if (CROSS_BLOCK_TYPES.has(block)) continue; // クロスブロックは別パスで処理

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
          if (CROSS_BLOCK_TYPES.has(block)) continue; // クロスブロックは別パスで処理

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

    // クロス（X字スプライト）ブロックの描画（草・花・きのこ・たいまつ）
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        for (let y = 0; y <= meshMaxY; y++) {
          const block = chunk.blocks[lx][y][lz];
          if (!CROSS_BLOCK_TYPES.has(block)) continue;

          const groupKey = `${block}_cross`;
          if (!groups[groupKey]) {
            groups[groupKey] = { positions: [], normals: [], uvs: [], colors: [], indices: [], blockType: block, face: 'cross' };
          }
          const g = groups[groupKey];

          // 対角線1: (wx, y, wz) → (wx+1, y, wz+1)
          let vi = g.positions.length / 3;
          g.positions.push(wx,   y,   wz,   wx+1, y,   wz+1, wx+1, y+1, wz+1, wx,   y+1, wz);
          g.normals.push(0.707,0,0.707, 0.707,0,0.707, 0.707,0,0.707, 0.707,0,0.707);
          g.uvs.push(0,0, 1,0, 1,1, 0,1);
          g.indices.push(vi, vi+1, vi+2, vi, vi+2, vi+3);
          g.colors.push(1,1,1, 1,1,1, 1,1,1, 1,1,1);

          // 対角線2: (wx+1, y, wz) → (wx, y, wz+1)
          vi = g.positions.length / 3;
          g.positions.push(wx+1, y,   wz,   wx,   y,   wz+1, wx,   y+1, wz+1, wx+1, y+1, wz);
          g.normals.push(-0.707,0,0.707, -0.707,0,0.707, -0.707,0,0.707, -0.707,0,0.707);
          g.uvs.push(0,0, 1,0, 1,1, 0,1);
          g.indices.push(vi, vi+1, vi+2, vi, vi+2, vi+3);
          g.colors.push(1,1,1, 1,1,1, 1,1,1, 1,1,1);
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
      cross:  1.0,
    };

    // Build materials array
    const materials = materialList.map(key => {
      const [typeStr, face] = key.split('_');
      const type = Number(typeStr);
      const faceKey = (face === 'top' || face === 'bottom' || face === 'cross') ? face : 'side';
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
