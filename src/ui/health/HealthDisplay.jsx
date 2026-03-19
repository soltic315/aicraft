import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { usePlayerStore } from '../../stores/playerStore.js';

export function HealthDisplay() {
  const fillRef = useRef(null);
  const valueRef = useRef(null);

  useEffect(() => {
    return usePlayerStore.subscribe((state) => {
      const { health, maxHealth } = state;
      const ratio = Math.max(0, Math.min(1, health / maxHealth));
      if (fillRef.current) {
        fillRef.current.style.width = `${Math.round(ratio * 100)}%`;
      }
      if (valueRef.current) {
        valueRef.current.textContent = `${Math.round(health)} / ${maxHealth}`;
      }
    });
  }, []);

  return (
    <div id="health-hud" aria-live="polite">
      HP <span id="health-value" ref={valueRef}>20 / 20</span>
      <div id="health-bar" aria-hidden="true">
        <div id="health-fill" ref={fillRef} />
      </div>
    </div>
  );
}
