// 天候システム: 雨・雪パーティクル、霧・明暗変化
import * as THREE from 'three';

const RAIN_COUNT = 1200;
const SNOW_COUNT = 700;
const WEATHER_RADIUS = 28;   // プレイヤー周囲の降水範囲（半径）
const WEATHER_HEIGHT = 22;   // 降水の高さ幅

export class WeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.weather = 'clear';          // 'clear' | 'rain' | 'snow'
    this._timer = 0;
    this._nextChangeIn = 150 + Math.random() * 180; // 2.5〜5.5分で変化
    this._intensity = 0;             // 0..1 スムーズ補間
    this._targetIntensity = 0;

    this._createRainParticles();
    this._createSnowParticles();
  }

  // ---- 雨パーティクル（縦に伸びた細い線） ----
  _createRainParticles() {
    const positions = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * WEATHER_RADIUS * 2;
      positions[i * 3 + 1] = Math.random() * WEATHER_HEIGHT;
      positions[i * 3 + 2] = (Math.random() - 0.5) * WEATHER_RADIUS * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x99bbee,
      size: 0.06,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this._rainMesh = new THREE.Points(geo, mat);
    this._rainMesh.visible = false;
    this._rainMesh.renderOrder = 1;
    this.scene.add(this._rainMesh);
    this._rainPos = positions;
  }

  // ---- 雪パーティクル（白い大きめの点） ----
  _createSnowParticles() {
    const positions = new Float32Array(SNOW_COUNT * 3);
    const offsets = new Float32Array(SNOW_COUNT); // 揺れの位相
    for (let i = 0; i < SNOW_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * WEATHER_RADIUS * 2;
      positions[i * 3 + 1] = Math.random() * WEATHER_HEIGHT;
      positions[i * 3 + 2] = (Math.random() - 0.5) * WEATHER_RADIUS * 2;
      offsets[i] = Math.random() * Math.PI * 2;
    }
    this._snowOffsets = offsets;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xeef4ff,
      size: 0.18,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this._snowMesh = new THREE.Points(geo, mat);
    this._snowMesh.visible = false;
    this._snowMesh.renderOrder = 1;
    this.scene.add(this._snowMesh);
    this._snowPos = positions;
    this._snowTime = 0;
  }

  /**
   * フレーム更新
   * @param {number} dt - デルタタイム（秒）
   * @param {THREE.Vector3} playerPos - プレイヤー位置
   */
  update(dt, playerPos) {
    this._timer += dt;

    // 天候変化タイマー
    if (this._timer >= this._nextChangeIn) {
      this._timer = 0;
      this._nextChangeIn = 120 + Math.random() * 150;
      this._cycleWeather();
    }

    // 強度スムーズ補間（フェードイン/アウト）
    const speed = this._targetIntensity > this._intensity ? 0.4 : 0.6;
    this._intensity += (this._targetIntensity - this._intensity) * Math.min(1, speed * dt);

    const showing = this._intensity > 0.02;

    if (this.weather === 'rain' && showing) {
      this._updateRain(dt, playerPos);
      this._rainMesh.material.opacity = Math.min(0.75, this._intensity * 0.75);
      this._rainMesh.visible = true;
      this._snowMesh.visible = false;
    } else if (this.weather === 'snow' && showing) {
      this._updateSnow(dt, playerPos);
      this._snowMesh.material.opacity = Math.min(0.85, this._intensity * 0.85);
      this._snowMesh.visible = true;
      this._rainMesh.visible = false;
    } else {
      this._rainMesh.visible = false;
      this._snowMesh.visible = false;
    }
  }

  _updateRain(dt, playerPos) {
    const pos = this._rainPos;
    const fallSpeed = 18 * dt;
    const px = playerPos.x;
    const py = playerPos.y;
    const pz = playerPos.z;

    for (let i = 0; i < RAIN_COUNT; i++) {
      pos[i * 3 + 1] -= fallSpeed;
      // プレイヤーより下に落ちたら上に戻す
      if (pos[i * 3 + 1] < py - 3) {
        pos[i * 3]     = px + (Math.random() - 0.5) * WEATHER_RADIUS * 2;
        pos[i * 3 + 1] = py + WEATHER_HEIGHT * (0.4 + Math.random() * 0.6);
        pos[i * 3 + 2] = pz + (Math.random() - 0.5) * WEATHER_RADIUS * 2;
      }
    }
    this._rainMesh.geometry.attributes.position.needsUpdate = true;
    this._rainMesh.position.set(0, 0, 0);
  }

  _updateSnow(dt, playerPos) {
    const pos = this._snowPos;
    const fallSpeed = 1.8 * dt;
    const px = playerPos.x;
    const py = playerPos.y;
    const pz = playerPos.z;
    this._snowTime += dt;
    const t = this._snowTime;

    for (let i = 0; i < SNOW_COUNT; i++) {
      pos[i * 3 + 1] -= fallSpeed;
      // ふわふわ揺れ（横方向のサイン波）
      pos[i * 3]     += Math.sin(t * 0.8 + this._snowOffsets[i]) * 0.008;
      pos[i * 3 + 2] += Math.cos(t * 0.6 + this._snowOffsets[i]) * 0.006;

      if (pos[i * 3 + 1] < py - 3) {
        pos[i * 3]     = px + (Math.random() - 0.5) * WEATHER_RADIUS * 2;
        pos[i * 3 + 1] = py + WEATHER_HEIGHT * (0.4 + Math.random() * 0.6);
        pos[i * 3 + 2] = pz + (Math.random() - 0.5) * WEATHER_RADIUS * 2;
      }
    }
    this._snowMesh.geometry.attributes.position.needsUpdate = true;
    this._snowMesh.position.set(0, 0, 0);
  }

  /** 天候をランダムに次の状態へ遷移 */
  _cycleWeather() {
    if (this.weather === 'clear') {
      // 晴れ → 雨 60% / 雪 40%
      this.weather = Math.random() < 0.6 ? 'rain' : 'snow';
      this._targetIntensity = 1.0;
    } else {
      // 雨/雪 → 晴れ
      this.weather = 'clear';
      this._targetIntensity = 0;
    }
  }

  /**
   * 霧の近距離倍率を返す（雨天時に霧を濃くする）
   * @returns {number} 0.6〜1.0（1.0=変化なし）
   */
  getFogNearMultiplier() {
    if (this.weather === 'clear' || this._intensity < 0.02) return 1.0;
    return 1.0 - this._intensity * 0.35;
  }

  /**
   * 環境光の減衰量を返す（雨天時に暗くする）
   * @returns {number} 0..0.4
   */
  getDarknessAmount() {
    if (this.weather === 'clear' || this._intensity < 0.02) return 0;
    return this._intensity * 0.35;
  }

  /** 現在の天候と強度を返す */
  getState() {
    return { weather: this.weather, intensity: this._intensity };
  }

  /** 天候を強制セット（デバッグ・セーブデータ復元用） */
  forceWeather(type) {
    this.weather = type;
    this._targetIntensity = type === 'clear' ? 0 : 1.0;
    this._intensity = this._targetIntensity;
    this._timer = 0;
  }

  dispose() {
    if (this._rainMesh) {
      this.scene.remove(this._rainMesh);
      this._rainMesh.geometry.dispose();
      this._rainMesh.material.dispose();
    }
    if (this._snowMesh) {
      this.scene.remove(this._snowMesh);
      this._snowMesh.geometry.dispose();
      this._snowMesh.material.dispose();
    }
  }
}
