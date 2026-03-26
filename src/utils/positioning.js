// 座標キー変換ユーティリティ

export function getPosKey(x, y, z) {
  return `${x},${y},${z}`;
}

export function parsePosKey(key) {
  const [x, y, z] = key.split(',').map(Number);
  return { x, y, z };
}
