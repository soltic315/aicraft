import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { usePlayerStore } from '../../stores/playerStore.js';
import { useGameStore } from '../../stores/gameStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';

const MAP_SIZE = 128;
const HALF = MAP_SIZE / 2;
const SAMPLE_RADIUS = 28;  // サンプリング半径（ブロック）
const SAMPLE_STEP  = 2;    // 2ブロックに1回サンプリング

// ブロックタイプ → ミニマップ色マッピング
const BLOCK_COLORS = {
  0:  null,          // AIR
  1:  '#5aad42',     // GRASS
  2:  '#8b5e3c',     // DIRT
  3:  '#888888',     // STONE
  4:  '#a0733a',     // WOOD
  5:  '#3d8a3d',     // LEAVES
  6:  '#e0d278',     // SAND
  7:  '#3355cc',     // WATER
  8:  '#c4a07a',     // PLANK
  9:  '#aad4ee',     // GLASS
  16: '#777777',     // COBBLESTONE
  17: '#a07060',     // IRON_ORE
  28: '#555555',     // COAL_ORE
  29: '#c8a850',     // GOLD_ORE
  30: '#55d8e8',     // DIAMOND_ORE
  34: '#ff4500',     // LAVA
  35: '#f0f0ff',     // SNOW
  36: '#4a8a30',     // CACTUS
  37: '#4aaa38',     // TALL_GRASS
  38: '#ff8888',     // FLOWER
  40: '#c8e8ff',     // ICE
  41: '#222222',     // BEDROCK
  50: '#6a4a1a',     // JUNGLE_WOOD
  51: '#1a6a1a',     // JUNGLE_LEAVES
  55: '#c8b878',     // SANDSTONE
  56: '#667766',     // MOSSY_COBBLESTONE
  57: '#c84020',     // ACACIA_WOOD
  58: '#a0bc60',     // ACACIA_LEAVES
  59: '#e87090',     // CHERRY_WOOD
  60: '#ffb8d0',     // CHERRY_LEAVES
  61: '#555588',     // DEEPSLATE
};

function getBlockColor(blockType, y) {
  const base = BLOCK_COLORS[blockType];
  if (!base) return null;
  // 高さによる明暗（深部は暗く、高所は明るい）
  const brightness = Math.max(0.45, Math.min(1.15, 0.55 + (y / 128) * 0.65));
  const r = Math.round(parseInt(base.slice(1, 3), 16) * brightness);
  const g = Math.round(parseInt(base.slice(3, 5), 16) * brightness);
  const b = Math.round(parseInt(base.slice(5, 7), 16) * brightness);
  return `rgb(${Math.min(255,r)},${Math.min(255,g)},${Math.min(255,b)})`;
}

// 地表ブロック検索（キャッシュ付き）
const surfaceCache = new Map();
const CACHE_EXPIRY = 5000; // 5秒でキャッシュ失効

function getSurfaceColor(world, wx, wz) {
  const key = `${wx},${wz}`;
  const cached = surfaceCache.get(key);
  if (cached && (Date.now() - cached.ts) < CACHE_EXPIRY) return cached.color;

  let color = '#1a2a1a';
  for (let y = 100; y >= 0; y--) {
    const block = world.getBlock(wx, y, wz);
    if (block && block !== 0) {
      color = getBlockColor(block, y) || '#4a4a4a';
      break;
    }
  }

  surfaceCache.set(key, { color, ts: Date.now() });
  return color;
}

export function MiniMap() {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const lastPosRef = useRef({ x: -9999, z: -9999 });
  const gameStarted = useGameStore(s => s.gameStarted);
  const isDead = useGameStore(s => s.isDead);
  const visible = useSettingsStore(s => s.showMinimap);

  useEffect(() => {
    if (!gameStarted || isDead) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function draw() {
      const gc = window.__aicraft?.gameController;
      const world = gc?.world;
      const pos = usePlayerStore.getState().position;
      const cam = gc?.camera;

      ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

      // 円形クリップ
      ctx.save();
      ctx.beginPath();
      ctx.arc(HALF, HALF, HALF - 2, 0, Math.PI * 2);
      ctx.clip();

      // 背景
      ctx.fillStyle = '#0d1a0d';
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

      const px = Math.floor(pos.x);
      const pz = Math.floor(pos.z);
      const scale = MAP_SIZE / (SAMPLE_RADIUS * 2);

      if (world) {
        for (let dz = -SAMPLE_RADIUS; dz < SAMPLE_RADIUS; dz += SAMPLE_STEP) {
          for (let dx = -SAMPLE_RADIUS; dx < SAMPLE_RADIUS; dx += SAMPLE_STEP) {
            const wx = px + dx;
            const wz = pz + dz;
            const color = getSurfaceColor(world, wx, wz);
            ctx.fillStyle = color;
            const sx = (dx + SAMPLE_RADIUS) * scale;
            const sy = (dz + SAMPLE_RADIUS) * scale;
            ctx.fillRect(sx, sy, scale * SAMPLE_STEP + 0.5, scale * SAMPLE_STEP + 0.5);
          }
        }
      } else {
        ctx.fillStyle = '#2a3a2a';
        ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
      }

      // 方向ライン
      if (cam) {
        const dir = { x: 0, y: 0, z: -1 };
        const q = cam.quaternion;
        // カメラのforward方向を計算
        const fx = 2 * (q.x * q.z + q.w * q.y);
        const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
        const angle = Math.atan2(fx, fz);

        ctx.strokeStyle = 'rgba(255,255,200,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(HALF, HALF);
        ctx.lineTo(HALF + Math.sin(angle) * (HALF - 4), HALF + Math.cos(angle) * (HALF - 4));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // モブドット
      const mobs = gc?.mobManager?.mobs;
      if (mobs) {
        for (const mob of mobs) {
          if (!mob.isAlive) continue;
          const mdx = mob.position.x - px;
          const mdz = mob.position.z - pz;
          if (Math.abs(mdx) > SAMPLE_RADIUS || Math.abs(mdz) > SAMPLE_RADIUS) continue;
          const sx = (mdx + SAMPLE_RADIUS) * scale;
          const sy = (mdz + SAMPLE_RADIUS) * scale;
          // 敵モブ（ゾンビ・スケルトン・クリーパー・スパイダー）は赤、友好モブは黄
          const hostile = mob.name === 'ゾンビ' || mob.name === 'スケルトン' || mob.name === 'クリーパー' || mob.name === 'スパイダー';
          ctx.fillStyle = hostile ? '#ff3333' : '#ffcc44';
          ctx.beginPath();
          ctx.arc(sx, sy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // プレイヤードット
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(HALF, HALF, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      // 枠線
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(HALF, HALF, HALF - 1.5, 0, Math.PI * 2);
      ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    }

    if (visible) {
      draw();
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [gameStarted, isDead, visible]);

  if (!gameStarted || isDead) return null;

  return (
    <div id="minimap-wrapper">
      <canvas
        ref={canvasRef}
        width={MAP_SIZE}
        height={MAP_SIZE}
        id="minimap-canvas"
        style={{ display: visible ? 'block' : 'none' }}
      />
    </div>
  );
}
