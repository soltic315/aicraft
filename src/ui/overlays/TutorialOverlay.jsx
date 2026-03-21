import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { useGameStore } from '../../stores/gameStore.js';

const TUTORIAL_KEY = 'aicraft_tutorial_done_v1';

// チュートリアルステップ定義
const STEPS = [
  {
    id: 'welcome',
    icon: '🎮',
    title: 'AiCraftへようこそ！',
    text: 'このチュートリアルで基本操作を学びましょう。',
    hint: 'マウスクリックでポインターロックを取得',
    action: null,
  },
  {
    id: 'move',
    icon: '🚶',
    title: '移動',
    text: 'W・A・S・D キーで移動、マウスで視点を変えられます。',
    hint: 'Ctrl で走る / Shift で忍び足',
    keys: ['W', 'A', 'S', 'D'],
    action: null,
  },
  {
    id: 'jump',
    icon: '🦘',
    title: 'ジャンプ',
    text: 'Space キーでジャンプできます。地面にいるときだけ有効です。',
    hint: '水中では Space で浮上できます',
    keys: ['Space'],
    action: null,
  },
  {
    id: 'break',
    icon: '⛏️',
    title: 'ブロック破壊',
    text: 'ブロックを左クリックし続けて破壊しましょう。\nまずは木を探して壊してみよう！',
    hint: 'ツールがあると破壊が速くなります',
    action: null,
  },
  {
    id: 'place',
    icon: '🧱',
    title: 'ブロック設置',
    text: '右クリックでブロックを設置できます。\nホットバーにアイテムを持った状態で右クリックしよう。',
    hint: 'ホットバーは1〜9キーで切り替え',
    action: null,
  },
  {
    id: 'inventory',
    icon: '🎒',
    title: 'インベントリ',
    text: 'E キーでインベントリを開けます。\nアイテムを整理したりクラフトにアクセスできます。',
    hint: 'I キーでもインベントリを開けます',
    keys: ['E'],
    action: null,
  },
  {
    id: 'craft',
    icon: '🔨',
    title: 'クラフト',
    text: '木材を4個集めて、作業台を作りましょう！\n作業台から多くのアイテムをクラフトできます。',
    hint: 'C キーでクラフトパネルを開く（作業台が必要）',
    action: null,
  },
  {
    id: 'complete',
    icon: '🌟',
    title: 'チュートリアル完了！',
    text: 'お疲れ様でした！あとは自由に探索しましょう。\nヒント: F キーで食事、P/ESC で設定を開けます。',
    hint: 'このヒントは再度表示されません',
    action: null,
  },
];

export function TutorialOverlay() {
  const gameStarted = useGameStore(s => s.gameStarted);
  const isDead = useGameStore(s => s.isDead);
  const [stepIdx, setStepIdx] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!gameStarted) return;
    const done = localStorage.getItem(TUTORIAL_KEY);
    if (!done) {
      setVisible(true);
      setStepIdx(0);
    }
  }, [gameStarted]);

  const next = useCallback(() => {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(s => s + 1);
    } else {
      localStorage.setItem(TUTORIAL_KEY, '1');
      setVisible(false);
    }
  }, [stepIdx]);

  const skip = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    setVisible(false);
  }, []);

  if (!gameStarted || isDead || !visible) return null;

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;
  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  return (
    <div id="tutorial-overlay">
      {/* 進捗バー */}
      <div id="tutorial-progress-bar">
        <div id="tutorial-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div id="tutorial-card">
        <div id="tutorial-icon">{step.icon}</div>
        <div id="tutorial-content">
          <h3 id="tutorial-title">{step.title}</h3>
          <p id="tutorial-text">{step.text}</p>

          {step.keys && (
            <div id="tutorial-keys">
              {step.keys.map(k => (
                <span key={k} class="tutorial-key">{k}</span>
              ))}
            </div>
          )}

          {step.hint && (
            <div id="tutorial-hint">💡 {step.hint}</div>
          )}
        </div>

        <div id="tutorial-actions">
          <div id="tutorial-step-count">{stepIdx + 1} / {STEPS.length}</div>
          <div id="tutorial-buttons">
            <button id="tutorial-skip-btn" onClick={skip}>スキップ</button>
            <button id="tutorial-next-btn" onClick={next}>
              {isLast ? '完了 ✓' : '次へ →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
