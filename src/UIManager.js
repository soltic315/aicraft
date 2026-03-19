// UI rendering and DOM management
import { BLOCK_NAMES } from './blocks.js';
import { generateBlockIcon } from './blocks.js';
import {
  HOTBAR_BLOCKS,
  CRAFT_RECIPES,
  CHEST_STORAGE_LIMIT,
  GAME_VERSION,
  clamp,
} from './config.js';

export class UIManager {
  constructor(eventBus) {
    this.eventBus = eventBus;

    // Cache DOM elements
    this.hud = document.getElementById('hud');
    this.craftPanel = document.getElementById('craft-panel');
    this.craftListEl = document.getElementById('craft-list');
    this.craftHintEl = document.getElementById('craft-hint');
    this.chestPanel = document.getElementById('chest-panel');
    this.chestStorageListEl = document.getElementById('chest-storage-list');
    this.chestPlayerListEl = document.getElementById('chest-player-list');
    this.chestHintEl = document.getElementById('chest-hint');
    this.actionFeedbackEl = document.getElementById('action-feedback');
    this.breakProgressEl = document.getElementById('break-progress');
    this.breakProgressFillEl = document.getElementById('break-progress-fill');
    this.startScreen = document.getElementById('start-screen');
    this.startBtn = document.getElementById('start-btn');
    this.settingsPanel = document.getElementById('settings-panel');
    this.settingSensitivity = document.getElementById('setting-sensitivity');
    this.settingSensitivityValue = document.getElementById('setting-sensitivity-value');
    this.settingBgm = document.getElementById('setting-bgm');
    this.settingBgmValue = document.getElementById('setting-bgm-value');
    this.settingSe = document.getElementById('setting-se');
    this.settingSeValue = document.getElementById('setting-se-value');
    this.settingRenderDistance = document.getElementById('setting-render-distance');
    this.settingRenderDistanceValue = document.getElementById('setting-render-distance-value');
    this.loadingScreen = document.getElementById('loading-screen');
    this.loadingText = document.getElementById('loading-text');
    this.gameTitle = document.getElementById('game-title');
    this.resumeHint = document.getElementById('resume-hint');
    this.waterOverlay = document.getElementById('water-overlay');
    this.mobileWarning = document.getElementById('mobile-warning');
    this.infoEl = document.getElementById('info');
    this.healthFillEl = document.getElementById('health-fill');
    this.healthValueEl = document.getElementById('health-value');
    this.saveBtn = document.getElementById('save-btn');
    this.deleteSaveBtn = document.getElementById('delete-save-btn');

    this.feedbackTimeout = null;
  }

  init(hasSavedGame) {
    if (this.gameTitle) {
      this.gameTitle.textContent = `AiCraft v${GAME_VERSION}`;
    }
    document.title = `AiCraft v${GAME_VERSION}`;

    if (hasSavedGame && this.startBtn) {
      this.startBtn.textContent = '続きからプレイ';
    }

    if (this.mobileWarning && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      this.mobileWarning.style.display = 'block';
    }

    this._setupUIListeners();
  }

