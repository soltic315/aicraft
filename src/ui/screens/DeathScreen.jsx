import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useGameStore } from '../../stores/gameStore.js';

export function DeathScreen() {
  const isDead = useGameStore((s) => s.isDead);
  const [visible, setVisible] = useState(false);
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (isDead) {
      // 死亡演出: 少し遅れてフェードイン
      const t = setTimeout(() => setVisible(true), 200);
      // パーティクル生成
      setParticles(Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: 30 + Math.random() * 40,
        y: 20 + Math.random() * 60,
        size: 4 + Math.random() * 8,
        drift: (Math.random() - 0.5) * 2,
        speed: 0.5 + Math.random() * 1.5,
        opacity: 0.6 + Math.random() * 0.4,
      })));
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      setParticles([]);
    }
  }, [isDead]);

  if (!isDead) return null;

  return (
    <div id="death-screen" class={visible ? 'death-visible' : ''}>
      {/* 血のパーティクル */}
      <div id="death-particles" aria-hidden="true">
        {particles.map(p => (
          <div
            key={p.id}
            class="death-particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              animationDuration: `${2 + Math.random()}s`,
              animationDelay: `${Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>

      <div id="death-content">
        <div id="death-skull">💀</div>
        <h1 id="death-title">You Died</h1>
        <p id="death-message">力尽きました...</p>

        <div id="death-tips">
          <p class="death-tip">💡 {getRandomDeathTip()}</p>
        </div>

        <div id="death-buttons">
          <button
            class="respawn-btn primary-respawn"
            onClick={() => {
              const { eventBus } = window.__aicraft;
              eventBus.emit('respawn-clicked');
            }}
          >
            ♻ リスポーン
          </button>
          <button
            class="respawn-btn secondary-respawn"
            onClick={() => {
              const { eventBus } = window.__aicraft;
              eventBus.emit('title-clicked');
            }}
          >
            🏠 タイトルへ
          </button>
        </div>
      </div>
    </div>
  );
}

const DEATH_TIPS = [
  '防具を装備するとダメージを軽減できます',
  '夜は危険！初日のうちに家を作りましょう',
  'クリーパーには近づかないように！爆発します',
  '空腹になると自然回復しなくなります',
  'ダイヤの防具が最強の守りを提供します',
  '弓矢があれば遠距離から安全に戦えます',
  '溶岩には注意！装備ごと失います',
  'スニーク(Shift)でブロックの端から落ちません',
];

function getRandomDeathTip() {
  return DEATH_TIPS[Math.floor(Math.random() * DEATH_TIPS.length)];
}
