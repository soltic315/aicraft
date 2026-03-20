// モブシステム: エンティティ管理・AI・レンダリング
import * as THREE from 'three';
import { BlockType } from './blocks.js';

// 歩行可能ブロック判定（水・背の低い草木などは通過可能）
const isPassable = (b) =>
  b === BlockType.AIR ||
  b === BlockType.WATER ||
  b === BlockType.TALL_GRASS ||
  b === BlockType.FLOWER ||
  b === BlockType.MUSHROOM;
import {
  MOB_MAX_COUNT,
  MOB_SPAWN_INTERVAL,
  MOB_SPAWN_MIN_DIST,
  MOB_SPAWN_MAX_DIST,
  MOB_DESPAWN_DIST,
  MOB_SEA_LEVEL_MIN,
  SHEEP_HP,
  SHEEP_SPEED,
  SHEEP_FLEE_SPEED,
  SHEEP_FLEE_DURATION,
  SHEEP_WANDER_INTERVAL,
  CHICKEN_HP,
  CHICKEN_SPEED,
  CHICKEN_FLEE_SPEED,
  CHICKEN_FLEE_DURATION,
  CHICKEN_WANDER_INTERVAL,
  ZOMBIE_HP,
  ZOMBIE_SPEED,
  ZOMBIE_VIEW_RANGE,
  ZOMBIE_ATTACK_RANGE,
  ZOMBIE_ATTACK_DAMAGE,
  ZOMBIE_ATTACK_INTERVAL,
  ZOMBIE_BURN_DAMAGE_PER_SEC,
  SKELETON_HP,
  SKELETON_SPEED,
  SKELETON_VIEW_RANGE,
  SKELETON_ATTACK_RANGE,
  SKELETON_ATTACK_DAMAGE,
  SKELETON_ATTACK_INTERVAL,
  SKELETON_BURN_DAMAGE_PER_SEC,
  SKELETON_SAFE_RANGE,
  CREEPER_HP,
  CREEPER_SPEED,
  CREEPER_VIEW_RANGE,
  CREEPER_FUSE_RANGE,
  CREEPER_FUSE_TIME,
  CREEPER_EXPLOSION_RADIUS,
  CREEPER_EXPLOSION_DAMAGE,
  ANIMAL_MAX_COUNT,
  ANIMAL_SPAWN_INTERVAL,
  COW_HP,
  COW_SPEED,
  COW_FLEE_SPEED,
  COW_FLEE_DURATION,
  COW_WANDER_INTERVAL,
  SPIDER_HP,
  SPIDER_SPEED,
  SPIDER_VIEW_RANGE,
  SPIDER_ATTACK_RANGE,
  SPIDER_ATTACK_DAMAGE,
  SPIDER_ATTACK_INTERVAL,
  SPIDER_NEUTRAL_RANGE_DAY,
  PIG_HP,
  PIG_SPEED,
  PIG_FLEE_SPEED,
  PIG_FLEE_DURATION,
  PIG_WANDER_INTERVAL,
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
    this.name = 'ゾンビ';
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

  /** 死亡時ドロップ */
  drops() {
    const items = [{ type: BlockType.BEEF, count: 1 }];
    if (Math.random() < 0.2) items.push({ type: BlockType.BONE, count: 1 });
    return items;
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
      const moveX = nx * ZOMBIE_SPEED * dt;
      const moveZ = nz * ZOMBIE_SPEED * dt;

      // X軸移動のブロック衝突チェック（胴体の高さ2ブロック分）
      const nextX = this.position.x + moveX;
      const bodyY = Math.floor(this.position.y);
      const blockX = world.getBlock(Math.floor(nextX + 0.4 * Math.sign(moveX)), bodyY, Math.floor(this.position.z));
      const blockX2 = world.getBlock(Math.floor(nextX + 0.4 * Math.sign(moveX)), bodyY + 1, Math.floor(this.position.z));
      if (isPassable(blockX) && isPassable(blockX2)) {
        this.position.x = nextX;
      }

      // Z軸移動のブロック衝突チェック
      const nextZ = this.position.z + moveZ;
      const blockZ = world.getBlock(Math.floor(this.position.x), bodyY, Math.floor(nextZ + 0.4 * Math.sign(moveZ)));
      const blockZ2 = world.getBlock(Math.floor(this.position.x), bodyY + 1, Math.floor(nextZ + 0.4 * Math.sign(moveZ)));
      if (isPassable(blockZ) && isPassable(blockZ2)) {
        this.position.z = nextZ;
      }

      // プレイヤー方向を向く
      this.mesh.rotation.y = Math.atan2(dx, dz);

      // 歩行アニメーション（脚の前後揺れ）
      this._walkTime += dt * 6;
      const swing = Math.sin(this._walkTime) * 0.35;
      this.mesh.children[4].rotation.x =  swing;
      this.mesh.children[5].rotation.x = -swing;
    }

    // ノックバック適用・減衰（衝突チェック付き）
    if (this._knockbackVel.lengthSq() > 0.01) {
      const kbX = this._knockbackVel.x * dt;
      const kbZ = this._knockbackVel.z * dt;
      const bodyY = Math.floor(this.position.y);

      const kbBlockX = world.getBlock(Math.floor(this.position.x + kbX + 0.4 * Math.sign(kbX)), bodyY, Math.floor(this.position.z));
      const kbBlockX2 = world.getBlock(Math.floor(this.position.x + kbX + 0.4 * Math.sign(kbX)), bodyY + 1, Math.floor(this.position.z));
      if (isPassable(kbBlockX) && isPassable(kbBlockX2)) this.position.x += kbX;

      const kbBlockZ = world.getBlock(Math.floor(this.position.x), bodyY, Math.floor(this.position.z + kbZ + 0.4 * Math.sign(kbZ)));
      const kbBlockZ2 = world.getBlock(Math.floor(this.position.x), bodyY + 1, Math.floor(this.position.z + kbZ + 0.4 * Math.sign(kbZ)));
      if (isPassable(kbBlockZ) && isPassable(kbBlockZ2)) this.position.z += kbZ;

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

// ---- 牛メッシュ生成 ----

function createCowMesh() {
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8B5E3C });
  const headMat = new THREE.MeshLambertMaterial({ color: 0x7A4E2C });
  const legMat  = new THREE.MeshLambertMaterial({ color: 0x6A3E1C });

  const group = new THREE.Group();

  // 胴体（幅広・低め）
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.5), bodyMat);
  body.position.set(0, 0.75, 0);
  group.add(body);

  // 頭（前寄り）
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.38), headMat);
  head.position.set(0, 0.9, 0.48);
  group.add(head);

  // 4本の脚（前左・前右・後左・後右）
  const legGeo = new THREE.BoxGeometry(0.18, 0.45, 0.18);
  for (const [x, z] of [[-0.3, 0.18], [0.3, 0.18], [-0.3, -0.18], [0.3, -0.18]]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, 0.225, z);
    group.add(leg);
  }

  return { group, mats: { body: bodyMat, head: headMat, leg: legMat } };
}

// ---- Cow クラス ----

class Cow {
  constructor(scene, position) {
    this.name = '牛';
    this.isAnimal = true;
    this.scene = scene;
    this.position = position.clone();
    this.health = COW_HP;
    this.maxHealth = COW_HP;
    this.isAlive = true;

    this._walkTime = 0;
    this._wanderDirX = 0;
    this._wanderDirZ = 0;
    this._wanderTimer = Math.random() * COW_WANDER_INTERVAL;

    this._fleeing = false;
    this._fleeTimer = 0;
    this._fleeDirX = 0;
    this._fleeDirZ = 0;

    this._knockbackVel = new THREE.Vector3();
    this._flashTimer = 0;

    const { group, mats } = createCowMesh();
    this.mesh = group;
    this._mats = mats;
    this._origColors = {
      body: mats.body.color.clone(),
      head: mats.head.color.clone(),
      leg:  mats.leg.color.clone(),
    };

    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  takeDamage(amount) {
    if (!this.isAlive) return 0;
    const prev = this.health;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this._die();
    return prev - this.health;
  }

  flashHit() {
    if (!this.isAlive) return;
    this._flashTimer = HIT_FLASH_DURATION;
    this._mats.body.color.copy(HIT_FLASH_COLOR);
    this._mats.head.color.copy(HIT_FLASH_COLOR);
    this._mats.leg.color.copy(HIT_FLASH_COLOR);
  }

  applyKnockback(fromX, fromZ, force) {
    if (!this.isAlive) return;
    const dx = this.position.x - fromX;
    const dz = this.position.z - fromZ;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) {
      this._knockbackVel.set(force, 0, 0);
      this._fleeDirX = 1; this._fleeDirZ = 0;
    } else {
      this._knockbackVel.set((dx / len) * force, 0, (dz / len) * force);
      this._fleeDirX = dx / len;
      this._fleeDirZ = dz / len;
    }
    // 逃走開始
    this._fleeing = true;
    this._fleeTimer = COW_FLEE_DURATION;
  }

