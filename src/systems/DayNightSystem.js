// 昼夜サイクルシステム: 空・霧・ライトの色と強度を時間に応じて更新
import {
  DAY_NIGHT_CYCLE_SECONDS,
  DAY_SKY_COLOR,
  NIGHT_SKY_COLOR,
  DAY_FOG_COLOR,
  NIGHT_FOG_COLOR,
  DAY_AMBIENT_COLOR,
  NIGHT_AMBIENT_COLOR,
  DAY_SUN_COLOR,
  NIGHT_MOON_COLOR,
  smoothstep,
} from '../config.js';

export class DayNightSystem {
  constructor(gc) {
    this.gc = gc;
  }

  /**
   * @param {number} elapsedSeconds - サイクル開始からの秒数
   * @param {number} [weatherDarkness=0] - 天候による暗化量 0..0.4（WeatherSystem から渡す）
   * @param {number} [fogNearMult=1.0] - 天候による霧近距離倍率（WeatherSystem から渡す）
   */
  update(elapsedSeconds, weatherDarkness = 0, fogNearMult = 1.0) {
    const cycleRatio = (elapsedSeconds % DAY_NIGHT_CYCLE_SECONDS) / DAY_NIGHT_CYCLE_SECONDS;
    const sunAngle = cycleRatio * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const daylight = smoothstep(-0.22, 0.28, sunHeight);

    // 天候暗化: 昼の明るさを雨・雪で減衰させる
    const effectiveDaylight = daylight * (1 - weatherDarkness * 0.7);

    this.gc._tempSkyColor.copy(NIGHT_SKY_COLOR).lerp(DAY_SKY_COLOR, effectiveDaylight);
    this.gc._tempFogColor.copy(NIGHT_FOG_COLOR).lerp(DAY_FOG_COLOR, effectiveDaylight);
    this.gc._tempAmbientColor.copy(NIGHT_AMBIENT_COLOR).lerp(DAY_AMBIENT_COLOR, effectiveDaylight);
    this.gc._tempSunColor.copy(NIGHT_MOON_COLOR).lerp(DAY_SUN_COLOR, effectiveDaylight);

    this.gc.renderer.setClearColor(this.gc._tempSkyColor);
    this.gc.scene.fog.color.copy(this.gc._tempFogColor);
    // 雨・雪は霧を濃くする（nearを短く、farを短く）
    const baseFogNear = 35 + (daylight * 25);
    const baseFogFar  = 85 + (daylight * 40);
    this.gc.scene.fog.near = baseFogNear * fogNearMult;
    this.gc.scene.fog.far  = baseFogFar  * fogNearMult;

    this.gc.ambientLight.color.copy(this.gc._tempAmbientColor);
    this.gc.ambientLight.intensity = 0.3 + (effectiveDaylight * 0.35);

    this.gc.dirLight.color.copy(this.gc._tempSunColor);
    this.gc.dirLight.intensity = 0.1 + (effectiveDaylight * 0.65);
    this.gc.dirLight.position.set(
      Math.cos(sunAngle) * 90,
      18 + (sunHeight * 110),
      Math.sin(sunAngle) * 65,
    );

    return { cycleRatio, sunAngle, daylight, isDay: daylight >= 0.5 };
  }
}
