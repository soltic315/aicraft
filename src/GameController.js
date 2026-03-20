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
  FOOD_ITEMS,
  TOOL_ITEMS,
  CHEST_STORAGE_LIMIT,
  DAY_SKY_COLOR,
  NIGHT_SKY_COLOR,
  DAY_FOG_COLOR,
  NIGHT_FOG_COLOR,
  DAY_AMBIENT_COLOR,
  NIGHT_AMBIENT_COLOR,
  DAY_SUN_COLOR,
  NIGHT_MOON_COLOR,
  clamp,
  calculateFallDamage,
  sanitizeSettings,
  getPosKey,
  parsePosKey,
  smoothstep,
  DROWNING_GRACE_PERIOD,
  DROWNING_DAMAGE_INTERVAL,
  DROWNING_DAMAGE,
  SUFFOCATION_DAMAGE_INTERVAL,
  SUFFOCATION_DAMAGE,
  HUNGER_DRAIN_IDLE,
  HUNGER_DRAIN_MOVE,
  HUNGER_DRAIN_SPRINT,
  HUNGER_LOW_THRESHOLD,
  HUNGER_STARVE_DAMAGE_INTERVAL,
  HUNGER_STARVE_DAMAGE,
  APPLE_HUNGER_RESTORE,
  CHEST_AUTO_CLOSE_DISTANCE,
  PLAYER_ATTACK_REACH,
  PLAYER_ATTACK_DAMAGE_BASE,
  PLAYER_ATTACK_DAMAGE_TOOL,
  PLAYER_ATTACK_COOLDOWN,
  KNOCKBACK_MOB_FORCE,
  KNOCKBACK_PLAYER_FORCE,
} from './config.js';
import { useSettingsStore } from './stores/settingsStore.js';
import { useInventoryStore } from './stores/inventoryStore.js';
import { useChestStore } from './stores/chestStore.js';
import { usePlayerStore } from './stores/playerStore.js';
import { useGameStore } from './stores/gameStore.js';
import { useDayNightStore } from './stores/dayNightStore.js';
import { useBreakStore } from './stores/breakStore.js';
import { useUIStore } from './stores/uiStore.js';
import { useToolStore } from './stores/toolStore.js';
import { useHungerStore } from './stores/hungerStore.js';
import { TOOL_NAMES, getToolBreakMultiplier, isToolType, ITEM_TO_TOOL_TYPE, TOOL_TYPE_TO_ITEM } from './tools.js';
import { MobManager } from './mobs.js';
import { DroppedItemManager } from './DroppedItemManager.js';

