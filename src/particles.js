// パーティクルシステム: ブロック破壊・設置エフェクト
import * as THREE from 'three';

const GRAVITY = 18;          // パーティクル重力加速度
const LIFETIME = 0.55;        // パーティクル生存時間（秒）
const PARTICLE_COUNT = 8;    // 1ブロック破壊で生成する粒子数

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = []; // { mesh, vx, vy, vz, age }
  }

  /**
   * ブロック破壊パーティクルを生成する
   * @param {number} bx - ブロックX座標
   * @param {number} by - ブロックY座標
   * @param {number} bz - ブロックZ座標
   * @param {THREE.Material} material - パーティクルに使うマテリアル（ブロックの上面テクスチャ）
   */
  spawnBreak(bx, by, bz, material) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const size = 0.1 + Math.random() * 0.15;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mesh = new THREE.Mesh(geo, material);

      // ブロック内のランダムな位置から出現
      mesh.position.set(
        bx + 0.2 + Math.random() * 0.6,
        by + 0.2 + Math.random() * 0.6,
        bz + 0.2 + Math.random() * 0.6
      );

      // 放射状に飛ぶ初速
      const speed = 2.0 + Math.random() * 3.0;
      const angle = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.3) * Math.PI;
      const vx = Math.cos(angle) * Math.cos(pitch) * speed;
      const vy = Math.sin(pitch) * speed + 1.5; // 上方向に少し強め
      const vz = Math.sin(angle) * Math.cos(pitch) * speed;

      this.scene.add(mesh);
      this.particles.push({ mesh, vx, vy, vz, age: 0 });
    }
  }

  /**
   * フレームごとにパーティクルを更新
   * @param {number} dt - デルタタイム（秒）
   */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;

      if (p.age >= LIFETIME) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // 物理: 重力と移動
      p.vy -= GRAVITY * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      // 速度減衰（空気抵抗）
      const drag = 1 - 3 * dt;
      p.vx *= drag;
      p.vz *= drag;

      // フェードアウト
      const fade = 1 - p.age / LIFETIME;
      p.mesh.material.opacity = fade;
      p.mesh.material.transparent = true;

      // 回転
      p.mesh.rotation.x += dt * 4;
      p.mesh.rotation.z += dt * 3;
    }
  }

  /** 全パーティクルを破棄 */
  dispose() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
    }
    this.particles = [];
  }
}
