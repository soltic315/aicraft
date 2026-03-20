// モブシステム: エンティティ管理・AI・レンダリング
import * as THREE from 'three';
import {
  MOB_MAX_COUNT,
  MOB_SPAWN_INTERVAL,
  MOB_SPAWN_MIN_DIST,
  MOB_SPAWN_MAX_DIST,
  MOB_DESPAWN_DIST,
  MOB_SEA_LEVEL_MIN,
  ZOMBIE_HP,
  ZOMBIE_SPEED,
  ZOMBIE_VIEW_RANGE,
  ZOMBIE_ATTACK_RANGE,
  ZOMBIE_ATTACK_DAMAGE,
  ZOMBIE_ATTACK_INTERVAL,
  ZOMBIE_BURN_DAMAGE_PER_SEC,
} from './config.js';

// ---- スラブ法によるレイ-AABB 交差判定 ----
// 交差していれば交点までの距離 t を返す。交差しなければ null。

function rayAABB(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ) {
  let tmin = 0;
  let tmax = Infinity;

  for (let i = 0; i < 3; i++) {
    const o = i === 0 ? ox : i === 1 ? oy : oz;
    const d = i === 0 ? dx : i === 1 ? dy : dz;
    const lo = i === 0 ? minX : i === 1 ? minY : minZ;
    const hi = i === 0 ? maxX : i === 1 ? maxY : maxZ;

    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return null;
    } else {
      const t1 = (lo - o) / d;
      const t2 = (hi - o) / d;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    }
  }

  return tmax >= tmin ? tmin : null;
}

// ---- ゾンビメッシュ生成 ----

function createZombieMesh() {
  const headMat = new THREE.MeshLambertMaterial({ color: 0x3a8c28 });
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1e5c12 });
  const legMat  = new THREE.MeshLambertMaterial({ color: 0x2a6b35 });

  const group = new THREE.Group();

  // 頭 (index 0)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
  head.position.set(0, 1.375, 0);
  group.add(head);

  // 胴体 (index 1)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), bodyMat);
  body.position.set(0, 0.75, 0);
  group.add(body);

  // 左腕 (index 2) - ゾンビらしく前に伸ばす
  const armGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
  const leftArm = new THREE.Mesh(armGeo, bodyMat);
  leftArm.position.set(-0.35, 0.9, 0.2);
  leftArm.rotation.x = 0.9;
  group.add(leftArm);

  // 右腕 (index 3)
  const rightArm = new THREE.Mesh(armGeo, bodyMat);
  rightArm.position.set(0.35, 0.9, 0.2);
  rightArm.rotation.x = 0.9;
  group.add(rightArm);

  // 左脚 (index 4)
  const legGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22);
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.13, 0.325, 0);
  group.add(leftLeg);

  // 右脚 (index 5)
  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.13, 0.325, 0);
  group.add(rightLeg);

  return { group, mats: { head: headMat, body: bodyMat, leg: legMat } };
}

// ---- Zombie クラス ----

// モブの当たり判定サイズ（AABB半径・高さ）
const MOB_RADIUS = 0.3;
const MOB_HEIGHT = 1.8;
const HIT_FLASH_COLOR = new THREE.Color(0xff2828);
const HIT_FLASH_DURATION = 0.18; // 秒

class Zombie {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();
    this.health = ZOMBIE_HP;
    this.maxHealth = ZOMBIE_HP;
    this.isAlive = true;
    this.attackCooldown = 0;
    this._walkTime = 0;

    // ノックバック速度
    this._knockbackVel = new THREE.Vector3();

    // ヒットフラッシュ
    this._flashTimer = 0;

    const { group, mats } = createZombieMesh();
    this.mesh = group;
    this._mats = mats;
    // 元の色を保持（フラッシュ復元用）
    this._origColors = {
      head: mats.head.color.clone(),
      body: mats.body.color.clone(),
      leg:  mats.leg.color.clone(),
    };

    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  /** ダメージを与える。戻り値は実際に与えたダメージ量。 */
  takeDamage(amount) {
    if (!this.isAlive) return 0;
    const prev = this.health;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this._die();
    return prev - this.health;
  }

  /** 被弾時に赤くフラッシュする */
  flashHit() {
    if (!this.isAlive) return;
    this._flashTimer = HIT_FLASH_DURATION;
    this._mats.head.color.copy(HIT_FLASH_COLOR);
    this._mats.body.color.copy(HIT_FLASH_COLOR);
    this._mats.leg.color.copy(HIT_FLASH_COLOR);
  }

