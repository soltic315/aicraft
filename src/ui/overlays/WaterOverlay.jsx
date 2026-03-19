import { h } from 'preact';
import { useUIStore } from '../../stores/uiStore.js';

export function WaterOverlay() {
  const visible = useUIStore((s) => s.waterOverlay);

  return <div id="water-overlay" style={{ display: visible ? 'block' : 'none' }} />;
}
