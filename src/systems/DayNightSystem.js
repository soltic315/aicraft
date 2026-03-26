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

  update(elapsedSeconds) {
    const cycleRatio = (elapsedSeconds % DAY_NIGHT_CYCLE_SECONDS) / DAY_NIGHT_CYCLE_SECONDS;
    const sunAngle = cycleRatio * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const daylight = smoothstep(-0.22, 0.28, sunHeight);

    this.gc._tempSkyColor.copy(NIGHT_SKY_COLOR).lerp(DAY_SKY_COLOR, daylight);
    this.gc._tempFogColor.copy(NIGHT_FOG_COLOR).lerp(DAY_FOG_COLOR, daylight);
    this.gc._tempAmbientColor.copy(NIGHT_AMBIENT_COLOR).lerp(DAY_AMBIENT_COLOR, daylight);
    this.gc._tempSunColor.copy(NIGHT_MOON_COLOR).lerp(DAY_SUN_COLOR, daylight);

    this.gc.renderer.setClearColor(this.gc._tempSkyColor);
    this.gc.scene.fog.color.copy(this.gc._tempFogColor);
    this.gc.scene.fog.near = 35 + (daylight * 25);
    this.gc.scene.fog.far = 85 + (daylight * 40);

    this.gc.ambientLight.color.copy(this.gc._tempAmbientColor);
    this.gc.ambientLight.intensity = 0.3 + (daylight * 0.35);

    this.gc.dirLight.color.copy(this.gc._tempSunColor);
    this.gc.dirLight.intensity = 0.1 + (daylight * 0.65);
    this.gc.dirLight.position.set(
      Math.cos(sunAngle) * 90,
      18 + (sunHeight * 110),
      Math.sin(sunAngle) * 65,
    );

    return { cycleRatio, sunAngle, daylight, isDay: daylight >= 0.5 };
  }
}
