import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { useHungerStore } from '../../stores/hungerStore.js';

export function HungerDisplay() {
  const fillRef = useRef(null);
  const valueRef = useRef(null);

  useEffect(() => {
    return useHungerStore.subscribe((state) => {
      const { hunger, maxHunger } = state;
      const ratio = Math.max(0, Math.min(1, hunger / maxHunger));
      if (fillRef.current) {
        fillRef.current.style.width = `${Math.round(ratio * 100)}%`;
        // 空腹度が低いと色を変える
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
    <div id="hunger-hud" aria-live="polite">
      空腹 <span id="hunger-value" ref={valueRef}>20 / 20</span>
      <div id="hunger-bar" aria-hidden="true">
        <div id="hunger-fill" ref={fillRef} />
      </div>
    </div>
  );
}