  /** 死亡時にドロップするアイテム一覧 */
  drops() {
    const count = 1 + (Math.random() < 0.4 ? 1 : 0);
    return [{ type: BlockType.BEEF, count }];
  }

  _die() {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.scene.remove(this.mesh);
    this._mats.body.dispose();
    this._mats.head.dispose();
    this._mats.leg.dispose();
    this.mesh.traverse((obj) => {
      if (obj.isMesh) obj.geometry.dispose();
    });
  }

  _restoreColors() {
    this._mats.body.color.copy(this._origColors.body);
    this._mats.head.color.copy(this._origColors.head);
    this._mats.leg.color.copy(this._origColors.leg);
  }

  update(dt, playerPos, world, isDay) {
    if (!this.isAlive) return null;

    // ヒットフラッシュ更新
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) this._restoreColors();
    }

    let moveX = 0;
    let moveZ = 0;

    if (this._fleeing) {
      // 逃走中: プレイヤーから離れる方向へ走る
      this._fleeTimer -= dt;
      if (this._fleeTimer <= 0) {
        this._fleeing = false;
      } else {
        moveX = this._fleeDirX * COW_FLEE_SPEED * dt;
        moveZ = this._fleeDirZ * COW_FLEE_SPEED * dt;
      }
    } else {
      // 徘徊: 一定間隔で方向転換
      this._wanderTimer -= dt;
      if (this._wanderTimer <= 0) {
        this._wanderTimer = COW_WANDER_INTERVAL * (0.5 + Math.random());
        const angle = Math.random() * Math.PI * 2;
        // 30%の確率で立ち止まる
        const moving = Math.random() > 0.3;
        this._wanderDirX = moving ? Math.cos(angle) : 0;
        this._wanderDirZ = moving ? Math.sin(angle) : 0;
      }
      moveX = this._wanderDirX * COW_SPEED * dt;
      moveZ = this._wanderDirZ * COW_SPEED * dt;
    }

    // ブロック衝突チェック付き移動
    const bodyY = Math.floor(this.position.y);
    if (moveX !== 0) {
      const bx  = world.getBlock(Math.floor(this.position.x + moveX + 0.4 * Math.sign(moveX)), bodyY, Math.floor(this.position.z));
      const bx2 = world.getBlock(Math.floor(this.position.x + moveX + 0.4 * Math.sign(moveX)), bodyY + 1, Math.floor(this.position.z));
      if (isPassable(bx) && isPassable(bx2)) this.position.x += moveX;
      else { this._wanderDirX = -this._wanderDirX; this._wanderTimer = 0; }
    }
    if (moveZ !== 0) {
      const bz  = world.getBlock(Math.floor(this.position.x), bodyY, Math.floor(this.position.z + moveZ + 0.4 * Math.sign(moveZ)));
      const bz2 = world.getBlock(Math.floor(this.position.x), bodyY + 1, Math.floor(this.position.z + moveZ + 0.4 * Math.sign(moveZ)));
      if (isPassable(bz) && isPassable(bz2)) this.position.z += moveZ;
      else { this._wanderDirZ = -this._wanderDirZ; this._wanderTimer = 0; }
    }

    // ノックバック適用
    if (this._knockbackVel.lengthSq() > 0.01) {
      const kbX = this._knockbackVel.x * dt;
      const kbZ = this._knockbackVel.z * dt;
      const bkY = Math.floor(this.position.y);
      const kbBX  = world.getBlock(Math.floor(this.position.x + kbX + 0.4 * Math.sign(kbX)), bkY, Math.floor(this.position.z));
      const kbBX2 = world.getBlock(Math.floor(this.position.x + kbX + 0.4 * Math.sign(kbX)), bkY + 1, Math.floor(this.position.z));
      if (isPassable(kbBX) && isPassable(kbBX2)) this.position.x += kbX;
      const kbBZ  = world.getBlock(Math.floor(this.position.x), bkY, Math.floor(this.position.z + kbZ + 0.4 * Math.sign(kbZ)));
      const kbBZ2 = world.getBlock(Math.floor(this.position.x), bkY + 1, Math.floor(this.position.z + kbZ + 0.4 * Math.sign(kbZ)));
      if (isPassable(kbBZ) && isPassable(kbBZ2)) this.position.z += kbZ;
      this._knockbackVel.multiplyScalar(Math.pow(0.08, dt));
      if (this._knockbackVel.lengthSq() < 0.01) this._knockbackVel.set(0, 0, 0);
    }

    // 地形高度に追従
    const groundY = world.getHeight(Math.floor(this.position.x), Math.floor(this.position.z));
    this.position.y = groundY + 1;
    this.mesh.position.copy(this.position);

    // 移動時に進行方向を向く・脚アニメーション
    if (Math.abs(moveX) + Math.abs(moveZ) > 0.001) {
      this.mesh.rotation.y = Math.atan2(moveX, moveZ);
      this._walkTime += dt * 5;
      const swing = Math.sin(this._walkTime) * 0.35;
      // 前左・後右 / 前右・後左 で対角に動かす
      this.mesh.children[2].rotation.x =  swing;
      this.mesh.children[3].rotation.x = -swing;
      this.mesh.children[4].rotation.x = -swing;
      this.mesh.children[5].rotation.x =  swing;
    }

    return null; // 友好モブ: 攻撃しない
  }
}

// ---- スケルトンメッシュ生成 ----

function createSkeletonMesh() {
  const boneMat = new THREE.MeshLambertMaterial({ color: 0xdde8e0 });
  const jointMat = new THREE.MeshLambertMaterial({ color: 0xc0ccc4 });

  const group = new THREE.Group();

  // 頭（やや細長い）
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), boneMat);
  head.position.set(0, 1.35, 0);
  group.add(head);

  // 胴体（細い）
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.7, 0.18), boneMat);
  body.position.set(0, 0.72, 0);
  group.add(body);

  // 腕（細い）
  const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
  const leftArm = new THREE.Mesh(armGeo, jointMat);
  leftArm.position.set(-0.28, 0.72, 0);
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, jointMat);
  rightArm.position.set(0.28, 0.72, 0);
  group.add(rightArm);

  // 脚（細い）
  const legGeo = new THREE.BoxGeometry(0.16, 0.65, 0.16);
  const leftLeg = new THREE.Mesh(legGeo, boneMat);
  leftLeg.position.set(-0.1, 0.325, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, boneMat);
  rightLeg.position.set(0.1, 0.325, 0);
  group.add(rightLeg);

  // 弓（右腕に取り付け）
  const bowMat = new THREE.MeshLambertMaterial({ color: 0x8B5E3C });
  const bowGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6);
  const bow = new THREE.Mesh(bowGeo, bowMat);
  bow.position.set(0.38, 0.72, 0.1);
  bow.rotation.z = Math.PI * 0.1;
  group.add(bow);

  return { group, mats: { bone: boneMat, joint: jointMat } };
}

// ---- Skeleton クラス ----

