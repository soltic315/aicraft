import { h } from 'preact';
import { useUIStore } from '../../stores/uiStore.js';

const SECTIONS = [
  {
    title: '移動',
    rows: [
      { keys: ['W', 'A', 'S', 'D'], desc: '前後左右移動' },
      { keys: ['Space'], desc: 'ジャンプ / 水中浮上' },
      { keys: ['Shift'], desc: 'スニーク（低速移動・端から落ちない）' },
      { keys: ['Ctrl'], desc: 'ダッシュ（1.3倍速）' },
    ],
  },
  {
    title: 'アクション',
    rows: [
      { keys: ['左クリック'], desc: 'ブロック破壊 / モブ攻撃' },
      { keys: ['右クリック'], desc: 'ブロック設置 / 右クリックインタラクト' },
      { keys: ['1〜9'], desc: 'ホットバースロット選択' },
      { keys: ['スクロール'], desc: 'ホットバースロット切替' },
      { keys: ['Q'], desc: '持っているアイテムを捨てる' },
    ],
  },
  {
    title: 'メニュー',
    rows: [
      { keys: ['Tab'], desc: 'インベントリ開閉' },
      { keys: ['C'], desc: 'クラフトパネル開閉' },
      { keys: ['P'], desc: '設定パネル開閉' },
      { keys: ['H'], desc: 'このヘルプを開閉' },
    ],
  },
  {
    title: 'その他',
    rows: [
      { keys: ['G'], desc: 'クリエイティブ / サバイバル切替' },
      { keys: ['F11'], desc: 'フルスクリーン切替' },
      { keys: ['Esc'], desc: 'ポインターロック解除 / 一時停止' },
    ],
  },
];

export function HelpOverlay() {
  const helpOpen = useUIStore((s) => s.helpOpen);
  if (!helpOpen) return null;

  const close = () => useUIStore.getState().toggleHelp();

  return (
    <div id="help-overlay" onClick={close}>
      <div id="help-modal" onClick={(e) => e.stopPropagation()}>
        <div id="help-header">
          <span id="help-title">操作ガイド</span>
          <button id="help-close" onClick={close}>✕</button>
        </div>
        <div id="help-body">
          {SECTIONS.map((sec) => (
            <div class="help-section" key={sec.title}>
              <div class="help-section-title">{sec.title}</div>
              {sec.rows.map((row) => (
                <div class="help-row" key={row.desc}>
                  <div class="help-keys">
                    {row.keys.map((k) => (
                      <kbd class="help-kbd" key={k}>{k}</kbd>
                    ))}
                  </div>
                  <div class="help-desc">{row.desc}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
