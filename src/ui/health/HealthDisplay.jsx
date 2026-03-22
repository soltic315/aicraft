import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { usePlayerStore } from '../../stores/playerStore.js';

export function HealthDisplay() {
  const fillRef  = useRef(null);
  const valueRef = useRef(null);
  const rowRef   = useRef(null);
  const prevHpRef = useRef(20);

  useEffect(() => {
    return usePlayerStore.subscribe((state) => {
      const { health, maxHealth } = state;
      const ratio = Math.max(0, Math.min(1, health / maxHealth));

      if (fillRef.current) {
        fillRef.current.style.width = `${Math.round(ratio * 100)}%`;
        // HP が低いと色を変える
        fillRef.current.style.background = health <= maxHealth * 0.25
          ? 'linear-gradient(90deg, #991010, #cc2020)'
          : 'linear-gradient(90deg, #cc3030, #ff5555)';
      }
      if (valueRef.current) {
        valueRef.current.textContent = `${Math.max(0, Math.round(health))} / ${maxHealth}`;
      }

      // ダメージフラッシュ
      if (health < prevHpRef.current && rowRef.current) {
        rowRef.current.classList.add('stat-damaged');
        setTimeout(() => rowRef.current?.classList.remove('stat-damaged'), 300);
      }
      prevHpRef.current = health;
    });
  }, []);

  return (
    <div class="stat-bar-row" id="health-row" ref={rowRef} aria-live="polite">
      <div class="stat-bar-header">
        <span class="stat-label stat-label-hp">HP</span>
        <span class="stat-value" ref={valueRef}>20 / 20</span>
      </div>
      <div class="stat-bar">
        <div class="stat-fill stat-fill-hp" ref={fillRef} />
      </div>
    </div>
  );
}
