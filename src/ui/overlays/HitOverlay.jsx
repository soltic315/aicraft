import { h } from 'preact';
import { useUIStore } from '../../stores/uiStore.js';

/**
 * 被弾時に画面縁が赤くフラッシュするビネットオーバーレイ。
 * hitFlashCount がインクリメントされるたびに key が変わり、
 * Preact がコンポーネントを再マウントして CSS アニメーションが再実行される。
 */
export function HitOverlay() {
  const count = useUIStore((s) => s.hitFlashCount);
  if (count === 0) return null;
  return <div id="hit-overlay" key={count} />;
}
