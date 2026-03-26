// 数学ユーティリティ関数

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
