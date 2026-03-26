// ブロック操作システム: ブロック設置・破壊・たいまつライト管理
import * as THREE from 'three';
import {
  BlockType,
  BLOCK_BREAK_DURATIONS,
  BLOCK_DROP_OVERRIDES,
} from '../blocks.js';
import {
  PLACE_COOLDOWN,
  FOOD_ITEMS,
  TOOL_ITEMS,
  getPosKey,
} from '../config.js';
import { useInventoryStore } from '../stores/inventoryStore.js';
import { useChestStore } from '../stores/chestStore.js';
import { useBreakStore } from '../stores/breakStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { useToolStore } from '../stores/toolStore.js';
import { useDurabilityStore } from '../stores/durabilityStore.js';
import { useAchievementStore } from '../stores/achievementStore.js';
import { getToolBreakMultiplier as _getToolBreakMultiplier, TOOL_NAMES as _TOOL_NAMES, TOOL_TYPE_TO_ITEM as _TOOL_TYPE_TO_ITEM } from '../tools.js';

export class BlockInteractionSystem {
  constructor(gc) {
    this.gc = gc;
  }

  resetBreaking() {
    this.gc.breakState.key = null;
    this.gc.breakState.duration = 0;
    this.gc.breakState.startedAt = 0;
    this.gc.breakState.blockType = BlockType.AIR;
    this.gc.breakState.toolType = null;
    this.gc.breakOverlayMesh.visible = false;
    useBreakStore.getState().reset();
  }

  setBreakOverlayStage(stageIndex) {
    const textureSource = this.gc.breakOverlayTextures[stageIndex];
    if (!textureSource) return;

    for (const material of this.gc.breakOverlayMaterials) {
      material.map.image = textureSource;
      material.map.needsUpdate = true;
    }
  }

  // たいまつのPointLightをシーンに追加
  addTorchLight(x, y, z) {
    const key = getPosKey(x, y, z);
    if (this.gc._torchLights.has(key)) return;
    const light = new THREE.PointLight(0xffaa33, 2.0, 22);
    light.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.gc.scene.add(light);
    this.gc._torchLights.set(key, light);
  }

  // たいまつのPointLightをシーンから削除
  removeTorchLight(x, y, z) {
    const key = getPosKey(x, y, z);
    const light = this.gc._torchLights.get(key);
    if (light) {
      this.gc.scene.remove(light);
      this.gc._torchLights.delete(key);
    }
  }

  tryPlaceBlock(now) {
    if (now - this.gc.lastPlaceTime < PLACE_COOLDOWN) return;

    const { selectedSlot, slots } = useInventoryStore.getState();
    const placeType = slots[selectedSlot]?.type ?? null;

    // 食料アイテムはブロックを見ていなくても右クリックで食べる
    if (placeType != null && FOOD_ITEMS.has(placeType)) {
      this.gc._tryEatFood(placeType);
      return;
    }

    // 弓: 矢を消費して遠距離攻撃
    if (placeType === BlockType.BOW) {
      this.gc._tryFireBow(now);
      return;
    }

    const hit = this.gc.world.raycast(this.gc.player.getEyePosition(), this.gc.player.getDirection());

    // 右クリックで作業台クラフトパネルを開く（手が空でも可）
    if (hit && hit.blockType === BlockType.CRAFTING_TABLE) {
      useUIStore.getState().openCraftPanel('crafting_table');
      this.gc.openedCraftingTablePos = hit.blockPos;
      this.gc.openedRepairTablePos = null;
      if (document.pointerLockElement === document.body) {
        document.exitPointerLock();
      }
      return;
    }

    // 右クリックで修理台クラフトパネルを開く（手が空でも可）
    if (hit && hit.blockType === BlockType.REPAIR_TABLE) {
      useUIStore.getState().openCraftPanel('repair_table');
      this.gc.openedRepairTablePos = hit.blockPos;
      this.gc.openedCraftingTablePos = null;
      if (document.pointerLockElement === document.body) {
        document.exitPointerLock();
      }
      return;
    }

    // 右クリックでチェストを開く（手が空でも可）
    if (hit && hit.blockType === BlockType.CHEST) {
      this.gc._openChestAt(hit.blockPos);
      return;
    }

    // 右クリックでかまどを開く（手が空でも可）
    if (hit && hit.blockType === BlockType.FURNACE) {
      useUIStore.getState().openFurnacePanel();
      this.gc.openedFurnacePos = hit.blockPos;
      useAchievementStore.getState().unlock('first_furnace');
      if (document.pointerLockElement === document.body) {
        document.exitPointerLock();
      }
      return;
    }

    // 右クリックでエンチャント台を開く（手が空でも可）
    if (hit && hit.blockType === BlockType.ENCHANTING_TABLE) {
      this.gc._enchantmentStore.getState().openEnchantPanel();
      this.gc.openedEnchantTablePos = hit.blockPos;
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
      this.gc.sound.playError();
      return;
    }

    // ツールアイテムは設置不可
    if (TOOL_ITEMS.has(placeType)) {
      useUIStore.getState().showFeedback('ツールは設置できません', 800);
      this.gc.sound.playError();
      return;
    }

    if (this.gc.getInventoryCount(placeType) <= 0) {
      useUIStore.getState().showFeedback('設置失敗: 所持数が不足しています');
      this.gc.sound.playError();
      return;
    }

    const pp = hit.placePos;
    if (this.gc.player.intersectsBlock(pp.x, pp.y, pp.z)) {
      useUIStore.getState().showFeedback('設置失敗: プレイヤーと衝突します');
      this.gc.sound.playError();
      return;
    }

    this.gc.lastPlaceTime = now;

    if (!this.gc._consumeFromInventory(placeType)) return;
    this.gc.world.setBlockWithDiff(pp.x, pp.y, pp.z, placeType);
    if (placeType === BlockType.CHEST) {
      useChestStore.getState().getChestData(pp, true);
    }
    // たいまつ設置時にPointLightを追加
    if (placeType === BlockType.TORCH) {
      this.addTorchLight(pp.x, pp.y, pp.z);
    }

    // 設置パーティクル
    const placeMat = this.gc.blockMaterials[placeType]?.top ?? this.gc.blockMaterials[1]?.top;
    if (placeMat) {
      this.gc.particleManager.spawnPlace(pp.x, pp.y, pp.z, placeMat.clone());
    }

    this.gc.sound.playPlace();
  }

