// Game orchestration: scene, state, game loop, save/load
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  BlockType,
  BLOCK_NAMES,
  BLOCK_BREAK_DURATIONS,
  BLOCK_DROP_OVERRIDES,
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
  DIFFICULTY_SETTINGS,
  DAY_NIGHT_CYCLE_SECONDS,
  PLACE_COOLDOWN,
  FOOD_ITEMS,
  TOOL_ITEMS,
  ARMOR_ITEMS,
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
  DEFAULT_SETTINGS,
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
  FOOD_STATS,
  CHEST_AUTO_CLOSE_DISTANCE,
  PLAYER_ATTACK_REACH,
  PLAYER_ATTACK_DAMAGE_BASE,
  PLAYER_ATTACK_DAMAGE_TOOL,
  PLAYER_ATTACK_COOLDOWN,
  KNOCKBACK_MOB_FORCE,
  KNOCKBACK_PLAYER_FORCE,
  MOB_XP_REWARDS,
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
import { useDurabilityStore } from './stores/durabilityStore.js';
import { useArmorStore, ARMOR_TYPE_TO_SLOT, BLOCK_TO_ARMOR_KEY, ARMOR_KEY_TO_BLOCK } from './stores/armorStore.js';
import { useXpStore } from './stores/xpStore.js';
import { useAchievementStore } from './stores/achievementStore.js';
import { useEnchantmentStore } from './stores/enchantmentStore.js';
import { TOOL_NAMES, getToolBreakMultiplier, isToolType, ITEM_TO_TOOL_TYPE, TOOL_TYPE_TO_ITEM } from './tools.js';
import { MobManager } from './mobs.js';
import { DroppedItemManager } from './DroppedItemManager.js';
import { ParticleManager } from './particles.js';
import { SkyDome } from './sky.js';
import { SurvivalSystem } from './systems/SurvivalSystem.js';
import { SaveSystem } from './systems/SaveSystem.js';

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
    // エンチャントストアの参照
    this._enchantmentStore = useEnchantmentStore;
    this.worldSeed = Number.isFinite(this.savedGame?.worldSeed)
      ? this.savedGame.worldSeed
      : Math.floor(Math.random() * 100000);

    // Scene
    this.webglSupported = true;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setClearColor(0x87CEEB);
      // ACESFilm トーンマッピングで映画的な色彩表現
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      // シャドウマップ（動的影）
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.domElement.style.touchAction = 'none';
      this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
      document.body.appendChild(this.renderer.domElement);
    } catch (error) {
      this.webglSupported = false;
      this._showWebGLError(error);
      return;
    }

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87CEEB, 60, 120);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);
    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    this.dirLight.position.set(50, 100, 30);
    // ソフトシャドウ設定（プレイヤー周辺の影を動的に描画）
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 200;
    this.dirLight.shadow.camera.left   = -72;
    this.dirLight.shadow.camera.right  =  72;
    this.dirLight.shadow.camera.top    =  72;
    this.dirLight.shadow.camera.bottom = -72;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target); // シャドウカメラターゲットをシーンに追加

    // ポストプロセッシング: EffectComposer + ブルーム（ゲーム開始時に遅延初期化）
    // コンストラクタで作成するとGPUメモリ確保で起動時フリーズするため
    this.composer = null;
    this.bloomPass = null;

    // 水・溶岩アニメーション用タイムトラッカー
    this._waterAnimTime = 0;
    this._lavaAnimTime = 0;

    // たいまつPointLight管理: posKey -> PointLight
    this._torchLights = new Map();

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

        // PBR（物理ベースレンダリング）マテリアルで各ブロックの質感を表現
        const matOptions = { map: texture, vertexColors: true, roughness: 0.85, metalness: 0.0 };

        // 透明・特殊マテリアル設定
        if (type === BlockType.WATER) {
          matOptions.transparent = true; matOptions.opacity = 0.72; matOptions.depthWrite = false;
          matOptions.roughness = 0.05; matOptions.metalness = 0.15; // 水は滑らか・やや光沢
        }
        if (type === BlockType.GLASS) {
          matOptions.transparent = true; matOptions.opacity = 0.42;
          matOptions.roughness = 0.0; matOptions.metalness = 0.05;
        }
        if (type === BlockType.LEAVES) {
          matOptions.transparent = true; matOptions.opacity = 0.9;
          matOptions.roughness = 0.95;
        }
        if (type === BlockType.JUNGLE_LEAVES) {
          matOptions.transparent = true; matOptions.opacity = 0.9;
          matOptions.roughness = 0.95;
        }
        if (type === BlockType.ICE) {
          matOptions.transparent = true; matOptions.opacity = 0.88; matOptions.depthWrite = false;
          matOptions.roughness = 0.02; matOptions.metalness = 0.08; // 氷は非常に滑らか
        }
        // 金属鉱石・素材のメタリック感
        if (type === BlockType.IRON_ORE) { matOptions.roughness = 0.7; matOptions.metalness = 0.3; }
        if (type === BlockType.GOLD_ORE) { matOptions.roughness = 0.5; matOptions.metalness = 0.6; }
        if (type === BlockType.DIAMOND_ORE) { matOptions.roughness = 0.2; matOptions.metalness = 0.15; }
        if (type === BlockType.AMETHYST_ORE) {
          matOptions.roughness = 0.25; matOptions.metalness = 0.1;
          matOptions.emissive = new THREE.Color(0x6020a0);
          matOptions.emissiveIntensity = 0.18;
        }
        if (type === BlockType.DEEPSLATE) { matOptions.roughness = 0.92; matOptions.metalness = 0.05; }
        // 溶岩: 発光エフェクトでブルームを誘発
        if (type === BlockType.LAVA) {
          matOptions.emissive = new THREE.Color(0xff4400);
          matOptions.emissiveIntensity = 0.8;
          matOptions.roughness = 0.9;
        }
        // ダイヤモンド鉱石: 淡い発光（希少感を演出）
        if (type === BlockType.DIAMOND_ORE) {
          matOptions.emissive = new THREE.Color(0x00b8c8);
          matOptions.emissiveIntensity = 0.12;
        }
        // 金鉱石: 淡い金色の光
        if (type === BlockType.GOLD_ORE) {
          matOptions.emissive = new THREE.Color(0xb07800);
          matOptions.emissiveIntensity = 0.1;
        }
        // 雪: 白く輝く
        if (type === BlockType.SNOW) { matOptions.roughness = 0.65; }
        // たいまつ: 強い橙色発光でブルームを誘発
        if (type === BlockType.TORCH) {
          matOptions.emissive = new THREE.Color(0xff8810);
          matOptions.emissiveIntensity = 1.2;
          matOptions.roughness = 0.9;
        }

        const mat = new THREE.MeshStandardMaterial(matOptions);
        this.blockMaterials[type][face] = mat;

        // 水・溶岩マテリアルへの参照を保持（アニメーション用）
        if (type === BlockType.WATER && !this._waterMaterials) this._waterMaterials = [];
        if (type === BlockType.WATER) this._waterMaterials.push(mat);
        if (type === BlockType.LAVA && !this._lavaMaterials) this._lavaMaterials = [];
        if (type === BlockType.LAVA) this._lavaMaterials.push(mat);
      }
    }

    // World & Player
    this.world = new World(this.scene, this.blockMaterials, {
      renderDistance: this.settings.renderDistance,
      seed: this.worldSeed,
    });
    if (this.savedGame?.chunkDiffs) {
      this.world.applyChunkEdits(this.savedGame.chunkDiffs);
      // セーブデータからたいまつのPointLightを復元
      for (const edit of this.savedGame.chunkDiffs) {
        if (edit.type === BlockType.TORCH) {
          this._addTorchLight(edit.x, edit.y, edit.z);
        }
      }
    }
    this.player = new Player(this.camera, this.world, { mouseSensitivity: this.settings.sensitivity });

    // 作業台・修理台専用クラフト用の開かれたテーブル位置保持
    this.openedCraftingTablePos = null;
    this.openedRepairTablePos = null;
    this.openedFurnacePos = null;
    this.openedEnchantTablePos = null;

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

    // ツール耐久値を復元
    if (this.savedGame?.player?.toolDurability) {
      useDurabilityStore.getState().restoreFromSave(this.savedGame.player.toolDurability);
    }

    // 防具を復元
    if (this.savedGame?.player?.armorEquipped) {
      useArmorStore.getState().restoreFromSave(this.savedGame.player.armorEquipped);
    }

    // XPを復元
    if (Number.isFinite(this.savedGame?.player?.xp)) {
      useXpStore.getState().restoreFromSave(this.savedGame.player.xp);
    }

    // 実績を復元
    if (this.savedGame?.achievements) {
      useAchievementStore.getState().restoreFromSave(this.savedGame.achievements);
    }

    this.lastPlaceTime = 0;
    this._attackCooldown = 0;

    // モブマネージャー
    this.mobManager = new MobManager(this.scene, this.world);

    // ドロップアイテムマネージャー
    this.droppedItemManager = new DroppedItemManager(this.scene, this.world);

    // パーティクルマネージャー
    this.particleManager = new ParticleManager(this.scene);

    // スカイドーム（太陽・月・星・雲）
    this.skyDome = new SkyDome(this.scene);

    // Break state (internal tracking for game loop)
    this.breakState = {
      key: null,
      duration: 0,
      startedAt: 0,
      blockType: BlockType.AIR,
      toolType: null,
    };

    // サバイバルシステム
    this.survivalSystem = new SurvivalSystem(this.player, this.sound);

    // セーブシステム
    this.saveSystem = new SaveSystem(this.player, this.world, () => this.worldSeed);

    // Game loop state
    this.gameStarted = false;
    this.lastTime = performance.now();
    this.lastFrameTime = this.lastTime;
    this.wasOnGround = false;
    this.cycleStartTime = performance.now();
    this.frameCount = 0;
    this.fpsTime = 0;
    this.fps = 0;
    this._prevIsDay = null; // 未初期化を防ぐ（最初のフレームで不正なBGM変更を防止）
  }

  init() {
    if (!this.webglSupported) {
      return;
    }

    // Expose shared refs for Preact components
    window.__aicraft = {
      eventBus: this.eventBus,
      sound: this.sound,
      hasSavedGame: !!this.savedGame,
      applySettings: () => this._applySettings(),
      gameController: this,
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
      if (this.composer) {
        this.composer.setSize(window.innerWidth, window.innerHeight);
      }
      if (this.bloomPass) {
        this.bloomPass.resolution.set(window.innerWidth, window.innerHeight);
      }
    });

    // Auto-save before unload
    window.addEventListener('beforeunload', () => {
      this.saveSystem.save({ showFeedback: false });
    });

    // タブ非表示時に自動一時停止（意図しない挙動防止）
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.gameStarted && !useGameStore.getState().paused) {
        useGameStore.getState().setPaused(true);
        useUIStore.getState().showFeedback('タブが非アクティブになったためゲームを一時停止しました', 1200);
      }
    });

    // パネルが閉じている状態でのクリック/キー入力で自動再ロック
    const tryRelock = () => {
      if (!this.gameStarted || this.player.locked) return;
      if (useGameStore.getState().isDead) return;
      if (useGameStore.getState().paused) return;
      const ui = useUIStore.getState();
      if (ui.inventoryOpen || ui.craftOpen || ui.settingsOpen || ui.chestOpen) return;
      void this.sound.ensureStarted();
      this.player.lock();
    };
    this.renderer.domElement.addEventListener('click', tryRelock);
    document.addEventListener('keydown', tryRelock);

    // フルスクリーン解除時の自動一時停止
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && this.gameStarted) {
        useGameStore.getState().setPaused(true);
        document.exitPointerLock();
        useUIStore.getState().setResumeHint(true);
      }
    });

    // Start game loop
    requestAnimationFrame((t) => this._gameLoop(t));
  }

  // ---- Lazy Initialization ----

  _initComposer() {
    if (this.composer) return;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3,
      0.5,
      0.82
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
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

    this.eventBus.on('start-clicked', async () => {
      if (this.gameStarted) return;
      void this.sound.ensureStarted();
      useGameStore.getState().setLoading(true, 'ワールドを生成中...');

      // 1フレーム待機してローディング画面を確実に描画させてから重い処理を開始
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      // EffectComposer + UnrealBloomPassをここで初期化（GPU確保は起動時ではなくゲーム開始時に行う）
      this._initComposer();

      try {
        this.player.spawn();
        if (this.savedGame?.player?.position && typeof this.savedGame.player.position === 'object') {
          this.player.position.set(
            Number.isFinite(Number(this.savedGame.player.position.x)) ? Number(this.savedGame.player.position.x) : this.player.position.x,
            Number.isFinite(Number(this.savedGame.player.position.y)) ? Number(this.savedGame.player.position.y) : this.player.position.y,
            Number.isFinite(Number(this.savedGame.player.position.z)) ? Number(this.savedGame.player.position.z) : this.player.position.z
          );
        }
        if (Number.isFinite(this.savedGame?.player?.yaw)) {
          this.player.yaw = this.savedGame.player.yaw;
        }
        if (Number.isFinite(this.savedGame?.player?.pitch)) {
          this.player.pitch = this.savedGame.player.pitch;
        }

        // 全チャンクをローディング中に一括生成（進捗メッセージを随時更新）
        await this.world.preloadAllChunks(
          this.player.position.x,
          this.player.position.z,
          (current, total, message) => {
            const progress = Math.round((current / total) * 100);
            useGameStore.getState().setLoading(true, message, progress);
          }
        );

        this.gameStarted = true;
        this._onSlotChanged(); // 初期スロットのツールを装備

        // 防具の防御値をプレイヤーに反映
        this.player.armorDefense = useArmorStore.getState().totalDefense;

        // 難易度設定をMobManagerに適用
        const difficulty = useGameStore.getState().difficulty;
        const diffSettings = DIFFICULTY_SETTINGS[difficulty];
        if (diffSettings) {
          this.mobManager.setDifficulty(diffSettings);
        }

        useGameStore.getState().startGame();
        this.saveSystem.startAutoSave();
        this.player.lock();
      } catch (error) {
        console.error('Failed to start game:', error);
        useUIStore.getState().showFeedback('ワールド初期化に失敗しました。再読み込みしてください', 2200);
      } finally {
        useGameStore.getState().setLoading(false);
      }
    });

    this.eventBus.on('resume-game', () => {
      const doResume = () => {
        useGameStore.getState().setPaused(false);
        useUIStore.getState().setResumeHint(false);
        this.player.lock();
      };
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(doResume).catch(doResume);
      } else {
        doResume();
      }
    });

    this.eventBus.on('save-clicked', () => {
      this.saveSystem.save();
    });

    this.eventBus.on('delete-save-clicked', () => {
      localStorage.removeItem(SAVE_STORAGE_KEY);
      this._returnToTitle();
    });

    this.eventBus.on('title-clicked', () => {
      this._returnToTitle();
    });

    this.eventBus.on('respawn-clicked', () => {
      useGameStore.getState().setDead(false);
      useHungerStore.getState().reset();
      this.survivalSystem.reset();
      this.mobManager.removeAll();
      this.droppedItemManager.removeAll();
      this.player.spawn();
      // 防具の防御値をリスポーン後も維持
      this.player.armorDefense = useArmorStore.getState().totalDefense;
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

    // ---- 防具装備イベント ----
    this.eventBus.on('equip-armor-from-slot', ({ slotIndex, armorType }) => {
      if (!this.gameStarted) return;
      const armorStore = useArmorStore.getState();
      // armorType は BlockType 数値 → キー文字列に変換
      const armorKey = BLOCK_TO_ARMOR_KEY[armorType];
      if (!armorKey) return;
      const slot = ARMOR_TYPE_TO_SLOT[armorKey];
      if (!slot) return;
      // 既存装備がある場合はインベントリに戻す（BlockType数値で返す）
      const currentEquippedKey = armorStore.equipped[slot];
      if (currentEquippedKey) {
        const currentBlockType = ARMOR_KEY_TO_BLOCK[currentEquippedKey];
        if (currentBlockType != null) useInventoryStore.getState().addItem(currentBlockType, 1);
      }
      // スロットから防具を消費して装備
      useInventoryStore.getState().removeFromSlot(slotIndex, 1);
      armorStore.equipAutoSlot(armorType);
      this.player.armorDefense = useArmorStore.getState().totalDefense;
      useUIStore.getState().showFeedback(`${BLOCK_NAMES[armorType] ?? '防具'} を装備`, 1000);
      this.sound.playPlace();
      this._checkArmorAchievements();
    });

    this.eventBus.on('unequip-armor', ({ slot, type }) => {
      if (!this.gameStarted) return;
      useArmorStore.getState().unequip(slot);
      // type はBlockType数値
      if (type != null) useInventoryStore.getState().addItem(type, 1);
      this.player.armorDefense = useArmorStore.getState().totalDefense;
      useUIStore.getState().showFeedback('防具を外した', 800);
    });
  }

  // ---- 実績チェック ----
  _checkArmorAchievements() {
    const achieveStore = useAchievementStore.getState();
    achieveStore.unlock('first_armor');
    const { equipped } = useArmorStore.getState();
    const allEquipped = ['helmet', 'chestplate', 'leggings', 'boots'].every((s) => equipped[s] != null);
    if (allEquipped) achieveStore.unlock('full_armor');
  }

  _checkMiningAchievement(blockType, dropType) {
    const achieveStore = useAchievementStore.getState();
    if (blockType === BlockType.WOOD || blockType === BlockType.JUNGLE_WOOD ||
        blockType === BlockType.ACACIA_WOOD || blockType === BlockType.CHERRY_WOOD) {
      achieveStore.unlock('first_wood');
    }
    if (blockType === BlockType.STONE || blockType === BlockType.COBBLESTONE) {
      achieveStore.unlock('first_stone');
    }
    if (dropType === BlockType.IRON_INGOT || blockType === BlockType.IRON_ORE) {
      achieveStore.unlock('first_iron');
    }
    if (dropType === BlockType.DIAMOND || blockType === BlockType.DIAMOND_ORE) {
      achieveStore.unlock('first_diamond');
    }
  }

  _checkCraftAchievement() {
    useAchievementStore.getState().unlock('first_craft');
  }

  // ---- Settings ----

  _showWebGLError(error) {
    console.error('WebGL not supported or failed to initialize:', error);
    const warning = document.createElement('div');
    warning.id = 'webgl-error-overlay';
    warning.style = 'position: fixed; inset: 0; background: rgba(0,0,0,0.9); color: #fff; display: flex; align-items: center; justify-content: center; z-index: 3000; font-size: 18px; padding: 20px; text-align: center; line-height: 1.5;';
    warning.innerHTML = `<div><h2>WebGL が利用できません</h2><p>お使いのブラウザやグラフィックドライバが WebGL2 に対応していない可能性があります。最新のブラウザに更新するか、別の環境で再度お試しください。</p><p>${String(error)}</p></div>`;
    document.body.appendChild(warning);
    useUIStore.getState().showFeedback('WebGLが利用できません。最新ブラウザをお試しください。', 5000);
  }

  _applySettings(persist = true) {
    const settings = useSettingsStore.getState();
    this.settings = settings;
    this.player.setMouseSensitivity(settings.sensitivity);
    this.world.setRenderDistance(settings.renderDistance);
    this.sound.setSEVolume(settings.seVolume);
    this.sound.setBGMVolume(settings.bgmVolume);

    // FoV適用
    const fov = settings.fov ?? 75;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();

    // Pixel ratio / 性能制御
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(pixelRatio);

    // フレームレート制限に合わせる
    this.targetFps = settings.targetFps ?? DEFAULT_SETTINGS.targetFps;

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
      if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION) {
        console.info('保存データのスキーマが一致しません（', parsed.schemaVersion, '!=', SAVE_SCHEMA_VERSION, '）。新規ワールドを生成します。');
        return null;
      }
      return parsed;
    } catch (e) {
      console.warn('保存データの読み込みに失敗しました:', e);
      return null;
    }
  }

  _returnToTitle() {
    // 自動セーブを停止
    this.saveSystem.stopAutoSave();
    // ポインターロック解除
    document.exitPointerLock();
    // キー状態をリセット（タイトルへ戻った際にキーが押し続けとして残らないように）
    this.player.keys = {};
    // 内部状態をリセット
    this.gameStarted = false;
    this.savedGame = null;
    if (window.__aicraft) window.__aicraft.hasSavedGame = false;
    // ゲームストアをリセット
    useInventoryStore.getState().reset();
    useToolStore.getState().clearTool();
    useHungerStore.getState().reset();
    useDurabilityStore.getState().reset();
    useBreakStore.getState().reset();
    useArmorStore.getState().reset();
    useXpStore.getState().reset();
    useAchievementStore.getState().reset();
    this.player.armorDefense = 0;
    // 作業台・修理台・かまど・エンチャント台の開放状態をリセット
    this.openedCraftingTablePos = null;
    this.openedRepairTablePos = null;
    this.openedFurnacePos = null;
    this.openedEnchantTablePos = null;
    this.mobManager.removeAll();
    this.droppedItemManager.removeAll();
    this.particleManager.dispose();
    // ワールドのチャンク・地形データをリセット
    this.world.reset();
    // 全UIパネルを閉じる
    useUIStore.getState().closeInventoryPanels();
    useUIStore.getState().setChestOpen(false);
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
    this._checkCraftAchievement();
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
      return;
    }
  }

  _validateOpenedTable() {
    const craftOpen = useUIStore.getState().craftOpen;
    const craftMode = useUIStore.getState().craftMode;

    if (craftOpen && craftMode === 'crafting_table' && this.openedCraftingTablePos) {
      const tablePos = this.openedCraftingTablePos;
      if (this.world.getBlock(tablePos.x, tablePos.y, tablePos.z) !== BlockType.CRAFTING_TABLE) {
        useUIStore.getState().closeCraftPanel();
        this.openedCraftingTablePos = null;
        useUIStore.getState().showFeedback('作業台が破壊されました');
        return;
      }

      const dx = this.player.position.x - (tablePos.x + 0.5);
      const dy = this.player.position.y - (tablePos.y + 0.5);
      const dz = this.player.position.z - (tablePos.z + 0.5);
      if (dx * dx + dy * dy + dz * dz > CHEST_AUTO_CLOSE_DISTANCE * CHEST_AUTO_CLOSE_DISTANCE) {
        useUIStore.getState().closeCraftPanel();
        this.openedCraftingTablePos = null;
        useUIStore.getState().showFeedback('作業台から離れました');
        return;
      }
    }

    if (craftOpen && craftMode === 'repair_table' && this.openedRepairTablePos) {
      const tablePos = this.openedRepairTablePos;
      if (this.world.getBlock(tablePos.x, tablePos.y, tablePos.z) !== BlockType.REPAIR_TABLE) {
        useUIStore.getState().closeCraftPanel();
        this.openedRepairTablePos = null;
        useUIStore.getState().showFeedback('修理台が破壊されました');
        return;
      }

      const dx = this.player.position.x - (tablePos.x + 0.5);
      const dy = this.player.position.y - (tablePos.y + 0.5);
      const dz = this.player.position.z - (tablePos.z + 0.5);
      if (dx * dx + dy * dy + dz * dz > CHEST_AUTO_CLOSE_DISTANCE * CHEST_AUTO_CLOSE_DISTANCE) {
        useUIStore.getState().closeCraftPanel();
        this.openedRepairTablePos = null;
        useUIStore.getState().showFeedback('修理台から離れました');
        return;
      }
    }
  }

  _validateOpenedFurnace() {
    if (!useUIStore.getState().furnaceOpen || !this.openedFurnacePos) return;

    const pos = this.openedFurnacePos;
    if (this.world.getBlock(pos.x, pos.y, pos.z) !== BlockType.FURNACE) {
      useUIStore.getState().closeFurnacePanel();
      this.openedFurnacePos = null;
      useUIStore.getState().showFeedback('かまどが破壊されました');
      return;
    }

    const dx = this.player.position.x - (pos.x + 0.5);
    const dy = this.player.position.y - (pos.y + 0.5);
    const dz = this.player.position.z - (pos.z + 0.5);
    if (dx * dx + dy * dy + dz * dz > CHEST_AUTO_CLOSE_DISTANCE * CHEST_AUTO_CLOSE_DISTANCE) {
      useUIStore.getState().closeFurnacePanel();
      this.openedFurnacePos = null;
      useUIStore.getState().showFeedback('かまどから離れました');
    }
  }

  _validateOpenedEnchantTable() {
    const es = this._enchantmentStore.getState();
    if (!es.enchantPanelOpen || !this.openedEnchantTablePos) return;

    const pos = this.openedEnchantTablePos;
    if (this.world.getBlock(pos.x, pos.y, pos.z) !== BlockType.ENCHANTING_TABLE) {
      es.closeEnchantPanel();
      this.openedEnchantTablePos = null;
      useUIStore.getState().showFeedback('エンチャント台が破壊されました');
      return;
    }

    const dx = this.player.position.x - (pos.x + 0.5);
    const dy = this.player.position.y - (pos.y + 0.5);
    const dz = this.player.position.z - (pos.z + 0.5);
    if (dx * dx + dy * dy + dz * dz > CHEST_AUTO_CLOSE_DISTANCE * CHEST_AUTO_CLOSE_DISTANCE) {
      es.closeEnchantPanel();
      this.openedEnchantTablePos = null;
      useUIStore.getState().showFeedback('エンチャント台から離れました');
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

  // ---- 弓射撃 ----

  _tryFireBow(now) {
    if (now - this.lastPlaceTime < 600) return; // 弓は0.6秒のクールダウン

    // 矢が必要
    const arrowCount = useInventoryStore.getState().getCount(BlockType.ARROW);
    if (arrowCount <= 0) {
      useUIStore.getState().showFeedback('矢がありません！', 800);
      this.sound.playError();
      return;
    }

    const eyePos = this.player.getEyePosition();
    const dir = this.player.getDirection();
    const BOW_RANGE = 24;

    // 射程内のモブへレイキャスト
    const mobHit = this.mobManager.raycastMobs(eyePos, dir, BOW_RANGE);

    this.lastPlaceTime = now;
    this._consumeFromInventory(BlockType.ARROW);

    if (mobHit) {
      const { mob, distance } = mobHit;
      // 距離に応じてダメージ減衰（近距離ほど強い）
      const dmg = Math.max(2, Math.round(5 * (1 - distance / BOW_RANGE)));
      mob.takeDamage(dmg);
      mob.flashHit();
      if (!mob.isAlive && typeof mob.drops === 'function') {
        for (const { type, count } of mob.drops()) {
          this.droppedItemManager.spawn(mob.position.x, mob.position.y, mob.position.z, type, count);
        }
        const name = mob.name ?? (mob.isAnimal ? '動物' : 'モブ');
        useUIStore.getState().showFeedback(`弓で${name}を倒した！`, 1200);
      } else {
        useUIStore.getState().showFeedback(`弓攻撃命中！ -${dmg} HP`, 700);
      }
    } else {
      useUIStore.getState().showFeedback('弓を放った（空振り）', 700);
    }
    this.sound.playBreak();
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

    const stats = FOOD_STATS[selectedType] ?? { restore: APPLE_HUNGER_RESTORE, name: '食料' };

    if (this.getInventoryCount(selectedType) <= 0) {
      useUIStore.getState().showFeedback(`${stats.name}がありません`, 800);
      this.sound.playError();
      return;
    }

    this._consumeFromInventory(selectedType);
    hungerStore.feedHunger(stats.restore);
    useUIStore.getState().showFeedback(`${stats.name}を食べた！ 空腹 +${stats.restore}`, 1000);
    this.sound.playEat();
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

  // たいまつのPointLightをシーンに追加
  _addTorchLight(x, y, z) {
    const key = getPosKey(x, y, z);
    if (this._torchLights.has(key)) return;
    const light = new THREE.PointLight(0xffaa33, 1.8, 14);
    light.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.scene.add(light);
    this._torchLights.set(key, light);
  }

  // たいまつのPointLightをシーンから削除
  _removeTorchLight(x, y, z) {
    const key = getPosKey(x, y, z);
    const light = this._torchLights.get(key);
    if (light) {
      this.scene.remove(light);
      this._torchLights.delete(key);
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

    // 弓: 矢を消費して遠距離攻撃
    if (placeType === BlockType.BOW) {
      this._tryFireBow(now);
      return;
    }

    const hit = this.world.raycast(this.player.getEyePosition(), this.player.getDirection());

    // 右クリックで作業台クラフトパネルを開く（手が空でも可）
    if (hit && hit.blockType === BlockType.CRAFTING_TABLE) {
      useUIStore.getState().openCraftPanel('crafting_table');
      this.openedCraftingTablePos = hit.blockPos;
      this.openedRepairTablePos = null;
      if (document.pointerLockElement === document.body) {
        document.exitPointerLock();
      }
      return;
    }

    // 右クリックで修理台クラフトパネルを開く（手が空でも可）
    if (hit && hit.blockType === BlockType.REPAIR_TABLE) {
      useUIStore.getState().openCraftPanel('repair_table');
      this.openedRepairTablePos = hit.blockPos;
      this.openedCraftingTablePos = null;
      if (document.pointerLockElement === document.body) {
        document.exitPointerLock();
      }
      return;
    }

    // 右クリックでチェストを開く（手が空でも可）
    if (hit && hit.blockType === BlockType.CHEST) {
      this._openChestAt(hit.blockPos);
      return;
    }

    // 右クリックでかまどを開く（手が空でも可）
    if (hit && hit.blockType === BlockType.FURNACE) {
      useUIStore.getState().openFurnacePanel();
      this.openedFurnacePos = hit.blockPos;
      useAchievementStore.getState().unlock('first_furnace');
      if (document.pointerLockElement === document.body) {
        document.exitPointerLock();
      }
      return;
    }

    // 右クリックでエンチャント台を開く（手が空でも可）
    if (hit && hit.blockType === BlockType.ENCHANTING_TABLE) {
      this._enchantmentStore.getState().openEnchantPanel();
      this.openedEnchantTablePos = hit.blockPos;
      if (document.pointerLockElement === document.body) {
        document.exitPointerLock();
      }
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
    // たいまつ設置時にPointLightを追加
    if (placeType === BlockType.TORCH) {
      this._addTorchLight(pp.x, pp.y, pp.z);
    }

    // 設置パーティクル
    const placeMat = this.blockMaterials[placeType]?.top ?? this.blockMaterials[1]?.top;
    if (placeMat) {
      this.particleManager.spawnPlace(pp.x, pp.y, pp.z, placeMat.clone());
    }

    this.sound.playPlace();
  }

  _updateBreaking(hit, now) {
    // 岩盤は破壊不可
    if (hit.blockType === BlockType.BEDROCK) {
      this._resetBreaking();
      return;
    }

    const selectedTool = useToolStore.getState().selectedTool;
    // ツールを持っていない場合は補正なし（素手扱い）
    const toolItemType = TOOL_TYPE_TO_ITEM[selectedTool];
    const hasTool = toolItemType != null && useInventoryStore.getState().getCount(toolItemType) > 0;
    const key = `${getPosKey(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z)}|${selectedTool}|${hasTool}`;
    const baseDuration = BLOCK_BREAK_DURATIONS[hit.blockType] ?? 0.5;
    const multiplier = hasTool ? getToolBreakMultiplier(selectedTool, hit.blockType) : 1;
    // エンチャント: 効率強化の補正
    const _enchStore = this._enchantmentStore;
    let enchantMult = 1;
    if (_enchStore) {
      const slotKey = `slot_${useInventoryStore.getState().selectedSlot}`;
      const effLv = _enchStore.getState().getEnchantLevel(slotKey, 'efficiency');
      if (effLv > 0) enchantMult = 1 + effLv * 0.35;
    }
    const duration = Math.max(0.08, baseDuration / (multiplier * enchantMult));

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

      // ブロックを床にドロップ（石→丸石など上書き対応）
      const dropType = BLOCK_DROP_OVERRIDES[hit.blockType] ?? hit.blockType;
      this.droppedItemManager.spawn(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, dropType, 1);
      // 葉ブロック破壊時に30%の確率でリンゴをドロップ
      if ((hit.blockType === BlockType.LEAVES || hit.blockType === BlockType.JUNGLE_LEAVES) && Math.random() < 0.3) {
        this.droppedItemManager.spawn(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, BlockType.APPLE, 1);
      }
      // 破壊パーティクルを生成（ブロックの上面マテリアルを使用）
      const breakMat = this.blockMaterials[hit.blockType]?.top ?? this.blockMaterials[1]?.top;
      if (breakMat) {
        this.particleManager.spawnBreak(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, breakMat.clone());
        // 葉ブロックはゆっくり落下する葉パーティクルを追加
        if (hit.blockType === BlockType.LEAVES) {
          this.particleManager.spawnLeafFall(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, breakMat.clone());
        }
      }

      // たいまつ破壊時にPointLightを削除
      if (hit.blockType === BlockType.TORCH) {
        this._removeTorchLight(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z);
      }
      this.world.setBlockWithDiff(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, BlockType.AIR);
      this.sound.playBreak();

      // ブロック採掘実績チェック
      this._checkMiningAchievement(hit.blockType, dropType);

      // ツール耐久値を消耗
      if (hasTool && selectedTool) {
        const durStore = useDurabilityStore.getState();
        const broke = durStore.damage(selectedTool);
        if (broke) {
          useInventoryStore.getState().consumeItem(toolItemType, 1);
          durStore.resetTool(selectedTool);
          useUIStore.getState().showFeedback(`${TOOL_NAMES[selectedTool]}が壊れました！`, 1500);
          this.sound.playError();
        }
      }

      this._resetBreaking();
    }
  }

  // ---- モブシステム ----

  _updateMobs(dt, isDay) {
    if (useGameStore.getState().isDead) return;

    this.mobManager.update(
      dt,
      this.player.position,
      isDay,
      // 通常攻撃コールバック
      (damage, mobX, mobZ) => {
        const actualDamage = this.player.applyDamage(damage);
        if (actualDamage > 0) {
          this.player.applyKnockback(mobX, mobZ, KNOCKBACK_PLAYER_FORCE);
          useUIStore.getState().showHitFlash();
          useUIStore.getState().showFeedback(`モブに攻撃された！ -${actualDamage} HP`, 900);
          this.sound.playPlayerHit();
          this.sound.notifyCombat();
          if (this.player.health <= 0 && !useGameStore.getState().isDead) {
            useGameStore.getState().setDead(true);
            document.exitPointerLock();
          }
        }
      },
      // 爆発コールバック
      (ex, ey, ez, radius, damage) => {
        // 爆発範囲のブロックを除去
        const r = Math.ceil(radius);
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dz = -r; dz <= r; dz++) {
              if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
              const bx = ex + dx, by = ey + dy, bz = ez + dz;
              const bt = this.world.getBlock(bx, by, bz);
              if (bt !== BlockType.AIR && bt !== BlockType.BEDROCK) {
                if (bt === BlockType.TORCH) this._removeTorchLight(bx, by, bz);
                this.world.setBlockWithDiff(bx, by, bz, BlockType.AIR);
              }
            }
          }
        }
        // プレイヤーへのダメージ
        const pdx = this.player.position.x - ex;
        const pdy = this.player.position.y - ey;
        const pdz = this.player.position.z - ez;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz);
        if (pdist < radius + 2) {
          const scaledDamage = Math.round(damage * Math.max(0, 1 - pdist / (radius + 2)));
          if (scaledDamage > 0) {
            const actualDamage = this.player.applyDamage(scaledDamage);
            if (actualDamage > 0) {
              useUIStore.getState().showHitFlash();
              useUIStore.getState().showFeedback(`クリーパーが爆発した！ -${actualDamage} HP`, 1200);
              this.sound.playCreeperExplode();
              if (this.player.health <= 0 && !useGameStore.getState().isDead) {
                useGameStore.getState().setDead(true);
                document.exitPointerLock();
              }
            }
          }
        }
      }
    );
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
    let damage = selectedTool != null ? PLAYER_ATTACK_DAMAGE_TOOL : PLAYER_ATTACK_DAMAGE_BASE;
    // エンチャント: 鋭さの補正
    if (this._enchantmentStore) {
      const slotKey = `slot_${useInventoryStore.getState().selectedSlot}`;
      const sharpLv = this._enchantmentStore.getState().getEnchantLevel(slotKey, 'sharpness');
      if (sharpLv > 0) damage += sharpLv * 1.5;
    }

    mob.takeDamage(damage);
    mob.flashHit();
    mob.applyKnockback(this.player.position.x, this.player.position.z, KNOCKBACK_MOB_FORCE);

    this._attackCooldown = PLAYER_ATTACK_COOLDOWN;
    this.sound.playMeleeHit();
    this.sound.notifyCombat(); // 戦闘BGMに切り替え

    if (!mob.isAlive) {
      this.sound.playMobDeath();
      // ドロップアイテムをスポーン
      if (typeof mob.drops === 'function') {
        for (const { type, count } of mob.drops()) {
          this.droppedItemManager.spawn(mob.position.x, mob.position.y, mob.position.z, type, count);
        }
      }
      const name = mob.name ?? (mob.isAnimal ? '動物' : 'モブ');
      // XP付与
      const xpReward = MOB_XP_REWARDS[name] ?? 3;
      const { levelUp, newLevel } = useXpStore.getState().addXp(xpReward);
      if (levelUp) {
        useUIStore.getState().showFeedback(`レベルアップ！ Lv.${newLevel} ✨ (+${xpReward} XP)`, 2000);
        this.sound.playPlace(); // レベルアップ音
        // レベル実績チェック
        if (newLevel >= 5)  useAchievementStore.getState().unlock('reach_level5');
        if (newLevel >= 10) useAchievementStore.getState().unlock('reach_level10');
      } else {
        useUIStore.getState().showFeedback(`${name}を倒した！ +${xpReward} XP`, 1200);
      }
      // 初討伐実績
      useAchievementStore.getState().unlock('first_kill');
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
    this.dirLight.intensity = 0.1 + (daylight * 0.65);
    this.dirLight.position.set(
      Math.cos(sunAngle) * 90,
      18 + (sunHeight * 110),
      Math.sin(sunAngle) * 65,
    );

    return { cycleRatio, sunAngle, daylight, isDay: daylight >= 0.5 };
  }

  // ---- Game Loop ----

  _gameLoop(time) {
    requestAnimationFrame((t) => this._gameLoop(t));

    const targetFps = this.targetFps || DEFAULT_SETTINGS.targetFps;
    const minFrameMs = 1000 / targetFps;
    if (time - this.lastFrameTime < minFrameMs) {
      return;
    }
    this.lastFrameTime = time;

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

    // スカイドーム更新（常時）
    if (this.gameStarted) {
      this.skyDome.update(dayNight.sunAngle, dayNight.daylight, this.player.position, dt);
      // シャドウカメラをプレイヤーに追従させる
      this.dirLight.target.position.set(
        this.player.position.x,
        this.player.position.y,
        this.player.position.z
      );
      this.dirLight.target.updateMatrixWorld();
    }

    if (this.gameStarted && !useGameStore.getState().paused) {
      // 死亡中はプレイヤー物理・移動を更新しない
      if (!useGameStore.getState().isDead) {
        // プレイヤー物理・移動はパネルが開いていても常に更新
        const jumpRequested = Boolean(this.player.keys['Space'] && this.player.onGround);
        const fallingSpeedBeforeUpdate = this.player.velocity.y;

        this.player.update(dt);

        if (jumpRequested && !this.player.onGround && this.player.velocity.y > 0) {
          this.sound.playJump();
        }

        if (!this.wasOnGround && this.player.onGround && fallingSpeedBeforeUpdate < -1.5) {
          const landSpeed = Math.abs(fallingSpeedBeforeUpdate);
          this.sound.playLand(Math.min(landSpeed / 8, 2));

          // 落下着地パーティクル（一定以上の速度の時）
          if (landSpeed > 5) {
            const intensity = Math.min((landSpeed - 5) / 10, 2);
            this.particleManager.spawnLand(
              this.player.position.x, this.player.position.y,
              this.player.position.z, intensity
            );
          }

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
      }

      this.world.update(this.player.position.x, this.player.position.z, this.camera);
      this._validateOpenedChest();
      this._validateOpenedTable();
      this._validateOpenedFurnace();
      this._validateOpenedEnchantTable();

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
      const prevIsDay = this._prevIsDay;
      useDayNightStore.getState().update(dayNight.cycleRatio, dayNight.isDay);
      // 昼夜切り替わり時にBGMを変更（戦闘中でなければ）
      if (prevIsDay !== dayNight.isDay && this.sound.bgmStarted && this.sound._bgmMode !== 'combat') {
        this.sound.setBGMMode(dayNight.isDay ? 'day' : 'night');
        // 夜→朝に変わった時（=夜を生き延びた）
        if (dayNight.isDay && prevIsDay === false && !useGameStore.getState().isDead) {
          useAchievementStore.getState().unlock('night_survive');
        }
      }
      this._prevIsDay = dayNight.isDay;
      usePlayerStore.getState().syncFromPlayer(this.player);

      const eyePos = this.player.getEyePosition();
      const eyeBlock = this.world.getBlock(
        Math.floor(eyePos.x),
        Math.floor(eyePos.y),
        Math.floor(eyePos.z)
      );
      useUIStore.getState().setWaterOverlay(eyeBlock === BlockType.WATER);

      this.survivalSystem.update(dt, this.world);
      this._updateMobs(dt, dayNight.isDay);
      this._updateDroppedItems(dt);
      this.particleManager.update(dt);
    } else {
      // タイトル画面
      useDayNightStore.getState().update(dayNight.cycleRatio, dayNight.isDay);
      this.highlightMesh.visible = false;
      this._resetBreaking();
      useUIStore.getState().setWaterOverlay(false);
      this.wasOnGround = this.player.onGround;
      usePlayerStore.getState().syncFromPlayer(this.player);
      this._validateOpenedChest();
      this._validateOpenedFurnace();
      this._validateOpenedEnchantTable();
    }

    // 水・溶岩テクスチャアニメーション（UVスクロール）
    if (this.gameStarted) {
      this._waterAnimTime += dt;
      this._lavaAnimTime += dt * 0.25;
      if (this._waterMaterials) {
        for (const mat of this._waterMaterials) {
          if (mat.map) {
            mat.map.offset.set(
              Math.sin(this._waterAnimTime * 0.4) * 0.08,
              this._waterAnimTime * 0.06
            );
            mat.map.needsUpdate = true;
          }
        }
      }
      if (this._lavaMaterials) {
        for (const mat of this._lavaMaterials) {
          if (mat.map) {
            mat.map.offset.set(
              Math.sin(this._lavaAnimTime * 0.3) * 0.05,
              this._lavaAnimTime * 0.04
            );
            mat.map.needsUpdate = true;
          }
          // 溶岩の脈動発光
          mat.emissiveIntensity = 0.65 + Math.sin(this._lavaAnimTime * 1.8) * 0.25;
        }
      }
    }

    // タイトル画面ではThree.jsレンダリングをスキップ（シェーダーコンパイルによるフリーズを防ぐ）
    // スタート画面がcanvasを覆っているため描画は不要
    if (this.gameStarted) {
      this.composer.render();
    }
  }
}
