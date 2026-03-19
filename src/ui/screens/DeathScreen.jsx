import { h } from 'preact';
import { useGameStore } from '../../stores/gameStore.js';

export function DeathScreen() {
  const isDead = useGameStore((s) => s.isDead);
  if (!isDead) return null;

  return (
    <div id="death-screen">
      <h1 id="death-title">You Died</h1>
      <p id="death-message">力尽きました...</p>
      <button
        class="respawn-btn"
        onClick={() => {
          const { eventBus } = window.__aicraft;
          eventBus.emit('respawn-clicked');
        }}
      >
        リスポーン
      </button>
    </div>
  );
}
