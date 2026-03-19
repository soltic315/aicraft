// Main game entry point
import * as THREE from 'three';
import {
  BlockType,
  BLOCK_NAMES,
  BLOCK_BREAK_DURATIONS,
  generateTextures,
  generateBlockIcon,
  generateBreakOverlayTextures,
} from './blocks.js';
import { World } from './world.js';
import { Player } from './player.js';

const GAME_VERSION = '1.6.0';
const SETTINGS_STORAGE_KEY = 'aicraft_settings_v1';
const FALL_DAMAGE_SAFE_SPEED = 12;
const FALL_DAMAGE_HEAVY_SPEED = 16;
const FALL_DAMAGE_LIGHT_SCALE = 1.2;
const FALL_DAMAGE_HEAVY_SCALE = 1.9;
const DAY_NIGHT_CYCLE_SECONDS = 240;

const DAY_SKY_COLOR = new THREE.Color(0x87CEEB);
const NIGHT_SKY_COLOR = new THREE.Color(0x071020);
const DAY_FOG_COLOR = new THREE.Color(0x87CEEB);
const NIGHT_FOG_COLOR = new THREE.Color(0x12182F);
const DAY_AMBIENT_COLOR = new THREE.Color(0xffffff);
const NIGHT_AMBIENT_COLOR = new THREE.Color(0x7d88b0);
const DAY_SUN_COLOR = new THREE.Color(0xfff5db);
const NIGHT_MOON_COLOR = new THREE.Color(0x8ea0d0);
const CHEST_STORAGE_LIMIT = 90;

