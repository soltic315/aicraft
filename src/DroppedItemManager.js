// ドロップアイテムシステム: 床に落ちるアイテムの物理・描画・ピックアップ管理
import * as THREE from 'three';
import { BlockType } from './blocks.js';

const ITEM_SIZE = 0.3;           // アイテムキューブのサイズ
const ITEM_GRAVITY = 22;         // 重力加速度（ブロック/秒²）
const PICKUP_DISTANCE = 1.4;     // ピックアップ可能距離（ブロック）
const PICKUP_DELAY = 0.5;        // スポーン後のピックアップ待機時間（秒）
const DESPAWN_TIME = 300;        // デスポーンまでの時間（秒）
const BOBBING_SPEED = 2.2;       // 上下ボビング速度
const BOBBING_HEIGHT = 0.08;     // 上下ボビング高さ（ブロック）
const SPIN_SPEED = 1.8;          // 回転速度（ラジアン/秒）

// ブロックタイプごとの表示色
const ITEM_COLORS = {
  [BlockType.GRASS]: 0x5d9e3e,
  [BlockType.DIRT]: 0x8B6914,
  [BlockType.STONE]: 0x888888,
  [BlockType.WOOD]: 0x7a5c10,
  [BlockType.LEAVES]: 0x3a7a20,
  [BlockType.SAND]: 0xd4c06a,
  [BlockType.WATER]: 0x3a7fd4,
  [BlockType.PLANK]: 0xc09a44,
  [BlockType.GLASS]: 0xaaddff,
  [BlockType.CRAFTING_TABLE]: 0x8B5e14,
  [BlockType.CHEST]: 0xb87c2c,
  [BlockType.APPLE]: 0xd63020,
  [BlockType.PICKAXE]: 0x999999,
  [BlockType.AXE]: 0x999999,
  [BlockType.SHOVEL]: 0x999999,
};

function createItemMesh(type) {
  const color = ITEM_COLORS[type] ?? 0xffffff;
  const geo = new THREE.BoxGeometry(ITEM_SIZE, ITEM_SIZE, ITEM_SIZE);
  const mat = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  return mesh;
}

class DroppedItem {
  constructor(scene, type, count, x, y, z) {
    this.type = type;
    this.count = count;
    this.age = 0;
    this.pickupDelay = PICKUP_DELAY;
    this.onGround = false;
    this.baseY = y;
    // 位相をランダムにして複数アイテムが同期しないようにする
    this.bobbingTime = Math.random() * Math.PI * 2;

    this.position = new THREE.Vector3(x, y, z);
    // スポーン時の初速（少し上に飛ばす）
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2.5,
      2.5 + Math.random() * 1.5,
      (Math.random() - 0.5) * 2.5,
    );

