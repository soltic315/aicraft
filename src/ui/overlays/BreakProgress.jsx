import { h } from 'preact';
import { useBreakStore } from '../../stores/breakStore.js';

export function BreakProgress() {
  const active = useBreakStore((s) => s.active);
  const progress = useBreakStore((s) => s.progress);

  return (
    <div id="break-progress" aria-hidden="true" style={{ display: active ? 'block' : 'none' }}>
      <div id="break-progress-fill" style={{ width: `${Math.floor(progress * 100)}%` }} />
    </div>
  );
}