class Skeleton {
  constructor(scene, position) {
    this.name = 'スケルトン';
    this.scene = scene;
    this.position = position.clone();
    this.health = SKELETON_HP;
    this.maxHealth = SKELETON_HP;
    this.isAlive = true;
    this.attackCooldown = 0;
    this._walkTime = 0;
    this._knockbackVel = new THREE.Vector3();
    this._flashTimer = 0;

    const { group, mats } = createSkeletonMesh();
    this.mesh = group;
    this._mats = mats;
    this._origColors = {
      bone: mats.bone.color.clone(),
      joint: mats.joint.color.clone(),
    };
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  takeDamage(amount) {
    if (!this.isAlive) return 0;
    const prev = this.health;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this._die();
    return prev - this.health;
  }

  flashHit() {
    if (!this.isAlive) return;
    this._flashTimer = HIT_FLASH_DURATION;
    this._mats.bone.color.copy(HIT_FLASH_COLOR);
    this._mats.joint.color.copy(HIT_FLASH_COLOR);
  }

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

  /** 死亡時ドロップ */
  drops() {
    const drops = [{ type: BlockType.BONE, count: 1 + Math.floor(Math.random() * 2) }];
    if (Math.random() < 0.6) drops.push({ type: BlockType.ARROW, count: 1 + Math.floor(Math.random() * 3) });
    return drops;
  }

  _die() {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.scene.remove(this.mesh);
    this._mats.bone.dispose();
    this._mats.joint.dispose();
    this.mesh.traverse((obj) => {
      if (obj.isMesh) obj.geometry.dispose();
    });
  }

  _restoreColors() {
    this._mats.bone.color.copy(this._origColors.bone);
    this._mats.joint.color.copy(this._origColors.joint);
  }

  update(dt, playerPos, world, isDay) {
    if (!this.isAlive) return null;

    // ヒットフラッシュ更新
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) this._restoreColors();
    }

    // 昼間は日光ダメージ
    if (isDay) {
      this.takeDamage(SKELETON_BURN_DAMAGE_PER_SEC * dt);
      return null;
    }

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const horizDist = Math.sqrt(dx * dx + dz * dz);

    if (horizDist < SKELETON_VIEW_RANGE && horizDist > 0.05) {
      const nx = dx / horizDist;
      const nz = dz / horizDist;

      // 近づきすぎたら後退（弓使いは距離を保つ）
      let speed = 0;
      if (horizDist < SKELETON_SAFE_RANGE) {
        speed = -SKELETON_SPEED; // 後退
      } else if (horizDist > SKELETON_ATTACK_RANGE * 0.7) {
        speed = SKELETON_SPEED; // 接近
      }

      if (speed !== 0) {
        const moveX = nx * speed * dt;
        const moveZ = nz * speed * dt;
        const bodyY = Math.floor(this.position.y);

        const bx  = world.getBlock(Math.floor(this.position.x + moveX + 0.4 * Math.sign(moveX)), bodyY, Math.floor(this.position.z));
        const bx2 = world.getBlock(Math.floor(this.position.x + moveX + 0.4 * Math.sign(moveX)), bodyY + 1, Math.floor(this.position.z));
        if (isPassable(bx) && isPassable(bx2)) this.position.x += moveX;

        const bz  = world.getBlock(Math.floor(this.position.x), bodyY, Math.floor(this.position.z + moveZ + 0.4 * Math.sign(moveZ)));
        const bz2 = world.getBlock(Math.floor(this.position.x), bodyY + 1, Math.floor(this.position.z + moveZ + 0.4 * Math.sign(moveZ)));
        if (isPassable(bz) && isPassable(bz2)) this.position.z += moveZ;
      }

      // プレイヤー方向を向く
      this.mesh.rotation.y = Math.atan2(dx, dz);

      // 歩行アニメーション
      if (Math.abs(speed) > 0) {
        this._walkTime += dt * 5;
        const swing = Math.sin(this._walkTime) * 0.35;
        this.mesh.children[4].rotation.x =  swing;
        this.mesh.children[5].rotation.x = -swing;
      }
    }

    // ノックバック適用
    if (this._knockbackVel.lengthSq() > 0.01) {
      const kbX = this._knockbackVel.x * dt;
      const kbZ = this._knockbackVel.z * dt;
      const bodyY = Math.floor(this.position.y);
      const kbBX  = world.getBlock(Math.floor(this.position.x + kbX + 0.4 * Math.sign(kbX)), bodyY, Math.floor(this.position.z));
      const kbBX2 = world.getBlock(Math.floor(this.position.x + kbX + 0.4 * Math.sign(kbX)), bodyY + 1, Math.floor(this.position.z));
      if (isPassable(kbBX) && isPassable(kbBX2)) this.position.x += kbX;
      const kbBZ  = world.getBlock(Math.floor(this.position.x), bodyY, Math.floor(this.position.z + kbZ + 0.4 * Math.sign(kbZ)));
      const kbBZ2 = world.getBlock(Math.floor(this.position.x), bodyY + 1, Math.floor(this.position.z + kbZ + 0.4 * Math.sign(kbZ)));
      if (isPassable(kbBZ) && isPassable(kbBZ2)) this.position.z += kbZ;
      this._knockbackVel.multiplyScalar(Math.pow(0.08, dt));
      if (this._knockbackVel.lengthSq() < 0.01) this._knockbackVel.set(0, 0, 0);
    }

    // 地形高度に追従
    const groundY = world.getHeight(Math.floor(this.position.x), Math.floor(this.position.z));
    this.position.y = groundY + 1;
    this.mesh.position.copy(this.position);

    // 弓攻撃判定（射程内ならダメージ）
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const dy = playerPos.y - this.position.y;
    const fullDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (fullDist < SKELETON_ATTACK_RANGE && this.attackCooldown <= 0) {
      this.attackCooldown = SKELETON_ATTACK_INTERVAL;
      return { type: 'attack', damage: SKELETON_ATTACK_DAMAGE, mobX: this.position.x, mobZ: this.position.z };
    }

    return null;
  }
}

// ---- クリーパーメッシュ生成 ----

function createCreeperMesh() {
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a8a2a });
  const faceMat = new THREE.MeshLambertMaterial({ color: 0x1e6a1e });

  const group = new THREE.Group();

  // 頭（ほぼ正方形）
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), bodyMat);
  head.position.set(0, 1.4, 0);
  group.add(head);

  // 胴体
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.25), bodyMat);
  body.position.set(0, 0.75, 0);
  group.add(body);

  // 4本の脚（短め）
  const legGeo = new THREE.BoxGeometry(0.2, 0.38, 0.2);
  for (const [x, z] of [[-0.12, 0.1], [0.12, 0.1], [-0.12, -0.1], [0.12, -0.1]]) {
    const leg = new THREE.Mesh(legGeo, faceMat);
    leg.position.set(x, 0.19, z);
    group.add(leg);
  }

  return { group, mats: { body: bodyMat, face: faceMat } };
}

// ---- Creeper クラス ----

class Creeper {
  constructor(scene, position) {
    this.name = 'クリーパー';
    this.scene = scene;
    this.position = position.clone();
    this.health = CREEPER_HP;
    this.maxHealth = CREEPER_HP;
    this.isAlive = true;
    this._walkTime = 0;
    this._knockbackVel = new THREE.Vector3();
    this._flashTimer = 0;

    // 起爆タイマー
    this._fuseActive = false;
    this._fuseTimer = 0;
    this._fuseFlashTimer = 0;

    const { group, mats } = createCreeperMesh();
    this.mesh = group;
    this._mats = mats;
    this._origColors = {
      body: mats.body.color.clone(),
      face: mats.face.color.clone(),
    };
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  takeDamage(amount) {
    if (!this.isAlive) return 0;
    const prev = this.health;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this._die();
    return prev - this.health;
  }

  flashHit() {
    if (!this.isAlive) return;
    this._flashTimer = HIT_FLASH_DURATION;
    this._mats.body.color.copy(HIT_FLASH_COLOR);
    this._mats.face.color.copy(HIT_FLASH_COLOR);
  }

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
    // 攻撃を受けたら起爆解除
    this._fuseActive = false;
    this._fuseTimer = 0;
  }

  drops() {
    return []; // クリーパーはドロップなし（爆発で消滅）
  }

  _die() {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.scene.remove(this.mesh);
    this._mats.body.dispose();
    this._mats.face.dispose();
    this.mesh.traverse((obj) => {
      if (obj.isMesh) obj.geometry.dispose();
    });
  }

  _restoreColors() {
    this._mats.body.color.copy(this._origColors.body);
    this._mats.face.color.copy(this._origColors.face);
  }

