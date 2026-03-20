// スカイシステム: 太陽・月・星・雲・空グラデーション
import * as THREE from 'three';

export class SkyDome {
  constructor(scene) {
    this.scene = scene;
    this._cloudOffset = 0;

    this._createGradientSky();
    this._createStars();
    this._createSun();
    this._createMoon();
    this._createClouds();
  }

  // ---- 空グラデーションドーム ----
  _createGradientSky() {
    const geo = new THREE.SphereGeometry(190, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor:    { value: new THREE.Color(0x1a6bc4) },
        bottomColor: { value: new THREE.Color(0x87CEEB) },
        horizonOffset: { value: 0.1 },
        exponent:    { value: 0.5 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float horizonOffset;
        uniform float exponent;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y + horizonOffset;
          h = pow(clamp(h, 0.0, 1.0), exponent);
          gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(geo, mat);
    this.skyMesh.renderOrder = -2;
    this.scene.add(this.skyMesh);
  }

  // ---- 星 ----
  _createStars() {
    const count = 2000;
    const positions = new Float32Array(count * 3);
    const r = 180;
    for (let i = 0; i < count; i++) {
      // 球面一様分布
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(1 - 2 * v);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      sizeAttenuation: false,
    });
    this.stars = new THREE.Points(geo, this.starsMat);
    this.stars.renderOrder = -1;
    this.scene.add(this.stars);
  }

  // ---- 太陽 ----
  _createSun() {
    const geo = new THREE.SphereGeometry(6, 12, 8);
    this.sunMat = new THREE.MeshBasicMaterial({
      color: 0xffee88,
      depthWrite: false,
      transparent: true,
      opacity: 1.0,
    });
    this.sun = new THREE.Mesh(geo, this.sunMat);
    this.sun.renderOrder = -1;
    this.scene.add(this.sun);

    // 太陽の光芒（大きな半透明球）
    const glowGeo = new THREE.SphereGeometry(10, 12, 8);
    this.sunGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffdd66,
      depthWrite: false,
      transparent: true,
      opacity: 0.25,
    });
    this.sunGlow = new THREE.Mesh(glowGeo, this.sunGlowMat);
    this.sunGlow.renderOrder = -1;
    this.scene.add(this.sunGlow);
  }

  // ---- 月 ----
  _createMoon() {
    const geo = new THREE.SphereGeometry(4, 12, 8);
    this.moonMat = new THREE.MeshBasicMaterial({
      color: 0xdde8ff,
      depthWrite: false,
      transparent: true,
      opacity: 0.0,
    });
    this.moon = new THREE.Mesh(geo, this.moonMat);
    this.moon.renderOrder = -1;
    this.scene.add(this.moon);
  }

  // ---- 雲 ----
  _createClouds() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);

    // プロシージャル雲テクスチャ生成
    for (let i = 0; i < 28; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      const rx = 30 + Math.random() * 70;
      const ry = 15 + Math.random() * 30;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      grad.addColorStop(0,   'rgba(255,255,255,0.85)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.save();
      ctx.scale(rx / ry, 1);
      ctx.translate(cx * (1 - rx / ry), 0);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx * ry / rx, cy, ry, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.cloudTex = new THREE.CanvasTexture(canvas);
    this.cloudTex.wrapS = THREE.RepeatWrapping;
    this.cloudTex.wrapT = THREE.RepeatWrapping;

    const geo = new THREE.PlaneGeometry(600, 600, 1, 1);
    this.cloudMat = new THREE.MeshBasicMaterial({
      map: this.cloudTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.clouds = new THREE.Mesh(geo, this.cloudMat);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 70;
    this.scene.add(this.clouds);
  }

  /**
   * フレーム更新
   * @param {number} sunAngle - 太陽の角度（ラジアン）
   * @param {number} daylight - 昼夜比率（0=夜, 1=昼）
   * @param {THREE.Vector3} playerPos - プレイヤー位置
   * @param {number} dt - デルタタイム（秒）
   */
  update(sunAngle, daylight, playerPos, dt) {
    const px = playerPos.x;
    const py = playerPos.y;
    const pz = playerPos.z;

    // スカイドームをカメラに追従
    this.skyMesh.position.set(px, py, pz);
    this.stars.position.set(px, py, pz);
    this.sun.position.set(px, py, pz);
    this.sunGlow.position.set(px, py, pz);
    this.moon.position.set(px, py, pz);

    // 太陽の位置（DirectionalLight と同じ軌道）
    const sunDist = 155;
    const sx = Math.cos(sunAngle) * sunDist;
    const sy = Math.sin(sunAngle) * 110;
    const sz = Math.sin(sunAngle) * 65;
    this.sun.position.x += sx;
    this.sun.position.y += sy;
    this.sun.position.z += sz;
    this.sunGlow.position.copy(this.sun.position);

    // 月は太陽の反対側
    this.moon.position.x += -sx;
    this.moon.position.y += -sy + py;
    this.moon.position.z += -sz;

    // 太陽の表示（昼間）
    this.sunMat.opacity = Math.min(1.0, daylight * 3.0 - 0.5);
    this.sunGlowMat.opacity = Math.min(0.3, daylight * 0.5 - 0.1);

    // 月の表示（夜間）
    const nightness = 1.0 - daylight;
    this.moonMat.opacity = Math.min(1.0, nightness * 3.0 - 0.5);

    // 星の表示（夜間）
    this.starsMat.opacity = Math.min(0.95, nightness * 2.5 - 0.3);

    // 空グラデーションカラーを昼夜で補間
    const topDay   = new THREE.Color(0x1a6bc4); // 昼の頭上（深い青）
    const topNight = new THREE.Color(0x050d1a); // 夜の頭上（ほぼ黒）
    const botDay   = new THREE.Color(0x87CEEB); // 昼の地平線（空色）
    const botNight = new THREE.Color(0x0a1525); // 夜の地平線（暗い青）

    const topColor = new THREE.Color().lerpColors(topNight, topDay, daylight);
    const botColor = new THREE.Color().lerpColors(botNight, botDay, daylight);

    // 夕暮れ・夜明け時のオレンジ色ブレンド（日出・日没付近）
    const sunHeight = Math.sin(sunAngle);
    const dawnDusk = Math.max(0, 1.0 - Math.abs(sunHeight) * 4.0) * Math.max(0, daylight * 2 - 0.6);
    const dawnColor = new THREE.Color(0xf5802a);
    botColor.lerp(dawnColor, dawnDusk * 0.5);
    topColor.lerp(new THREE.Color(0x7a3010), dawnDusk * 0.25);

    this.skyMesh.material.uniforms.topColor.value.copy(topColor);
    this.skyMesh.material.uniforms.bottomColor.value.copy(botColor);

    // 雲: XZ でプレイヤーに追従、UV をゆっくりスクロール
    this.clouds.position.x = px;
    this.clouds.position.z = pz;
    this.clouds.material.opacity = 0.45 + daylight * 0.3;

    this._cloudOffset += dt * 0.0018;
    this.cloudTex.offset.set(this._cloudOffset, this._cloudOffset * 0.4);
    this.cloudTex.needsUpdate = true;
  }

  dispose() {
    [this.skyMesh, this.stars, this.sun, this.sunGlow, this.moon, this.clouds].forEach(obj => {
      this.scene.remove(obj);
      obj?.geometry?.dispose();
      obj?.material?.dispose();
    });
    this.cloudTex?.dispose();
  }
}
