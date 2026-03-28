import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { useGameStore } from '../../stores/gameStore.js';
import { GAME_VERSION, DIFFICULTY, DIFFICULTY_SETTINGS } from '../../config.js';

// パーティクル（浮かぶブロック）のアニメーション用
function useParticles(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const COLORS = [
      '#5aad42', '#8b5e3c', '#888', '#a0733a', '#3d8a3d',
      '#e0d278', '#3355cc', '#c4a07a', '#ff9933', '#aad4ee',
      '#e87090', '#ffb8d0', '#c84020',
    ];

    const particles = Array.from({ length: 28 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight + window.innerHeight,
      size: 12 + Math.random() * 20,
      speed: 0.3 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 0.4,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 0.12 + Math.random() * 0.18,
    }));

    let raf;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.y -= p.speed;
        p.x += p.drift;
        p.rotation += p.rotSpeed;
        if (p.y < -50) {
          p.y = canvas.height + 50;
          p.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        // ブロックの上面ハイライト
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.3);
        ctx.restore();
      });

      raf = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
}

export function StartScreen() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  const [selectedDifficulty, setSelectedDifficulty] = useState(DIFFICULTY.NORMAL);
  const [showControls, setShowControls] = useState(false);
  const [startAnim, setStartAnim] = useState(false);
  const [isCreativeMode, setIsCreativeMode] = useState(false);
  const [seedInput, setSeedInput] = useState('');
  const [showSeedInput, setShowSeedInput] = useState(false);
  const canvasRef = useRef(null);

  useParticles(canvasRef);

  if (gameStarted) return null;

  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasSave = window.__aicraft?.hasSavedGame;

  const handleStart = (newGame = false) => {
    if (newGame && hasSave) {
      if (!confirm('セーブデータを削除して新しいゲームを始めますか？')) return;
      window.__aicraft?.eventBus?.emit('delete-save-clicked');
      setTimeout(() => _doStart(true), 100);
    } else {
      _doStart(false);
    }
  };

  const _doStart = (isNewGame = false) => {
    setStartAnim(true);
    setTimeout(() => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      const { eventBus } = window.__aicraft;
      useGameStore.getState().setDifficulty(selectedDifficulty);
      const parsedSeed = seedInput.trim() !== '' ? Number(seedInput.trim()) : null;
      const seed = parsedSeed != null && Number.isFinite(parsedSeed) ? Math.floor(parsedSeed) : null;
      eventBus.emit('start-clicked', {
        isNewGame,
        seed,
        isCreative: isNewGame ? isCreativeMode : undefined,
      });
    }, 400);
  };

  const diffColors = {
    [DIFFICULTY.EASY]:   { border: '#4caf50', bg: 'rgba(30, 80, 30, 0.55)', active: 'rgba(40, 110, 40, 0.75)', glow: '#4caf5055' },
    [DIFFICULTY.NORMAL]: { border: '#2196f3', bg: 'rgba(20, 40, 80, 0.55)', active: 'rgba(25, 60, 110, 0.75)', glow: '#2196f355' },
    [DIFFICULTY.HARD]:   { border: '#f44336', bg: 'rgba(80, 20, 20, 0.55)', active: 'rgba(110, 25, 25, 0.75)', glow: '#f4433655' },
  };

  return (
    <div id="start-screen" class={startAnim ? 'fade-out' : ''}>
      {/* パーティクルキャンバス */}
      <canvas ref={canvasRef} id="start-particles" />

      <div id="start-screen-inner">
        {/* タイトルロゴ */}
        <div id="title-container">
          <h1 id="game-title">
            <span class="title-ai">Ai</span>
            <span class="title-craft">Craft</span>
          </h1>
          <div id="game-version-badge">v{GAME_VERSION}</div>
          <p id="game-subtitle">マインクラフト風 ブラウザサンドボックス</p>
        </div>

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
                    borderColor: isActive ? col.border : 'rgba(255,255,255,0.18)',
                    background: isActive ? col.active : col.bg,
                    boxShadow: isActive ? `0 0 16px ${col.glow}, inset 0 1px 0 rgba(255,255,255,0.1)` : 'none',
                  }}
                  onClick={() => setSelectedDifficulty(diff)}
                >
                  <span class="diff-icon">{diff === DIFFICULTY.EASY ? '🌿' : diff === DIFFICULTY.NORMAL ? '⚔️' : '💀'}</span>
                  <span class="diff-label">{cfg.label}</span>
                  <span class="diff-desc">{cfg.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ゲームモード選択（新規ゲーム時） */}
        <div id="game-mode-section">
          <div id="game-mode-label">ゲームモード</div>
          <div id="game-mode-buttons">
            <button
              class={`mode-btn${!isCreativeMode ? ' active' : ''}`}
              onClick={() => setIsCreativeMode(false)}
            >
              <span class="mode-icon">⚔️</span>
              <span class="mode-name">サバイバル</span>
              <span class="mode-desc">資源収集・戦闘・生存</span>
            </button>
            <button
              class={`mode-btn${isCreativeMode ? ' active' : ''}`}
              onClick={() => setIsCreativeMode(true)}
            >
              <span class="mode-icon">✨</span>
              <span class="mode-name">クリエイティブ</span>
              <span class="mode-desc">飛行・即破壊・ダメージなし</span>
            </button>
          </div>
        </div>

        {/* シード入力（折り畳み） */}
        <div id="seed-section">
          <button
            id="seed-toggle"
            onClick={() => setShowSeedInput(!showSeedInput)}
          >
            {showSeedInput ? 'シード設定を閉じる ▲' : 'ワールドシードを指定 ▼'}
          </button>
          {showSeedInput && (
            <div id="seed-input-container">
              <input
                id="seed-input"
                type="number"
                placeholder="数値を入力（空白でランダム）"
                value={seedInput}
                onInput={(e) => setSeedInput(e.target.value)}
              />
              {seedInput.trim() !== '' && (
                <span id="seed-preview">シード: {Math.floor(Number(seedInput.trim()) || 0)}</span>
              )}
            </div>
          )}
        </div>

        {/* ゲーム開始ボタン */}
        <div id="start-buttons">
          {hasSave ? (
            <>
              <button class="start-btn primary-btn" onClick={() => handleStart(false)}>
                <span class="btn-icon">▶</span> 続きからプレイ
              </button>
              <button class="start-btn secondary-btn" onClick={() => handleStart(true)}>
                <span class="btn-icon">✦</span> 新しいゲームを開始
              </button>
            </>
          ) : (
            <button class="start-btn primary-btn" onClick={() => handleStart(true)}>
              <span class="btn-icon">▶</span> ゲーム開始
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
                <div class="controls-section-title">🚶 移動</div>
                <div class="ctrl-row"><span class="ctrl-key">WASD</span><span class="ctrl-desc">移動</span></div>
                <div class="ctrl-row"><span class="ctrl-key">Space</span><span class="ctrl-desc">ジャンプ</span></div>
                <div class="ctrl-row"><span class="ctrl-key">Ctrl</span><span class="ctrl-desc">ダッシュ</span></div>
                <div class="ctrl-row"><span class="ctrl-key">Shift</span><span class="ctrl-desc">スニーク</span></div>
                <div class="ctrl-row"><span class="ctrl-key">1〜9</span><span class="ctrl-desc">ホットバー選択</span></div>
                <div class="ctrl-row"><span class="ctrl-key">ホイール</span><span class="ctrl-desc">スロット切替</span></div>
              </div>
              <div class="controls-col">
                <div class="controls-section-title">⚔️ アクション</div>
                <div class="ctrl-row"><span class="ctrl-key">左クリック</span><span class="ctrl-desc">破壊 / 攻撃</span></div>
                <div class="ctrl-row"><span class="ctrl-key">右クリック</span><span class="ctrl-desc">設置 / 使用</span></div>
                <div class="ctrl-row"><span class="ctrl-key">F</span><span class="ctrl-desc">食事</span></div>
                <div class="ctrl-row"><span class="ctrl-key">E / I</span><span class="ctrl-desc">インベントリ</span></div>
                <div class="ctrl-row"><span class="ctrl-key">C</span><span class="ctrl-desc">クラフト</span></div>
                <div class="ctrl-row"><span class="ctrl-key">M</span><span class="ctrl-desc">ミニマップ切替</span></div>
                <div class="ctrl-row"><span class="ctrl-key">P / ESC</span><span class="ctrl-desc">設定</span></div>
                <div class="ctrl-row"><span class="ctrl-key">G</span><span class="ctrl-desc">クリエイティブ切替</span></div>
                <div class="ctrl-row"><span class="ctrl-key">Space×2</span><span class="ctrl-desc">飛行モード切替</span></div>
              </div>
            </div>
          </div>
        )}

        {isMobile && (
          <div id="mobile-warning">
            ⚠ このバージョンはモバイル操作に最適化されていません（PC 推奨）
          </div>
        )}

        {/* フッター */}
        <div id="start-footer">
          <span>100% AI生成ゲーム</span>
          <span>•</span>
          <span>Three.js + Preact</span>
        </div>
      </div>
    </div>
  );
}
