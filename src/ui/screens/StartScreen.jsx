import { h } from 'preact';
import { useGameStore } from '../../stores/gameStore.js';
import { GAME_VERSION } from '../../config.js';

export function StartScreen() {
  const gameStarted = useGameStore((s) => s.gameStarted);

  if (gameStarted) return null;

  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  return (
    <div id="start-screen">
      <h1 id="game-title">{`AiCraft v${GAME_VERSION}`}</h1>
      <p>Minecraft風ブラウザゲーム</p>
      <button
        class="start-btn"
        id="start-btn"
        onClick={() => {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
          const { eventBus } = window.__aicraft;
          eventBus.emit('start-clicked');
        }}
      >
        {window.__aicraft?.hasSavedGame ? '続きからプレイ' : 'ゲーム開始'}
      </button>
      {isMobile && (
        <div id="mobile-warning" style={{ display: 'block' }}>
          このバージョンはモバイル操作に最適化されていません（PC 推奨）
        </div>
      )}
    </div>
  );
}