    this.mesh = createItemMesh(type);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export class DroppedItemManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.items = [];
  }

  /**
   * ブロック破壊時にアイテムをスポーンする（ブロック座標を受け取る）
   * @param {number} x - ブロックのX座標（ブロック左端）
   * @param {number} y - ブロックのY座標（ブロック下端）
   * @param {number} z - ブロックのZ座標（ブロック左端）
   * @param {number} type - BlockType
   * @param {number} count - 個数
   */
  spawn(x, y, z, type, count = 1) {
    // ブロック中央上部からスポーン
    const item = new DroppedItem(this.scene, type, count, x + 0.5, y + 0.8, z + 0.5);
    this.items.push(item);
  }

  /**
   * ワールド座標を直接指定してアイテムをスポーンする（プレイヤードロップ時に使用）
   * @param {number} wx - ワールドX座標
   * @param {number} wy - ワールドY座標
   * @param {number} wz - ワールドZ座標
   * @param {number} type - BlockType
   * @param {number} count - 個数
   */
  spawnAt(wx, wy, wz, type, count = 1) {
    const item = new DroppedItem(this.scene, type, count, wx, wy, wz);
    // 手放し感を出すために初速を小さめに上書き
    item.velocity.set(
      (Math.random() - 0.5) * 1.5,
      2.0 + Math.random() * 1.0,
      (Math.random() - 0.5) * 1.5,
    );
    this.items.push(item);
  }

  /**
   * 毎フレーム呼び出す更新処理
   * @param {number} dt - 経過時間（秒）
   * @param {THREE.Vector3} playerPos - プレイヤー座標
   * @returns {{ type: number, count: number }[]} - ピックアップされたアイテム一覧
   */
  update(dt, playerPos) {
    const pickedUp = [];

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.age += dt;
      item.pickupDelay = Math.max(0, item.pickupDelay - dt);
      item.bobbingTime += dt;

      // デスポーン
      if (item.age > DESPAWN_TIME) {
        item.dispose(this.scene);
        this.items.splice(i, 1);
        continue;
      }

      // 物理シミュレーション
      this._updatePhysics(item, dt);

      // メッシュ位置・回転を更新
      const bobbingOffset = item.onGround
        ? Math.sin(item.bobbingTime * BOBBING_SPEED) * BOBBING_HEIGHT
        : 0;
      item.mesh.position.set(
        item.position.x,
        item.position.y + bobbingOffset,
        item.position.z,
      );
      item.mesh.rotation.y += SPIN_SPEED * dt;

      // ピックアップ判定
      if (item.pickupDelay <= 0 && playerPos) {
        const dx = item.position.x - playerPos.x;
        const dy = item.position.y - (playerPos.y + 0.9); // プレイヤー中心
        const dz = item.position.z - playerPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < PICKUP_DISTANCE * PICKUP_DISTANCE) {
          pickedUp.push({ type: item.type, count: item.count });
          item.dispose(this.scene);
          this.items.splice(i, 1);
        }
      }
    }

    return pickedUp;
  }

  _updatePhysics(item, dt) {
    if (!item.onGround) {
      // 重力を適用
      item.velocity.y -= ITEM_GRAVITY * dt;
    }

    // 次の位置を計算
    const nextX = item.position.x + item.velocity.x * dt;
    const nextY = item.position.y + item.velocity.y * dt;
    const nextZ = item.position.z + item.velocity.z * dt;

    const bx = Math.floor(nextX);
    const bz = Math.floor(nextZ);

    // Y軸衝突判定（下向き）
    if (item.velocity.y < 0) {
      const footY = nextY - ITEM_SIZE / 2;
      const footBlockY = Math.floor(footY);
      const blockBelow = this.world.getBlock(bx, footBlockY, bz);
      if (blockBelow !== undefined && blockBelow !== BlockType.AIR) {
        // 着地: ブロック上面に合わせる
        item.position.y = footBlockY + 1 + ITEM_SIZE / 2;
        item.velocity.y = 0;
        item.velocity.x *= 0.2;
        item.velocity.z *= 0.2;
        item.onGround = true;
        item.baseY = item.position.y;
      } else {
        item.position.y = nextY;
        item.onGround = false;
      }
    } else {
      item.position.y = nextY;
    }

    // X・Z方向の移動（水平衝突は省略、壁めり込みはほぼ気にならない）
    item.position.x = nextX;
    item.position.z = nextZ;

    // 地面に乗っている場合、足元が空洞になったら落下開始
    if (item.onGround) {
      const footBlockY = Math.floor(item.position.y - ITEM_SIZE / 2 - 0.05);
      const blockBelow = this.world.getBlock(Math.floor(item.position.x), footBlockY, Math.floor(item.position.z));
      if (blockBelow === BlockType.AIR || blockBelow === undefined) {
        item.onGround = false;
      }
      // 水平摩擦
      item.velocity.x *= Math.max(0, 1 - 6 * dt);
      item.velocity.z *= Math.max(0, 1 - 6 * dt);
    }
  }

  /** ゲームリセット時に全アイテムを除去 */
  removeAll() {
    for (const item of this.items) {
      item.dispose(this.scene);
    }
    this.items = [];
  }
}
