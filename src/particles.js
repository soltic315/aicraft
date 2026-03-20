// パーティクルシステム: ブロック破壊・設置・落下・葉エフェクト
import * as THREE from 'three';

const GRAVITY = 18;          // パーティクル重力加速度

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = []; // { mesh, vx, vy, vz, age, lifetime, gravityScale }
  }

  /**
   * ブロック破壊パーティクルを生成する
   */
  spawnBreak(bx, by, bz, material) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const size = 0.1 + Math.random() * 0.15;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mesh = new THREE.Mesh(geo, material);

      mesh.position.set(
        bx + 0.2 + Math.random() * 0.6,
        by + 0.2 + Math.random() * 0.6,
        bz + 0.2 + Math.random() * 0.6
      );

      const speed = 2.0 + Math.random() * 3.0;
      const angle = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.3) * Math.PI;
      const vx = Math.cos(angle) * Math.cos(pitch) * speed;
      const vy = Math.sin(pitch) * speed + 1.5;
      const vz = Math.sin(angle) * Math.cos(pitch) * speed;

      this.scene.add(mesh);
      this.particles.push({ mesh, vx, vy, vz, age: 0, lifetime: 0.55, gravityScale: 1.0 });
    }
  }

  /**
   * ブロック設置時の砂埃エフェクト
   */
  spawnPlace(bx, by, bz, material) {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const size = 0.06 + Math.random() * 0.08;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mesh = new THREE.Mesh(geo, material);

      mesh.position.set(
        bx + 0.15 + Math.random() * 0.7,
        by + 1.0,
        bz + 0.15 + Math.random() * 0.7
      );

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 0.8;
      const vx = Math.cos(angle) * speed;
      const vy = 0.6 + Math.random() * 1.2;
      const vz = Math.sin(angle) * speed;

      this.scene.add(mesh);
      this.particles.push({ mesh, vx, vy, vz, age: 0, lifetime: 0.35, gravityScale: 1.0 });
    }
  }

  /**
   * 落下着地時の土埃エフェクト
   * @param {number} intensity - 衝撃強度（落下速度に基づく）
   */
  spawnLand(px, py, pz, intensity) {
    const count = Math.floor(6 + intensity * 3);
    for (let i = 0; i < count; i++) {
      const size = 0.06 + Math.random() * 0.09;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xbbbb99,
        transparent: true,
        opacity: 0.75,
      });
      const mesh = new THREE.Mesh(geo, mat);

      mesh.position.set(
        px + (Math.random() - 0.5) * 0.8,
        py,
        pz + (Math.random() - 0.5) * 0.8
      );

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * intensity;
      const vx = Math.cos(angle) * speed;
      const vy = 0.3 + Math.random() * 0.8;
      const vz = Math.sin(angle) * speed;

      this.scene.add(mesh);
      this.particles.push({ mesh, vx, vy, vz, age: 0, lifetime: 0.45 + Math.random() * 0.2, gravityScale: 0.8 });
    }
  }

  /**
   * 葉ブロック破壊時のゆっくり落下する葉パーティクル
   */
  spawnLeafFall(bx, by, bz, material) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const size = 0.13 + Math.random() * 0.09;
      const geo = new THREE.BoxGeometry(size, size * 0.4, size);
      const mesh = new THREE.Mesh(geo, material);

      mesh.position.set(
        bx + 0.1 + Math.random() * 0.8,
        by + 0.3 + Math.random() * 0.7,
        bz + 0.1 + Math.random() * 0.8
      );

      const vx = (Math.random() - 0.5) * 0.9;
      const vy = 0.1 + Math.random() * 0.4;  // 軽く上に浮いてから落下
      const vz = (Math.random() - 0.5) * 0.9;

      this.scene.add(mesh);
      // gravityScale 低め → ゆっくり落下
      this.particles.push({ mesh, vx, vy, vz, age: 0, lifetime: 1.4 + Math.random() * 0.8, gravityScale: 0.15 });
    }
  }

  /**
   * フレームごとにパーティクルを更新
   */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;

      if (p.age >= p.lifetime) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // 物理: 重力と移動
      p.vy -= GRAVITY * (p.gravityScale ?? 1.0) * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      // 速度減衰（空気抵抗）
      const drag = 1 - 3 * dt;
      p.vx *= drag;
      p.vz *= drag;

      // フェードアウト
      const fade = 1 - p.age / p.lifetime;
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