  updateBreaking(hit, now) {
    // 岩盤は破壊不可
    if (hit.blockType === BlockType.BEDROCK) {
      this.resetBreaking();
      return;
    }

    const selectedTool = useToolStore.getState().selectedTool;
    // ツールを持っていない場合は補正なし（素手扱い）
    const toolItemType = _TOOL_TYPE_TO_ITEM[selectedTool];
    const hasTool = toolItemType != null && useInventoryStore.getState().getCount(toolItemType) > 0;
    const key = `${getPosKey(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z)}|${selectedTool}|${hasTool}`;
    const baseDuration = BLOCK_BREAK_DURATIONS[hit.blockType] ?? 0.5;
    const multiplier = hasTool ? _getToolBreakMultiplier(selectedTool, hit.blockType) : 1;
    // エンチャント: 効率強化の補正
    const _enchStore = this.gc._enchantmentStore;
    let enchantMult = 1;
    if (_enchStore) {
      const slotKey = `slot_${useInventoryStore.getState().selectedSlot}`;
      const effLv = _enchStore.getState().getEnchantLevel(slotKey, 'efficiency');
      if (effLv > 0) enchantMult = 1 + effLv * 0.35;
    }
    const duration = Math.max(0.08, baseDuration / (multiplier * enchantMult));

    if (this.gc.breakState.key !== key) {
      this.gc.breakState.key = key;
      this.gc.breakState.duration = duration;
      this.gc.breakState.startedAt = now;
      this.gc.breakState.blockType = hit.blockType;
      this.gc.breakState.toolType = selectedTool;
    }

    const elapsed = (now - this.gc.breakState.startedAt) / 1000;
    const progress = Math.min(elapsed / this.gc.breakState.duration, 1);
    const stageIndex = Math.min(
      this.gc.breakOverlayTextures.length - 1,
      Math.floor(progress * this.gc.breakOverlayTextures.length)
    );

    this.gc.breakOverlayMesh.visible = true;
    this.gc.breakOverlayMesh.position.set(
      hit.blockPos.x + 0.5,
      hit.blockPos.y + 0.5,
      hit.blockPos.z + 0.5
    );
    this.setBreakOverlayStage(stageIndex);
    useBreakStore.getState().setProgress(progress);

    if (progress >= 1) {
      if (hit.blockType === BlockType.CHEST) {
        const recovered = this.gc._recoverChestItems(hit.blockPos);
        if (recovered > 0) {
          useUIStore.getState().showFeedback(`チェスト回収: 中身 ${recovered} 個を取得`, 1200);
        }
      }

      // ブロックを床にドロップ（石→丸石など上書き対応）
      const dropType = BLOCK_DROP_OVERRIDES[hit.blockType] ?? hit.blockType;
      this.gc.droppedItemManager.spawn(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, dropType, 1);
      // 葉ブロック破壊時に30%の確率でリンゴをドロップ
      if ((hit.blockType === BlockType.LEAVES || hit.blockType === BlockType.JUNGLE_LEAVES) && Math.random() < 0.3) {
        this.gc.droppedItemManager.spawn(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, BlockType.APPLE, 1);
      }
      // 破壊パーティクルを生成（ブロックの上面マテリアルを使用）
      const breakMat = this.gc.blockMaterials[hit.blockType]?.top ?? this.gc.blockMaterials[1]?.top;
      if (breakMat) {
        this.gc.particleManager.spawnBreak(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, breakMat.clone());
        // 葉ブロックはゆっくり落下する葉パーティクルを追加
        if (hit.blockType === BlockType.LEAVES) {
          this.gc.particleManager.spawnLeafFall(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, breakMat.clone());
        }
      }

      // たいまつ破壊時にPointLightを削除
      if (hit.blockType === BlockType.TORCH) {
        this.removeTorchLight(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z);
      }
      this.gc.world.setBlockWithDiff(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, BlockType.AIR);
      this.gc.sound.playBreak();

      // ブロック採掘実績チェック
      this.gc._checkMiningAchievement(hit.blockType, dropType);

      // ツール耐久値を消耗
      if (hasTool && selectedTool) {
        const durStore = useDurabilityStore.getState();
        const broke = durStore.damage(selectedTool);
        if (broke) {
          useInventoryStore.getState().consumeItem(toolItemType, 1);
          durStore.resetTool(selectedTool);
          useUIStore.getState().showFeedback(`${_TOOL_NAMES[selectedTool]}が壊れました！`, 1500);
          this.gc.sound.playError();
        }
      }

      this.resetBreaking();
    }
  }
}
