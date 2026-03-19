// Game constants and utility functions
import * as THREE from 'three';
import { BlockType } from './blocks.js';

export const GAME_VERSION = '1.6.1';
export const SETTINGS_STORAGE_KEY = 'aicraft_settings_v1';
export const SAVE_STORAGE_KEY = 'aicraft_save_slot_1';
export const SAVE_SCHEMA_VERSION = 1;
export const AUTO_SAVE_INTERVAL_MS = 30 * 1000;

export const FALL_DAMAGE_SAFE_SPEED = 12;
export const FALL_DAMAGE_HEAVY_SPEED = 16;
export const FALL_DAMAGE_LIGHT_SCALE = 1.2;
export const FALL_DAMAGE_HEAVY_SCALE = 1.9;
export const DAY_NIGHT_CYCLE_SECONDS = 240;
export const CHEST_STORAGE_LIMIT = 90;
export const PLACE_COOLDOWN = 150;

export const DAY_SKY_COLOR = new THREE.Color(0x87CEEB);
export const NIGHT_SKY_COLOR = new THREE.Color(0x071020);
export const DAY_FOG_COLOR = new THREE.Color(0x87CEEB);
export const NIGHT_FOG_COLOR = new THREE.Color(0x12182F);
export const DAY_AMBIENT_COLOR = new THREE.Color(0xffffff);
export const NIGHT_AMBIENT_COLOR = new THREE.Color(0x7d88b0);
export const DAY_SUN_COLOR = new THREE.Color(0xfff5db);
export const NIGHT_MOON_COLOR = new THREE.Color(0x8ea0d0);

export const DEFAULT_SETTINGS = {
  sensitivity: 0.002,
  bgmVolume: 0.35,
  seVolume: 0.55,
  renderDistance: 5,
};

export const HOTBAR_BLOCKS = [
  BlockType.GRASS,
  BlockType.DIRT,
  BlockType.STONE,
  BlockType.WOOD,
  BlockType.LEAVES,
  BlockType.SAND,
  BlockType.WATER,
  BlockType.PLANK,
  BlockType.GLASS,
  BlockType.CRAFTING_TABLE,
  BlockType.CHEST,
];

export const STARTER_INVENTORY = {
  [BlockType.GRASS]: 16,
  [BlockType.DIRT]: 16,
  [BlockType.STONE]: 12,
  [BlockType.WOOD]: 12,
  [BlockType.LEAVES]: 8,
  [BlockType.SAND]: 12,
  [BlockType.WATER]: 6,
  [BlockType.PLANK]: 0,
  [BlockType.GLASS]: 0,
  [BlockType.CRAFTING_TABLE]: 0,
  [BlockType.CHEST]: 0,
};

export const CRAFT_RECIPES = [
  {
    id: 'plank_from_wood',
    label: '木材 x1 -> 板材 x4',
    consumes: { [BlockType.WOOD]: 1 },
    produces: { [BlockType.PLANK]: 4 },
  },
  {
    id: 'glass_from_sand',
    label: '砂 x2 -> ガラス x1',
    consumes: { [BlockType.SAND]: 2 },
    produces: { [BlockType.GLASS]: 1 },
  },
  {
    id: 'crafting_table_from_plank',
    label: '板材 x4 -> 作業台 x1',
    consumes: { [BlockType.PLANK]: 4 },
    produces: { [BlockType.CRAFTING_TABLE]: 1 },
  },
  {
    id: 'chest_from_plank',
    label: '板材 x8 -> チェスト x1',
    consumes: { [BlockType.PLANK]: 8 },
    produces: { [BlockType.CHEST]: 1 },
  },
];

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function calculateFallDamage(landingSpeed) {
  const speed = Math.abs(Number(landingSpeed) || 0);
  if (speed <= FALL_DAMAGE_SAFE_SPEED) return 0;

  const lightImpact = Math.min(speed, FALL_DAMAGE_HEAVY_SPEED) - FALL_DAMAGE_SAFE_SPEED;
  const heavyImpact = Math.max(0, speed - FALL_DAMAGE_HEAVY_SPEED);
  const damage = (lightImpact * FALL_DAMAGE_LIGHT_SCALE) + (heavyImpact * FALL_DAMAGE_HEAVY_SCALE);
  return Math.max(1, Math.ceil(damage));
}

export function sanitizeSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  return {
    sensitivity: clamp(Number(raw.sensitivity) || DEFAULT_SETTINGS.sensitivity, 0.0005, 0.004),
    bgmVolume: clamp(Number(raw.bgmVolume) || 0, 0, 1),
    seVolume: clamp(Number(raw.seVolume) || 0, 0, 1),
    renderDistance: clamp(Math.floor(Number(raw.renderDistance) || DEFAULT_SETTINGS.renderDistance), 2, 8),
  };
}

export function getPosKey(x, y, z) {
  return `${x},${y},${z}`;
}

export function parsePosKey(key) {
  const [x, y, z] = key.split(',').map(Number);
  return { x, y, z };
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
