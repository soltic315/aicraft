import { h } from 'preact';
import { useGameStore } from '../../stores/gameStore.js';

const BUTTONS = [
  { icon: '🎒', label: 'インベントリ', key: 'TAB', event: 'toggle-inventory' },
  { icon: '🔨', label: 'クラフト',     key: 'C',   event: 'toggle-craft' },
  { icon: '⚙',  label: 'オプション',  key: 'P',   event: 'toggle-settings' },
  { icon: '❓', label: 'ヘルプ',       key: 'H',   event: 'toggle-help' },
];

export function KeyHints() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  if (!gameStarted) return null;

  return (
    <div id="key-hints">
      {BUTTONS.map(({ icon, label, key, event }) => (
        <button
          class="key-hint-btn"
          key={key}
          onClick={() => window.__aicraft?.eventBus?.emit(event)}
        >
          <span class="key-hint-icon">{icon}</span>
          <span class="key-hint-label">{label}</span>
          <span class="key-hint-key">{key}</span>
        </button>
      ))}
    </div>
  );
}
