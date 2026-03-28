// Player controller: FPS camera, movement, physics, block interaction
import * as THREE from 'three';
import { BlockType } from './blocks.js';

const MOVE_SPEED = 5;
const SPRINT_MULTIPLIER = 1.3;
const SNEAK_MULTIPLIER = 0.4;
const JUMP_FORCE = 8;
const GRAVITY = 20;
const WATER_GRAVITY = 5;
const WATER_SPEED_MULTIPLIER = 0.4;
const SWIM_FORCE = 8;
const PLAYER_HEIGHT = 1.62;
const PLAYER_RADIUS = 0.3;
const PLAYER_COLLISION_HEIGHT = 1.8;
const DEFAULT_MOUSE_SENSITIVITY = 0.002;
const COLLISION_EPSILON = 0.001;
const DEFAULT_MAX_HEALTH = 20;
const HEALTH_REGEN_COOLDOWN = 3.5;

const HEALTH_REGEN_TIERS = [
  { maxRatio: 0.35, perSecond: 0.7 },
  { maxRatio: 0.75, perSecond: 1.15 },
  { maxRatio: 1, perSecond: 0.85 },
];

export class Player {
  constructor(camera, world, options = {}) {
    this.camera = camera;
    this.world = world;

    this.position = new THREE.Vector3(8, 40, 8);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.pitch = 0;
    this.yaw = 0;

    this.onGround = false;
    this.isSprinting = false;
    this.isSneaking = false;
    this.isInWater = false;
    this.keys = {};
    this.locked = false;
    this._wLastPress = 0;
    this._sprintByDoubleTap = false;
    this.mouseSensitivity = options.mouseSensitivity ?? DEFAULT_MOUSE_SENSITIVITY;

    // クリエイティブモード・飛行
    this.isCreative = false;
    this.isFlying = false;
    this._spaceLastPress = 0;

    this.maxHealth = options.maxHealth ?? DEFAULT_MAX_HEALTH;
    this.health = this.maxHealth;
    this.healthRegenCooldown = 0;
    this.regenEnabled = true;
    this.armorDefense = 0; // 防具による防御ポイント（1pt = 4%軽減, 最大20pt = 80%）

    // ノックバック速度（攻撃を受けたときに加算、毎フレーム減衰）
    this.knockbackVelocity = new THREE.Vector3();

    // カメラヘッドボブ（歩行時の上下揺れ）
    this._bobPhase = 0;
    this._bobAmplitude = 0;
    this._bobTargetAmp = 0;

    this._initControls();
  }

