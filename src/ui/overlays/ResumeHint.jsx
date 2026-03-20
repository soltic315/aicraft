import { h } from 'preact';
import { useUIStore } from '../../stores/uiStore.js';

export function ResumeHint() {
  const visible = useUIStore((s) => s.resumeHintVisible);

  if (!visible) return null;

  const handleResume = () => {
    const { eventBus } = window.__aicraft;
    eventBus.emit('resume-game');
  };

  return (
    <div id="resume-hint">
      <p id="resume-hint-label">一時停止中</p>
      <button id="resume-btn" onClick={handleResume}>ゲーム再開</button>
    </div>
  );
}
