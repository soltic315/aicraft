// 戦闘システム: 弓射撃・食料消費・モブ攻撃
import { BlockType } from '../blocks.js';
import {
  FOOD_ITEMS,
  APPLE_HUNGER_RESTORE,
  FOOD_STATS,
  PLAYER_ATTACK_DAMAGE_BASE,
  PLAYER_ATTACK_DAMAGE_TOOL,
  PLAYER_ATTACK_COOLDOWN,
  KNOCKBACK_MOB_FORCE,
  MOB_XP_REWARDS,
} from '../config.js';
import { useInventoryStore } from '../stores/inventoryStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { useToolStore } from '../stores/toolStore.js';
import { useHungerStore } from '../stores/hungerStore.js';
import { useXpStore } from '../stores/xpStore.js';
import { useAchievementStore } from '../stores/achievementStore.js';

export class CombatSystem {
  constructor(gc) {
    this.gc = gc;
  }

  tryFireBow(now) {
    if (now - this.gc.lastPlaceTime < 600) return; // 弓は0.6秒のクールダウン

    // 矢が必要
    const arrowCount = useInventoryStore.getState().getCount(BlockType.ARROW);
    if (arrowCount <= 0) {
      useUIStore.getState().showFeedback('矢がありません！', 800);
      this.gc.sound.playError();
      return;
    }

    const eyePos = this.gc.player.getEyePosition();
    const dir = this.gc.player.getDirection();
    const BOW_RANGE = 24;

    // 射程内のモブへレイキャスト
    const mobHit = this.gc.mobManager.raycastMobs(eyePos, dir, BOW_RANGE);

    this.gc.lastPlaceTime = now;
    this.gc._consumeFromInventory(BlockType.ARROW);

    if (mobHit) {
      const { mob, distance } = mobHit;
      // 距離に応じてダメージ減衰（近距離ほど強い）
      const dmg = Math.max(2, Math.round(5 * (1 - distance / BOW_RANGE)));
      mob.takeDamage(dmg);
      mob.flashHit();
      if (!mob.isAlive && typeof mob.drops === 'function') {
        for (const { type, count } of mob.drops()) {
          this.gc.droppedItemManager.spawn(mob.position.x, mob.position.y, mob.position.z, type, count);
        }
        const name = mob.name ?? (mob.isAnimal ? '動物' : 'モブ');
        useUIStore.getState().showFeedback(`弓で${name}を倒した！`, 1200);
      } else {
        useUIStore.getState().showFeedback(`弓攻撃命中！ -${dmg} HP`, 700);
      }
    } else {
      useUIStore.getState().showFeedback('弓を放った（空振り）', 700);
    }
    this.gc.sound.playBreak();
  }

  tryEatFood(foodType) {
    // foodType 未指定の場合は選択スロットから取得
    if (!foodType) {
      const { selectedSlot, slots } = useInventoryStore.getState();
      foodType = slots[selectedSlot]?.type ?? null;
    }

    if (!FOOD_ITEMS.has(foodType)) {
      useUIStore.getState().showFeedback('食べられるものが選択されていません');
      this.gc.sound.playError();
      return;
    }

    const selectedType = foodType;

    const hungerStore = useHungerStore.getState();
    if (hungerStore.hunger >= hungerStore.maxHunger) {
      useUIStore.getState().showFeedback('お腹がいっぱいです', 800);
      return;
    }

    const stats = FOOD_STATS[selectedType] ?? { restore: APPLE_HUNGER_RESTORE, name: '食料' };

    if (this.gc.getInventoryCount(selectedType) <= 0) {
      useUIStore.getState().showFeedback(`${stats.name}がありません`, 800);
      this.gc.sound.playError();
      return;
    }

    this.gc._consumeFromInventory(selectedType);
    hungerStore.feedHunger(stats.restore);
    useUIStore.getState().showFeedback(`${stats.name}を食べた！ 空腹 +${stats.restore}`, 1000);
    this.gc.sound.playEat();
  }

  /** プレイヤーがモブを攻撃する */
  attackMob(mob) {
    if (this.gc._attackCooldown > 0) return;

    const { selectedTool } = useToolStore.getState();
    let damage = selectedTool != null ? PLAYER_ATTACK_DAMAGE_TOOL : PLAYER_ATTACK_DAMAGE_BASE;
    // エンチャント: 鋭さの補正
    if (this.gc._enchantmentStore) {
      const slotKey = `slot_${useInventoryStore.getState().selectedSlot}`;
      const sharpLv = this.gc._enchantmentStore.getState().getEnchantLevel(slotKey, 'sharpness');
      if (sharpLv > 0) damage += sharpLv * 1.5;
    }

    mob.takeDamage(damage);
    mob.flashHit();
    mob.applyKnockback(this.gc.player.position.x, this.gc.player.position.z, KNOCKBACK_MOB_FORCE);

    this.gc._attackCooldown = PLAYER_ATTACK_COOLDOWN;
    this.gc.sound.playMeleeHit();
    this.gc.sound.notifyCombat(); // 戦闘BGMに切り替え

    if (!mob.isAlive) {
      this.gc.sound.playMobDeath();
      // ドロップアイテムをスポーン
      if (typeof mob.drops === 'function') {
        for (const { type, count } of mob.drops()) {
          this.gc.droppedItemManager.spawn(mob.position.x, mob.position.y, mob.position.z, type, count);
        }
      }
      const name = mob.name ?? (mob.isAnimal ? '動物' : 'モブ');
      // XP付与
      const xpReward = MOB_XP_REWARDS[name] ?? 3;
      const { levelUp, newLevel } = useXpStore.getState().addXp(xpReward);
      if (levelUp) {
        useUIStore.getState().showFeedback(`レベルアップ！ Lv.${newLevel} ✨ (+${xpReward} XP)`, 2000);
        this.gc.sound.playPlace(); // レベルアップ音
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
}
