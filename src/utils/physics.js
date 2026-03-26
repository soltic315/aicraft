// 物理系ユーティリティ関数
import { FALL_DAMAGE_SAFE_SPEED, FALL_DAMAGE_HEAVY_SPEED, FALL_DAMAGE_LIGHT_SCALE, FALL_DAMAGE_HEAVY_SCALE } from '../constants/survivalConstants.js';

export function calculateFallDamage(landingSpeed) {
  const speed = Math.abs(Number(landingSpeed) || 0);
  if (speed <= FALL_DAMAGE_SAFE_SPEED) return 0;

  const lightImpact = Math.min(speed, FALL_DAMAGE_HEAVY_SPEED) - FALL_DAMAGE_SAFE_SPEED;
  const heavyImpact = Math.max(0, speed - FALL_DAMAGE_HEAVY_SPEED);
  const damage = (lightImpact * FALL_DAMAGE_LIGHT_SCALE) + (heavyImpact * FALL_DAMAGE_HEAVY_SCALE);
  return Math.max(1, Math.ceil(damage));
}