  update(dt, playerPos, world, isDay) {
    if (!this.isAlive) return null;

    // ヒットフラッシュ更新
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0 && !this._fuseActive) this._restoreColors();
    }

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const horizDist = Math.sqrt(dx * dx + dz * dz);

    // 起爆処理
    if (this._fuseActive) {
      this._fuseTimer -= dt;
      // 白黒点滅エフェクト
      this._fuseFlashTimer -= dt;
      if (this._fuseFlashTimer <= 0) {
        this._fuseFlashTimer = 0.15;
        const flashVal = Math.sin(this._fuseTimer * 20) > 0;
        if (flashVal) {
          this._mats.body.color.setRGB(1, 1, 1);
          this._mats.face.color.setRGB(1, 1, 1);
        } else {
          this._restoreColors();
        }
      }

      // 距離が離れたら起爆解除
      if (horizDist > CREEPER_FUSE_RANGE * 1.5) {
        this._fuseActive = false;
        this._fuseTimer = 0;
        this._restoreColors();
      }

      // 起爆！
      if (this._fuseTimer <= 0) {
        this._die();
        return {
          type: 'explosion',
          x: Math.floor(this.position.x),
          y: Math.floor(this.position.y),
          z: Math.floor(this.position.z),
          radius: CREEPER_EXPLOSION_RADIUS,
          damage: CREEPER_EXPLOSION_DAMAGE,
        };
      }
      return null;
    }

    // 追尾
    if (horizDist < CREEPER_VIEW_RANGE && horizDist > 0.05) {
      const nx = dx / horizDist;
      const nz = dz / horizDist;
      const moveX = nx * CREEPER_SPEED * dt;
      const moveZ = nz * CREEPER_SPEED * dt;
      const bodyY = Math.floor(this.position.y);

      const bx  = world.getBlock(Math.floor(this.position.x + moveX + 0.4 * Math.sign(moveX)), bodyY, Math.floor(this.position.z));
      const bx2 = world.getBlock(Math.floor(this.position.x + moveX + 0.4 * Math.sign(moveX)), bodyY + 1, Math.floor(this.position.z));
      if (isPassable(bx) && isPassable(bx2)) this.position.x += moveX;

      const bz  = world.getBlock(Math.floor(this.position.x), bodyY, Math.floor(this.position.z + moveZ + 0.4 * Math.sign(moveZ)));
      const bz2 = world.getBlock(Math.floor(this.position.x), bodyY + 1, Math.floor(this.position.z + moveZ + 0.4 * Math.sign(moveZ)));
      if (isPassable(bz) && isPassable(bz2)) this.position.z += moveZ;

      this.mesh.rotation.y = Math.atan2(dx, dz);

      // 歩行アニメーション
      this._walkTime += dt * 6;
      const swing = Math.sin(this._walkTime) * 0.3;
      this.mesh.children[2].rotation.x =  swing;
      this.mesh.children[3].rotation.x = -swing;
      this.mesh.children[4].rotation.x = -swing;
      this.mesh.children[5].rotation.x =  swing;

      // 起爆範囲に入ったら起爆開始
      if (horizDist < CREEPER_FUSE_RANGE) {
        this._fuseActive = true;
        this._fuseTimer = CREEPER_FUSE_TIME;
        this._fuseFlashTimer = 0;
      }
    }

    // ノックバック適用
    if (this._knockbackVel.lengthSq() > 0.01) {
      const kbX = this._knockbackVel.x * dt;
      const kbZ = this._knockbackVel.z * dt;
      const bodyY = Math.floor(this.position.y);
      const kbBX  = world.getBlock(Math.floor(this.position.x + kbX + 0.4 * Math.sign(kbX)), bodyY, Math.floor(this.position.z));
      const kbBX2 = world.getBlock(Math.floor(this.position.x + kbX + 0.4 * Math.sign(kbX)), bodyY + 1, Math.floor(this.position.z));
      if (isPassable(kbBX) && isPassable(kbBX2)) this.position.x += kbX;
      const kbBZ  = world.getBlock(Math.floor(this.position.x), bodyY, Math.floor(this.position.z + kbZ + 0.4 * Math.sign(kbZ)));
      const kbBZ2 = world.getBlock(Math.floor(this.position.x), bodyY + 1, Math.floor(this.position.z + kbZ + 0.4 * Math.sign(kbZ)));
      if (isPassable(kbBZ) && isPassable(kbBZ2)) this.position.z += kbZ;
      this._knockbackVel.multiplyScalar(Math.pow(0.08, dt));
      if (this._knockbackVel.lengthSq() < 0.01) this._knockbackVel.set(0, 0, 0);
    }

    // 地形高度に追従
    const groundY = world.getHeight(Math.floor(this.position.x), Math.floor(this.position.z));
    this.position.y = groundY + 1;
    this.mesh.position.copy(this.position);

    return null;
  }
}

// ---- クモメッシュ生成 ----

function createSpiderMesh() {
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const eyeMat  = new THREE.MeshLambertMaterial({ color: 0xff2020 });

  const group = new THREE.Group();

  // 腹部（大きめの楕円形状）
  const abdomen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.6), bodyMat);
  abdomen.position.set(0, 0.4, -0.2);
  group.add(abdomen);

  // 頭胸部
  const thorax = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.38), bodyMat);
  thorax.position.set(0, 0.42, 0.22);
  group.add(thorax);

  // 目（赤い小さな球体 x2）
  const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.06);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.1, 0.52, 0.42);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.1, 0.52, 0.42);
  group.add(rightEye);

  // 脚（8本: 左4・右4）
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const legGeo = new THREE.BoxGeometry(0.08, 0.08, 0.6);
  const legAngles = [-0.5, -0.2, 0.2, 0.5];
  for (const ang of legAngles) {
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.4, 0.3, 0.05 + ang * 0.3);
    leftLeg.rotation.z = 0.7;
    leftLeg.rotation.y = ang * 1.2;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.4, 0.3, 0.05 + ang * 0.3);
    rightLeg.rotation.z = -0.7;
    rightLeg.rotation.y = ang * 1.2;
    group.add(rightLeg);
  }

  return { group, mats: { body: bodyMat, eye: eyeMat, leg: legMat } };
}

// ---- Spider クラス ----

class Spider {
  constructor(scene, position) {
    this.name = 'クモ';
    this.scene = scene;
    this.position = position.clone();
    this.health = SPIDER_HP;
    this.maxHealth = SPIDER_HP;
    this.isAlive = true;
    this.attackCooldown = 0;
    this._walkTime = 0;
    this._knockbackVel = new THREE.Vector3();
    this._flashTimer = 0;
    // 昼間に攻撃を受けると敵対状態になる
    this._aggroed = false;

    const { group, mats } = createSpiderMesh();
    this.mesh = group;
    this._mats = mats;
    this._origColors = {
      body: mats.body.color.clone(),
      eye:  mats.eye.color.clone(),
      leg:  mats.leg.color.clone(),
    };
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  takeDamage(amount) {
    if (!this.isAlive) return 0;
    const prev = this.health;
    this.health = Math.max(0, this.health - amount);
    // 攻撃されたら敵対状態に
    this._aggroed = true;
    if (this.health <= 0) this._die();
    return prev - this.health;
  }

  flashHit() {
    if (!this.isAlive) return;
    this._flashTimer = HIT_FLASH_DURATION;
    this._mats.body.color.copy(HIT_FLASH_COLOR);
    this._mats.leg.color.copy(HIT_FLASH_COLOR);
  }

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

  drops() {
    return [{ type: BlockType.STRING, count: 1 + Math.floor(Math.random() * 2) }];
  }

  _die() {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.scene.remove(this.mesh);
    this._mats.body.dispose();
    this._mats.eye.dispose();
    this._mats.leg.dispose();
    this.mesh.traverse((obj) => {
      if (obj.isMesh) obj.geometry.dispose();
    });
  }

  _restoreColors() {
    this._mats.body.color.copy(this._origColors.body);
    this._mats.leg.color.copy(this._origColors.leg);
  }

  update(dt, playerPos, world, isDay) {
    if (!this.isAlive) return null;

    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) this._restoreColors();
    }

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const horizDist = Math.sqrt(dx * dx + dz * dz);

    // 昼間は一定距離以内に近づくか敵対状態になったときのみ攻撃
    const isHostile = !isDay || this._aggroed || horizDist < SPIDER_NEUTRAL_RANGE_DAY;

