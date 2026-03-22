import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { useHungerStore } from '../../stores/hungerStore.js';

export function HungerDisplay() {
  const fillRef  = useRef(null);
  const valueRef = useRef(null);

  useEffect(() => {
    return useHungerStore.subscribe((state) => {
      const { hunger, maxHunger } = state;
      const ratio = Math.max(0, Math.min(1, hunger / maxHunger));
      if (fillRef.current) {
        fillRef.current.style.width = `${Math.round(ratio * 100)}%`;
        fillRef.current.style.background = hunger <= 6
          ? 'linear-gradient(90deg, #c07020, #e09040)'
          : 'linear-gradient(90deg, #d4a830, #f0c858)';
      }
      if (valueRef.current) {
        valueRef.current.textContent = `${Math.floor(hunger)} / ${maxHunger}`;
      }
    });
  }, []);

  return (
    <div class="stat-bar-row" aria-live="polite">
      <div class="stat-bar-header">
        <span class="stat-label stat-label-hunger">空腹</span>
        <span class="stat-value" ref={valueRef}>20 / 20</span>
      </div>
      <div class="stat-bar">
        <div class="stat-fill stat-fill-hunger" ref={fillRef} />
      </div>
    </div>
  );
}