const DEFAULT_SETTINGS = {
  sensitivity: 0.002,
  bgmVolume: 0.35,
  seVolume: 0.55,
  renderDistance: 5,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function calculateFallDamage(landingSpeed) {
  const speed = Math.abs(Number(landingSpeed) || 0);
  if (speed <= FALL_DAMAGE_SAFE_SPEED) return 0;

  const lightImpact = Math.min(speed, FALL_DAMAGE_HEAVY_SPEED) - FALL_DAMAGE_SAFE_SPEED;
  const heavyImpact = Math.max(0, speed - FALL_DAMAGE_HEAVY_SPEED);
  const damage = (lightImpact * FALL_DAMAGE_LIGHT_SCALE) + (heavyImpact * FALL_DAMAGE_HEAVY_SCALE);
  return Math.max(1, Math.ceil(damage));
}

function sanitizeSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  return {
    sensitivity: clamp(Number(raw.sensitivity) || DEFAULT_SETTINGS.sensitivity, 0.0005, 0.004),
    bgmVolume: clamp(Number(raw.bgmVolume) || 0, 0, 1),
    seVolume: clamp(Number(raw.seVolume) || 0, 0, 1),
    renderDistance: clamp(Math.floor(Number(raw.renderDistance) || DEFAULT_SETTINGS.renderDistance), 2, 8),
  };
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    return sanitizeSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

const settings = loadSettings();

// ---- Sound Effects ----
class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.seGain = null;
    this.bgmGain = null;
    this.bgmNodes = [];
    this.bgmStarted = false;
    this.seVolume = DEFAULT_SETTINGS.seVolume;
    this.bgmVolume = DEFAULT_SETTINGS.bgmVolume;
  }

  async ensureStarted() {
    if (!window.AudioContext && !window.webkitAudioContext) return;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.45;

      this.seGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.seGain.connect(this.masterGain);
      this.bgmGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.setSEVolume(this.seVolume);
      this.setBGMVolume(this.bgmVolume);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.startBGM();
  }

  _playSweep({ from, to, duration, type = 'square', volume = 0.2 }) {
    if (!this.ctx || !this.seGain || this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.seGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  startBGM() {
    if (!this.ctx || !this.bgmGain || this.bgmStarted) return;

    const now = this.ctx.currentTime;
    const padA = this.ctx.createOscillator();
    const padB = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();

    padA.type = 'sine';
    padB.type = 'triangle';
    padA.frequency.setValueAtTime(82.41, now);
    padB.frequency.setValueAtTime(123.47, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.Q.value = 0.7;

    padA.connect(filter);
    padB.connect(filter);
    filter.connect(this.bgmGain);

    padA.start(now);
    padB.start(now);

    this.bgmNodes = [padA, padB, filter];
    this.bgmStarted = true;
  }

  setSEVolume(volume) {
    this.seVolume = clamp(Number(volume) || 0, 0, 1);
    if (!this.seGain || !this.ctx) return;
    this.seGain.gain.setTargetAtTime(this.seVolume, this.ctx.currentTime, 0.02);
  }

  setBGMVolume(volume) {
    this.bgmVolume = clamp(Number(volume) || 0, 0, 1);
    if (!this.bgmGain || !this.ctx) return;
    this.bgmGain.gain.setTargetAtTime(this.bgmVolume * 0.2, this.ctx.currentTime, 0.04);
  }

  playBreak() {
    this._playSweep({ from: 170, to: 75, duration: 0.08, type: 'square', volume: 0.12 });
    this._playSweep({ from: 130, to: 55, duration: 0.1, type: 'triangle', volume: 0.06 });
  }

  playPlace() {
    this._playSweep({ from: 200, to: 250, duration: 0.06, type: 'square', volume: 0.1 });
  }

  playJump() {
    this._playSweep({ from: 220, to: 360, duration: 0.09, type: 'square', volume: 0.12 });
  }

  playLand(intensity = 1) {
    const clamped = Math.min(Math.max(intensity, 0.5), 2);
    this._playSweep({
      from: 140,
      to: 85,
      duration: 0.07,
      type: 'triangle',
      volume: 0.08 * clamped,
    });
  }

  playError() {
    this._playSweep({ from: 180, to: 120, duration: 0.06, type: 'sawtooth', volume: 0.09 });
  }
}

const sound = new SoundManager();

// ---- Setup Scene ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x87CEEB);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 60, 120);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

// ---- Lighting ----
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(50, 100, 30);
scene.add(dirLight);

const tempSkyColor = new THREE.Color();
const tempFogColor = new THREE.Color();
const tempAmbientColor = new THREE.Color();
const tempSunColor = new THREE.Color();

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function updateDayNightCycle(elapsedSeconds) {
  const cycleRatio = (elapsedSeconds % DAY_NIGHT_CYCLE_SECONDS) / DAY_NIGHT_CYCLE_SECONDS;
  const sunAngle = cycleRatio * Math.PI * 2;
  const sunHeight = Math.sin(sunAngle);
  const daylight = smoothstep(-0.22, 0.28, sunHeight);

  tempSkyColor.copy(NIGHT_SKY_COLOR).lerp(DAY_SKY_COLOR, daylight);
  tempFogColor.copy(NIGHT_FOG_COLOR).lerp(DAY_FOG_COLOR, daylight);
  tempAmbientColor.copy(NIGHT_AMBIENT_COLOR).lerp(DAY_AMBIENT_COLOR, daylight);
  tempSunColor.copy(NIGHT_MOON_COLOR).lerp(DAY_SUN_COLOR, daylight);

  renderer.setClearColor(tempSkyColor);
  scene.fog.color.copy(tempFogColor);
  scene.fog.near = 35 + (daylight * 25);
  scene.fog.far = 85 + (daylight * 40);

  ambientLight.color.copy(tempAmbientColor);
  ambientLight.intensity = 0.2 + (daylight * 0.45);

  dirLight.color.copy(tempSunColor);
  dirLight.intensity = 0.1 + (daylight * 0.95);
  dirLight.position.set(
    Math.cos(sunAngle) * 90,
    18 + (sunHeight * 110),
    Math.sin(sunAngle) * 65,
  );

  return {
    cycleRatio,
    isDay: daylight >= 0.5,
  };
}

// ---- Generate block materials ----
const textures = generateTextures();
const blockMaterials = {};

for (const [typeStr, faceTextures] of Object.entries(textures)) {
  const type = Number(typeStr);
  blockMaterials[type] = {};
  for (const [face, canvas] of Object.entries(faceTextures)) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    const matOptions = {
      map: texture,
    };

    if (type === BlockType.WATER) {
      matOptions.transparent = true;
      matOptions.opacity = 0.6;
    }
    if (type === BlockType.GLASS) {
      matOptions.transparent = true;
      matOptions.opacity = 0.42;
    }
    if (type === BlockType.LEAVES) {
      matOptions.transparent = true;
      matOptions.opacity = 0.9;
    }

    blockMaterials[type][face] = new THREE.MeshLambertMaterial(matOptions);
  }
}

// ---- World & Player ----
const world = new World(scene, blockMaterials, { renderDistance: settings.renderDistance });
const player = new Player(camera, world, { mouseSensitivity: settings.sensitivity });
const craftPanel = document.getElementById('craft-panel');
const craftListEl = document.getElementById('craft-list');
const craftHintEl = document.getElementById('craft-hint');
const chestPanel = document.getElementById('chest-panel');
const chestStorageListEl = document.getElementById('chest-storage-list');
const chestPlayerListEl = document.getElementById('chest-player-list');
const chestHintEl = document.getElementById('chest-hint');

// ---- Block highlight wireframe ----
const highlightGeo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
const highlightMat = new THREE.MeshBasicMaterial({
  color: 0x000000,
  wireframe: true,
  transparent: true,
  opacity: 0.5,
});
const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
highlightMesh.visible = false;
scene.add(highlightMesh);

const breakOverlayGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
const breakOverlayTextures = generateBreakOverlayTextures();
const breakOverlayMaterials = Array.from({ length: 6 }, () => {
  const texture = new THREE.CanvasTexture(breakOverlayTextures[0]);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
});
const breakOverlayMesh = new THREE.Mesh(breakOverlayGeo, breakOverlayMaterials);
breakOverlayMesh.visible = false;
breakOverlayMesh.renderOrder = 2;
scene.add(breakOverlayMesh);

// ---- Hotbar ----
const HOTBAR_BLOCKS = [
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
const STARTER_INVENTORY = {
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
const CRAFT_RECIPES = [
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
let selectedSlot = 0;
const chestStorage = new Map();
let openedChestKey = null;
const inventoryCounts = Object.fromEntries(
  HOTBAR_BLOCKS.map((type) => [type, STARTER_INVENTORY[type] ?? 0])
);

function getPosKey(x, y, z) {
  return `${x},${y},${z}`;
}

function parsePosKey(key) {
  const [x, y, z] = key.split(',').map(Number);
  return { x, y, z };
}

function getChestDataAt(pos, createIfMissing = false) {
  const key = getPosKey(pos.x, pos.y, pos.z);
  let data = chestStorage.get(key);
  if (!data && createIfMissing) {
    data = Object.fromEntries(HOTBAR_BLOCKS.map((type) => [type, 0]));
    chestStorage.set(key, data);
  }
  return data;
}

function getChestTotalItems(chestData) {
  if (!chestData) return 0;
  return Object.values(chestData).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function closeChestPanel(message = null, playError = false) {
  openedChestKey = null;
  if (chestPanel) {
    chestPanel.style.display = 'none';
  }
  if (message) {
    showActionFeedback(message);
    if (playError) sound.playError();
  }
}

function openChestAt(pos) {
  if (world.getBlock(pos.x, pos.y, pos.z) !== BlockType.CHEST) {
    closeChestPanel('チェストが見つかりません', true);
    return false;
  }

  openedChestKey = getPosKey(pos.x, pos.y, pos.z);
  getChestDataAt(pos, true);
  renderChestPanel();
  showActionFeedback('チェストを開きました', 800);
  sound.playPlace();

  if (document.pointerLockElement === document.body) {
    document.exitPointerLock();
  }

  return true;
}

function getTargetChestHit() {
  const hit = world.raycast(player.getEyePosition(), player.getDirection());
  if (!hit || hit.blockType !== BlockType.CHEST) return null;
  return hit;
}

function getInventoryCount(type) {
  return inventoryCounts[type] ?? 0;
}

function addToInventory(type, amount = 1) {
  if (!Object.hasOwn(inventoryCounts, type)) return;
  inventoryCounts[type] += amount;
}

function consumeFromInventory(type, amount = 1) {
  if (!Object.hasOwn(inventoryCounts, type)) return false;
  if (inventoryCounts[type] < amount) return false;
  inventoryCounts[type] -= amount;
  return true;
}

function hasRecipeIngredients(recipe) {
  return Object.entries(recipe.consumes).every(([type, amount]) => {
    const blockType = Number(type);
    return getInventoryCount(blockType) >= amount;
  });
}

function craftRecipe(recipe) {
  if (!hasRecipeIngredients(recipe)) {
    showActionFeedback('クラフト失敗: 素材が不足しています');
    sound.playError();
    return false;
  }

  for (const [type, amount] of Object.entries(recipe.consumes)) {
    consumeFromInventory(Number(type), amount);
  }
  for (const [type, amount] of Object.entries(recipe.produces)) {
    addToInventory(Number(type), amount);
  }

  buildHotbar();
  renderCraftPanel();
  sound.playPlace();
  showActionFeedback(`クラフト成功: ${recipe.label}`, 900);
  return true;
}

function getSlotLabel(index) {
  if (index === 9) return '0';
  return String(index + 1);
}

function buildHotbar() {
  const hud = document.getElementById('hud');
  hud.innerHTML = '';
  HOTBAR_BLOCKS.forEach((type, i) => {
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot' + (i === selectedSlot ? ' active' : '');
    const num = document.createElement('span');
    num.className = 'slot-num';
    num.textContent = getSlotLabel(i);
    slot.appendChild(num);
    const icon = generateBlockIcon(type);
    if (icon) slot.appendChild(icon);

    const count = document.createElement('span');
    count.className = 'slot-count';
    count.textContent = getInventoryCount(type);
    slot.appendChild(count);

    hud.appendChild(slot);
  });

  renderCraftPanel();
  renderChestPanel();
}
buildHotbar();

// Slot selection
document.addEventListener('keydown', (e) => {
  if (e.key === '0' && HOTBAR_BLOCKS.length >= 10) {
    selectedSlot = 9;
    buildHotbar();
    return;
  }

  const num = Number.parseInt(e.key, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= Math.min(HOTBAR_BLOCKS.length, 9)) {
    selectedSlot = num - 1;
    buildHotbar();
  }
});
document.addEventListener('wheel', (e) => {
  if (!player.locked) return;
  if (e.deltaY > 0) {
    selectedSlot = (selectedSlot + 1) % HOTBAR_BLOCKS.length;
  } else {
    selectedSlot = (selectedSlot - 1 + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
  }
  buildHotbar();
});

// ---- Block Interaction ----
let lastPlaceTime = 0;
let isBreakingInputActive = false;
const PLACE_COOLDOWN = 150;
const breakState = {
  key: null,
  duration: 0,
  startedAt: 0,
  blockType: BlockType.AIR,
};
const actionFeedbackEl = document.getElementById('action-feedback');
const breakProgressEl = document.getElementById('break-progress');
const breakProgressFillEl = document.getElementById('break-progress-fill');
let feedbackTimeout = null;

function getBlockKey(blockPos) {
  return getPosKey(blockPos.x, blockPos.y, blockPos.z);
}

function resetBreaking() {
  breakState.key = null;
  breakState.duration = 0;
  breakState.startedAt = 0;
  breakState.blockType = BlockType.AIR;
  breakOverlayMesh.visible = false;
  if (breakProgressEl && breakProgressFillEl) {
    breakProgressEl.style.display = 'none';
    breakProgressFillEl.style.width = '0%';
  }
}

function setBreakOverlayStage(stageIndex) {
  const textureSource = breakOverlayTextures[stageIndex];
  if (!textureSource) return;

  for (const material of breakOverlayMaterials) {
    material.map.image = textureSource;
    material.map.needsUpdate = true;
  }
}

function showActionFeedback(message, durationMs = 1200) {
  if (!actionFeedbackEl) return;
  actionFeedbackEl.textContent = message;
  actionFeedbackEl.style.opacity = '1';

  if (feedbackTimeout) {
    clearTimeout(feedbackTimeout);
  }
  feedbackTimeout = setTimeout(() => {
    actionFeedbackEl.style.opacity = '0';
    feedbackTimeout = null;
  }, durationMs);
}

function transferToChest(type) {
  if (!openedChestKey) return false;

  const chestPos = parsePosKey(openedChestKey);
  if (world.getBlock(chestPos.x, chestPos.y, chestPos.z) !== BlockType.CHEST) {
    closeChestPanel('チェストが見つかりません', true);
    return false;
  }

  const chestData = getChestDataAt(chestPos, true);
  if (getChestTotalItems(chestData) >= CHEST_STORAGE_LIMIT) {
    showActionFeedback('収納失敗: チェストが満杯です');
    sound.playError();
    return false;
  }

  if (!consumeFromInventory(type, 1)) {
    showActionFeedback('収納失敗: 所持数が不足しています');
    sound.playError();
    return false;
  }

  chestData[type] = (chestData[type] ?? 0) + 1;
  buildHotbar();
  renderChestPanel();
  sound.playPlace();
  return true;
}

function transferFromChest(type) {
  if (!openedChestKey) return false;

  const chestPos = parsePosKey(openedChestKey);
  if (world.getBlock(chestPos.x, chestPos.y, chestPos.z) !== BlockType.CHEST) {
    closeChestPanel('チェストが見つかりません', true);
    return false;
  }

  const chestData = getChestDataAt(chestPos, false);
  if (!chestData || (chestData[type] ?? 0) <= 0) {
    showActionFeedback('取り出し失敗: チェスト内の在庫が不足しています');
    sound.playError();
    return false;
  }

  chestData[type] -= 1;
  addToInventory(type, 1);
  buildHotbar();
  renderChestPanel();
  sound.playPlace();
  return true;
}

function renderChestPanel() {
  if (!chestPanel || !chestStorageListEl || !chestPlayerListEl || !chestHintEl) return;
  if (!openedChestKey) {
    chestPanel.style.display = 'none';
    return;
  }

  const chestPos = parsePosKey(openedChestKey);
  if (world.getBlock(chestPos.x, chestPos.y, chestPos.z) !== BlockType.CHEST) {
    closeChestPanel('チェストが破壊されました');
    return;
  }

  chestPanel.style.display = 'block';
  const chestData = getChestDataAt(chestPos, true);
  const totalItems = getChestTotalItems(chestData);

  chestStorageListEl.innerHTML = '';
  chestPlayerListEl.innerHTML = '';

  HOTBAR_BLOCKS.forEach((type) => {
    const chestCount = chestData[type] ?? 0;
    const chestRow = document.createElement('div');
    chestRow.className = 'chest-row';
    const chestText = document.createElement('span');
    chestText.textContent = `${BLOCK_NAMES[type]} x${chestCount}`;
    const withdrawBtn = document.createElement('button');
    withdrawBtn.type = 'button';
    withdrawBtn.textContent = '取り出す';
    withdrawBtn.disabled = chestCount <= 0;
    withdrawBtn.addEventListener('click', () => {
      transferFromChest(type);
    });
    chestRow.appendChild(chestText);
    chestRow.appendChild(withdrawBtn);
    chestStorageListEl.appendChild(chestRow);

    const invCount = getInventoryCount(type);
    const invRow = document.createElement('div');
    invRow.className = 'chest-row';
    const invText = document.createElement('span');
    invText.textContent = `${BLOCK_NAMES[type]} x${invCount}`;
    const depositBtn = document.createElement('button');
    depositBtn.type = 'button';
    depositBtn.textContent = '収納する';
    depositBtn.disabled = invCount <= 0 || totalItems >= CHEST_STORAGE_LIMIT;
    depositBtn.addEventListener('click', () => {
      transferToChest(type);
    });
    invRow.appendChild(invText);
    invRow.appendChild(depositBtn);
    chestPlayerListEl.appendChild(invRow);
  });

  chestHintEl.textContent =
    `座標: (${chestPos.x}, ${chestPos.y}, ${chestPos.z}) / 合計: ${totalItems} / ${CHEST_STORAGE_LIMIT}`;
}

function recoverChestItems(blockPos) {
  const key = getBlockKey(blockPos);
  const chestData = chestStorage.get(key);
  if (!chestData) {
    if (openedChestKey === key) {
      closeChestPanel('チェストを閉じました');
    }
    return 0;
  }

  let recovered = 0;
  HOTBAR_BLOCKS.forEach((type) => {
    const count = Math.max(0, Math.floor(chestData[type] ?? 0));
    if (count <= 0) return;
    addToInventory(type, count);
    recovered += count;
  });

  chestStorage.delete(key);
  if (openedChestKey === key) {
    closeChestPanel('チェストを閉じました');
  }

  return recovered;
}

function tryPlaceBlock(now) {
  if (now - lastPlaceTime < PLACE_COOLDOWN) return;

  const hit = world.raycast(player.getEyePosition(), player.getDirection());
  if (!hit) {
    showActionFeedback('設置失敗: 射程外です');
    sound.playError();
    return;
  }

  const placeType = HOTBAR_BLOCKS[selectedSlot];
  if (getInventoryCount(placeType) <= 0) {
    showActionFeedback('設置失敗: 所持数が不足しています');
    sound.playError();
    return;
  }

  const pp = hit.placePos;
  if (player.intersectsBlock(pp.x, pp.y, pp.z)) {
    showActionFeedback('設置失敗: プレイヤーと衝突します');
    sound.playError();
    return;
  }

  lastPlaceTime = now;

  if (!consumeFromInventory(placeType)) return;
  world.setBlock(pp.x, pp.y, pp.z, placeType);
  if (placeType === BlockType.CHEST) {
    getChestDataAt(pp, true);
  }
  buildHotbar();
  sound.playPlace();
}

function updateBreaking(hit, now) {
  const key = getBlockKey(hit.blockPos);
  const duration = BLOCK_BREAK_DURATIONS[hit.blockType] ?? 0.5;

  if (breakState.key !== key) {
    breakState.key = key;
    breakState.duration = duration;
    breakState.startedAt = now;
    breakState.blockType = hit.blockType;
  }

  const elapsed = (now - breakState.startedAt) / 1000;
  const progress = Math.min(elapsed / breakState.duration, 1);
  const stageIndex = Math.min(
    breakOverlayTextures.length - 1,
    Math.floor(progress * breakOverlayTextures.length)
  );

  breakOverlayMesh.visible = true;
  breakOverlayMesh.position.set(hit.blockPos.x + 0.5, hit.blockPos.y + 0.5, hit.blockPos.z + 0.5);
  setBreakOverlayStage(stageIndex);
  if (breakProgressEl && breakProgressFillEl) {
    breakProgressEl.style.display = 'block';
    breakProgressFillEl.style.width = `${Math.floor(progress * 100)}%`;
  }

  if (progress >= 1) {
    if (hit.blockType === BlockType.CHEST) {
      const recovered = recoverChestItems(hit.blockPos);
      if (recovered > 0) {
        showActionFeedback(`チェスト回収: 中身 ${recovered} 個を取得`, 1200);
      }
    }

    addToInventory(hit.blockType, 1);
    world.setBlock(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, BlockType.AIR);
    buildHotbar();
    sound.playBreak();
    resetBreaking();
  }
}

document.addEventListener('mousedown', (e) => {
  if (!player.locked) return;
  void sound.ensureStarted();
  if (e.button === 0) {
    isBreakingInputActive = true;
  } else if (e.button === 2) {
    tryPlaceBlock(performance.now());
  }
});

document.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;
  isBreakingInputActive = false;
  resetBreaking();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === document.body) return;
  isBreakingInputActive = false;
  resetBreaking();
});

window.addEventListener('blur', () => {
  isBreakingInputActive = false;
  resetBreaking();
});

// Disable context menu
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- Start Screen ----
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const settingsPanel = document.getElementById('settings-panel');
const settingSensitivity = document.getElementById('setting-sensitivity');
const settingSensitivityValue = document.getElementById('setting-sensitivity-value');
const settingBgm = document.getElementById('setting-bgm');
const settingBgmValue = document.getElementById('setting-bgm-value');
const settingSe = document.getElementById('setting-se');
const settingSeValue = document.getElementById('setting-se-value');
const settingRenderDistance = document.getElementById('setting-render-distance');
const settingRenderDistanceValue = document.getElementById('setting-render-distance-value');
const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');
const gameTitle = document.getElementById('game-title');
const resumeHint = document.getElementById('resume-hint');
const waterOverlay = document.getElementById('water-overlay');
const mobileWarning = document.getElementById('mobile-warning');
let gameStarted = false;

if (mobileWarning && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
  mobileWarning.style.display = 'block';
}

function renderCraftPanel() {
  if (!craftListEl) return;

  craftListEl.innerHTML = '';
  CRAFT_RECIPES.forEach((recipe) => {
    const row = document.createElement('div');
    row.className = 'craft-row';

    const text = document.createElement('span');
    text.textContent = recipe.label;

    const craftBtn = document.createElement('button');
    craftBtn.type = 'button';
    craftBtn.textContent = '作成';
    craftBtn.disabled = !hasRecipeIngredients(recipe);
    craftBtn.addEventListener('click', () => {
      craftRecipe(recipe);
    });

    row.appendChild(text);
    row.appendChild(craftBtn);
    craftListEl.appendChild(row);
  });

  if (craftHintEl) {
    const available = CRAFT_RECIPES.filter(hasRecipeIngredients).length;
    craftHintEl.textContent = available > 0
      ? `作成可能レシピ: ${available} 件`
      : '素材が足りるレシピのみクラフトできます。';
  }
}

renderCraftPanel();

function updateSettingsPanelValues() {
  if (
    !settingSensitivity ||
    !settingSensitivityValue ||
    !settingBgm ||
    !settingBgmValue ||
    !settingSe ||
    !settingSeValue ||
    !settingRenderDistance ||
    !settingRenderDistanceValue
  ) {
    return;
  }

  settingSensitivity.value = (settings.sensitivity * 1000).toFixed(1);
  settingSensitivityValue.textContent = Number(settingSensitivity.value).toFixed(1);

  settingBgm.value = String(Math.round(settings.bgmVolume * 100));
  settingBgmValue.textContent = settingBgm.value;

  settingSe.value = String(Math.round(settings.seVolume * 100));
  settingSeValue.textContent = settingSe.value;

  settingRenderDistance.value = String(settings.renderDistance);
  settingRenderDistanceValue.textContent = settingRenderDistance.value;
}

function applySettings(persist = true) {
  player.setMouseSensitivity(settings.sensitivity);
  world.setRenderDistance(settings.renderDistance);
  sound.setSEVolume(settings.seVolume);
  sound.setBGMVolume(settings.bgmVolume);

  if (persist) {
    saveSettings(settings);
  }
}

updateSettingsPanelValues();
applySettings(false);

if (settingSensitivity && settingSensitivityValue) {
  settingSensitivity.addEventListener('input', () => {
    settings.sensitivity = clamp(Number(settingSensitivity.value) / 1000, 0.0005, 0.004);
    settingSensitivityValue.textContent = Number(settingSensitivity.value).toFixed(1);
    applySettings();
  });
}

if (settingBgm && settingBgmValue) {
  settingBgm.addEventListener('input', () => {
    settings.bgmVolume = clamp(Number(settingBgm.value) / 100, 0, 1);
    settingBgmValue.textContent = settingBgm.value;
    applySettings();
  });
}

if (settingSe && settingSeValue) {
  settingSe.addEventListener('input', () => {
    settings.seVolume = clamp(Number(settingSe.value) / 100, 0, 1);
    settingSeValue.textContent = settingSe.value;
    applySettings();
  });
}

if (settingRenderDistance && settingRenderDistanceValue) {
  settingRenderDistance.addEventListener('input', () => {
    settings.renderDistance = clamp(Math.floor(Number(settingRenderDistance.value)), 2, 8);
    settingRenderDistanceValue.textContent = String(settings.renderDistance);
    applySettings();
  });
}

if (gameTitle) {
  gameTitle.textContent = `AiCraft v${GAME_VERSION}`;
}
document.title = `AiCraft v${GAME_VERSION}`;

document.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyP' || !settingsPanel) return;
  settingsPanel.style.display = settingsPanel.style.display === 'block' ? 'none' : 'block';
  if (settingsPanel.style.display === 'block' && document.pointerLockElement === document.body) {
    document.exitPointerLock();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyC' || !craftPanel) return;
  craftPanel.style.display = craftPanel.style.display === 'block' ? 'none' : 'block';
  if (craftPanel.style.display === 'block' && document.pointerLockElement === document.body) {
    document.exitPointerLock();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyE') return;

  if (openedChestKey) {
    closeChestPanel('チェストを閉じました', false);
    return;
  }

  const hit = getTargetChestHit();
  if (!hit) {
    showActionFeedback('視線先にチェストがありません');
    sound.playError();
    return;
  }

  openChestAt(hit.blockPos);
});

startBtn.addEventListener('click', () => {
  if (gameStarted) return;
  void sound.ensureStarted();
  startScreen.style.display = 'none';
  loadingScreen.style.display = 'flex';
  loadingText.textContent = 'ワールドを生成中...';

  // Let the loading UI paint before heavy chunk generation starts.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      world.update(player.position.x, player.position.z);
      player.spawn();
      gameStarted = true;
      loadingScreen.style.display = 'none';
      player.lock();
    });
  });
});

