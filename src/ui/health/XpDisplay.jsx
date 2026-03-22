import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useXpStore } from '../../stores/xpStore.js';

export function XpDisplay() {
  const fillRef  = useRef(null);
  const levelRef = useRef(null);
  const xpRef    = useRef(null);

  useEffect(() => {
    return useXpStore.subscribe((state) => {
      const { level, progress, xp } = state;
      if (fillRef.current)  fillRef.current.style.width = `${Math.round(progress * 100)}%`;
      if (levelRef.current) levelRef.current.textContent = `Lv.${level}`;
      if (xpRef.current)    xpRef.current.textContent = `${xp} XP`;
    });
  }, []);

  return (
    <div class="stat-bar-row" aria-live="polite">
      <div class="stat-bar-header">
        <span class="stat-label stat-label-xp" ref={levelRef}>Lv.1</span>
        <span class="stat-value" ref={xpRef}>0 XP</span>
      </div>
      <div class="stat-bar">
        <div class="stat-fill stat-fill-xp" ref={fillRef} />
      </div>
    </div>
  );
}
