// Web Worker: チャンクのメッシュジオメトリ計算をメインスレッドをブロックせずに実行する
// Three.js は使用しない。純粋な配列演算のみ。
import { BlockType } from './blocks.js';

const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 128;

// 現在処理中のチャンク情報（ワーカースコープグローバル）
let CX, CZ;
let selfBlocks, rightBlocks, leftBlocks, frontBlocks, backBlocks;

// フラット Uint8Array インデックス計算
function B(lx, y, lz) {
  return lx * WORLD_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + lz;
}

// ワールド座標からブロックタイプを取得（5チャンク分のフラット配列を参照）
function getBlock(wx, wy, wz) {
  if (wy < 0 || wy >= WORLD_HEIGHT) return BlockType.AIR;
  const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const bcx = Math.floor(wx / CHUNK_SIZE);
  const bcz = Math.floor(wz / CHUNK_SIZE);
  let fb;
  if (bcx === CX) {
    if (bcz === CZ)          fb = selfBlocks;
    else if (bcz === CZ + 1) fb = frontBlocks;
    else if (bcz === CZ - 1) fb = backBlocks;
    else return BlockType.AIR;
  } else if (bcz === CZ) {
    if (bcx === CX + 1)      fb = rightBlocks;
    else if (bcx === CX - 1) fb = leftBlocks;
    else return BlockType.AIR;
  } else {
    return BlockType.AIR;
  }
  if (!fb) return BlockType.AIR;
  return fb[B(lx, wy, lz)];
}

const isSolid = (wx, wy, wz) => {
  const b = getBlock(wx, wy, wz);
  return b !== BlockType.AIR && b !== BlockType.WATER && b != null;
};

const isTransparentNeighbor = (b) =>
  b === BlockType.AIR || b === BlockType.WATER ||
  b === BlockType.ICE || b === BlockType.GLASS ||
  b === BlockType.LEAVES || b === BlockType.JUNGLE_LEAVES;

// ブロックがその隣接ブロックに向けて面を描画すべきか判定
// ICE・GLASS は同種ブロックと隣接するとき内部面を生成しない（透過の積み重ねを防止）
const shouldShowFace = (blockType, neighborType) => {
  if (!isTransparentNeighbor(neighborType)) return false;
  if (blockType === neighborType &&
      (blockType === BlockType.ICE || blockType === BlockType.GLASS)) return false;
  return true;
};

const aoVal = (s1, s2, c) => {
  if (s1 && s2) return 0;
  return 3 - (s1 ? 1 : 0) - (s2 ? 1 : 0) - (c ? 1 : 0);
};

// AO値(0-3)を明るさ(0.72-1.0)に変換
const toBright = (v) => 0.72 + 0.28 * (v / 3);