  /** ノックバック速度を設定する */
  applyKnockback(fromX, fromZ, force) {
    if (!this.isAlive) return;
    const dx = this.position.x - fromX;
    const dz = this.position.z - fromZ;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) {
      this._knockbackVel.set(force, 0, 0);
    } else {
      this._knockbackVel.set((dx / len) * force, 0, (dz / len) * force);
    }
  }

  _die() {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.scene.remove(this.mesh);
    this._mats.head.dispose();
    this._mats.body.dispose();
    this._mats.leg.dispose();
    this.mesh.traverse((obj) => {
      if (obj.isMesh) obj.geometry.dispose();
    });
  }

  _restoreColors() {
    this._mats.head.color.copy(this._origColors.head);
    this._mats.body.color.copy(this._origColors.body);
    this._mats.leg.color.copy(this._origColors.leg);
  }

  /**
   * @returns {{ type: 'attack', damage: number, mobX: number, mobZ: number } | null}
   */
  update(dt, playerPos, world, isDay) {
    if (!this.isAlive) return null;

    // ヒットフラッシュ更新
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) {
        this._restoreColors();
      }
    }

    // 昼間は日光ダメージで消滅
    if (isDay) {
      this.takeDamage(ZOMBIE_BURN_DAMAGE_PER_SEC * dt);
      return null;
    }

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const horizDistSq = dx * dx + dz * dz;
    const horizDist = Math.sqrt(horizDistSq);

    // 視野範囲内ならプレイヤーへ追尾
    if (horizDist < ZOMBIE_VIEW_RANGE && horizDist > 0.05) {
      const nx = dx / horizDist;
      const nz = dz / horizDist;
      this.position.x += nx * ZOMBIE_SPEED * dt;
      this.position.z += nz * ZOMBIE_SPEED * dt;

      // プレイヤー方向を向く
      this.mesh.rotation.y = Math.atan2(dx, dz);

      // 歩行アニメーション（脚の前後揺れ）
      this._walkTime += dt * 6;
      const swing = Math.sin(this._walkTime) * 0.35;
      this.mesh.children[4].rotation.x =  swing;
      this.mesh.children[5].rotation.x = -swing;
    }

    // ノックバック適用・減衰
    if (this._knockbackVel.lengthSq() > 0.01) {
      this.position.x += this._knockbackVel.x * dt;
      this.position.z += this._knockbackVel.z * dt;
      // 1秒でほぼ消える（~8%残る）
      this._knockbackVel.multiplyScalar(Math.pow(0.08, dt));
      if (this._knockbackVel.lengthSq() < 0.01) this._knockbackVel.set(0, 0, 0);
    }

    // 地形高度に追従
    const groundY = world.getHeight(Math.floor(this.position.x), Math.floor(this.position.z));
    this.position.y = groundY + 1;

    this.mesh.position.copy(this.position);

    // 攻撃判定（3D距離）
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const dy = playerPos.y - this.position.y;
    const fullDist = Math.sqrt(horizDistSq + dy * dy);
    if (fullDist < ZOMBIE_ATTACK_RANGE && this.attackCooldown <= 0) {
      this.attackCooldown = ZOMBIE_ATTACK_INTERVAL;
      return { type: 'attack', damage: ZOMBIE_ATTACK_DAMAGE, mobX: this.position.x, mobZ: this.position.z };
    }

    return null;
  }
}

// ---- MobManager クラス ----

export class MobManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    /** @type {Zombie[]} */
    this.mobs = [];
    this.spawnTimer = MOB_SPAWN_INTERVAL;
  }

  get count() {
    return this.mobs.length;
  }

  /**
   * 視線からモブのAABBへレイキャスト。最も近いモブを返す。
   * @param {{ x, y, z }} origin
   * @param {{ x, y, z }} dir  正規化済みベクトル
   * @param {number} maxRange
   * @returns {{ mob: Zombie, distance: number } | null}
   */
  raycastMobs(origin, dir, maxRange) {
    let nearest = null;
    let nearestT = maxRange;

    for (const mob of this.mobs) {
      if (!mob.isAlive) continue;
      const t = rayAABB(
        origin.x, origin.y, origin.z,
        dir.x, dir.y, dir.z,
        mob.position.x - MOB_RADIUS, mob.position.y,               mob.position.z - MOB_RADIUS,
        mob.position.x + MOB_RADIUS, mob.position.y + MOB_HEIGHT,  mob.position.z + MOB_RADIUS,
      );
      if (t !== null && t < nearestT) {
        nearestT = t;
        nearest = mob;
      }
    }

    return nearest ? { mob: nearest, distance: nearestT } : null;
  }

  /**
   * ゲームループから毎フレーム呼ぶ
   * @param {(damage: number, mobX: number, mobZ: number) => void} onMobAttack
   */
  update(dt, playerPos, isDay, onMobAttack) {
    // 夜間スポーン
    if (!isDay) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = MOB_SPAWN_INTERVAL;
        this._trySpawn(playerPos);
      }
    } else {
      this.spawnTimer = Math.min(this.spawnTimer, MOB_SPAWN_INTERVAL * 0.3);
    }

    // 各モブ更新
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];

      if (!mob.isAlive) {
        this.mobs.splice(i, 1);
        continue;
      }

      // デスポーン
      const dx = playerPos.x - mob.position.x;
      const dz = playerPos.z - mob.position.z;
      if (dx * dx + dz * dz > MOB_DESPAWN_DIST * MOB_DESPAWN_DIST) {
        mob._die();
        this.mobs.splice(i, 1);
        continue;
      }

      const result = mob.update(dt, playerPos, this.world, isDay);
      if (result?.type === 'attack') {
        onMobAttack(result.damage, result.mobX, result.mobZ);
      }
    }
  }

  _trySpawn(playerPos) {
    if (this.mobs.length >= MOB_MAX_COUNT) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = MOB_SPAWN_MIN_DIST + Math.random() * (MOB_SPAWN_MAX_DIST - MOB_SPAWN_MIN_DIST);
    const x = playerPos.x + Math.cos(angle) * dist;
    const z = playerPos.z + Math.sin(angle) * dist;
    const groundY = this.world.getHeight(Math.floor(x), Math.floor(z));

    if (groundY <= MOB_SEA_LEVEL_MIN) return;

    this.mobs.push(new Zombie(this.scene, new THREE.Vector3(x, groundY + 1, z)));
  }

  removeAll() {
    for (const mob of this.mobs) {
      if (mob.isAlive) mob._die();
    }
    this.mobs = [];
  }
}
