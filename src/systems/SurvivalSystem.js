// サバイバルシステム: 溺れ・窒息・空腹・サボテン・溶岩ダメージを管理する
import { BlockType } from '../blocks.js';
import {
  DIFFICULTY_SETTINGS,
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
} from '../config.js';
import { useGameStore } from '../stores/gameStore.js';
import { useHungerStore } from '../stores/hungerStore.js';
import { useUIStore } from '../stores/uiStore.js';

export class SurvivalSystem {
  constructor(player, sound) {
    this.player = player;
    this.sound = sound;
    this.underwaterTimer = 0;
    this.drowningDamageTimer = DROWNING_DAMAGE_INTERVAL;
    this.suffocationDamageTimer = SUFFOCATION_DAMAGE_INTERVAL;
    this.starvationDamageTimer = HUNGER_STARVE_DAMAGE_INTERVAL;
    this.cactusContactTimer = 0;
    this.lavaDamageTimer = 0.5;
  }

  reset() {
    this.underwaterTimer = 0;
    this.drowningDamageTimer = DROWNING_DAMAGE_INTERVAL;
    this.suffocationDamageTimer = SUFFOCATION_DAMAGE_INTERVAL;
    this.starvationDamageTimer = HUNGER_STARVE_DAMAGE_INTERVAL;
    this.cactusContactTimer = 0;
    this.lavaDamageTimer = 0.5;
  }

  update(dt, world) {
    if (useGameStore.getState().isDead) return;
    // クリエイティブモード中はサバイバルダメージを全スキップ
    if (useGameStore.getState().isCreative) return;

    // --- 空腹 ---
    const difficulty = useGameStore.getState().difficulty;
    const diffSettings = DIFFICULTY_SETTINGS[difficulty] ?? DIFFICULTY_SETTINGS.normal;
    const isMoving = Math.abs(this.player.velocity.x) > 0.3 || Math.abs(this.player.velocity.z) > 0.3;
    let hungerDrain = HUNGER_DRAIN_IDLE;
    if (this.player.isSprinting) hungerDrain = HUNGER_DRAIN_SPRINT;
    else if (isMoving) hungerDrain = HUNGER_DRAIN_MOVE;
    useHungerStore.getState().consumeHunger(hungerDrain * diffSettings.hungerDrainMult * dt);

    const currentHunger = useHungerStore.getState().hunger;
    this.player.regenEnabled = currentHunger > HUNGER_LOW_THRESHOLD;

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

    // --- サボテンダメージ ---
    const pfx = Math.floor(this.player.position.x);
    const pfy = Math.floor(this.player.position.y);
    const pfz = Math.floor(this.player.position.z);
    const touchesCactus = [
      world.getBlock(pfx + 1, pfy,     pfz),
      world.getBlock(pfx - 1, pfy,     pfz),
      world.getBlock(pfx,     pfy,     pfz + 1),
      world.getBlock(pfx,     pfy,     pfz - 1),
      world.getBlock(pfx + 1, pfy + 1, pfz),
      world.getBlock(pfx - 1, pfy + 1, pfz),
      world.getBlock(pfx,     pfy + 1, pfz + 1),
      world.getBlock(pfx,     pfy + 1, pfz - 1),
    ].some(b => b === BlockType.CACTUS);

    if (touchesCactus) {
      this.cactusContactTimer -= dt;
      if (this.cactusContactTimer <= 0) {
        this.cactusContactTimer = 0.5;
        const dmg = this.player.applyDamage(1);
        if (dmg > 0) {
          useUIStore.getState().showFeedback('サボテンに刺さった！ -1 HP', 900);
          this.sound.playError();
        }
      }
    } else {
      this.cactusContactTimer = 0;
    }

    // --- 溶岩ダメージ ---
    if (this.player.isInLava) {
      this.lavaDamageTimer -= dt;
      if (this.lavaDamageTimer <= 0) {
        this.lavaDamageTimer = 0.5;
        const dmg = this.player.applyDamage(2);
        if (dmg > 0) {
          useUIStore.getState().showFeedback('溶岩で燃えている！ -2 HP', 900);
          this.sound.playError();
        }
      }
    } else {
      this.lavaDamageTimer = 0.5;
    }

    // 死亡判定
    if (this.player.health <= 0 && !useGameStore.getState().isDead) {
      useGameStore.getState().setDead(true);
      document.exitPointerLock();
    }
  }
}
