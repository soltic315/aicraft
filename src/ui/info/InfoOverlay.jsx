import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { useGameStore } from '../../stores/gameStore.js';
import { useDayNightStore } from '../../stores/dayNightStore.js';
import { usePlayerStore } from '../../stores/playerStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';

export function InfoOverlay() {
  const elRef = useRef(null);
  const showDebugInfo = useSettingsStore((s) => s.showDebugInfo);

  useEffect(() => {
    const update = () => {
      const el = elRef.current;
      if (!el) return;

      const { fps } = useGameStore.getState();
      const { cycleRatio, isDay } = useDayNightStore.getState();
      const { position } = usePlayerStore.getState();

      el.innerHTML =
        `FPS: ${fps}<br>` +
        `時刻: ${isDay ? '昼' : '夜'} (${Math.floor(cycleRatio * 24).toString().padStart(2, '0')}:00)<br>` +
        `座標: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`;
    };

    const unsubs = [
      useGameStore.subscribe(update),
      useDayNightStore.subscribe(update),
      usePlayerStore.subscribe(update),
    ];

    update();
    return () => unsubs.forEach((u) => u());
  }, []);

  if (!showDebugInfo) return null;
  return <div id="info" ref={elRef} />;
}
