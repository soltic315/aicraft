import { h } from 'preact';
import { useGameStore } from '../../stores/gameStore.js';

const HINTS = [
  { key: 'TAB', label: 'インベントリ' },
  { key: 'C', label: 'クラフト' },
  { key: 'Q', label: 'アイテムを1個捨てる' },
  { key: 'P', label: 'オプション' },
];

export function KeyHints() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  if (!gameStarted) return null;

  return (
    <div id="key-hints">
      {HINTS.map(({ key, label }) => (
        <div class="key-hint-row" key={key}>
          <span class="key-hint-key">{key}</span>
          <span class="key-hint-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