  _initControls() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      // W連打でスプリント開始
      if (e.code === 'KeyW') {
        const now = performance.now();
        if (now - this._wLastPress < 300) this._sprintByDoubleTap = true;
        this._wLastPress = now;
      }
      // 後退キーでスプリント解除
      if (e.code === 'KeyS') this._sprintByDoubleTap = false;
      // クリエイティブ飛行: スペース2連打で飛行モード切替
      if (e.code === 'Space' && this.isCreative) {
        const now = performance.now();
        if (now - this._spaceLastPress < 350) {
          this.isFlying = !this.isFlying;
          if (!this.isFlying) this.velocity.y = 0;
        }
        this._spaceLastPress = now;
      }
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      // W離したらダブルタップスプリント解除
      if (e.code === 'KeyW') this._sprintByDoubleTap = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * this.mouseSensitivity;
      this.pitch -= e.movementY * this.mouseSensitivity;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === document.body;
    });
  }

  lock() {
    document.body.requestPointerLock();
  }

  spawn() {
    const spawnY = this.world.getSpawnHeight(8, 8);
    this.position.set(8, spawnY, 8);
    this.velocity.set(0, 0, 0);
    this.restoreHealth();
  }

  update(dt) {
    dt = Math.min(dt, 0.05); // Cap delta

    // 水中・溶岩中判定（足元ブロック）
    const feetBlock = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.5),
      Math.floor(this.position.z)
    );
    this.isInWater = feetBlock === BlockType.WATER;
    this.isInLava  = feetBlock === BlockType.LAVA;

    // 氷上判定（前フレームの接地状態と足元1マス下ブロックで判定）
    const isOnIce = this.onGround && this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y - 0.01),
      Math.floor(this.position.z)
    ) === BlockType.ICE;

    // Movement direction
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3(0, 0, 0);
    if (this.keys['KeyW']) moveDir.add(forward);
    if (this.keys['KeyS']) moveDir.sub(forward);
    if (this.keys['KeyA']) moveDir.sub(right);
    if (this.keys['KeyD']) moveDir.add(right);

    if (moveDir.length() > 0) moveDir.normalize();

    // クリエイティブ飛行中の処理
    if (this.isCreative && this.isFlying) {
      const flySpeed = MOVE_SPEED * 2.5;
      this.velocity.x = moveDir.x * flySpeed;
      this.velocity.z = moveDir.z * flySpeed;
      // 上下移動: Space=上昇, Shift=下降
      const flyVertSpeed = MOVE_SPEED * 2.0;
      if (this.keys['Space']) {
        this.velocity.y = flyVertSpeed;
      } else if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
        this.velocity.y = -flyVertSpeed;
      } else {
        // 急停止
        this.velocity.y *= Math.pow(0.001, dt);
      }
    } else {
      // スプリント（CtrlまたはControl長押し）・スニーク（Shift長押し）
      this.isSprinting = (this.keys['ControlLeft'] || this.keys['ControlRight'] || this._sprintByDoubleTap) && this.onGround && moveDir.length() > 0 && !this.isInWater;
      this.isSneaking = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.isSprinting;

      let speed = MOVE_SPEED;
      if (this.isSprinting) speed *= SPRINT_MULTIPLIER;
      else if (this.isSneaking) speed *= SNEAK_MULTIPLIER;
      if (this.isInWater) speed *= WATER_SPEED_MULTIPLIER;
      else if (this.isInLava) speed *= WATER_SPEED_MULTIPLIER * 0.5; // 溶岩は水より遅い

      // Horizontal velocity（氷上は慣性が大きく滑る）
      const targetVelX = moveDir.x * speed;
      const targetVelZ = moveDir.z * speed;
      if (isOnIce) {
        const iceAccel = 3.5; // 通常のsetより遅い変化
        this.velocity.x += (targetVelX - this.velocity.x) * Math.min(1, iceAccel * dt);
        this.velocity.z += (targetVelZ - this.velocity.z) * Math.min(1, iceAccel * dt);
      } else {
        this.velocity.x = targetVelX;
        this.velocity.z = targetVelZ;
      }

      // ノックバック加算・減衰（1秒でほぼ消える）
      if (this.knockbackVelocity.lengthSq() > 0.01) {
        this.velocity.x += this.knockbackVelocity.x;
        this.velocity.z += this.knockbackVelocity.z;
        this.velocity.y = Math.max(this.velocity.y, this.knockbackVelocity.y);
        this.knockbackVelocity.multiplyScalar(Math.pow(0.08, dt));
        if (this.knockbackVelocity.lengthSq() < 0.01) this.knockbackVelocity.set(0, 0, 0);
      }

      if (this.isInWater) {
        // 水中: Spaceで浮上、浮力で上昇減速
        if (this.keys['Space']) {
          // 頭が水面から出ている（水面付近）は通常ジャンプ力で陸地に上がれる
          this.velocity.y = this.isHeadInWater() ? SWIM_FORCE : JUMP_FORCE;
        }
        // 水中重力（浮力で軽減）
        this.velocity.y -= WATER_GRAVITY * dt;
        // 水中では速度を減衰させる
        this.velocity.y *= (1 - 2 * dt);
      } else if (this.isInLava) {
        // 溶岩中: 水中と同様だが浮力は弱め
        if (this.keys['Space']) {
          this.velocity.y = SWIM_FORCE * 0.55;
        }
        this.velocity.y -= WATER_GRAVITY * 1.4 * dt;
        this.velocity.y *= (1 - 3 * dt);
      } else {
        // 通常ジャンプ
        if (this.keys['Space'] && this.onGround) {
          this.velocity.y = JUMP_FORCE;
          this.onGround = false;
        }
        // 重力
        this.velocity.y -= GRAVITY * dt;
      }
    }

    // Move and collide
    this._moveAxis('y', this.velocity.y * dt);
    this._moveAxis('x', this.velocity.x * dt);
    this._moveAxis('z', this.velocity.z * dt);

    // Prevent falling below world
    if (this.position.y < -10) {
      this.spawn();
    }

    this._updateHealth(dt);

    // カメラヘッドボブ: 地上歩行時に自然な揺れを追加
    const isMovingOnGround = moveDir.length() > 0 && this.onGround && !this.isInWater && !this.isInLava;
    this._bobTargetAmp = isMovingOnGround ? (this.isSprinting ? 0.072 : 0.042) : 0;
    // 滑らかに振幅を変化させる
    this._bobAmplitude += (this._bobTargetAmp - this._bobAmplitude) * Math.min(1, 10 * dt);
    if (this._bobAmplitude > 0.002) {
      const bobSpeed = this.isSprinting ? 13 : 8.5;
      this._bobPhase += bobSpeed * dt;
    }
    const bobOffset = Math.sin(this._bobPhase) * this._bobAmplitude;

    // Update camera
    this.camera.position.copy(this.position);
    this.camera.position.y += PLAYER_HEIGHT + bobOffset;

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  _moveAxis(axis, amount) {
    if (amount === 0) {
      if (axis === 'y') {
        this.onGround = this._hasGroundSupport();
      }
      return;
    }

    const wasOnGround = this.onGround;
    this.position[axis] += amount;

    const bounds = this._getBounds();
    let collided = false;

    if (axis === 'x') {
      collided = this._resolveHorizontalCollision(bounds, amount, 'x');
      if (collided) this.velocity.x = 0;
      // スニーク時エッジ防止: 移動後に地面サポートがなければ戻す
      if (!collided && this.isSneaking && wasOnGround && !this._hasGroundSupport()) {
        this.position.x -= amount;
        this.velocity.x = 0;
      }
    } else if (axis === 'z') {
      collided = this._resolveHorizontalCollision(bounds, amount, 'z');
      if (collided) this.velocity.z = 0;
      // スニーク時エッジ防止: 移動後に地面サポートがなければ戻す
      if (!collided && this.isSneaking && wasOnGround && !this._hasGroundSupport()) {
        this.position.z -= amount;
        this.velocity.z = 0;
      }
    } else if (axis === 'y') {
      this.onGround = false;
      collided = this._resolveVerticalCollision(bounds, amount);
      if (collided) this.velocity.y = 0;
      if (!collided && amount <= 0) {
        this.onGround = this._hasGroundSupport();
      }
    }
  }

  _getBounds() {
    return {
      minX: this.position.x - PLAYER_RADIUS,
      maxX: this.position.x + PLAYER_RADIUS,
      minY: this.position.y,
      maxY: this.position.y + PLAYER_COLLISION_HEIGHT,
      minZ: this.position.z - PLAYER_RADIUS,
      maxZ: this.position.z + PLAYER_RADIUS,
    };
  }

  _resolveHorizontalCollision(bounds, amount, axis) {
    const checkCoord = amount > 0
      ? Math.floor((axis === 'x' ? bounds.maxX : bounds.maxZ) - COLLISION_EPSILON)
      : Math.floor((axis === 'x' ? bounds.minX : bounds.minZ) + COLLISION_EPSILON);

    const minY = Math.floor(bounds.minY + COLLISION_EPSILON);
    const maxY = Math.floor(bounds.maxY - COLLISION_EPSILON);
    const minOther = Math.floor((axis === 'x' ? bounds.minZ : bounds.minX) + COLLISION_EPSILON);
    const maxOther = Math.floor((axis === 'x' ? bounds.maxZ : bounds.maxX) - COLLISION_EPSILON);

    for (let y = minY; y <= maxY; y++) {
      for (let other = minOther; other <= maxOther; other++) {
        const bx = axis === 'x' ? checkCoord : other;
        const bz = axis === 'x' ? other : checkCoord;
        if (!this._isSolidBlock(bx, y, bz)) continue;

        if (axis === 'x') {
          this.position.x = amount > 0
            ? bx - PLAYER_RADIUS - COLLISION_EPSILON
            : bx + 1 + PLAYER_RADIUS + COLLISION_EPSILON;
        } else {
          this.position.z = amount > 0
            ? bz - PLAYER_RADIUS - COLLISION_EPSILON
            : bz + 1 + PLAYER_RADIUS + COLLISION_EPSILON;
        }
        return true;
      }
    }

    return false;
  }

  _resolveVerticalCollision(bounds, amount) {
    const checkY = amount > 0
      ? Math.floor(bounds.maxY - COLLISION_EPSILON)
      : Math.floor(bounds.minY + COLLISION_EPSILON);
    const minX = Math.floor(bounds.minX + COLLISION_EPSILON);
    const maxX = Math.floor(bounds.maxX - COLLISION_EPSILON);
    const minZ = Math.floor(bounds.minZ + COLLISION_EPSILON);
    const maxZ = Math.floor(bounds.maxZ - COLLISION_EPSILON);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (!this._isSolidBlock(x, checkY, z)) continue;

        if (amount > 0) {
          this.position.y = checkY - PLAYER_COLLISION_HEIGHT - COLLISION_EPSILON;
        } else {
          this.position.y = checkY + 1 + COLLISION_EPSILON;
          this.onGround = true;
        }
        return true;
      }
    }

    return false;
  }

  _hasGroundSupport() {
    const bounds = this._getBounds();
    const supportY = Math.floor(bounds.minY - COLLISION_EPSILON);
    const minX = Math.floor(bounds.minX + COLLISION_EPSILON);
    const maxX = Math.floor(bounds.maxX - COLLISION_EPSILON);
    const minZ = Math.floor(bounds.minZ + COLLISION_EPSILON);
    const maxZ = Math.floor(bounds.maxZ - COLLISION_EPSILON);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (this._isSolidBlock(x, supportY, z)) {
          return true;
        }
      }
    }

    return false;
  }

  _isSolidBlock(x, y, z) {
    const block = this.world.getBlock(x, y, z);
    return block !== BlockType.AIR &&
           block !== BlockType.WATER &&
           block !== BlockType.LAVA &&
           block !== BlockType.TALL_GRASS &&
           block !== BlockType.FLOWER &&
           block !== BlockType.MUSHROOM;
  }

  // 頭部が水中にあるか判定
  isHeadInWater() {
    const block = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + PLAYER_HEIGHT),
      Math.floor(this.position.z)
    );
    return block === BlockType.WATER;
  }

  // 頭部が固体ブロック内にあるか判定（窒息）
  isHeadInSolid() {
    const block = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + PLAYER_HEIGHT),
      Math.floor(this.position.z)
    );
    return block !== BlockType.AIR && block !== BlockType.WATER;
  }

  getDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }

  getEyePosition() {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + PLAYER_HEIGHT,
      this.position.z
    );
  }

  intersectsBlock(x, y, z) {
    const bounds = this._getBounds();

    const blockMinX = x;
    const blockMaxX = x + 1;
    const blockMinY = y;
    const blockMaxY = y + 1;
    const blockMinZ = z;
    const blockMaxZ = z + 1;

    return (
      bounds.minX < blockMaxX &&
      bounds.maxX > blockMinX &&
      bounds.minY < blockMaxY &&
      bounds.maxY > blockMinY &&
      bounds.minZ < blockMaxZ &&
      bounds.maxZ > blockMinZ
    );
  }

  setMouseSensitivity(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    this.mouseSensitivity = Math.min(Math.max(num, 0.0005), 0.008);
  }

  /** モブ側の位置から弾き飛ばされる方向にノックバックを適用 */
  applyKnockback(fromX, fromZ, force) {
    const dx = this.position.x - fromX;
    const dz = this.position.z - fromZ;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) return;
    this.knockbackVelocity.set(
      (dx / len) * force,
      force * 0.5,   // 少し上に飛ぶ
      (dz / len) * force,
    );
  }

  applyDamage(amount) {
    const damage = Math.max(0, Number(amount) || 0);
    if (damage <= 0) return 0;

    // 防具による軽減（最大80%、1ポイント = 4%軽減）
    const reduction = Math.min(0.8, this.armorDefense * 0.04);
    const effectiveDamage = reduction > 0
      ? Math.max(1, Math.ceil(damage * (1 - reduction)))
      : damage;

    const prev = this.health;
    this.health = Math.max(0, this.health - effectiveDamage);
    this.healthRegenCooldown = HEALTH_REGEN_COOLDOWN;
    return prev - this.health;
  }

  heal(amount) {
    const healAmount = Math.max(0, Number(amount) || 0);
    if (healAmount <= 0) return 0;

    const prev = this.health;
    this.health = Math.min(this.maxHealth, this.health + healAmount);
    return this.health - prev;
  }

  restoreHealth() {
    this.health = this.maxHealth;
    this.healthRegenCooldown = 0;
  }

  getHealthRatio() {
    if (this.maxHealth <= 0) return 0;
    return this.health / this.maxHealth;
  }

  _updateHealth(dt) {
    if (this.health >= this.maxHealth) return;

    if (!this.regenEnabled) return; // 空腹時は回復しない

    if (this.healthRegenCooldown > 0) {
      this.healthRegenCooldown = Math.max(0, this.healthRegenCooldown - dt);
      return;
    }

    // Regen is intentionally gated to grounded state so players can recover safely.
    if (this.onGround) {
      this.heal(this._getHealthRegenPerSecond() * dt);
    }
  }

  _getHealthRegenPerSecond() {
    if (this.maxHealth <= 0) return 0;

    const ratio = this.health / this.maxHealth;
    const tier = HEALTH_REGEN_TIERS.find((entry) => ratio <= entry.maxRatio);
    return tier ? tier.perSecond : HEALTH_REGEN_TIERS[HEALTH_REGEN_TIERS.length - 1].perSecond;
  }
}
