import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { useGameStore } from '../../stores/gameStore.js';

// ローディング中に表示するゲームプレイのヒント一覧
const LOADING_TIPS = [
  '木を素手で壊して木材を集めよう。まず作業台を作るのが基本！',
  'Ctrl キーを押しながら走るとダッシュできる。移動が速くなるよ',
  'ツルハシは石・鉱石の採掘に。斧は木材に。シャベルは土・砂に最適',
  'ダイヤモンドは深さ30以下に多く埋まっている。採掘して最強ツールを作ろう',
  'F キーで食料を食べられる。空腹になると自然回復しなくなるので注意',
  'クリーパーに近づきすぎると爆発する！距離を保って弓で攻撃しよう',
  '夜になるとゾンビやスケルトンが出現する。初日は安全な場所で過ごそう',
  'チェストは右クリックで開ける。大切なアイテムはチェストに保管しよう',
  '作業台（C）でツールや建材をクラフトできる。レシピを試してみよう',
  'かまどで生肉を焼くと回復量が大きい食料になる',
  'スニーク（Shift）中はブロックの端に立っても落下しない',
  '石炭は明かりを作るのに必須。洞窟探検前に松明を用意しよう',
  '水の中ではゆっくり沈む。Space キーで浮上できる',
  'バイオームによって生えている木の種類が違う。木材の見た目も変わるよ',
  'インベントリ（E）でアイテムを整理しよう。スロット数は27個',
];

export function LoadingScreen() {
  const loading = useGameStore((s) => s.loading);
  const message = useGameStore((s) => s.loadingMessage);
  const progress = useGameStore((s) => s.loadingProgress);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * LOADING_TIPS.length));
  const tipTimer = useRef(null);

  // 5秒ごとにヒントを切り替え
  useEffect(() => {
    if (!loading) return;
    tipTimer.current = setInterval(() => {
      setTipIndex(i => (i + 1) % LOADING_TIPS.length);
    }, 5000);
    return () => clearInterval(tipTimer.current);
  }, [loading]);

  if (!loading) return null;

  return (
    <div id="loading-screen" style={{ display: 'flex' }}>
      <div class="loading-logo">
        <span style={{ color: '#7cc8ff' }}>Ai</span>
        <span style={{ color: '#fff' }}>Craft</span>
      </div>

      <div class="loading-spinner" aria-hidden="true" />

      <p id="loading-text">{message || '読み込み中...'}</p>

      {/* 進捗バー */}
      <div class="loading-progress-bar-outer" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div
          class="loading-progress-bar-inner"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p class="loading-progress-pct">{progress}%</p>

      {/* ヒント */}
      <div class="loading-tip">
        <span class="loading-tip-label">ヒント</span>
        <span class="loading-tip-text">{LOADING_TIPS[tipIndex]}</span>
      </div>
    </div>
  );
}
