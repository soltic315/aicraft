// Main game entry point
import * as THREE from 'three';
import { BlockType, BLOCK_NAMES, generateTextures, generateBlockIcon } from './blocks.js';
import { World } from './world.js';
import { Player } from './player.js';

const GAME_VERSION = '1.0.4';

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
let lastClickTime = 0;
const CLICK_COOLDOWN = 150;

document.addEventListener('mousedown', (e) => {
  if (!player.locked) return;
  const now = performance.now();
  if (now - lastClickTime < CLICK_COOLDOWN) return;
  lastClickTime = now;

  const hit = world.raycast(player.getEyePosition(), player.getDirection());
  if (!hit) return;

  if (e.button === 0) {
    // Break block
    world.setBlock(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, BlockType.AIR);
  } else if (e.button === 2) {
    // Place block
    const placeType = HOTBAR_BLOCKS[selectedSlot];
    // Don't place inside player
    const pp = hit.placePos;
    if (player.intersectsBlock(pp.x, pp.y, pp.z)) return;

    world.setBlock(pp.x, pp.y, pp.z, placeType);
  }
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
    player.update(dt);
    world.update(player.position.x, player.position.z);

    // Highlight target block
    const hit = world.raycast(player.getEyePosition(), player.getDirection());
    if (hit) {
      highlightMesh.visible = true;
      highlightMesh.position.set(hit.blockPos.x + 0.5, hit.blockPos.y + 0.5, hit.blockPos.z + 0.5);
    } else {
      highlightMesh.visible = false;
    }

    // Update HUD
    const p = player.position;
    const blockName = BLOCK_NAMES[HOTBAR_BLOCKS[selectedSlot]] || '';
    infoEl.innerHTML =
      `FPS: ${fps}<br>` +
      `座標: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}<br>` +
      `選択: ${blockName}`;

    const eyePos = player.getEyePosition();
    const eyeBlock = world.getBlock(Math.floor(eyePos.x), Math.floor(eyePos.y), Math.floor(eyePos.z));
    waterOverlay.style.display = eyeBlock === BlockType.WATER ? 'block' : 'none';
  } else {
    highlightMesh.visible = false;
    waterOverlay.style.display = 'none';
  }

  resumeHint.style.display = gameStarted && !player.locked ? 'block' : 'none';

  renderer.render(scene, camera);
}

requestAnimationFrame(gameLoop);