    if (isHostile && horizDist < SPIDER_VIEW_RANGE && horizDist > 0.05) {
      const nx = dx / horizDist;
      const nz = dz / horizDist;
      const moveX = nx * SPIDER_SPEED * dt;
      const moveZ = nz * SPIDER_SPEED * dt;
      const bodyY = Math.floor(this.position.y);

      const bx  = world.getBlock(Math.floor(this.position.x + moveX + 0.35 * Math.sign(moveX)), bodyY, Math.floor(this.position.z));
      const bx2 = world.getBlock(Math.floor(this.position.x + moveX + 0.35 * Math.sign(moveX)), bodyY + 1, Math.floor(this.position.z));
      if (isPassable(bx) && isPassable(bx2)) this.position.x += moveX;

      const bz  = world.getBlock(Math.floor(this.position.x), bodyY, Math.floor(this.position.z + moveZ + 0.35 * Math.sign(moveZ)));
      const bz2 = world.getBlock(Math.floor(this.position.x), bodyY + 1, Math.floor(this.position.z + moveZ + 0.35 * Math.sign(moveZ)));
      if (isPassable(bz) && isPassable(bz2)) this.position.z += moveZ;

      this.mesh.rotation.y = Math.atan2(dx, dz);

      // 脚のスクリット動き
      this._walkTime += dt * 10;
      const swing = Math.sin(this._walkTime) * 0.2;
      // 脚インデックス（5〜12）をまとめて動かす
      for (let li = 5; li < Math.min(this.mesh.children.length, 13); li++) {
        this.mesh.children[li].rotation.y += swing * 0.05 * (li % 2 === 0 ? 1 : -1);
      }
    } else if (isDay && !this._aggroed) {
      // 昼間・非敵対: ゆっくり離れる
      if (horizDist < SPIDER_NEUTRAL_RANGE_DAY && horizDist > 0.05) {
        const nx = dx / horizDist;
        const nz = dz / horizDist;
        this.position.x -= nx * SPIDER_SPEED * 0.5 * dt;
        this.position.z -= nz * SPIDER_SPEED * 0.5 * dt;
      }
    }

    // ノックバック適用
    if (this._knockbackVel.lengthSq() > 0.01) {
      const kbX = this._knockbackVel.x * dt;
      const kbZ = this._knockbackVel.z * dt;
      const bodyY = Math.floor(this.position.y);
      const kbBX  = world.getBlock(Math.floor(this.position.x + kbX + 0.35 * Math.sign(kbX)), bodyY, Math.floor(this.position.z));
      const kbBX2 = world.getBlock(Math.floor(this.position.x + kbX + 0.35 * Math.sign(kbX)), bodyY + 1, Math.floor(this.position.z));
      if (isPassable(kbBX) && isPassable(kbBX2)) this.position.x += kbX;
      const kbBZ  = world.getBlock(Math.floor(this.position.x), bodyY, Math.floor(this.position.z + kbZ + 0.35 * Math.sign(kbZ)));
      const kbBZ2 = world.getBlock(Math.floor(this.position.x), bodyY + 1, Math.floor(this.position.z + kbZ + 0.35 * Math.sign(kbZ)));
      if (isPassable(kbBZ) && isPassable(kbBZ2)) this.position.z += kbZ;
      this._knockbackVel.multiplyScalar(Math.pow(0.08, dt));
      if (this._knockbackVel.lengthSq() < 0.01) this._knockbackVel.set(0, 0, 0);
    }

    const groundY = world.getHeight(Math.floor(this.position.x), Math.floor(this.position.z));
    this.position.y = groundY + 0.6; // クモは低め
    this.mesh.position.copy(this.position);

    // 攻撃判定
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (isHostile) {
      const dy = playerPos.y - this.position.y;
      const fullDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (fullDist < SPIDER_ATTACK_RANGE && this.attackCooldown <= 0) {
        this.attackCooldown = SPIDER_ATTACK_INTERVAL;
        return { type: 'attack', damage: SPIDER_ATTACK_DAMAGE, mobX: this.position.x, mobZ: this.position.z };
      }
    }

    return null;
  }
}

// ---- 羊メッシュ生成 ----

function createSheepMesh() {
  const woolMat = new THREE.MeshLambertMaterial({ color: 0xf0ece8 });
  const faceMat = new THREE.MeshLambertMaterial({ color: 0xd0c8c0 });
  const legMat  = new THREE.MeshLambertMaterial({ color: 0xd8d0c8 });

  const group = new THREE.Group();

  // 胴体（羊毛で丸みある形）
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.60, 0.52), woolMat);
  body.position.set(0, 0.76, 0);
  group.add(body);

  // 頭（少し暗め・毛なし）
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.40, 0.42), faceMat);
  head.position.set(0, 0.90, 0.48);
  group.add(head);

  // 耳
  const earGeo = new THREE.BoxGeometry(0.20, 0.08, 0.12);
  const leftEar = new THREE.Mesh(earGeo, faceMat);
  leftEar.position.set(-0.26, 1.0, 0.44);
  group.add(leftEar);
  const rightEar = new THREE.Mesh(earGeo, faceMat);
  rightEar.position.set(0.26, 1.0, 0.44);
  group.add(rightEar);

  // 4本の脚
  const legGeo = new THREE.BoxGeometry(0.17, 0.44, 0.17);
  for (const [x, z] of [[-0.28, 0.18], [0.28, 0.18], [-0.28, -0.18], [0.28, -0.18]]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, 0.22, z);
    group.add(leg);
  }

  return { group, mats: { wool: woolMat, face: faceMat, leg: legMat } };
}

// ---- Sheep クラス ----

class Sheep {
  constructor(scene, position) {
    this.name = '羊';
    this.isAnimal = true;
    this.scene = scene;
    this.position = position.clone();
    this.health = SHEEP_HP;
    this.maxHealth = SHEEP_HP;
    this.isAlive = true;

    this._walkTime = 0;
    this._wanderDirX = 0;
    this._wanderDirZ = 0;
    this._wanderTimer = Math.random() * SHEEP_WANDER_INTERVAL;

    this._fleeing = false;
    this._fleeTimer = 0;
    this._fleeDirX = 0;
    this._fleeDirZ = 0;

    this._knockbackVel = new THREE.Vector3();
    this._flashTimer = 0;

    const { group, mats } = createSheepMesh();
    this.mesh = group;
    this._mats = mats;
    this._origColors = {
      wool: mats.wool.color.clone(),
      face: mats.face.color.clone(),
      leg:  mats.leg.color.clone(),
    };

    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  takeDamage(amount) {
    if (!this.isAlive) return 0;
    const prev = this.health;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this._die();
    return prev - this.health;
  }

  flashHit() {
    if (!this.isAlive) return;
    this._flashTimer = HIT_FLASH_DURATION;
    this._mats.wool.color.copy(HIT_FLASH_COLOR);
    this._mats.face.color.copy(HIT_FLASH_COLOR);
    this._mats.leg.color.copy(HIT_FLASH_COLOR);
  }

  applyKnockback(fromX, fromZ, force) {
    if (!this.isAlive) return;
    const dx = this.position.x - fromX;
    const dz = this.position.z - fromZ;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) {
      this._knockbackVel.set(force, 0, 0);
      this._fleeDirX = 1; this._fleeDirZ = 0;
    } else {
      this._knockbackVel.set((dx / len) * force, 0, (dz / len) * force);
      this._fleeDirX = dx / len;
      this._fleeDirZ = dz / len;
    }
    this._fleeing = true;
    this._fleeTimer = SHEEP_FLEE_DURATION;
  }

  drops() {
    return [
      { type: BlockType.WOOL, count: 1 + Math.floor(Math.random() * 2) },
    ];
  }

  _die() {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.scene.remove(this.mesh);
    this._mats.wool.dispose();
    this._mats.face.dispose();
    this._mats.leg.dispose();
    this.mesh.traverse((obj) => {
      if (obj.isMesh) obj.geometry.dispose();
    });
  }

  _restoreColors() {
    this._mats.wool.color.copy(this._origColors.wool);
    this._mats.face.color.copy(this._origColors.face);
    this._mats.leg.color.copy(this._origColors.leg);
  }

