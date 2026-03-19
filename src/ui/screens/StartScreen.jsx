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
      <div class="controls">
        WASD：移動　｜　スペース：ジャンプ　｜　Ctrl：ダッシュ　｜　Shift：スニーク<br />
        左クリック：ブロック破壊　｜　右クリック：ブロック設置<br />
        1-9/0：ブロック選択　｜　マウスホイール：ブロック切替<br />
        Z：ツルハシ　｜　X：斧　｜　V：シャベル<br />
        Tab：インベントリ・クラフト　｜　P：設定パネル　｜　E：チェストを開く<br />
        ESC：マウスロック解除　｜　ロック解除中に画面クリック：ゲーム復帰
      </div>
    </div>
  );
}
