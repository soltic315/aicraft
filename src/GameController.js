// Game orchestration: scene, state, game loop, save/load
import * as THREE from 'three';
import {
  BlockType,
  BLOCK_NAMES,
  BLOCK_BREAK_DURATIONS,
  generateTextures,
  generateBreakOverlayTextures,
} from './blocks.js';
import { World } from './world.js';
import { Player } from './player.js';
import {
  SETTINGS_STORAGE_KEY,
  SAVE_STORAGE_KEY,
  SAVE_SCHEMA_VERSION,
  AUTO_SAVE_INTERVAL_MS,
  DAY_NIGHT_CYCLE_SECONDS,
  PLACE_COOLDOWN,
  HOTBAR_BLOCKS,
  STARTER_INVENTORY,
  CHEST_STORAGE_LIMIT,
  DAY_SKY_COLOR,
  NIGHT_SKY_COLOR,
  DAY_FOG_COLOR,
  NIGHT_FOG_COLOR,
  DAY_AMBIENT_COLOR,
  NIGHT_AMBIENT_COLOR,
  DAY_SUN_COLOR,
  NIGHT_MOON_COLOR,
  DEFAULT_SETTINGS,
  clamp,
  calculateFallDamage,
  sanitizeSettings,
  getPosKey,
  parsePosKey,
  smoothstep,
} from './config.js';