  update(dt, playerPos, world, isDay) {
    if (!this.isAlive) return null;

    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) this._restoreColors();
    }

    let moveX = 0;
    let moveZ = 0;

    if (this._fleeing) {
      this._fleeTimer -= dt;
      if (this._fleeTimer <= 0) {
        this._fleeing = false;
      } else {
        moveX = this._fleeDirX * SHEEP_FLEE_SPEED * dt;
        moveZ = this._fleeDirZ * SHEEP_FLEE_SPEED * dt;
      }
    } else {
      this._wanderTimer -= dt;
      if (this._wanderTimer <= 0) {
        this._wanderTimer = SHEEP_WANDER_INTERVAL * (0.5 + Math.random());
        const angle = Math.random() * Math.PI * 2;
        const moving = Math.random() > 0.3;
        this._wanderDirX = moving ? Math.cos(angle) : 0;
        this._wanderDirZ = moving ? Math.sin(angle) : 0;
      }
      moveX = this._wanderDirX * SHEEP_SPEED * dt;
      moveZ = this._wanderDirZ * SHEEP_SPEED * dt;
    }

    const bodyY = Math.floor(this.position.y);
    if (moveX !== 0) {
      const bx  = world.getBlock(Math.floor(this.position.x + moveX + 0.4 * Math.sign(moveX)), bodyY, Math.floor(this.position.z));
      const bx2 = world.getBlock(Math.floor(this.position.x + moveX + 0.4 * Math.sign(moveX)), bodyY + 1, Math.floor(this.position.z));
      if (isPassable(bx) && isPassable(bx2)) this.position.x += moveX;
      else { this._wanderDirX = -this._wanderDirX; this._wanderTimer = 0; }
    }
    if (moveZ !== 0) {
      const bz  = world.getBlock(Math.floor(this.position.x), bodyY, Math.floor(this.position.z + moveZ + 0.4 * Math.sign(moveZ)));
      const bz2 = world.getBlock(Math.floor(this.position.x), bodyY + 1, Math.floor(this.position.z + moveZ + 0.4 * Math.sign(moveZ)));
      if (isPassable(bz) && isPassable(bz2)) this.position.z += moveZ;
      else { this._wanderDirZ = -this._wanderDirZ; this._wanderTimer = 0; }
    }

    if (this._knockbackVel.lengthSq() > 0.01) {
      const kbX = this._knockbackVel.x * dt;
      const kbZ = this._knockbackVel.z * dt;
      const bkY = Math.floor(this.position.y);
      const kbBX  = world.getBlock(Math.floor(this.position.x + kbX + 0.4 * Math.sign(kbX)), bkY, Math.floor(this.position.z));
      const kbBX2 = world.getBlock(Math.floor(this.position.x + kbX + 0.4 * Math.sign(kbX)), bkY + 1, Math.floor(this.position.z));
      if (isPassable(kbBX) && isPassable(kbBX2)) this.position.x += kbX;
      const kbBZ  = world.getBlock(Math.floor(this.position.x), bkY, Math.floor(this.position.z + kbZ + 0.4 * Math.sign(kbZ)));
      const kbBZ2 = world.getBlock(Math.floor(this.position.x), bkY + 1, Math.floor(this.position.z + kbZ + 0.4 * Math.sign(kbZ)));
      if (isPassable(kbBZ) && isPassable(kbBZ2)) this.position.z += kbZ;
      this._knockbackVel.multiplyScalar(Math.pow(0.08, dt));
      if (this._knockbackVel.lengthSq() < 0.01) this._knockbackVel.set(0, 0, 0);
    }

    const groundY = world.getHeight(Math.floor(this.position.x), Math.floor(this.position.z));
    this.position.y = groundY + 1;
    this.mesh.position.copy(this.position);

    if (Math.abs(moveX) + Math.abs(moveZ) > 0.001) {
      this.mesh.rotation.y = Math.atan2(moveX, moveZ);
      this._walkTime += dt * 5;
      const swing = Math.sin(this._walkTime) * 0.32;
      for (let li = 5; li <= 8; li++) {
        const child = this.mesh.children[li];
        if (child) child.rotation.x = (li % 2 === 1 ? swing : -swing);
      }
    }

    return null;
  }
}

// ---- ニワトリメッシュ生成 ----

function createChickenMesh() {
  const bodyMat  = new THREE.MeshLambertMaterial({ color: 0xf0f0e8 });
  const headMat  = new THREE.MeshLambertMaterial({ color: 0xe8e8e0 });
  const combMat  = new THREE.MeshLambertMaterial({ color: 0xe02020 });
  const beakMat  = new THREE.MeshLambertMaterial({ color: 0xe8a820 });
  const legMat   = new THREE.MeshLambertMaterial({ color: 0xe8a820 });

  const group = new THREE.Group();

  // 胴体（丸みある）
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.48), bodyMat);
  body.position.set(0, 0.60, 0);
  group.add(body);

  // 頭（小さめ）
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.30, 0.30), headMat);
  head.position.set(0, 1.0, 0.28);
  group.add(head);

  // トサカ（赤）
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.08), combMat);
  comb.position.set(0, 1.20, 0.26);
  group.add(comb);

  // くちばし（黄）
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, 0.14), beakMat);
  beak.position.set(0, 1.0, 0.42);
  group.add(beak);

  // 2本の脚（細め）
  const legGeo = new THREE.BoxGeometry(0.10, 0.32, 0.10);
  for (const [x] of [[-0.14], [0.14]]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, 0.16, 0.05);
    group.add(leg);
  }

  return { group, mats: { body: bodyMat, head: headMat, comb: combMat, beak: beakMat, leg: legMat } };
}

// ---- Chicken クラス ----

class Chicken {
  constructor(scene, position) {
    this.name = 'ニワトリ';
    this.isAnimal = true;
    this.scene = scene;
    this.position = position.clone();
    this.health = CHICKEN_HP;
    this.maxHealth = CHICKEN_HP;
    this.isAlive = true;

    this._walkTime = 0;
    this._wanderDirX = 0;
    this._wanderDirZ = 0;
    this._wanderTimer = Math.random() * CHICKEN_WANDER_INTERVAL;

    this._fleeing = false;
    this._fleeTimer = 0;
    this._fleeDirX = 0;
    this._fleeDirZ = 0;

    this._knockbackVel = new THREE.Vector3();
    this._flashTimer = 0;

    const { group, mats } = createChickenMesh();
    this.mesh = group;
    this._mats = mats;
    this._origColors = {
      body: mats.body.color.clone(),
      head: mats.head.color.clone(),
    };

    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  takeDamage(amount) {
    if (!this.isAlive) return 0;
    const prev = this.health;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this._die();
    return prev - this.health;
  }

  flashHit() {
    if (!this.isAlive) return;
    this._flashTimer = HIT_FLASH_DURATION;
    this._mats.body.color.copy(HIT_FLASH_COLOR);
    this._mats.head.color.copy(HIT_FLASH_COLOR);
  }

  applyKnockback(fromX, fromZ, force) {
    if (!this.isAlive) return;
    const dx = this.position.x - fromX;
    const dz = this.position.z - fromZ;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) {
      this._knockbackVel.set(force, 0, 0);
      this._fleeDirX = 1; this._fleeDirZ = 0;
    } else {
      this._knockbackVel.set((dx / len) * force, 0, (dz / len) * force);
      this._fleeDirX = dx / len;
      this._fleeDirZ = dz / len;
    }
    this._fleeing = true;
    this._fleeTimer = CHICKEN_FLEE_DURATION;
  }

  drops() {
    return [
      { type: BlockType.FEATHER, count: 1 + Math.floor(Math.random() * 2) },
      { type: BlockType.CHICKEN, count: 1 },
    ];
  }

  _die() {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.scene.remove(this.mesh);
    this._mats.body.dispose();
    this._mats.head.dispose();
    this._mats.comb.dispose();
    this._mats.beak.dispose();
    this._mats.leg.dispose();
    this.mesh.traverse((obj) => {
      if (obj.isMesh) obj.geometry.dispose();
    });
  }

  _restoreColors() {
    this._mats.body.color.copy(this._origColors.body);
    this._mats.head.color.copy(this._origColors.head);
  }

