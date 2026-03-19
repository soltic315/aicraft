// World generation and chunk management
import * as THREE from 'three';
import { BlockType } from './blocks.js';
import { Noise } from './noise.js';

const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 64;
const SEA_LEVEL = 20;
const RENDER_DISTANCE = 5;

export class World {
  constructor(scene, blockMaterials) {
    this.scene = scene;
    this.blockMaterials = blockMaterials;
    this.chunks = new Map();
    this.noise = new Noise(Math.floor(Math.random() * 100000));
    this.treePlaced = new Set();
  }

  _chunkKey(cx, cz) {
    return `${cx},${cz}`;
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

  _generateChunkData(cx, cz) {
    const blocks = new Array(CHUNK_SIZE);
    for (let x = 0; x < CHUNK_SIZE; x++) {
      blocks[x] = new Array(WORLD_HEIGHT);
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        blocks[x][y] = new Uint8Array(CHUNK_SIZE);
      }
    }

    const treeNoise = new Noise(this.noise.perm[0] * 1000 + 7);

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
          const treeVal = treeNoise.noise2D(wx * 0.5, wz * 0.5);
          if (treeVal > 0.35 && lx > 2 && lx < CHUNK_SIZE - 3 && lz > 2 && lz < CHUNK_SIZE - 3) {
            const treeKey = `${wx},${wz}`;
            if (!this.treePlaced.has(treeKey)) {
              this.treePlaced.add(treeKey);
              // Trunk
              const trunkHeight = 4 + Math.floor(Math.abs(treeNoise.noise2D(wx * 10, wz * 10)) * 3);
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

    return { blocks };
  }

  _buildChunkMesh(cx, cz) {
    const key = this._chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return null;

    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const materialIndices = []; // which face belongs to which material group

    // Group faces by block type and face direction for materials
    // We'll use a single geometry with groups
    const groups = {}; // key: `${blockType}_${faceDir}` -> { positions, normals, uvs, indices }

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const block = chunk.blocks[lx][y][lz];
          if (block === BlockType.AIR || block === BlockType.WATER) continue;

          const wx = cx * CHUNK_SIZE + lx;
          const wz = cz * CHUNK_SIZE + lz;

          // Check all 6 faces
          const neighbors = [
            { dir: 'top', dx: 0, dy: 1, dz: 0, face: 'top' },
            { dir: 'bottom', dx: 0, dy: -1, dz: 0, face: 'bottom' },
            { dir: 'front', dx: 0, dy: 0, dz: 1, face: 'side' },
            { dir: 'back', dx: 0, dy: 0, dz: -1, face: 'side' },
            { dir: 'right', dx: 1, dy: 0, dz: 0, face: 'side' },
            { dir: 'left', dx: -1, dy: 0, dz: 0, face: 'side' },
          ];

          for (const n of neighbors) {
            const nx = wx + n.dx;
            const ny = y + n.dy;
            const nz = wz + n.dz;

            const neighbor = this.getBlock(nx, ny, nz);
            if (neighbor !== BlockType.AIR && neighbor !== BlockType.WATER) continue;

            const groupKey = `${block}_${n.face}`;
            if (!groups[groupKey]) {
              groups[groupKey] = { positions: [], normals: [], uvs: [], indices: [], blockType: block, face: n.face };
            }
            const g = groups[groupKey];
            const vi = g.positions.length / 3;

            this._addFace(g, wx, y, wz, n.dir, vi);
          }
        }
      }
    }

    // Also render water surfaces
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const block = chunk.blocks[lx][y][lz];
          if (block !== BlockType.WATER) continue;

          const wx = cx * CHUNK_SIZE + lx;
          const wz = cz * CHUNK_SIZE + lz;

          // Only top face for water
          const above = this.getBlock(wx, y + 1, wz);
          if (above === BlockType.AIR) {
            const groupKey = `${BlockType.WATER}_top`;
            if (!groups[groupKey]) {
              groups[groupKey] = { positions: [], normals: [], uvs: [], indices: [], blockType: BlockType.WATER, face: 'top' };
            }
            const g = groups[groupKey];
            const vi = g.positions.length / 3;
            this._addFace(g, wx, y - 0.1, wz, 'top', vi);
          }
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

    // Build materials array
    const materials = materialList.map(key => {
      const [typeStr, face] = key.split('_');
      const type = Number(typeStr);
      return this.blockMaterials[type]?.[face] || this.blockMaterials[BlockType.STONE].side;
    });

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.name = `chunk_${cx}_${cz}`;
    return mesh;
  }

  _addFace(g, x, y, z, dir, vi) {
    const p = g.positions;
    const n = g.normals;
    const u = g.uvs;
    const idx = g.indices;

    switch (dir) {
      case 'top':
        p.push(x, y + 1, z, x + 1, y + 1, z, x + 1, y + 1, z + 1, x, y + 1, z + 1);
        n.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        u.push(0, 0, 1, 0, 1, 1, 0, 1);
        break;
      case 'bottom':
        p.push(x, y, z + 1, x + 1, y, z + 1, x + 1, y, z, x, y, z);
        n.push(0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0);
        u.push(0, 0, 1, 0, 1, 1, 0, 1);
        break;
      case 'front':
        p.push(x, y, z + 1, x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z + 1);
        n.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
        u.push(0, 0, 1, 0, 1, 1, 0, 1);
        break;
      case 'back':
        p.push(x + 1, y, z, x, y, z, x, y + 1, z, x + 1, y + 1, z);
        n.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
        u.push(0, 0, 1, 0, 1, 1, 0, 1);
        break;
      case 'right':
        p.push(x + 1, y, z + 1, x + 1, y, z, x + 1, y + 1, z, x + 1, y + 1, z + 1);
        n.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
        u.push(0, 0, 1, 0, 1, 1, 0, 1);
        break;
      case 'left':
        p.push(x, y, z, x, y, z + 1, x, y + 1, z + 1, x, y + 1, z);
        n.push(-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0);
        u.push(0, 0, 1, 0, 1, 1, 0, 1);
        break;
    }

    idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
  }

  _rebuildChunkMesh(cx, cz) {
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
      this.scene.add(mesh);
    }
  }

  update(playerX, playerZ) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    // Load chunks in range
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = this._chunkKey(cx, cz);

        if (!this.chunks.has(key)) {
          const data = this._generateChunkData(cx, cz);
          this.chunks.set(key, { ...data, mesh: null });
          this._rebuildChunkMesh(cx, cz);
        }
      }
    }

    // Unload far chunks
    for (const [key, chunk] of this.chunks) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.abs(cx - pcx) > RENDER_DISTANCE + 2 || Math.abs(cz - pcz) > RENDER_DISTANCE + 2) {
        if (chunk.mesh) {
          this.scene.remove(chunk.mesh);
          chunk.mesh.geometry.dispose();
        }
        this.chunks.delete(key);
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