function computeAO(blockType, face, x, y, z) {
  if (blockType === BlockType.WATER || blockType === BlockType.GLASS ||
      blockType === BlockType.LEAVES || blockType === BlockType.JUNGLE_LEAVES) {
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
      return [1, 1, 1, 1]; // 底面は AO なし
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
}

// ジオメトリグループへクワッドを追加（_addQuad と同一ロジック）
function addQuadGeom(g, x, y, z, w, h, dir, vi, aoValues) {
  const [ao0, ao1, ao2, ao3] = aoValues;
  switch (dir) {
    case 'top':
      g.p.push(x,y+1,z,   x,y+1,z+h, x+w,y+1,z+h, x+w,y+1,z);
      g.n.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
      g.u.push(0,0, w,0, w,h, 0,h);
      break;
    case 'bottom':
      g.p.push(x,y,z,     x+w,y,z,   x+w,y,z+h,   x,y,z+h);
      g.n.push(0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0);
      g.u.push(0,0, w,0, w,h, 0,h);
      break;
    case 'front':
      g.p.push(x,y,z+1,   x+w,y,z+1, x+w,y+h,z+1, x,y+h,z+1);
      g.n.push(0,0,1, 0,0,1, 0,0,1, 0,0,1);
      g.u.push(0,0, w,0, w,h, 0,h);
      break;
    case 'back':
      g.p.push(x+w,y,z,   x,y,z,     x,y+h,z,     x+w,y+h,z);
      g.n.push(0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1);
      g.u.push(0,0, w,0, w,h, 0,h);
      break;
    case 'right':
      g.p.push(x+1,y,z+w, x+1,y,z,   x+1,y+h,z,   x+1,y+h,z+w);
      g.n.push(1,0,0, 1,0,0, 1,0,0, 1,0,0);
      g.u.push(0,0, w,0, w,h, 0,h);
      break;
    case 'left':
      g.p.push(x,y,z,     x,y,z+w,   x,y+h,z+w,   x,y+h,z);
      g.n.push(-1,0,0, -1,0,0, -1,0,0, -1,0,0);
      g.u.push(0,0, w,0, w,h, 0,h);
      break;
  }
  g.i.push(vi, vi+1, vi+2, vi, vi+2, vi+3);
  g.c.push(ao0,ao0,ao0, ao1,ao1,ao1, ao2,ao2,ao2, ao3,ao3,ao3);
}

// メッシュジオメトリデータを構築して返す（_buildChunkMesh のワーカー版）
function buildMesh(cx, cz, maxY) {
  const groups = {};

  function getGroup(blockType, face) {
    const key = `${blockType}_${face}`;
    if (!groups[key]) {
      // p=positions, n=normals, u=uvs, c=colors, i=indices
      groups[key] = { p: [], n: [], u: [], c: [], i: [], blockType, face };
    }
    return groups[key];
  }

  function addQuad(blockType, face, x, y, z) {
    const g = getGroup(blockType, face);
    const vi = g.p.length / 3;
    const aoValues = computeAO(blockType, face, x, y, z);
    addQuadGeom(g, x, y, z, 1, 1, face, vi, aoValues);
  }

  const meshMaxY = Math.min((maxY ?? WORLD_HEIGHT - 1) + 2, WORLD_HEIGHT - 1);
  const yCount = meshMaxY + 1;

  // Top / bottom faces
  for (let y = 0; y <= meshMaxY; y++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const block = selfBlocks[B(lx, y, lz)];
        if (block === BlockType.AIR || block === BlockType.WATER) continue;
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        if (shouldShowFace(block, getBlock(wx, y + 1, wz))) addQuad(block, 'top',    wx, y, wz);
        if (shouldShowFace(block, getBlock(wx, y - 1, wz))) addQuad(block, 'bottom', wx, y, wz);
      }
    }
  }

  // Front / back faces
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    const wz = cz * CHUNK_SIZE + lz;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = cx * CHUNK_SIZE + lx;
      for (let y = 0; y < yCount; y++) {
        const block = selfBlocks[B(lx, y, lz)];
        if (block === BlockType.AIR || block === BlockType.WATER) continue;
        if (shouldShowFace(block, getBlock(wx, y, wz + 1))) addQuad(block, 'front', wx, y, wz);
        if (shouldShowFace(block, getBlock(wx, y, wz - 1))) addQuad(block, 'back',  wx, y, wz);
      }
    }
  }

  // Right / left faces
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    const wx = cx * CHUNK_SIZE + lx;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = cz * CHUNK_SIZE + lz;
      for (let y = 0; y < yCount; y++) {
        const block = selfBlocks[B(lx, y, lz)];
        if (block === BlockType.AIR || block === BlockType.WATER) continue;
        if (shouldShowFace(block, getBlock(wx + 1, y, wz))) addQuad(block, 'right', wx, y, wz);
        if (shouldShowFace(block, getBlock(wx - 1, y, wz))) addQuad(block, 'left',  wx, y, wz);
      }
    }
  }

  // Water surfaces（上面）
  for (let y = 0; y <= meshMaxY; y++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        if (selfBlocks[B(lx, y, lz)] !== BlockType.WATER) continue;
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        if (getBlock(wx, y + 1, wz) === BlockType.AIR) {
          // 水面は 0.1 下げて描画（_buildChunkMesh と同一）
          addQuad(BlockType.WATER, 'top', wx, y - 0.1, wz);
        }
      }
    }
  }

  // Water side/bottom faces
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      for (let y = 0; y <= meshMaxY; y++) {
        if (selfBlocks[B(lx, y, lz)] !== BlockType.WATER) continue;
        if (getBlock(wx, y, wz + 1) === BlockType.AIR) addQuad(BlockType.WATER, 'front',  wx, y, wz);
        if (getBlock(wx, y, wz - 1) === BlockType.AIR) addQuad(BlockType.WATER, 'back',   wx, y, wz);
        if (getBlock(wx + 1, y, wz) === BlockType.AIR) addQuad(BlockType.WATER, 'right',  wx, y, wz);
        if (getBlock(wx - 1, y, wz) === BlockType.AIR) addQuad(BlockType.WATER, 'left',   wx, y, wz);
        if (getBlock(wx, y - 1, wz) === BlockType.AIR) addQuad(BlockType.WATER, 'bottom', wx, y, wz);
      }
    }
  }

  const entries = Object.values(groups);
  if (entries.length === 0) return null;

  // 全グループのデータをフラット配列にマージ
  const allP = [];
  const allN = [];
  const allU = [];
  const allC = [];
  const allI = [];
  const materialKeys = [];
  const geoGroups = [];
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const g of entries) {
    const matKey = `${g.blockType}_${g.face}`;
    let matIndex = materialKeys.indexOf(matKey);
    if (matIndex === -1) {
      materialKeys.push(matKey);
      matIndex = materialKeys.length - 1;
    }

    for (const v of g.p) allP.push(v);
    for (const v of g.n) allN.push(v);
    for (const v of g.u) allU.push(v);
    for (const v of g.c) allC.push(v);
    for (const idx of g.i) allI.push(idx + vertexOffset);

    geoGroups.push({ start: indexOffset, count: g.i.length, materialIndex: matIndex });

    vertexOffset += g.p.length / 3;
    indexOffset  += g.i.length;
  }

  return {
    positions:   new Float32Array(allP),
    normals:     new Float32Array(allN),
    uvs:         new Float32Array(allU),
    colors:      new Float32Array(allC),
    indices:     new Uint32Array(allI),
    groups:      geoGroups,
    materialKeys,
  };
}

// メインスレッドからのメッセージを処理してジオメトリを返す
self.onmessage = ({ data }) => {
  const { cx, cz, maxY } = data;
  CX = cx;
  CZ = cz;
  selfBlocks  = data.selfBlocks;
  rightBlocks = data.rightBlocks;
  leftBlocks  = data.leftBlocks;
  frontBlocks = data.frontBlocks;
  backBlocks  = data.backBlocks;

  const geoData = buildMesh(cx, cz, maxY);

  if (!geoData) {
    self.postMessage({ cx, cz, geoData: null });
    return;
  }

  // バッファをトランスファラブルとして転送（ゼロコピー）
  const transferables = [
    geoData.positions.buffer,
    geoData.normals.buffer,
    geoData.uvs.buffer,
    geoData.colors.buffer,
    geoData.indices.buffer,
  ];
  self.postMessage({ cx, cz, geoData }, transferables);
};