export class GameController {
  constructor(eventBus, sound, input) {
    this.eventBus = eventBus;
    this.sound = sound;
    this.input = input;

    // Settings & save data
    this.savedGame = this._loadSaveData();
    if (this.savedGame?.settings) {
      useSettingsStore.getState().load(this.savedGame.settings);
    }
    this.settings = useSettingsStore.getState();
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
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

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

    // Inventory (restore from save via store)
    if (this.savedGame?.player) {
      useInventoryStore.getState().restoreFromSave(
        this.savedGame.player.inventory,
        this.savedGame.player.selectedSlot,
      );
      // ロード後は選択スロットに基づいてツール状態を初期化
      this._onSlotChanged();
    }

    // Chest storage (restore from save via store)
    if (this.savedGame?.chestStorage) {
      useChestStore.getState().restoreFromSave(this.savedGame.chestStorage);
    }

    // 空腹値を復元
    if (Number.isFinite(this.savedGame?.player?.hunger)) {
      useHungerStore.getState().restoreFromSave(this.savedGame.player.hunger);
    }

    this.lastPlaceTime = 0;
    this._attackCooldown = 0;

    // モブマネージャー
    this.mobManager = new MobManager(this.scene, this.world);

    // ドロップアイテムマネージャー
    this.droppedItemManager = new DroppedItemManager(this.scene, this.world);

    // Break state (internal tracking for game loop)
    this.breakState = {
      key: null,
      duration: 0,
      startedAt: 0,
      blockType: BlockType.AIR,
      toolType: null,
    };

    // 溺れ・窒息・飢餓タイマー
    this.underwaterTimer = 0;
    this.drowningDamageTimer = DROWNING_DAMAGE_INTERVAL;
    this.suffocationDamageTimer = SUFFOCATION_DAMAGE_INTERVAL;
    this.starvationDamageTimer = HUNGER_STARVE_DAMAGE_INTERVAL;

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
    // Expose shared refs for Preact components
    window.__aicraft = {
      eventBus: this.eventBus,
      sound: this.sound,
      hasSavedGame: !!this.savedGame,
      applySettings: () => this._applySettings(),
    };

    // Apply initial settings
    this._applySettings(false);

    // Subscribe to events
    this._subscribeEvents();

    // Subscribe to settings store changes
    useSettingsStore.subscribe((state) => {
      this.settings = state;
    });

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

    // パネルが閉じている状態でのクリック/キー入力で自動再ロック
    const tryRelock = () => {
      if (!this.gameStarted || this.player.locked) return;
      if (useGameStore.getState().isDead) return;
      const ui = useUIStore.getState();
      if (ui.inventoryOpen || ui.craftOpen || ui.settingsOpen || ui.chestOpen) return;
      void this.sound.ensureStarted();
      this.player.lock();
    };
    this.renderer.domElement.addEventListener('click', tryRelock);
    document.addEventListener('keydown', tryRelock);

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
      useInventoryStore.getState().setSlot(slot);
      this._onSlotChanged();
    });

    this.eventBus.on('slot-scroll', (deltaY) => {
      if (!this.player.locked) return;
      useInventoryStore.getState().scrollSlot(deltaY);
      this._onSlotChanged();
    });

    // スロット内容変更時も追従（ドラッグ&ドロップ等）
    useInventoryStore.subscribe((state, prev) => {
      if (state.selectedSlot !== prev.selectedSlot || state.slots !== prev.slots) {
        this._onSlotChanged();
      }
    });

    this.eventBus.on('toggle-settings', () => {
      const opened = useUIStore.getState().toggleSettings();
      if (opened) document.exitPointerLock();
    });

    this.eventBus.on('toggle-inventory', () => {
      const opened = useUIStore.getState().toggleInventory();
      if (opened) document.exitPointerLock();
    });

    this.eventBus.on('toggle-craft', () => {
      const opened = useUIStore.getState().toggleCraft();
      if (opened) document.exitPointerLock();
    });

    this.eventBus.on('close-chest', () => {
      this._closeChestPanel('チェストを閉じました', false);
    });

    this.eventBus.on('interact-chest', () => {
      const chestStore = useChestStore.getState();
      if (chestStore.openedChestKey) {
        this._closeChestPanel('チェストを閉じました', false);
        return;
      }

      const hit = this._getTargetChestHit();
      if (!hit) {
        useUIStore.getState().showFeedback('視線先にチェストがありません');
        this.sound.playError();
        return;
      }

      this._openChestAt(hit.blockPos);
    });

    this.eventBus.on('start-clicked', () => {
      if (this.gameStarted) return;
      void this.sound.ensureStarted();
      useGameStore.getState().setLoading(true, 'ワールドを生成中...');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
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

            this.world.update(this.player.position.x, this.player.position.z, this.camera);
            this.gameStarted = true;
            this._onSlotChanged(); // 初期スロットのツールを装備
            useGameStore.getState().startGame();
            this._startAutoSave();
            this.player.lock();
          } catch (error) {
            console.error('Failed to start game:', error);
            useUIStore.getState().showFeedback('ワールド初期化に失敗しました。再読み込みしてください', 2200);
          } finally {
            useGameStore.getState().setLoading(false);
          }
        });
      });
    });

    this.eventBus.on('save-clicked', () => {
      this._saveGame();
    });

    this.eventBus.on('delete-save-clicked', () => {
      localStorage.removeItem(SAVE_STORAGE_KEY);
      this._returnToTitle();
    });

    this.eventBus.on('respawn-clicked', () => {
      useGameStore.getState().setDead(false);
      useHungerStore.getState().reset();
      this.underwaterTimer = 0;
      this.drowningDamageTimer = DROWNING_DAMAGE_INTERVAL;
      this.suffocationDamageTimer = SUFFOCATION_DAMAGE_INTERVAL;
      this.starvationDamageTimer = HUNGER_STARVE_DAMAGE_INTERVAL;
      this.mobManager.removeAll();
      this.droppedItemManager.removeAll();
      this.player.spawn();
      this.player.lock();
    });

    this.eventBus.on('eat-food', (foodType) => {
      if (!this.gameStarted) return;
      this._tryEatFood(foodType);
    });

    // Qキー: 選択ホットバースロットから1個床にドロップ
    this.eventBus.on('drop-held-item', () => {
      if (!this.gameStarted || useGameStore.getState().isDead) return;
      const { slots, selectedSlot } = useInventoryStore.getState();
      const slot = slots[selectedSlot];
      if (!slot || slot.type === null || slot.count === 0) return;
      this._dropItemFromSlot(selectedSlot, 1);
    });

    // インベントリUI: スロット外ドラッグで床にドロップ
    this.eventBus.on('drop-item-from-slot', ({ slotIndex, count }) => {
      if (!this.gameStarted || useGameStore.getState().isDead) return;
      this._dropItemFromSlot(slotIndex, count);
    });

    // チェストUI: チェストアイテムをパネル外にドラッグで床にドロップ
    this.eventBus.on('drop-chest-item-to-floor', ({ type }) => {
      if (!this.gameStarted || useGameStore.getState().isDead) return;
      const count = useChestStore.getState().removeAllFromOpenedChest(type);
      if (count <= 0) return;
      const pos = this.player.position;
      const fwd = this.player.getDirection();
      this.droppedItemManager.spawnAt(
        pos.x + fwd.x * 0.6,
        pos.y + 0.5,
        pos.z + fwd.z * 0.6,
        type,
        count,
      );
    });
  }

  // ---- Settings ----

  _applySettings(persist = true) {
    const settings = useSettingsStore.getState();
    this.settings = settings;
    this.player.setMouseSensitivity(settings.sensitivity);
    this.world.setRenderDistance(settings.renderDistance);
    this.sound.setSEVolume(settings.seVolume);
    this.sound.setBGMVolume(settings.bgmVolume);

    // Accessibility / UI scaling
    document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale ?? 1));
    document.body.classList.toggle('high-contrast', Boolean(settings.highContrast));

    if (persist) {
      settings.persist();
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
      const { slots, selectedSlot } = useInventoryStore.getState();
      const { selectedTool } = useToolStore.getState();
      const chestState = useChestStore.getState().exportForSave();
      const settings = useSettingsStore.getState();
      const { hunger } = useHungerStore.getState();

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
          inventory: slots.map((s) => ({ type: s.type, count: s.count })),
          selectedSlot,
          selectedTool,
          hunger,
        },
        settings: {
          sensitivity: settings.sensitivity,
          bgmVolume: settings.bgmVolume,
          seVolume: settings.seVolume,
          renderDistance: settings.renderDistance,
        },
        chunkDiffs: this.world.exportChunkEdits(),
        chestStorage: chestState,
      };

      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
      if (showFeedback) useUIStore.getState().showFeedback('ゲームをセーブしました', 800);
    } catch (e) {
      console.warn('Failed to save game:', e);
      if (showFeedback) useUIStore.getState().showFeedback('セーブに失敗しました', 1000);
    }
  }

  _startAutoSave() {
    if (this.autoSaveIntervalId) return;
    this.autoSaveIntervalId = setInterval(() => {
      this._saveGame({ showFeedback: false });
    }, AUTO_SAVE_INTERVAL_MS);
  }

  _returnToTitle() {
    // 自動セーブを停止
    if (this.autoSaveIntervalId) {
      clearInterval(this.autoSaveIntervalId);
      this.autoSaveIntervalId = null;
    }
    // ポインターロック解除
    document.exitPointerLock();
    // 内部状態をリセット
    this.gameStarted = false;
    this.savedGame = null;
    if (window.__aicraft) window.__aicraft.hasSavedGame = false;
    // ゲームストアをリセット
    useInventoryStore.getState().reset();
    useToolStore.getState().clearTool();
    useHungerStore.getState().reset();
    useBreakStore.getState().reset();
    this.mobManager.removeAll();
    this.droppedItemManager.removeAll();
    // ワールドのチャンク・地形データをリセット
    this.world.reset();
    // ストアをタイトル状態へ（設定パネルも閉じる）
    if (useUIStore.getState().settingsOpen) {
      useUIStore.getState().toggleSettings();
    }
    useGameStore.getState().returnToTitle();
  }

  // ---- Inventory (delegated to store) ----

  getInventoryCount(type) {
    return useInventoryStore.getState().getCount(type);
  }

  _addToInventory(type, amount = 1) {
    useInventoryStore.getState().addItem(type, amount);
  }

  _consumeFromInventory(type, amount = 1) {
    return useInventoryStore.getState().consumeItem(type, amount);
  }

  _hasRecipeIngredients(recipe) {
    return useInventoryStore.getState().hasRecipeIngredients(recipe);
  }

  _craftRecipe(recipe) {
    const inv = useInventoryStore.getState();
    if (!inv.craftRecipe(recipe)) {
      useUIStore.getState().showFeedback('クラフト失敗: 素材が不足しています');
      this.sound.playError();
      return false;
    }

    this.sound.playPlace();
    useUIStore.getState().showFeedback(`クラフト成功: ${recipe.label}`, 900);
    return true;
  }

  // ---- Chest (delegated to store) ----

  _closeChestPanel(message = null, playError = false) {
    useChestStore.getState().closeChest();
    useUIStore.getState().setChestOpen(false);
    if (message) {
      useUIStore.getState().showFeedback(message);
      if (playError) this.sound.playError();
    }
  }

  _openChestAt(pos) {
    if (this.world.getBlock(pos.x, pos.y, pos.z) !== BlockType.CHEST) {
      this._closeChestPanel('チェストが見つかりません', true);
      return false;
    }

    const posKey = getPosKey(pos.x, pos.y, pos.z);
    const chestStore = useChestStore.getState();
    chestStore.getChestData(pos, true);
    chestStore.openChest(posKey);
    useUIStore.getState().openChestPanel();
    useUIStore.getState().showFeedback('チェストを開きました', 800);
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

  _recoverChestItems(blockPos) {
    return useChestStore.getState().recoverChestItems(blockPos);
  }

  _validateOpenedChest() {
    const chestStore = useChestStore.getState();
    if (!chestStore.openedChestKey) return;

    const chestPos = parsePosKey(chestStore.openedChestKey);
    if (this.world.getBlock(chestPos.x, chestPos.y, chestPos.z) !== BlockType.CHEST) {
      this._closeChestPanel('チェストが破壊されました');
      return;
    }

    // プレイヤーがチェストから離れたら自動で閉じる
    const dx = this.player.position.x - (chestPos.x + 0.5);
    const dy = this.player.position.y - (chestPos.y + 0.5);
    const dz = this.player.position.z - (chestPos.z + 0.5);
    if (dx * dx + dy * dy + dz * dz > CHEST_AUTO_CLOSE_DISTANCE * CHEST_AUTO_CLOSE_DISTANCE) {
      this._closeChestPanel('チェストから離れました');
    }
  }

  // ---- スロット変更時の処理（ツール自動装備） ----

  _onSlotChanged() {
    const { selectedSlot, slots } = useInventoryStore.getState();
    const slot = slots[selectedSlot];
    const toolType = slot?.type != null ? ITEM_TO_TOOL_TYPE[slot.type] : null;
    if (toolType) {
      useToolStore.getState().setTool(toolType);
    } else {
      // ツールでないスロット（空・素材・食料等）を選択した場合はツールをクリア
      useToolStore.getState().clearTool();
    }
  }

  // ---- 食料消費 ----

  _tryEatFood(foodType) {
    // foodType 未指定の場合は選択スロットから取得
    if (!foodType) {
      const { selectedSlot, slots } = useInventoryStore.getState();
      foodType = slots[selectedSlot]?.type ?? null;
    }

    if (!FOOD_ITEMS.has(foodType)) {
      useUIStore.getState().showFeedback('食べられるものが選択されていません');
      this.sound.playError();
      return;
    }

    const selectedType = foodType;

    const hungerStore = useHungerStore.getState();
    if (hungerStore.hunger >= hungerStore.maxHunger) {
      useUIStore.getState().showFeedback('お腹がいっぱいです', 800);
      return;
    }

    if (this.getInventoryCount(selectedType) <= 0) {
      useUIStore.getState().showFeedback('リンゴがありません', 800);
      this.sound.playError();
      return;
    }

    this._consumeFromInventory(selectedType);
    hungerStore.feedHunger(APPLE_HUNGER_RESTORE);
    useUIStore.getState().showFeedback(`リンゴを食べた！ 空腹 +${APPLE_HUNGER_RESTORE}`, 1000);
    this.sound.playPlace();
  }

  // ---- Block Interaction ----

  _resetBreaking() {
    this.breakState.key = null;
    this.breakState.duration = 0;
    this.breakState.startedAt = 0;
    this.breakState.blockType = BlockType.AIR;
    this.breakState.toolType = null;
    this.breakOverlayMesh.visible = false;
    useBreakStore.getState().reset();
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

    const { selectedSlot, slots } = useInventoryStore.getState();
    const placeType = slots[selectedSlot]?.type ?? null;

    // 食料アイテムはブロックを見ていなくても右クリックで食べる
    if (placeType != null && FOOD_ITEMS.has(placeType)) {
      this._tryEatFood(placeType);
      return;
    }

    const hit = this.world.raycast(this.player.getEyePosition(), this.player.getDirection());

    // 右クリックでチェストを開く（手が空でも可）
    if (hit && hit.blockType === BlockType.CHEST) {
      this._openChestAt(hit.blockPos);
      return;
    }

    if (placeType == null) {
      return;
    }

    if (!hit) {
      useUIStore.getState().showFeedback('設置失敗: 射程外です');
      this.sound.playError();
      return;
    }

    // ツールアイテムは設置不可
    if (TOOL_ITEMS.has(placeType)) {
      useUIStore.getState().showFeedback('ツールは設置できません', 800);
      this.sound.playError();
      return;
    }

    if (this.getInventoryCount(placeType) <= 0) {
      useUIStore.getState().showFeedback('設置失敗: 所持数が不足しています');
      this.sound.playError();
      return;
    }

    const pp = hit.placePos;
    if (this.player.intersectsBlock(pp.x, pp.y, pp.z)) {
      useUIStore.getState().showFeedback('設置失敗: プレイヤーと衝突します');
      this.sound.playError();
      return;
    }

    this.lastPlaceTime = now;

    if (!this._consumeFromInventory(placeType)) return;
    this.world.setBlockWithDiff(pp.x, pp.y, pp.z, placeType);
    if (placeType === BlockType.CHEST) {
      useChestStore.getState().getChestData(pp, true);
    }
    this.sound.playPlace();
  }

  _updateBreaking(hit, now) {
    const selectedTool = useToolStore.getState().selectedTool;
    // ツールを持っていない場合は補正なし（素手扱い）
    const toolItemType = TOOL_TYPE_TO_ITEM[selectedTool];
    const hasTool = toolItemType != null && useInventoryStore.getState().getCount(toolItemType) > 0;
    const key = `${getPosKey(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z)}|${selectedTool}|${hasTool}`;
    const baseDuration = BLOCK_BREAK_DURATIONS[hit.blockType] ?? 0.5;
    const multiplier = hasTool ? getToolBreakMultiplier(selectedTool, hit.blockType) : 1;
    const duration = Math.max(0.08, baseDuration / multiplier);

    if (this.breakState.key !== key) {
      this.breakState.key = key;
      this.breakState.duration = duration;
      this.breakState.startedAt = now;
      this.breakState.blockType = hit.blockType;
      this.breakState.toolType = selectedTool;
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
    useBreakStore.getState().setProgress(progress);

    if (progress >= 1) {
      if (hit.blockType === BlockType.CHEST) {
        const recovered = this._recoverChestItems(hit.blockPos);
        if (recovered > 0) {
          useUIStore.getState().showFeedback(`チェスト回収: 中身 ${recovered} 個を取得`, 1200);
        }
      }

      // ブロックを床にドロップ
      this.droppedItemManager.spawn(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, hit.blockType, 1);
      // 葉ブロック破壊時に30%の確率でリンゴをドロップ
      if (hit.blockType === BlockType.LEAVES && Math.random() < 0.3) {
        this.droppedItemManager.spawn(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, BlockType.APPLE, 1);
      }
      this.world.setBlockWithDiff(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, BlockType.AIR);
      this.sound.playBreak();
      this._resetBreaking();
    }
  }

  // ---- サバイバルシステム（溺れ・窒息・空腹） ----

  _updateSurvivalSystems(dt) {
    if (useGameStore.getState().isDead) return;

    // --- 空腹 ---
    const isMoving = Math.abs(this.player.velocity.x) > 0.3 || Math.abs(this.player.velocity.z) > 0.3;
    let hungerDrain = HUNGER_DRAIN_IDLE;
    if (this.player.isSprinting) hungerDrain = HUNGER_DRAIN_SPRINT;
    else if (isMoving) hungerDrain = HUNGER_DRAIN_MOVE;
    useHungerStore.getState().consumeHunger(hungerDrain * dt);

    // 最新の空腹値を取得
    const currentHunger = useHungerStore.getState().hunger;

    // HP回復: 空腹度が低いと無効化
    this.player.regenEnabled = currentHunger > HUNGER_LOW_THRESHOLD;

    // 飢餓ダメージ
    if (currentHunger <= 0) {
      this.starvationDamageTimer -= dt;
      if (this.starvationDamageTimer <= 0) {
        this.starvationDamageTimer = HUNGER_STARVE_DAMAGE_INTERVAL;
        const dmg = this.player.applyDamage(HUNGER_STARVE_DAMAGE);
        if (dmg > 0) {
          useUIStore.getState().showFeedback('空腹でダメージ！ -1 HP', 900);
          this.sound.playError();
        }
      }
    } else {
      this.starvationDamageTimer = HUNGER_STARVE_DAMAGE_INTERVAL;
    }

    // --- 溺れダメージ ---
    if (this.player.isHeadInWater()) {
      this.underwaterTimer += dt;
      if (this.underwaterTimer >= DROWNING_GRACE_PERIOD) {
        this.drowningDamageTimer -= dt;
        if (this.drowningDamageTimer <= 0) {
          this.drowningDamageTimer = DROWNING_DAMAGE_INTERVAL;
          const dmg = this.player.applyDamage(DROWNING_DAMAGE);
          if (dmg > 0) {
            useUIStore.getState().showFeedback('溺れている！ -2 HP', 900);
            this.sound.playError();
          }
        }
      }
    } else {
      this.underwaterTimer = 0;
      this.drowningDamageTimer = DROWNING_DAMAGE_INTERVAL;
    }

    // --- 窒息ダメージ ---
    if (this.player.isHeadInSolid()) {
      this.suffocationDamageTimer -= dt;
      if (this.suffocationDamageTimer <= 0) {
        this.suffocationDamageTimer = SUFFOCATION_DAMAGE_INTERVAL;
        const dmg = this.player.applyDamage(SUFFOCATION_DAMAGE);
        if (dmg > 0) {
          useUIStore.getState().showFeedback('窒息している！ -1 HP', 900);
          this.sound.playError();
        }
      }
    } else {
      this.suffocationDamageTimer = SUFFOCATION_DAMAGE_INTERVAL;
    }

    // 死亡判定
    if (this.player.health <= 0 && !useGameStore.getState().isDead) {
      useGameStore.getState().setDead(true);
      document.exitPointerLock();
    }
  }

  // ---- モブシステム ----

  _updateMobs(dt, isDay) {
    if (useGameStore.getState().isDead) return;

    this.mobManager.update(dt, this.player.position, isDay, (damage, mobX, mobZ) => {
      const actualDamage = this.player.applyDamage(damage);
      if (actualDamage > 0) {
        this.player.applyKnockback(mobX, mobZ, KNOCKBACK_PLAYER_FORCE);
        useUIStore.getState().showHitFlash();
        useUIStore.getState().showFeedback(`ゾンビに攻撃された！ -${actualDamage} HP`, 900);
        this.sound.playError();
        if (this.player.health <= 0 && !useGameStore.getState().isDead) {
          useGameStore.getState().setDead(true);
          document.exitPointerLock();
        }
      }
    });
  }

  // ---- ドロップアイテムシステム ----

  /**
   * 指定スロットからアイテムをドロップする
   * @param {number} slotIndex - インベントリスロットインデックス
   * @param {number} count - ドロップ個数
   */
  _dropItemFromSlot(slotIndex, count) {
    const { slots } = useInventoryStore.getState();
    const slot = slots[slotIndex];
    if (!slot || slot.type === null || slot.count === 0) return;

    const dropCount = Math.min(count, slot.count);
    const type = slot.type;

    useInventoryStore.getState().removeFromSlot(slotIndex, dropCount);

    // プレイヤーの前方向に少し飛ばす
    const pos = this.player.position;
    const fwd = this.player.getDirection();
    this.droppedItemManager.spawnAt(
      pos.x + fwd.x * 0.6,
      pos.y + 0.5,
      pos.z + fwd.z * 0.6,
      type,
      dropCount,
    );
  }

  _updateDroppedItems(dt) {
    if (useGameStore.getState().isDead) return;
    const playerPos = this.player.position;
    const pickedUp = this.droppedItemManager.update(dt, playerPos);
    for (const { type, count } of pickedUp) {
      useInventoryStore.getState().addItem(type, count);
      this.sound.playPlace(); // ピックアップ音として流用
    }
  }

  /** プレイヤーがモブを攻撃する */
  _attackMob(mob) {
    if (this._attackCooldown > 0) return;

    const { selectedTool } = useToolStore.getState();
    const damage = selectedTool != null ? PLAYER_ATTACK_DAMAGE_TOOL : PLAYER_ATTACK_DAMAGE_BASE;

    mob.takeDamage(damage);
    mob.flashHit();
    mob.applyKnockback(this.player.position.x, this.player.position.z, KNOCKBACK_MOB_FORCE);

    this._attackCooldown = PLAYER_ATTACK_COOLDOWN;
    this.sound.playBreak(); // 打撃音として流用

    if (!mob.isAlive) {
      useUIStore.getState().showFeedback('ゾンビを倒した！', 1200);
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

    const dayNight = this._updateDayNightCycle((time - this.cycleStartTime) / 1000);

    if (this.gameStarted) {
      // プレイヤー物理・移動はパネルが開いていても常に更新
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
            useUIStore.getState().showFeedback(`落下ダメージ: -${actualDamage} HP`, 1000);
            this.sound.playError();
          }

          if (this.player.health <= 0 && !useGameStore.getState().isDead) {
            useGameStore.getState().setDead(true);
            document.exitPointerLock();
          }
        }
      }
      this.wasOnGround = this.player.onGround;

      this.world.update(this.player.position.x, this.player.position.z, this.camera);
      this._validateOpenedChest();

      // 攻撃クールダウン更新
      this._attackCooldown = Math.max(0, this._attackCooldown - dt);

      // ブロックハイライト・採掘・モブ攻撃はポインターロック時のみ
      if (this.player.locked) {
        const eyePos = this.player.getEyePosition();
        const dir = this.player.getDirection();
        const blockHit = this.world.raycast(eyePos, dir);

        // モブへのレイキャスト（攻撃リーチ内のみ）
        const mobHit = this.mobManager.raycastMobs(eyePos, dir, PLAYER_ATTACK_REACH);

        // ブロックとモブの距離を比較してモブが手前にいるか判定
        let blockDist = Infinity;
        if (blockHit) {
          const bx = blockHit.blockPos.x + 0.5 - eyePos.x;
          const by = blockHit.blockPos.y + 0.5 - eyePos.y;
          const bz = blockHit.blockPos.z + 0.5 - eyePos.z;
          blockDist = Math.sqrt(bx * bx + by * by + bz * bz);
        }
        const targetMob = mobHit && mobHit.distance < blockDist ? mobHit.mob : null;

        if (blockHit && !targetMob) {
          // ブロックをターゲット
          this.highlightMesh.visible = true;
          this.highlightMesh.position.set(
            blockHit.blockPos.x + 0.5,
            blockHit.blockPos.y + 0.5,
            blockHit.blockPos.z + 0.5
          );
          if (this.input.isBreaking) {
            this._updateBreaking(blockHit, time);
          } else {
            this._resetBreaking();
          }
        } else {
          // モブをターゲット（または何もない）
          this.highlightMesh.visible = false;
          this._resetBreaking();
          if (targetMob && this.input.isBreaking) {
            this._attackMob(targetMob);
          }
        }
      } else {
        this.highlightMesh.visible = false;
        this._resetBreaking();
      }

      // Sync stores for Preact UI
      useGameStore.getState().setFps(this.fps);
      useDayNightStore.getState().update(dayNight.cycleRatio, dayNight.isDay);
      usePlayerStore.getState().syncFromPlayer(this.player);

      const eyePos = this.player.getEyePosition();
      const eyeBlock = this.world.getBlock(
        Math.floor(eyePos.x),
        Math.floor(eyePos.y),
        Math.floor(eyePos.z)
      );
      useUIStore.getState().setWaterOverlay(eyeBlock === BlockType.WATER);

      this._updateSurvivalSystems(dt);
      this._updateMobs(dt, dayNight.isDay);
      this._updateDroppedItems(dt);
    } else {
      // タイトル画面
      useDayNightStore.getState().update(dayNight.cycleRatio, dayNight.isDay);
      this.highlightMesh.visible = false;
      this._resetBreaking();
      useUIStore.getState().setWaterOverlay(false);
      this.wasOnGround = this.player.onGround;
      usePlayerStore.getState().syncFromPlayer(this.player);
      this._validateOpenedChest();
    }

    this.renderer.render(this.scene, this.camera);
  }
}