renderer.domElement.addEventListener('click', () => {
  void sound.ensureStarted();
  if (!gameStarted || player.locked) return;
  player.lock();
});

// ---- HUD Info ----
const infoEl = document.getElementById('info');
const healthFillEl = document.getElementById('health-fill');
const healthValueEl = document.getElementById('health-value');
let frameCount = 0;
let fpsTime = 0;
let fps = 0;
const cycleStartTime = performance.now();

function updateHealthHud() {
  if (!healthFillEl || !healthValueEl) return;
  const ratio = Math.max(0, Math.min(1, player.getHealthRatio()));
  healthFillEl.style.width = `${Math.round(ratio * 100)}%`;
  healthValueEl.textContent = `${Math.round(player.health)} / ${player.maxHealth}`;
}

updateHealthHud();

// ---- Resize ----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Game Loop ----
let lastTime = performance.now();
let wasOnGround = false;

function gameLoop(time) {
  requestAnimationFrame(gameLoop);

  const dt = (time - lastTime) / 1000;
  lastTime = time;

  // FPS counter
  frameCount++;
  fpsTime += dt;
  if (fpsTime >= 1) {
    fps = frameCount;
    frameCount = 0;
    fpsTime = 0;
  }

  if (player.locked) {
    const dayNight = updateDayNightCycle((time - cycleStartTime) / 1000);
    const jumpRequested = Boolean(player.keys['Space'] && player.onGround);
    const fallingSpeedBeforeUpdate = player.velocity.y;

    player.update(dt);

    if (jumpRequested && !player.onGround && player.velocity.y > 0) {
      sound.playJump();
    }

    if (!wasOnGround && player.onGround && fallingSpeedBeforeUpdate < -1.5) {
      sound.playLand(Math.min(Math.abs(fallingSpeedBeforeUpdate) / 8, 2));

      const damage = calculateFallDamage(fallingSpeedBeforeUpdate);
      if (damage > 0) {
        const actualDamage = player.applyDamage(damage);

        if (actualDamage > 0) {
          showActionFeedback(`落下ダメージ: -${actualDamage} HP`, 1000);
          sound.playError();
        }

        if (player.health <= 0) {
          showActionFeedback('力尽きました。スポーン地点に戻ります', 1500);
          player.spawn();
        }
      }
    }
    wasOnGround = player.onGround;

    world.update(player.position.x, player.position.z);

    if (openedChestKey) {
      renderChestPanel();
    }

    // Highlight target block
    const hit = world.raycast(player.getEyePosition(), player.getDirection());
    if (hit) {
      highlightMesh.visible = true;
      highlightMesh.position.set(hit.blockPos.x + 0.5, hit.blockPos.y + 0.5, hit.blockPos.z + 0.5);

      if (isBreakingInputActive) {
        updateBreaking(hit, time);
      } else {
        resetBreaking();
      }
    } else {
      highlightMesh.visible = false;
      resetBreaking();
    }

    // Update HUD
    const p = player.position;
    const blockName = BLOCK_NAMES[HOTBAR_BLOCKS[selectedSlot]] || '';
    const selectedCount = getInventoryCount(HOTBAR_BLOCKS[selectedSlot]);
    infoEl.innerHTML =
      `FPS: ${fps}<br>` +
      `時刻: ${dayNight.isDay ? '昼' : '夜'} (${Math.floor(dayNight.cycleRatio * 24).toString().padStart(2, '0')}:00)<br>` +
      `座標: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}<br>` +
      `体力: ${Math.round(player.health)} / ${player.maxHealth}<br>` +
      `選択: ${blockName} x${selectedCount}`;

    updateHealthHud();

    const eyePos = player.getEyePosition();
    const eyeBlock = world.getBlock(Math.floor(eyePos.x), Math.floor(eyePos.y), Math.floor(eyePos.z));
    waterOverlay.style.display = eyeBlock === BlockType.WATER ? 'block' : 'none';
  } else {
    updateDayNightCycle((time - cycleStartTime) / 1000);
    highlightMesh.visible = false;
    resetBreaking();
    waterOverlay.style.display = 'none';
    wasOnGround = player.onGround;
    updateHealthHud();
    if (openedChestKey) {
      renderChestPanel();
    }
  }

  resumeHint.style.display = gameStarted && !player.locked ? 'block' : 'none';

  renderer.render(scene, camera);
}

requestAnimationFrame(gameLoop);
