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

const GAME_VERSION = '1.1.1';

// ---- Sound Effects ----
class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
  }

  async ensureStarted() {
    if (!window.AudioContext && !window.webkitAudioContext) return;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.22;
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  _playSweep({ from, to, duration, type = 'square', volume = 0.2 }) {
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;

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
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
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
    if (type === BlockType.LEAVES) {
      matOptions.transparent = true;
      matOptions.opacity = 0.9;
    }

    blockMaterials[type][face] = new THREE.MeshLambertMaterial(matOptions);
  }
}

// ---- World & Player ----
const world = new World(scene, blockMaterials);
const player = new Player(camera, world);

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
];
let selectedSlot = 0;
const inventoryCounts = Object.fromEntries(HOTBAR_BLOCKS.map((type) => [type, 0]));

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

function buildHotbar() {
  const hud = document.getElementById('hud');
  hud.innerHTML = '';
  HOTBAR_BLOCKS.forEach((type, i) => {
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot' + (i === selectedSlot ? ' active' : '');
    const num = document.createElement('span');
    num.className = 'slot-num';
    num.textContent = i + 1;
    slot.appendChild(num);
    const icon = generateBlockIcon(type);
    if (icon) slot.appendChild(icon);

    const count = document.createElement('span');
    count.className = 'slot-count';
    count.textContent = getInventoryCount(type);
    slot.appendChild(count);

    hud.appendChild(slot);
  });
}
buildHotbar();

// Slot selection
document.addEventListener('keydown', (e) => {
  const num = parseInt(e.key);
  if (num >= 1 && num <= HOTBAR_BLOCKS.length) {
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

function getBlockKey(blockPos) {
  return `${blockPos.x},${blockPos.y},${blockPos.z}`;
}

function resetBreaking() {
  breakState.key = null;
  breakState.duration = 0;
  breakState.startedAt = 0;
  breakState.blockType = BlockType.AIR;
  breakOverlayMesh.visible = false;
}

function setBreakOverlayStage(stageIndex) {
  const textureSource = breakOverlayTextures[stageIndex];
  if (!textureSource) return;

  for (const material of breakOverlayMaterials) {
    material.map.image = textureSource;
    material.map.needsUpdate = true;
  }
}

function tryPlaceBlock(now) {
  if (now - lastPlaceTime < PLACE_COOLDOWN) return;

  const hit = world.raycast(player.getEyePosition(), player.getDirection());
  if (!hit) return;

  const placeType = HOTBAR_BLOCKS[selectedSlot];
  if (getInventoryCount(placeType) <= 0) return;

  const pp = hit.placePos;
  if (player.intersectsBlock(pp.x, pp.y, pp.z)) return;

  lastPlaceTime = now;

  if (!consumeFromInventory(placeType)) return;
  world.setBlock(pp.x, pp.y, pp.z, placeType);
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

  if (progress >= 1) {
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
const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');
const gameTitle = document.getElementById('game-title');
const resumeHint = document.getElementById('resume-hint');
const waterOverlay = document.getElementById('water-overlay');
let gameStarted = false;

if (gameTitle) {
  gameTitle.textContent = `AiCraft v${GAME_VERSION}`;
}
document.title = `AiCraft v${GAME_VERSION}`;

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
let frameCount = 0;
let fpsTime = 0;
let fps = 0;

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
    const jumpRequested = Boolean(player.keys['Space'] && player.onGround);
    const fallingSpeedBeforeUpdate = player.velocity.y;

    player.update(dt);

    if (jumpRequested && !player.onGround && player.velocity.y > 0) {
      sound.playJump();
    }

    if (!wasOnGround && player.onGround && fallingSpeedBeforeUpdate < -1.5) {
      sound.playLand(Math.min(Math.abs(fallingSpeedBeforeUpdate) / 8, 2));
    }
    wasOnGround = player.onGround;

    world.update(player.position.x, player.position.z);

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
      `座標: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}<br>` +
      `選択: ${blockName} x${selectedCount}`;

    const eyePos = player.getEyePosition();
    const eyeBlock = world.getBlock(Math.floor(eyePos.x), Math.floor(eyePos.y), Math.floor(eyePos.z));
    waterOverlay.style.display = eyeBlock === BlockType.WATER ? 'block' : 'none';
  } else {
    highlightMesh.visible = false;
    resetBreaking();
    waterOverlay.style.display = 'none';
    wasOnGround = player.onGround;
  }

  resumeHint.style.display = gameStarted && !player.locked ? 'block' : 'none';

  renderer.render(scene, camera);
}

requestAnimationFrame(gameLoop);
