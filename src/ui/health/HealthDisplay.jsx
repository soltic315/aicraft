import { h } from 'preact';
import { useRef, useEffect, useState } from 'preact/hooks';
import { usePlayerStore } from '../../stores/playerStore.js';

const TOTAL_HEARTS = 10; // 10ハート = 最大20HP

export function HealthDisplay() {
  const [health, setHealth] = useState(20);
  const [maxHealth, setMaxHealth] = useState(20);
  const [damaged, setDamaged] = useState(false);
  const prevHealthRef = useRef(20);

  useEffect(() => {
    return usePlayerStore.subscribe((state) => {
      const { health: h, maxHealth: mh } = state;
      // ダメージを受けたときのフラッシュエフェクト
      if (h < prevHealthRef.current) {
        setDamaged(true);
        setTimeout(() => setDamaged(false), 300);
      }
      prevHealthRef.current = h;
      setHealth(h);
      setMaxHealth(mh);
    });
  }, []);

  const hearts = [];
  const hpPerHeart = maxHealth / TOTAL_HEARTS;

  for (let i = 0; i < TOTAL_HEARTS; i++) {
    const threshold = (i + 1) * hpPerHeart;
    const halfThreshold = i * hpPerHeart + hpPerHeart / 2;

    let fill = 'empty';
    if (health >= threshold) {
      fill = 'full';
    } else if (health > halfThreshold) {
      fill = 'half';
    }

    // HP が低い場合は点滅
    const isLow = health <= maxHealth * 0.25;

    hearts.push(
      <span
        key={i}
        class={`heart-icon heart-${fill}${isLow && fill !== 'empty' ? ' heart-low' : ''}`}
        aria-hidden="true"
      >
        {fill === 'full'  ? '❤' :
         fill === 'half'  ? '💔' : '🖤'}
      </span>
    );
  }

  return (
    <div id="health-hud" class={damaged ? 'health-damaged' : ''} aria-live="polite">
      <div id="health-header">
        <span id="health-label">HP</span>
        <span id="health-value">{Math.max(0, Math.round(health))} / {maxHealth}</span>
      </div>
      <div id="health-hearts" aria-label={`体力 ${Math.round(health)} / ${maxHealth}`}>
        {hearts}
      </div>
    </div>
  );
}