export class GameController {
  constructor(eventBus, sound, input, ui) {
    this.eventBus = eventBus;
    this.sound = sound;
    this.input = input;
    this.ui = ui;

    // Settings & save data
    this.settings = this._loadSettings();
    this.savedGame = this._loadSaveData();
    if (this.savedGame?.settings) {
      Object.assign(this.settings, sanitizeSettings(this.savedGame.settings));
    }
    this.worldSeed = Number.isFinite(this.savedGame?.worldSeed)
      ? this.savedGame.worldSeed
      : Math.floor(Math.random() * 100000);

    // Scene
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x87CEEB);
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87CEEB, 60, 120);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);
    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.dirLight.position.set(50, 100, 30);
    this.scene.add(this.dirLight);

    // Reusable temp colors for day/night interpolation
    this._tempSkyColor = new THREE.Color();
    this._tempFogColor = new THREE.Color();
    this._tempAmbientColor = new THREE.Color();
    this._tempSunColor = new THREE.Color();

    // Block materials
    const textures = generateTextures();
    this.blockMaterials = {};
    for (const [typeStr, faceTextures] of Object.entries(textures)) {
      const type = Number(typeStr);
      this.blockMaterials[type] = {};
      for (const [face, canvas] of Object.entries(faceTextures)) {
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;

        const matOptions = { map: texture };
        if (type === BlockType.WATER) { matOptions.transparent = true; matOptions.opacity = 0.6; }
        if (type === BlockType.GLASS) { matOptions.transparent = true; matOptions.opacity = 0.42; }
        if (type === BlockType.LEAVES) { matOptions.transparent = true; matOptions.opacity = 0.9; }

        this.blockMaterials[type][face] = new THREE.MeshLambertMaterial(matOptions);
      }
    }

    // World & Player
    this.world = new World(this.scene, this.blockMaterials, {
      renderDistance: this.settings.renderDistance,
      seed: this.worldSeed,
    });
    if (this.savedGame?.chunkDiffs) {
      this.world.applyChunkEdits(this.savedGame.chunkDiffs);
    }
    this.player = new Player(this.camera, this.world, { mouseSensitivity: this.settings.sensitivity });

    // Highlight wireframe
    const highlightGeo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    this.highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);

    // Break overlay
    const breakOverlayGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    this.breakOverlayTextures = generateBreakOverlayTextures();
    this.breakOverlayMaterials = Array.from({ length: 6 }, () => {
      const texture = new THREE.CanvasTexture(this.breakOverlayTextures[0]);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      return new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
    });
    this.breakOverlayMesh = new THREE.Mesh(breakOverlayGeo, this.breakOverlayMaterials);
    this.breakOverlayMesh.visible = false;
    this.breakOverlayMesh.renderOrder = 2;
    this.scene.add(this.breakOverlayMesh);

    // Inventory
    this.selectedSlot = Number.isFinite(this.savedGame?.player?.selectedSlot)
      ? this.savedGame.player.selectedSlot
      : 0;
    this.inventoryCounts = Object.fromEntries(
      HOTBAR_BLOCKS.map((type) => [type, STARTER_INVENTORY[type] ?? 0])
    );
    if (this.savedGame?.player?.inventory && typeof this.savedGame.player.inventory === 'object') {
      Object.entries(this.savedGame.player.inventory).forEach(([type, count]) => {
        const t = Number(type);
        if (!Number.isNaN(t) && Object.hasOwn(this.inventoryCounts, t)) {
          this.inventoryCounts[t] = Math.max(0, Math.floor(Number(count) || 0));
        }
      });
    }

    // Chest storage
    this.chestStorage = new Map();
    this.openedChestKey = null;
    if (this.savedGame?.chestStorage && typeof this.savedGame.chestStorage === 'object') {
      Object.entries(this.savedGame.chestStorage).forEach(([posKey, contents]) => {
        if (contents && typeof contents === 'object') {
          this.chestStorage.set(posKey, { ...contents });
        }
      });
    }

    // Break state
    this.breakState = {
      key: null,
      duration: 0,
      startedAt: 0,
      blockType: BlockType.AIR,
    };
    this.lastPlaceTime = 0;

    // Game loop state
    this.gameStarted = false;
    this.lastTime = performance.now();
    this.wasOnGround = false;
    this.cycleStartTime = performance.now();
    this.frameCount = 0;
    this.fpsTime = 0;
    this.fps = 0;
    this.autoSaveIntervalId = null;
  }

  init() {
    // Initialize UI
    this.ui.init(!!this.savedGame);
    this.ui.updateSettingsValues(this.settings);
    this.ui.setupSettingsListeners(this.settings, () => this._applySettings());

    // Apply initial settings
    this._applySettings(false);

    // Build initial UI
    this._refreshUI();
    this.ui.updateHealthHud(this.player.health, this.player.maxHealth);

    // Subscribe to events
    this._subscribeEvents();

    // Resize handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Auto-save before unload
    window.addEventListener('beforeunload', () => {
      this._saveGame({ showFeedback: false });
    });

    // Canvas click to re-lock
    this.renderer.domElement.addEventListener('click', () => {
      void this.sound.ensureStarted();
      if (!this.gameStarted || this.player.locked) return;
      this.player.lock();
    });

    // Start game loop
    requestAnimationFrame((t) => this._gameLoop(t));
  }

  // ---- Event Subscriptions ----

  _subscribeEvents() {
    this.eventBus.on('mousedown', (e) => {
      if (!this.player.locked) return;
      void this.sound.ensureStarted();
    });

    this.eventBus.on('place-requested', () => {
      if (!this.player.locked) return;
      void this.sound.ensureStarted();
      this._tryPlaceBlock(performance.now());
    });

    this.eventBus.on('break-cancelled', () => {
      this._resetBreaking();
    });

    this.eventBus.on('pointer-unlocked', () => {
      this._resetBreaking();
    });

    this.eventBus.on('slot-selected', (slot) => {
      this.selectedSlot = slot;
      this._refreshUI();
    });

    this.eventBus.on('slot-scroll', (deltaY) => {
      if (!this.player.locked) return;
      if (deltaY > 0) {
        this.selectedSlot = (this.selectedSlot + 1) % HOTBAR_BLOCKS.length;
      } else {
        this.selectedSlot = (this.selectedSlot - 1 + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
      }
      this._refreshUI();
    });

    this.eventBus.on('toggle-settings', () => {
      const opened = this.ui.togglePanel(this.ui.settingsPanel);
      if (opened && document.pointerLockElement === document.body) {
        document.exitPointerLock();
      }
    });

    this.eventBus.on('toggle-craft', () => {
      const opened = this.ui.togglePanel(this.ui.craftPanel);
      if (opened && document.pointerLockElement === document.body) {
        document.exitPointerLock();
      }
    });

    this.eventBus.on('interact-chest', () => {
      if (this.openedChestKey) {
        this._closeChestPanel('チェストを閉じました', false);
        return;
      }

      const hit = this._getTargetChestHit();
      if (!hit) {
        this.ui.showActionFeedback('視線先にチェストがありません');
        this.sound.playError();
        return;
      }

      this._openChestAt(hit.blockPos);
    });

    this.eventBus.on('start-clicked', () => {
      if (this.gameStarted) return;
      void this.sound.ensureStarted();
      this.ui.hideStartScreen();
      this.ui.showLoadingScreen('ワールドを生成中...');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.player.spawn();
          if (this.savedGame?.player?.position && typeof this.savedGame.player.position === 'object') {
            this.player.position.set(
              Number(this.savedGame.player.position.x) || this.player.position.x,
              Number(this.savedGame.player.position.y) || this.player.position.y,
              Number(this.savedGame.player.position.z) || this.player.position.z
            );
          }
          if (Number.isFinite(this.savedGame?.player?.yaw)) {
            this.player.yaw = this.savedGame.player.yaw;
          }
          if (Number.isFinite(this.savedGame?.player?.pitch)) {
            this.player.pitch = this.savedGame.player.pitch;
          }

          this.world.update(this.player.position.x, this.player.position.z);
          this.gameStarted = true;
          this._startAutoSave();
          this.ui.hideLoadingScreen();
          this.player.lock();
        });
      });
    });

    this.eventBus.on('save-clicked', () => {
      this._saveGame();
    });

    this.eventBus.on('delete-save-clicked', () => {
      localStorage.removeItem(SAVE_STORAGE_KEY);
      this.ui.showActionFeedback('セーブデータを削除しました', 1200);
    });
  }

  // ---- Settings ----

  _loadSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
      return sanitizeSettings(parsed);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  _applySettings(persist = true) {
    this.player.setMouseSensitivity(this.settings.sensitivity);
    this.world.setRenderDistance(this.settings.renderDistance);
    this.sound.setSEVolume(this.settings.seVolume);
    this.sound.setBGMVolume(this.settings.bgmVolume);

    if (persist) {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    }
  }

  // ---- Save / Load ----

  _loadSaveData() {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  _saveGame({ showFeedback = true } = {}) {
    try {
      const inventory = {};
      Object.entries(this.inventoryCounts).forEach(([key, value]) => {
        inventory[key] = Number(value) || 0;
      });

      const chestState = {};
      for (const [key, contents] of this.chestStorage.entries()) {
        chestState[key] = { ...contents };
      }

      const data = {
        schemaVersion: SAVE_SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        worldSeed: this.worldSeed,
        player: {
          position: {
            x: this.player.position.x,
            y: this.player.position.y,
            z: this.player.position.z,
          },
          yaw: this.player.yaw,
          pitch: this.player.pitch,
          inventory,
          selectedSlot: this.selectedSlot,
        },
        settings: { ...this.settings },
        chunkDiffs: this.world.exportChunkEdits(),
        chestStorage: chestState,
      };

      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
      if (showFeedback) this.ui.showActionFeedback('ゲームをセーブしました', 800);
    } catch (e) {
      console.warn('Failed to save game:', e);
      if (showFeedback) this.ui.showActionFeedback('セーブに失敗しました', 1000);
    }
  }

  _startAutoSave() {
    if (this.autoSaveIntervalId) return;
    this.autoSaveIntervalId = setInterval(() => {
      this._saveGame({ showFeedback: false });
    }, AUTO_SAVE_INTERVAL_MS);
  }

  // ---- Inventory ----

  getInventoryCount(type) {
    return this.inventoryCounts[type] ?? 0;
  }

  _addToInventory(type, amount = 1) {
    if (!Object.hasOwn(this.inventoryCounts, type)) return;
    this.inventoryCounts[type] += amount;
  }

  _consumeFromInventory(type, amount = 1) {
    if (!Object.hasOwn(this.inventoryCounts, type)) return false;
    if (this.inventoryCounts[type] < amount) return false;
    this.inventoryCounts[type] -= amount;
    return true;
  }

  _hasRecipeIngredients(recipe) {
    return Object.entries(recipe.consumes).every(([type, amount]) => {
      return this.getInventoryCount(Number(type)) >= amount;
    });
  }

  _craftRecipe(recipe) {
    if (!this._hasRecipeIngredients(recipe)) {
      this.ui.showActionFeedback('クラフト失敗: 素材が不足しています');
      this.sound.playError();
      return false;
    }

    for (const [type, amount] of Object.entries(recipe.consumes)) {
      this._consumeFromInventory(Number(type), amount);
    }
    for (const [type, amount] of Object.entries(recipe.produces)) {
      this._addToInventory(Number(type), amount);
    }

    this._refreshUI();
    this.sound.playPlace();
    this.ui.showActionFeedback(`クラフト成功: ${recipe.label}`, 900);
    return true;
  }

  // ---- Chest ----

  _getChestDataAt(pos, createIfMissing = false) {
    const key = getPosKey(pos.x, pos.y, pos.z);
    let data = this.chestStorage.get(key);
    if (!data && createIfMissing) {
      data = Object.fromEntries(HOTBAR_BLOCKS.map((type) => [type, 0]));
      this.chestStorage.set(key, data);
    }
    return data;
  }

  _closeChestPanel(message = null, playError = false) {
    this.openedChestKey = null;
    this.ui.hideChestPanel();
    if (message) {
      this.ui.showActionFeedback(message);
      if (playError) this.sound.playError();
    }
  }

  _openChestAt(pos) {
    if (this.world.getBlock(pos.x, pos.y, pos.z) !== BlockType.CHEST) {
      this._closeChestPanel('チェストが見つかりません', true);
      return false;
    }

    this.openedChestKey = getPosKey(pos.x, pos.y, pos.z);
    this._getChestDataAt(pos, true);
    this._renderChestPanel();
    this.ui.showActionFeedback('チェストを開きました', 800);
    this.sound.playPlace();

    if (document.pointerLockElement === document.body) {
      document.exitPointerLock();
    }

    return true;
  }

  _getTargetChestHit() {
    const hit = this.world.raycast(this.player.getEyePosition(), this.player.getDirection());
    if (!hit || hit.blockType !== BlockType.CHEST) return null;
    return hit;
  }

  _transferToChest(type) {
    if (!this.openedChestKey) return false;

    const chestPos = parsePosKey(this.openedChestKey);
    if (this.world.getBlock(chestPos.x, chestPos.y, chestPos.z) !== BlockType.CHEST) {
      this._closeChestPanel('チェストが見つかりません', true);
      return false;
    }

    const chestData = this._getChestDataAt(chestPos, true);
    const totalItems = Object.values(chestData).reduce((sum, v) => sum + (Number(v) || 0), 0);
    if (totalItems >= CHEST_STORAGE_LIMIT) {
      this.ui.showActionFeedback('収納失敗: チェストが満杯です');
      this.sound.playError();
      return false;
    }

    if (!this._consumeFromInventory(type, 1)) {
      this.ui.showActionFeedback('収納失敗: 所持数が不足しています');
      this.sound.playError();
      return false;
    }

    chestData[type] = (chestData[type] ?? 0) + 1;
    this._refreshUI();
    this._renderChestPanel();
    this.sound.playPlace();
    return true;
  }

  _transferFromChest(type) {
    if (!this.openedChestKey) return false;

    const chestPos = parsePosKey(this.openedChestKey);
    if (this.world.getBlock(chestPos.x, chestPos.y, chestPos.z) !== BlockType.CHEST) {
      this._closeChestPanel('チェストが見つかりません', true);
      return false;
    }

    const chestData = this._getChestDataAt(chestPos, false);
    if (!chestData || (chestData[type] ?? 0) <= 0) {
      this.ui.showActionFeedback('取り出し失敗: チェスト内の在庫が不足しています');
      this.sound.playError();
      return false;
    }

    chestData[type] -= 1;
    this._addToInventory(type, 1);
    this._refreshUI();
    this._renderChestPanel();
    this.sound.playPlace();
    return true;
  }

  _recoverChestItems(blockPos) {
    const key = getPosKey(blockPos.x, blockPos.y, blockPos.z);
    const chestData = this.chestStorage.get(key);
    if (!chestData) {
      if (this.openedChestKey === key) {
        this._closeChestPanel('チェストを閉じました');
      }
      return 0;
    }

    let recovered = 0;
    HOTBAR_BLOCKS.forEach((type) => {
      const count = Math.max(0, Math.floor(chestData[type] ?? 0));
      if (count <= 0) return;
      this._addToInventory(type, count);
      recovered += count;
    });

    this.chestStorage.delete(key);
    if (this.openedChestKey === key) {
      this._closeChestPanel('チェストを閉じました');
    }

    return recovered;
  }

  _renderChestPanel() {
    if (!this.openedChestKey) {
      this.ui.hideChestPanel();
      return;
    }

    const chestPos = parsePosKey(this.openedChestKey);
    if (this.world.getBlock(chestPos.x, chestPos.y, chestPos.z) !== BlockType.CHEST) {
      this._closeChestPanel('チェストが破壊されました');
      return;
    }

    const chestData = this._getChestDataAt(chestPos, true);
    this.ui.renderChestPanel(
      chestData,
      chestPos,
      (type) => this.getInventoryCount(type),
      (type) => this._transferFromChest(type),
      (type) => this._transferToChest(type),
    );
  }

  // ---- Block Interaction ----

  _resetBreaking() {
    this.breakState.key = null;
    this.breakState.duration = 0;
    this.breakState.startedAt = 0;
    this.breakState.blockType = BlockType.AIR;
    this.breakOverlayMesh.visible = false;
    this.ui.hideBreakProgress();
  }

  _setBreakOverlayStage(stageIndex) {
    const textureSource = this.breakOverlayTextures[stageIndex];
    if (!textureSource) return;

    for (const material of this.breakOverlayMaterials) {
      material.map.image = textureSource;
      material.map.needsUpdate = true;
    }
  }

  _tryPlaceBlock(now) {
    if (now - this.lastPlaceTime < PLACE_COOLDOWN) return;

    const hit = this.world.raycast(this.player.getEyePosition(), this.player.getDirection());
    if (!hit) {
      this.ui.showActionFeedback('設置失敗: 射程外です');
      this.sound.playError();
      return;
    }

    const placeType = HOTBAR_BLOCKS[this.selectedSlot];
    if (this.getInventoryCount(placeType) <= 0) {
      this.ui.showActionFeedback('設置失敗: 所持数が不足しています');
      this.sound.playError();
      return;
    }

    const pp = hit.placePos;
    if (this.player.intersectsBlock(pp.x, pp.y, pp.z)) {
      this.ui.showActionFeedback('設置失敗: プレイヤーと衝突します');
      this.sound.playError();
      return;
    }

    this.lastPlaceTime = now;

    if (!this._consumeFromInventory(placeType)) return;
    this.world.setBlockWithDiff(pp.x, pp.y, pp.z, placeType);
    if (placeType === BlockType.CHEST) {
      this._getChestDataAt(pp, true);
    }
    this._refreshUI();
    this.sound.playPlace();
  }

  _updateBreaking(hit, now) {
    const key = getPosKey(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z);
    const duration = BLOCK_BREAK_DURATIONS[hit.blockType] ?? 0.5;

    if (this.breakState.key !== key) {
      this.breakState.key = key;
      this.breakState.duration = duration;
      this.breakState.startedAt = now;
      this.breakState.blockType = hit.blockType;
    }

    const elapsed = (now - this.breakState.startedAt) / 1000;
    const progress = Math.min(elapsed / this.breakState.duration, 1);
    const stageIndex = Math.min(
      this.breakOverlayTextures.length - 1,
      Math.floor(progress * this.breakOverlayTextures.length)
    );

    this.breakOverlayMesh.visible = true;
    this.breakOverlayMesh.position.set(
      hit.blockPos.x + 0.5,
      hit.blockPos.y + 0.5,
      hit.blockPos.z + 0.5
    );
    this._setBreakOverlayStage(stageIndex);
    this.ui.showBreakProgress(progress);

    if (progress >= 1) {
      if (hit.blockType === BlockType.CHEST) {
        const recovered = this._recoverChestItems(hit.blockPos);
        if (recovered > 0) {
          this.ui.showActionFeedback(`チェスト回収: 中身 ${recovered} 個を取得`, 1200);
        }
      }

      this._addToInventory(hit.blockType, 1);
      this.world.setBlockWithDiff(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, BlockType.AIR);
      this._refreshUI();
      this.sound.playBreak();
      this._resetBreaking();
    }
  }

  // ---- Day/Night ----

  _updateDayNightCycle(elapsedSeconds) {
    const cycleRatio = (elapsedSeconds % DAY_NIGHT_CYCLE_SECONDS) / DAY_NIGHT_CYCLE_SECONDS;
    const sunAngle = cycleRatio * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const daylight = smoothstep(-0.22, 0.28, sunHeight);

    this._tempSkyColor.copy(NIGHT_SKY_COLOR).lerp(DAY_SKY_COLOR, daylight);
    this._tempFogColor.copy(NIGHT_FOG_COLOR).lerp(DAY_FOG_COLOR, daylight);
    this._tempAmbientColor.copy(NIGHT_AMBIENT_COLOR).lerp(DAY_AMBIENT_COLOR, daylight);
    this._tempSunColor.copy(NIGHT_MOON_COLOR).lerp(DAY_SUN_COLOR, daylight);

    this.renderer.setClearColor(this._tempSkyColor);
    this.scene.fog.color.copy(this._tempFogColor);
    this.scene.fog.near = 35 + (daylight * 25);
    this.scene.fog.far = 85 + (daylight * 40);

    this.ambientLight.color.copy(this._tempAmbientColor);
    this.ambientLight.intensity = 0.2 + (daylight * 0.45);

    this.dirLight.color.copy(this._tempSunColor);
    this.dirLight.intensity = 0.1 + (daylight * 0.95);
    this.dirLight.position.set(
      Math.cos(sunAngle) * 90,
      18 + (sunHeight * 110),
      Math.sin(sunAngle) * 65,
    );

    return { cycleRatio, isDay: daylight >= 0.5 };
  }

  // ---- UI Refresh ----

  _refreshUI() {
    this.ui.buildHotbar(this.selectedSlot, (type) => this.getInventoryCount(type));
    this.ui.renderCraftPanel(
      (recipe) => this._hasRecipeIngredients(recipe),
      (recipe) => this._craftRecipe(recipe),
    );
    this._renderChestPanel();
  }

  // ---- Game Loop ----

  _gameLoop(time) {
    requestAnimationFrame((t) => this._gameLoop(t));

    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // FPS counter
    this.frameCount++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTime = 0;
    }

    if (this.player.locked) {
      const dayNight = this._updateDayNightCycle((time - this.cycleStartTime) / 1000);
      const jumpRequested = Boolean(this.player.keys['Space'] && this.player.onGround);
      const fallingSpeedBeforeUpdate = this.player.velocity.y;

      this.player.update(dt);

      if (jumpRequested && !this.player.onGround && this.player.velocity.y > 0) {
        this.sound.playJump();
      }

      if (!this.wasOnGround && this.player.onGround && fallingSpeedBeforeUpdate < -1.5) {
        this.sound.playLand(Math.min(Math.abs(fallingSpeedBeforeUpdate) / 8, 2));

        const damage = calculateFallDamage(fallingSpeedBeforeUpdate);
        if (damage > 0) {
          const actualDamage = this.player.applyDamage(damage);

          if (actualDamage > 0) {
            this.ui.showActionFeedback(`落下ダメージ: -${actualDamage} HP`, 1000);
            this.sound.playError();
          }

          if (this.player.health <= 0) {
            this.ui.showActionFeedback('力尽きました。スポーン地点に戻ります', 1500);
            this.player.spawn();
          }
        }
      }
      this.wasOnGround = this.player.onGround;

      this.world.update(this.player.position.x, this.player.position.z);

      if (this.openedChestKey) {
        this._renderChestPanel();
      }

      // Highlight target block
      const hit = this.world.raycast(this.player.getEyePosition(), this.player.getDirection());
      if (hit) {
        this.highlightMesh.visible = true;
        this.highlightMesh.position.set(
          hit.blockPos.x + 0.5,
          hit.blockPos.y + 0.5,
          hit.blockPos.z + 0.5
        );

        if (this.input.isBreaking) {
          this._updateBreaking(hit, time);
        } else {
          this._resetBreaking();
        }
      } else {
        this.highlightMesh.visible = false;
        this._resetBreaking();
      }

      // Update HUD
      const blockName = BLOCK_NAMES[HOTBAR_BLOCKS[this.selectedSlot]] || '';
      const selectedCount = this.getInventoryCount(HOTBAR_BLOCKS[this.selectedSlot]);
      this.ui.updateInfo(
        this.fps,
        dayNight,
        this.player.position,
        this.player.health,
        this.player.maxHealth,
        blockName,
        selectedCount,
      );
      this.ui.updateHealthHud(this.player.health, this.player.maxHealth);

      const eyePos = this.player.getEyePosition();
      const eyeBlock = this.world.getBlock(
        Math.floor(eyePos.x),
        Math.floor(eyePos.y),
        Math.floor(eyePos.z)
      );
      this.ui.setWaterOverlay(eyeBlock === BlockType.WATER);
    } else {
      this._updateDayNightCycle((time - this.cycleStartTime) / 1000);
      this.highlightMesh.visible = false;
      this._resetBreaking();
      this.ui.setWaterOverlay(false);
      this.wasOnGround = this.player.onGround;
      this.ui.updateHealthHud(this.player.health, this.player.maxHealth);
      if (this.openedChestKey) {
        this._renderChestPanel();
      }
    }

    this.ui.setResumeHint(this.gameStarted && !this.player.locked);

    this.renderer.render(this.scene, this.camera);
  }
}
