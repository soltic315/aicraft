import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useGameStore } from '../../stores/gameStore.js';
import { GAME_VERSION, DIFFICULTY, DIFFICULTY_SETTINGS } from '../../config.js';

export function StartScreen() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  const [selectedDifficulty, setSelectedDifficulty] = useState(DIFFICULTY.NORMAL);
  const [showControls, setShowControls] = useState(false);

  if (gameStarted) return null;

  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasSave = window.__aicraft?.hasSavedGame;

  const handleStart = (newGame = false) => {
    if (newGame && hasSave) {
      if (!confirm('セーブデータを削除して新しいゲームを始めますか？')) return;
      window.__aicraft?.eventBus?.emit('delete-save-clicked');
      setTimeout(() => _doStart(), 100);
    } else {
      _doStart();
    }
  };

  const _doStart = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    const { eventBus } = window.__aicraft;
    useGameStore.getState().setDifficulty(selectedDifficulty);
    eventBus.emit('start-clicked');
  };

  const diffColors = {
    [DIFFICULTY.EASY]:   { border: '#4caf50', bg: 'rgba(30, 80, 30, 0.5)', active: 'rgba(40, 110, 40, 0.7)' },
    [DIFFICULTY.NORMAL]: { border: '#2196f3', bg: 'rgba(20, 40, 80, 0.5)', active: 'rgba(25, 60, 110, 0.7)' },
    [DIFFICULTY.HARD]:   { border: '#f44336', bg: 'rgba(80, 20, 20, 0.5)', active: 'rgba(110, 25, 25, 0.7)' },
  };

  return (
    <div id="start-screen">
      <div id="start-screen-inner">
        {/* タイトル */}
        <h1 id="game-title">
          <span style={{ color: '#7cc8ff' }}>Ai</span>
          <span style={{ color: '#fff' }}>Craft</span>
          <span id="game-version">v{GAME_VERSION}</span>
        </h1>
        <p id="game-subtitle">マインクラフト風ブラウザサンドボックスゲーム</p>

        {/* 難易度選択 */}
        <div id="difficulty-section">
          <div id="difficulty-label">難易度を選択</div>
          <div id="difficulty-buttons">
            {Object.values(DIFFICULTY).map((diff) => {
              const cfg = DIFFICULTY_SETTINGS[diff];
              const col = diffColors[diff];
              const isActive = selectedDifficulty === diff;
              return (
                <button
                  key={diff}
                  class={`difficulty-btn${isActive ? ' active' : ''}`}
                  style={{
                    borderColor: isActive ? col.border : 'rgba(255,255,255,0.2)',
                    background: isActive ? col.active : col.bg,
                  }}
                  onClick={() => setSelectedDifficulty(diff)}
                >
                  <span class="diff-label">{cfg.label}</span>
                  <span class="diff-desc">{cfg.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ゲーム開始ボタン */}
        <div id="start-buttons">
          {hasSave ? (
            <>
              <button class="start-btn primary-btn" onClick={() => handleStart(false)}>
                続きからプレイ
              </button>
              <button class="start-btn secondary-btn" onClick={() => handleStart(true)}>
                新しいゲームを開始
              </button>
            </>
          ) : (
            <button class="start-btn primary-btn" onClick={() => handleStart(false)}>
              ゲーム開始
            </button>
          )}
        </div>

        {/* コントロール表示トグル */}
        <button
          id="controls-toggle"
          onClick={() => setShowControls(!showControls)}
        >
          {showControls ? '操作ガイドを閉じる ▲' : '操作ガイドを見る ▼'}
        </button>

        {showControls && (
          <div id="controls-guide">
            <div class="controls-grid">
              <div class="controls-col">
                <div class="controls-section-title">基本操作</div>
                <div class="ctrl-row"><span class="ctrl-key">WASD</span><span class="ctrl-desc">移動</span></div>
                <div class="ctrl-row"><span class="ctrl-key">Space</span><span class="ctrl-desc">ジャンプ</span></div>
                <div class="ctrl-row"><span class="ctrl-key">Ctrl</span><span class="ctrl-desc">ダッシュ</span></div>
                <div class="ctrl-row"><span class="ctrl-key">Shift</span><span class="ctrl-desc">スニーク</span></div>
                <div class="ctrl-row"><span class="ctrl-key">1〜9</span><span class="ctrl-desc">ホットバー選択</span></div>
                <div class="ctrl-row"><span class="ctrl-key">ホイール</span><span class="ctrl-desc">スロット切替</span></div>
              </div>
              <div class="controls-col">
                <div class="controls-section-title">アクション</div>
                <div class="ctrl-row"><span class="ctrl-key">左クリック</span><span class="ctrl-desc">破壊 / 攻撃</span></div>
                <div class="ctrl-row"><span class="ctrl-key">右クリック</span><span class="ctrl-desc">設置 / 使用</span></div>
                <div class="ctrl-row"><span class="ctrl-key">F</span><span class="ctrl-desc">食事</span></div>
                <div class="ctrl-row"><span class="ctrl-key">E</span><span class="ctrl-desc">インベントリ</span></div>
                <div class="ctrl-row"><span class="ctrl-key">C</span><span class="ctrl-desc">クラフト</span></div>
                <div class="ctrl-row"><span class="ctrl-key">P / ESC</span><span class="ctrl-desc">設定</span></div>
              </div>
            </div>
          </div>
        )}

        {isMobile && (
          <div id="mobile-warning">
            このバージョンはモバイル操作に最適化されていません（PC 推奨）
          </div>
        )}
      </div>
    </div>
  );
}
