import { h } from 'preact';
import { useGameStore } from '../../stores/gameStore.js';

const HINTS = [
  { key: 'TAB', label: 'インベントリ',   event: 'toggle-inventory' },
  { key: 'C',   label: 'クラフト',       event: 'toggle-craft' },
  { key: 'M',   label: 'ミニマップ',     event: null },
  { key: 'P',   label: 'オプション',     event: 'toggle-settings' },
];

export function KeyHints() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  if (!gameStarted) return null;

  const handleClick = (event) => {
    window.__aicraft?.eventBus?.emit(event);
  };

  return (
    <div id="key-hints">
      {HINTS.map(({ key, label, event }) => (
        <div class="key-hint-row key-hint-clickable" key={key} onClick={() => handleClick(event)}>
          <span class="key-hint-key">{key}</span>
          <span class="key-hint-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
