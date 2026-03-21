import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useXpStore } from '../../stores/xpStore.js';

export function XpDisplay() {
  const fillRef  = useRef(null);
  const labelRef = useRef(null);

  useEffect(() => {
    return useXpStore.subscribe((state) => {
      const { level, progress, xp } = state;
      if (fillRef.current) {
        fillRef.current.style.width = `${Math.round(progress * 100)}%`;
      }
      if (labelRef.current) {
        labelRef.current.textContent = `Lv.${level}  ${xp} XP`;
      }
    });
  }, []);

  return (
    <div id="xp-hud" aria-live="polite">
      <span id="xp-label" ref={labelRef}>Lv.1  0 XP</span>
      <div id="xp-bar">
        <div id="xp-fill" ref={fillRef} />
      </div>
    </div>
  );
}