  update(dt, playerPos, world, isDay) {
    if (!this.isAlive) return null;

    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) this._restoreColors();
    }

    let moveX = 0;
    let moveZ = 0;

    if (this._fleeing) {
      this._fleeTimer -= dt;
      if (this._fleeTimer <= 0) {
        this._fleeing = false;
      } else {
        moveX = this._fleeDirX * CHICKEN_FLEE_SPEED * dt;
        moveZ = this._fleeDirZ * CHICKEN_FLEE_SPEED * dt;
      }
    } else {
      this._wanderTimer -= dt;
      if (this._wanderTimer <= 0) {
        this._wanderTimer = CHICKEN_WANDER_INTERVAL * (0.5 + Math.random());
        const angle = Math.random() * Math.PI * 2;
        const moving = Math.random() > 0.25;
        this._wanderDirX = moving ? Math.cos(angle) : 0;
        this._wanderDirZ = moving ? Math.sin(angle) : 0;
      }
      moveX = this._wanderDirX * CHICKEN_SPEED * dt;
      moveZ = this._wanderDirZ * CHICKEN_SPEED * dt;
    }

    const bodyY = Math.floor(this.position.y);
    if (moveX !== 0) {
      const bx  = world.getBlock(Math.floor(this.position.x + moveX + 0.3 * Math.sign(moveX)), bodyY, Math.floor(this.position.z));
      const bx2 = world.getBlock(Math.floor(this.position.x + moveX + 0.3 * Math.sign(moveX)), bodyY + 1, Math.floor(this.position.z));
      if (isPassable(bx) && isPassable(bx2)) this.position.x += moveX;
      else { this._wanderDirX = -this._wanderDirX; this._wanderTimer = 0; }
    }
    if (moveZ !== 0) {
      const bz  = world.getBlock(Math.floor(this.position.x), bodyY, Math.floor(this.position.z + moveZ + 0.3 * Math.sign(moveZ)));
      const bz2 = world.getBlock(Math.floor(this.position.x), bodyY + 1, Math.floor(this.position.z + moveZ + 0.3 * Math.sign(moveZ)));
      if (isPassable(bz) && isPassable(bz2)) this.position.z += moveZ;
      else { this._wanderDirZ = -this._wanderDirZ; this._wanderTimer = 0; }
    }

    if (this._knockbackVel.lengthSq() > 0.01) {
      const kbX = this._knockbackVel.x * dt;
      const kbZ = this._knockbackVel.z * dt;
      const bkY = Math.floor(this.position.y);
      const kbBX  = world.getBlock(Math.floor(this.position.x + kbX + 0.3 * Math.sign(kbX)), bkY, Math.floor(this.position.z));
      const kbBX2 = world.getBlock(Math.floor(this.position.x + kbX + 0.3 * Math.sign(kbX)), bkY + 1, Math.floor(this.position.z));
      if (isPassable(kbBX) && isPassable(kbBX2)) this.position.x += kbX;
      const kbBZ  = world.getBlock(Math.floor(this.position.x), bkY, Math.floor(this.position.z + kbZ + 0.3 * Math.sign(kbZ)));
      const kbBZ2 = world.getBlock(Math.floor(this.position.x), bkY + 1, Math.floor(this.position.z + kbZ + 0.3 * Math.sign(kbZ)));
      if (isPassable(kbBZ) && isPassable(kbBZ2)) this.position.z += kbZ;
      this._knockbackVel.multiplyScalar(Math.pow(0.08, dt));
      if (this._knockbackVel.lengthSq() < 0.01) this._knockbackVel.set(0, 0, 0);
    }

    const groundY = world.getHeight(Math.floor(this.position.x), Math.floor(this.position.z));
    this.position.y = groundY + 0.7;
    this.mesh.position.copy(this.position);

    if (Math.abs(moveX) + Math.abs(moveZ) > 0.001) {
      this.mesh.rotation.y = Math.atan2(moveX, moveZ);
      this._walkTime += dt * 8;
      const swing = Math.sin(this._walkTime) * 0.4;
      // 脚インデックス（5〜6）
      if (this.mesh.children[5]) this.mesh.children[5].rotation.x =  swing;
      if (this.mesh.children[6]) this.mesh.children[6].rotation.x = -swing;
    }

    return null;
  }
}

// ---- 豚メッシュ生成 ----

function createPigMesh() {
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf0a0a0 });
  const snoutMat = new THREE.MeshLambertMaterial({ color: 0xe88080 });
  const legMat   = new THREE.MeshLambertMaterial({ color: 0xe07070 });

  const group = new THREE.Group();

  // 胴体（横長）
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.48), bodyMat);
  body.position.set(0, 0.72, 0);
  group.add(body);

  // 頭
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 0.42), bodyMat);
  head.position.set(0, 0.88, 0.46);
  group.add(head);

  // 鼻（丸みのある四角）
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.12), snoutMat);
  snout.position.set(0, 0.82, 0.69);
  group.add(snout);

  // 耳（小さな三角っぽいもの）
  const earGeo = new THREE.BoxGeometry(0.14, 0.14, 0.06);
  const leftEar = new THREE.Mesh(earGeo, snoutMat);
  leftEar.position.set(-0.16, 1.07, 0.44);
  group.add(leftEar);
  const rightEar = new THREE.Mesh(earGeo, snoutMat);
  rightEar.position.set(0.16, 1.07, 0.44);
  group.add(rightEar);

  // 4本の脚
  const legGeo = new THREE.BoxGeometry(0.18, 0.4, 0.18);
  for (const [x, z] of [[-0.28, 0.16], [0.28, 0.16], [-0.28, -0.16], [0.28, -0.16]]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, 0.2, z);
    group.add(leg);
  }

  return { group, mats: { body: bodyMat, snout: snoutMat, leg: legMat } };
}

// ---- Pig クラス ----

class Pig {
  constructor(scene, position) {
    this.name = '豚';
    this.isAnimal = true;
    this.scene = scene;
    this.position = position.clone();
    this.health = PIG_HP;
    this.maxHealth = PIG_HP;
    this.isAlive = true;

    this._walkTime = 0;
    this._wanderDirX = 0;
    this._wanderDirZ = 0;
    this._wanderTimer = Math.random() * PIG_WANDER_INTERVAL;

    this._fleeing = false;
    this._fleeTimer = 0;
    this._fleeDirX = 0;
    this._fleeDirZ = 0;

    this._knockbackVel = new THREE.Vector3();
    this._flashTimer = 0;

    const { group, mats } = createPigMesh();
    this.mesh = group;
    this._mats = mats;
    this._origColors = {
      body:  mats.body.color.clone(),
      snout: mats.snout.color.clone(),
      leg:   mats.leg.color.clone(),
    };

    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  takeDamage(amount) {
    if (!this.isAlive) return 0;
    const prev = this.health;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this._die();
    return prev - this.health;
  }

  flashHit() {
    if (!this.isAlive) return;
    this._flashTimer = HIT_FLASH_DURATION;
    this._mats.body.color.copy(HIT_FLASH_COLOR);
    this._mats.snout.color.copy(HIT_FLASH_COLOR);
    this._mats.leg.color.copy(HIT_FLASH_COLOR);
  }

  applyKnockback(fromX, fromZ, force) {
    if (!this.isAlive) return;
    const dx = this.position.x - fromX;
    const dz = this.position.z - fromZ;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) {
      this._knockbackVel.set(force, 0, 0);
      this._fleeDirX = 1; this._fleeDirZ = 0;
    } else {
      this._knockbackVel.set((dx / len) * force, 0, (dz / len) * force);
      this._fleeDirX = dx / len;
      this._fleeDirZ = dz / len;
    }
    this._fleeing = true;
    this._fleeTimer = PIG_FLEE_DURATION;
  }

  drops() {
    const count = 1 + (Math.random() < 0.5 ? 1 : 0);
    return [{ type: BlockType.PORK_CHOP, count }];
  }

  _die() {
    if (!this.isAlive) return;
    this.isAlive = false;
    this.scene.remove(this.mesh);
    this._mats.body.dispose();
    this._mats.snout.dispose();
    this._mats.leg.dispose();
    this.mesh.traverse((obj) => {
      if (obj.isMesh) obj.geometry.dispose();
    });
  }

  _restoreColors() {
    this._mats.body.color.copy(this._origColors.body);
    this._mats.snout.color.copy(this._origColors.snout);
    this._mats.leg.color.copy(this._origColors.leg);
  }

