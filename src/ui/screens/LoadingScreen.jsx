import { h } from 'preact';
import { useGameStore } from '../../stores/gameStore.js';

export function LoadingScreen() {
  const loading = useGameStore((s) => s.loading);
  const message = useGameStore((s) => s.loadingMessage);

  if (!loading) return null;

  return (
    <div id="loading-screen" style={{ display: 'flex' }}>
      <div class="loading-spinner" aria-hidden="true" />
      <p id="loading-text">{message || '読み込み中...'}</p>
    </div>
  );
}