  _setupUIListeners() {
    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => {
        this.eventBus.emit('start-clicked');
      });
    }

    if (this.saveBtn) {
      this.saveBtn.addEventListener('click', () => {
        this.eventBus.emit('save-clicked');
      });
    }

    if (this.deleteSaveBtn) {
      this.deleteSaveBtn.addEventListener('click', () => {
        this.eventBus.emit('delete-save-clicked');
      });
    }
  }

  setupSettingsListeners(settings, onSettingsChanged) {
    if (this.settingSensitivity && this.settingSensitivityValue) {
      this.settingSensitivity.addEventListener('input', () => {
        settings.sensitivity = clamp(Number(this.settingSensitivity.value) / 1000, 0.0005, 0.004);
        this.settingSensitivityValue.textContent = Number(this.settingSensitivity.value).toFixed(1);
        onSettingsChanged();
      });
    }

    if (this.settingBgm && this.settingBgmValue) {
      this.settingBgm.addEventListener('input', () => {
        settings.bgmVolume = clamp(Number(this.settingBgm.value) / 100, 0, 1);
        this.settingBgmValue.textContent = this.settingBgm.value;
        onSettingsChanged();
      });
    }

    if (this.settingSe && this.settingSeValue) {
      this.settingSe.addEventListener('input', () => {
        settings.seVolume = clamp(Number(this.settingSe.value) / 100, 0, 1);
        this.settingSeValue.textContent = this.settingSe.value;
        onSettingsChanged();
      });
    }

    if (this.settingRenderDistance && this.settingRenderDistanceValue) {
      this.settingRenderDistance.addEventListener('input', () => {
        settings.renderDistance = clamp(Math.floor(Number(this.settingRenderDistance.value)), 2, 8);
        this.settingRenderDistanceValue.textContent = String(settings.renderDistance);
        onSettingsChanged();
      });
    }
  }

  updateSettingsValues(settings) {
    if (
      !this.settingSensitivity ||
      !this.settingSensitivityValue ||
      !this.settingBgm ||
      !this.settingBgmValue ||
      !this.settingSe ||
      !this.settingSeValue ||
      !this.settingRenderDistance ||
      !this.settingRenderDistanceValue
    ) {
      return;
    }

    this.settingSensitivity.value = (settings.sensitivity * 1000).toFixed(1);
    this.settingSensitivityValue.textContent = Number(this.settingSensitivity.value).toFixed(1);

    this.settingBgm.value = String(Math.round(settings.bgmVolume * 100));
    this.settingBgmValue.textContent = this.settingBgm.value;

    this.settingSe.value = String(Math.round(settings.seVolume * 100));
    this.settingSeValue.textContent = this.settingSe.value;

    this.settingRenderDistance.value = String(settings.renderDistance);
    this.settingRenderDistanceValue.textContent = this.settingRenderDistance.value;
  }

  getSlotLabel(index) {
    if (index === 9) return '0';
    return String(index + 1);
  }

  buildHotbar(selectedSlot, getInventoryCount) {
    if (!this.hud) return;
    this.hud.innerHTML = '';
    HOTBAR_BLOCKS.forEach((type, i) => {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot' + (i === selectedSlot ? ' active' : '');
      const num = document.createElement('span');
      num.className = 'slot-num';
      num.textContent = this.getSlotLabel(i);
      slot.appendChild(num);
      const icon = generateBlockIcon(type);
      if (icon) slot.appendChild(icon);

      const count = document.createElement('span');
      count.className = 'slot-count';
      count.textContent = getInventoryCount(type);
      slot.appendChild(count);

      this.hud.appendChild(slot);
    });
  }

  renderCraftPanel(hasRecipeIngredients, onCraft) {
    if (!this.craftListEl) return;

    this.craftListEl.innerHTML = '';
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
        onCraft(recipe);
      });

      row.appendChild(text);
      row.appendChild(craftBtn);
      this.craftListEl.appendChild(row);
    });

    if (this.craftHintEl) {
      const available = CRAFT_RECIPES.filter(hasRecipeIngredients).length;
      this.craftHintEl.textContent = available > 0
        ? `作成可能レシピ: ${available} 件`
        : '素材が足りるレシピのみクラフトできます。';
    }
  }

  renderChestPanel(chestData, chestPos, getInventoryCount, onWithdraw, onDeposit) {
    if (!this.chestPanel || !this.chestStorageListEl || !this.chestPlayerListEl || !this.chestHintEl) return;

    if (!chestData) {
      this.chestPanel.style.display = 'none';
      return;
    }

    this.chestPanel.style.display = 'block';
    const totalItems = Object.values(chestData).reduce((sum, v) => sum + (Number(v) || 0), 0);

    this.chestStorageListEl.innerHTML = '';
    this.chestPlayerListEl.innerHTML = '';

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
      withdrawBtn.addEventListener('click', () => onWithdraw(type));
      chestRow.appendChild(chestText);
      chestRow.appendChild(withdrawBtn);
      this.chestStorageListEl.appendChild(chestRow);

      const invCount = getInventoryCount(type);
      const invRow = document.createElement('div');
      invRow.className = 'chest-row';
      const invText = document.createElement('span');
      invText.textContent = `${BLOCK_NAMES[type]} x${invCount}`;
      const depositBtn = document.createElement('button');
      depositBtn.type = 'button';
      depositBtn.textContent = '収納する';
      depositBtn.disabled = invCount <= 0 || totalItems >= CHEST_STORAGE_LIMIT;
      depositBtn.addEventListener('click', () => onDeposit(type));
      invRow.appendChild(invText);
      invRow.appendChild(depositBtn);
      this.chestPlayerListEl.appendChild(invRow);
    });

    this.chestHintEl.textContent =
      `座標: (${chestPos.x}, ${chestPos.y}, ${chestPos.z}) / 合計: ${totalItems} / ${CHEST_STORAGE_LIMIT}`;
  }

  hideChestPanel() {
    if (this.chestPanel) {
      this.chestPanel.style.display = 'none';
    }
  }

  showActionFeedback(message, durationMs = 1200) {
    if (!this.actionFeedbackEl) return;
    this.actionFeedbackEl.textContent = message;
    this.actionFeedbackEl.style.opacity = '1';

    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
    this.feedbackTimeout = setTimeout(() => {
      this.actionFeedbackEl.style.opacity = '0';
      this.feedbackTimeout = null;
    }, durationMs);
  }

  showBreakProgress(progress) {
    if (this.breakProgressEl && this.breakProgressFillEl) {
      this.breakProgressEl.style.display = 'block';
      this.breakProgressFillEl.style.width = `${Math.floor(progress * 100)}%`;
    }
  }

  hideBreakProgress() {
    if (this.breakProgressEl && this.breakProgressFillEl) {
      this.breakProgressEl.style.display = 'none';
      this.breakProgressFillEl.style.width = '0%';
    }
  }

  updateHealthHud(health, maxHealth) {
    if (!this.healthFillEl || !this.healthValueEl) return;
    const ratio = Math.max(0, Math.min(1, health / maxHealth));
    this.healthFillEl.style.width = `${Math.round(ratio * 100)}%`;
    this.healthValueEl.textContent = `${Math.round(health)} / ${maxHealth}`;
  }

  updateInfo(fps, dayNight, position, health, maxHealth, blockName, selectedCount) {
    if (!this.infoEl) return;
    this.infoEl.innerHTML =
      `FPS: ${fps}<br>` +
      `時刻: ${dayNight.isDay ? '昼' : '夜'} (${Math.floor(dayNight.cycleRatio * 24).toString().padStart(2, '0')}:00)<br>` +
      `座標: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}<br>` +
      `体力: ${Math.round(health)} / ${maxHealth}<br>` +
      `選択: ${blockName} x${selectedCount}`;
  }

  setWaterOverlay(visible) {
    if (this.waterOverlay) {
      this.waterOverlay.style.display = visible ? 'block' : 'none';
    }
  }

  setResumeHint(visible) {
    if (this.resumeHint) {
      this.resumeHint.style.display = visible ? 'block' : 'none';
    }
  }

  togglePanel(panel) {
    if (!panel) return false;
    const isNowVisible = panel.style.display !== 'block';
    panel.style.display = isNowVisible ? 'block' : 'none';
    return isNowVisible;
  }

  showStartScreen() {
    if (this.startScreen) this.startScreen.style.display = 'flex';
  }

  hideStartScreen() {
    if (this.startScreen) this.startScreen.style.display = 'none';
  }

  showLoadingScreen(message) {
    if (this.loadingScreen) this.loadingScreen.style.display = 'flex';
    if (this.loadingText) this.loadingText.textContent = message;
  }

  hideLoadingScreen() {
    if (this.loadingScreen) this.loadingScreen.style.display = 'none';
  }
}
