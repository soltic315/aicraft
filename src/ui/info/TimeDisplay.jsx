import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { useGameStore } from '../../stores/gameStore.js';
import { useDayNightStore } from '../../stores/dayNightStore.js';

// ゲーム内時刻を右上に常時表示する
export function TimeDisplay() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  const elRef = useRef(null);

  useEffect(() => {
    if (!gameStarted) return;
    return useDayNightStore.subscribe((state) => {
      const el = elRef.current;
      if (!el) return;
      const { cycleRatio, isDay } = state;
      const hour = Math.floor(cycleRatio * 24);
      const min = Math.floor((cycleRatio * 24 - hour) * 60);
      const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const icon = isDay ? '☀' : '☽';
      el.textContent = `${icon} ${timeStr}`;
    });
  }, [gameStarted]);

  if (!gameStarted) return null;

  return <div id="time-display" ref={elRef} aria-hidden="true">☀ 06:00</div>;
}
