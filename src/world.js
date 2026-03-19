// World generation and chunk management
import * as THREE from 'three';
import { BlockType } from './blocks.js';
import { Noise } from './noise.js';

const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 64;
const SEA_LEVEL = 20;
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

  // Get terrain height at world (x, z)
  getHeight(x, z) {
    const scale = 0.02;
    const n = this.noise.fbm(x * scale, z * scale, 5, 2, 0.5);
    return Math.floor(SEA_LEVEL + n * 18);
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

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          if (y === 0) {
            blocks[lx][y][lz] = BlockType.STONE;
          } else if (y < height - 4) {
            blocks[lx][y][lz] = BlockType.STONE;
          } else if (y < height) {
            blocks[lx][y][lz] = BlockType.DIRT;
          } else if (y === height) {
            if (height <= SEA_LEVEL) {
              blocks[lx][y][lz] = BlockType.SAND;
            } else {
              blocks[lx][y][lz] = BlockType.GRASS;
            }
          } else if (y <= SEA_LEVEL) {
            blocks[lx][y][lz] = BlockType.WATER;
          } else {
            blocks[lx][y][lz] = BlockType.AIR;
          }
        }

        // Trees (only on grass, sparse)
        if (height > SEA_LEVEL + 1) {
          const treeVal = this.treeNoise.noise2D(wx * 0.5, wz * 0.5);
          if (treeVal > 0.35 && lx > 2 && lx < CHUNK_SIZE - 3 && lz > 2 && lz < CHUNK_SIZE - 3) {
            const treeKey = `${wx},${wz}`;
            if (!this.treePlaced.has(treeKey)) {
              this.treePlaced.add(treeKey);
              // Trunk
              const trunkHeight = 4 + Math.floor(Math.abs(this.treeNoise.noise2D(wx * 10, wz * 10)) * 3);
              for (let ty = 1; ty <= trunkHeight; ty++) {
                if (height + ty < WORLD_HEIGHT) {
                  blocks[lx][height + ty][lz] = BlockType.WOOD;
                }
              }
              // Leaves sphere
              const leafStart = trunkHeight - 1;
              const leafEnd = trunkHeight + 2;
              for (let ly = leafStart; ly <= leafEnd; ly++) {
                const radius = ly === leafEnd ? 1 : 2;
                for (let dx = -radius; dx <= radius; dx++) {
                  for (let dz = -radius; dz <= radius; dz++) {
                    if (dx === 0 && dz === 0 && ly < leafEnd) continue; // trunk goes through
                    if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
                    const nlx = lx + dx;
                    const nlz = lz + dz;
                    const ny = height + ly;
                    if (nlx >= 0 && nlx < CHUNK_SIZE && nlz >= 0 && nlz < CHUNK_SIZE && ny < WORLD_HEIGHT) {
                      if (blocks[nlx][ny][nlz] === BlockType.AIR) {
                        blocks[nlx][ny][nlz] = BlockType.LEAVES;
                      }
                    }
                  }
                }
              }
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

    // Build materials array
    const materials = materialList.map(key => {
      const [typeStr, face] = key.split('_');
      const type = Number(typeStr);
      const faceKey = (face === 'top' || face === 'bottom') ? face : 'side';
      return this.blockMaterials[type]?.[faceKey] || this.blockMaterials[BlockType.STONE].side;
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
