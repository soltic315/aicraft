import { h } from 'preact';
import { useUIStore } from '../../stores/uiStore.js';

export function ResumeHint() {
  const visible = useUIStore((s) => s.resumeHintVisible);

  return (
    <div id="resume-hint" style={{ display: visible ? 'block' : 'none' }}>
      クリックしてゲームに戻る
    </div>
  );
}