  update(dt, playerPos, world, isDay) {
    if (!this.isAlive) return null;

    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) this._restoreColors();
    }

    let moveX = 0;
    let moveZ = 0;

    if (this._fleeing) {
      this._fleeTimer -= dt;
      if (this._fleeTimer <= 0) {
        this._fleeing = false;
      } else {
        moveX = this._fleeDirX * PIG_FLEE_SPEED * dt;
        moveZ = this._fleeDirZ * PIG_FLEE_SPEED * dt;
      }
    } else {
      this._wanderTimer -= dt;
      if (this._wanderTimer <= 0) {
        this._wanderTimer = PIG_WANDER_INTERVAL * (0.5 + Math.random());
        const angle = Math.random() * Math.PI * 2;
        const moving = Math.random() > 0.3;
        this._wanderDirX = moving ? Math.cos(angle) : 0;
        this._wanderDirZ = moving ? Math.sin(angle) : 0;
      }
      moveX = this._wanderDirX * PIG_SPEED * dt;
      moveZ = this._wanderDirZ * PIG_SPEED * dt;
    }

    const bodyY = Math.floor(this.position.y);
    if (moveX !== 0) {
      const bx  = world.getBlock(Math.floor(this.position.x + moveX + 0.4 * Math.sign(moveX)), bodyY, Math.floor(this.position.z));
      const bx2 = world.getBlock(Math.floor(this.position.x + moveX + 0.4 * Math.sign(moveX)), bodyY + 1, Math.floor(this.position.z));
      if (isPassable(bx) && isPassable(bx2)) this.position.x += moveX;
      else { this._wanderDirX = -this._wanderDirX; this._wanderTimer = 0; }
    }
    if (moveZ !== 0) {
      const bz  = world.getBlock(Math.floor(this.position.x), bodyY, Math.floor(this.position.z + moveZ + 0.4 * Math.sign(moveZ)));
      const bz2 = world.getBlock(Math.floor(this.position.x), bodyY + 1, Math.floor(this.position.z + moveZ + 0.4 * Math.sign(moveZ)));
      if (isPassable(bz) && isPassable(bz2)) this.position.z += moveZ;
      else { this._wanderDirZ = -this._wanderDirZ; this._wanderTimer = 0; }
    }

    if (this._knockbackVel.lengthSq() > 0.01) {
      const kbX = this._knockbackVel.x * dt;
      const kbZ = this._knockbackVel.z * dt;
      const bkY = Math.floor(this.position.y);
      const kbBX  = world.getBlock(Math.floor(this.position.x + kbX + 0.4 * Math.sign(kbX)), bkY, Math.floor(this.position.z));
      const kbBX2 = world.getBlock(Math.floor(this.position.x + kbX + 0.4 * Math.sign(kbX)), bkY + 1, Math.floor(this.position.z));
      if (isPassable(kbBX) && isPassable(kbBX2)) this.position.x += kbX;
      const kbBZ  = world.getBlock(Math.floor(this.position.x), bkY, Math.floor(this.position.z + kbZ + 0.4 * Math.sign(kbZ)));
      const kbBZ2 = world.getBlock(Math.floor(this.position.x), bkY + 1, Math.floor(this.position.z + kbZ + 0.4 * Math.sign(kbZ)));
      if (isPassable(kbBZ) && isPassable(kbBZ2)) this.position.z += kbZ;
      this._knockbackVel.multiplyScalar(Math.pow(0.08, dt));
      if (this._knockbackVel.lengthSq() < 0.01) this._knockbackVel.set(0, 0, 0);
    }

    const groundY = world.getHeight(Math.floor(this.position.x), Math.floor(this.position.z));
    this.position.y = groundY + 1;
    this.mesh.position.copy(this.position);

    if (Math.abs(moveX) + Math.abs(moveZ) > 0.001) {
      this.mesh.rotation.y = Math.atan2(moveX, moveZ);
      this._walkTime += dt * 5;
      const swing = Math.sin(this._walkTime) * 0.35;
      // 脚インデックス（5〜8）
      for (let li = 5; li <= 8; li++) {
        const child = this.mesh.children[li];
        if (child) child.rotation.x = (li % 2 === 1 ? swing : -swing);
      }
    }

    return null;
  }
}

// ---- MobManager クラス ----

export class MobManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    /** @type {Array<Zombie|Cow>} */
    this.mobs = [];
    this.spawnTimer = MOB_SPAWN_INTERVAL;
    this.animalSpawnTimer = ANIMAL_SPAWN_INTERVAL * 0.3; // 最初は早めにスポーン
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
   * @param {(x: number, y: number, z: number, radius: number, damage: number) => void} onExplosion
   */
  update(dt, playerPos, isDay, onMobAttack, onExplosion) {
    // 夜間スポーン（ゾンビ・スケルトン・クリーパー）
    if (!isDay) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = MOB_SPAWN_INTERVAL;
        this._trySpawn(playerPos);
      }
    } else {
      this.spawnTimer = Math.min(this.spawnTimer, MOB_SPAWN_INTERVAL * 0.3);
    }

    // 昼間スポーン（動物）
    if (isDay) {
      this.animalSpawnTimer -= dt;
      if (this.animalSpawnTimer <= 0) {
        this.animalSpawnTimer = ANIMAL_SPAWN_INTERVAL;
        this._trySpawnAnimal(playerPos);
      }
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
      } else if (result?.type === 'explosion') {
        if (onExplosion) {
          onExplosion(result.x, result.y, result.z, result.radius, result.damage);
        }
        // 爆発後はモブ除去
        this.mobs.splice(i, 1);
      }
    }
  }

  _trySpawnAnimal(playerPos) {
    const animalCount = this.mobs.filter((m) => m.isAnimal).length;
    if (animalCount >= ANIMAL_MAX_COUNT) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = MOB_SPAWN_MIN_DIST + Math.random() * (MOB_SPAWN_MAX_DIST - MOB_SPAWN_MIN_DIST);
    const x = playerPos.x + Math.cos(angle) * dist;
    const z = playerPos.z + Math.sin(angle) * dist;
    const groundY = this.world.getHeight(Math.floor(x), Math.floor(z));

    if (groundY <= MOB_SEA_LEVEL_MIN) return;

    // 草地ブロックの上にのみスポーン
    const surfaceBlock = this.world.getBlock(Math.floor(x), groundY, Math.floor(z));
    if (surfaceBlock !== BlockType.GRASS) return;

    // バイオームに応じた動物スポーン
    const biome = this.world.getBiome ? this.world.getBiome(Math.floor(x), Math.floor(z)) : 'plains';
    const roll = Math.random();
    if (biome === 'jungle') {
      // ジャングル: 豚とニワトリが多い
      if (roll < 0.5) {
        this.mobs.push(new Pig(this.scene, new THREE.Vector3(x, groundY + 1, z)));
      } else if (roll < 0.8) {
        this.mobs.push(new Chicken(this.scene, new THREE.Vector3(x, groundY + 0.7, z)));
      } else {
        this.mobs.push(new Cow(this.scene, new THREE.Vector3(x, groundY + 1, z)));
      }
    } else if (biome === 'savanna') {
      // サバンナ: 牛・羊が多い
      if (roll < 0.5) {
        this.mobs.push(new Cow(this.scene, new THREE.Vector3(x, groundY + 1, z)));
      } else if (roll < 0.85) {
        this.mobs.push(new Sheep(this.scene, new THREE.Vector3(x, groundY + 1, z)));
      } else {
        this.mobs.push(new Chicken(this.scene, new THREE.Vector3(x, groundY + 0.7, z)));
      }
    } else {
      // 平原・森・桜の森など: 均等
      if (roll < 0.35) {
        this.mobs.push(new Cow(this.scene, new THREE.Vector3(x, groundY + 1, z)));
      } else if (roll < 0.60) {
        this.mobs.push(new Pig(this.scene, new THREE.Vector3(x, groundY + 1, z)));
      } else if (roll < 0.80) {
        this.mobs.push(new Sheep(this.scene, new THREE.Vector3(x, groundY + 1, z)));
      } else {
        this.mobs.push(new Chicken(this.scene, new THREE.Vector3(x, groundY + 0.7, z)));
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

    // ランダムにモブ種別を選択（ゾンビ40%・スケルトン25%・クリーパー15%・クモ20%）
    const roll = Math.random();
    let mob;
    if (roll < 0.4) {
      mob = new Zombie(this.scene, new THREE.Vector3(x, groundY + 1, z));
    } else if (roll < 0.65) {
      mob = new Skeleton(this.scene, new THREE.Vector3(x, groundY + 1, z));
    } else if (roll < 0.8) {
      mob = new Creeper(this.scene, new THREE.Vector3(x, groundY + 1, z));
    } else {
      mob = new Spider(this.scene, new THREE.Vector3(x, groundY + 0.6, z));
    }
    this.mobs.push(mob);
  }

  removeAll() {
    for (const mob of this.mobs) {
      if (mob.isAlive) mob._die();
    }
    this.mobs = [];
  }
}
